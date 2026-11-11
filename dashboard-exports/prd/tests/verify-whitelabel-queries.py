"""Test exported PromQL with real Prometheus, reset counters and range changes."""
import json
from pathlib import Path
import subprocess
import tempfile

IMAGE = "prom/prometheus:v3.5.0@sha256:63805ebb8d2b3920190daf1cb14a60871b16fd38bed42b857a3182bc621f4996"
dashboard = json.loads((Path(__file__).parents[1] / "prd-whitelabel-lb-requests.json").read_text())
queries = {tile["id"]: tile["config"]["promqlExpression"]
           for tile in dashboard["tiles"] if tile["config"].get("configType") == "promql"}


def expression(id, seconds=864000, status=".*", host=".*"):
    return (queries[id].replace("${status:regex}", status).replace("${host:regex}", host)
            .replace("$__range_s", str(seconds)).replace("$__range", f"{seconds}s"))


base = ('cluster="live-us-central1-cluster",namespace="default",container="auto-ssl-backend",'
        'lb="a8c356da9198a4d53abc2169e8dadea9"')
inputs = []
for instance, status, host, values in [
    ("pod-a", "2xx", "whitelabel.gohighlevel.com", "0+180x2400 180+180x2399"),
    ("pod-b", "5xx", "__other_hosts__", "0+360x4800"),
]:
    labels = base + f',instance="{instance}",status_class="{status}"'
    inputs.append(dict(series="nginx_lb_http_requests_total{" + labels + "}", values=values))
    inputs.append(dict(series="nginx_lb_http_requests_by_host_total{" + labels + f',host="{host}"' + "}", values=values))
    inputs.append(dict(series="nginx_lb_request_metrics_enabled{" + base + f',instance="{instance}"' + "}", values="1+0x4800"))

checks = []


def check(query, value):
    checks.append(dict(expr=query, eval_time="10d", exp_samples=[] if value is None else [dict(labels="{}", value=value)]))


for seconds in (864000, 86400, 43200):
    check(expression("total", seconds), 3 * seconds)
    check(expression("daily", seconds), 259200)
    check(expression("average-rps", seconds), 3)
check(expression("total", status="5xx"), 1728000)
check(expression("host-total", host="whitelabel\\.gohighlevel\\.com".replace("\\", "\\\\")), 864000)
check(expression("host-daily", host="whitelabel\\.gohighlevel\\.com".replace("\\", "\\\\")), 86400)
check(expression("overflow"), 1728000)
check(expression("enabled"), 2)
check(expression("rps"), 3)
check(expression("host-total", host="unseen.example"), None)

with tempfile.TemporaryDirectory(prefix="whitelabel-promql-") as directory:
    path = Path(directory)
    # Parse every exported expression, including chart-only expressions.
    rules = dict(groups=[dict(name="dashboard", rules=[dict(record="test:" + id.replace("-", "_"), expr=expression(id)) for id in queries])])
    (path / "rules.json").write_text(json.dumps(rules))
    # Three-minute samples keep the 10-day fixture below promtool's sample cap.
    (path / "tests.json").write_text(json.dumps(dict(evaluation_interval="3m", tests=[dict(interval="3m", input_series=inputs, promql_expr_test=checks)])))
    command = ["docker", "run", "--rm", "--network", "none", "--entrypoint", "/bin/promtool", "-v", f"{path}:/tests:ro", IMAGE]
    subprocess.run(command + ["check", "rules", "/tests/rules.json"], check=True)
    subprocess.run(command + ["test", "rules", "/tests/tests.json"], check=True)
print("PASS: all expressions parse; 10-day/1-day/12-hour averages; per-target reset; status/host filters; overflow; missing data stays absent")
