import { SampleLog } from './LogSummaryRow';

const events: Record<string, unknown>[] = [
  {
    deployment_name: 'ai-wrapper-api',
    container_name: 'api',
    node_name: 'gke-stg-workload-pool-node-01',
    log_level: 'info',
    log: {
      message: '/ai-wrapper/plan/company/demo-company · Plan retrieved in 42ms',
      msg: 'lower priority message',
      trace_id: 'demo-trace-001',
    },
    httpRequest: {
      requestMethod: 'GET',
      status: 200,
      userAgent: 'Chrome 138.0',
    },
    pod_name: 'ai-wrapper-api-6c4f8d9f6c-vh7dx',
    namespace_name: 'default',
  },
  {
    deployment_name: 'ai-wrapper-api',
    container_name: 'api',
    host: 'gke-stg-workload-pool-node-02',
    log_level: 'info',
    log: '{"msg":"WALLET_FUND_COMPANY_demo-company hasFunds=true","request_id":"demo-request-002"}',
    httpRequest: {
      requestMethod: 'GET',
      status: 200,
      userAgent: 'axios 1.13.6',
    },
  },
  {
    deployment_name: '',
    container_name: 'contacts-get-internal-api',
    log_level: 'warn',
    log: 'Upstream connection timed out after 5000ms; retrying request (attempt 2 of 3)',
    json_payload: {
      'httpRequest.requestMethod': 'POST',
      'httpRequest.status': '503',
      trace_id: 'demo-trace-003',
    },
    pod_name: 'contacts-get-internal-api-7ddf86bd6c-qkw2h',
    namespace_name: 'default',
  },
  {
    deployment_name: '',
    service_name: 'platform-api',
    log_level: 'info',
    'log.message':
      'Current resource usage: CPU 24%, memory 318 MiB. Request queue is empty.',
    'log.msg': 'should not appear',
  },
  {
    resource: {
      labels: {
        container_name: 'custom-objects-api',
        namespace_name: 'default',
        pod_name: 'custom-objects-api-6fb8d678b9-ckn4p',
      },
    },
    log_level: 'info',
    log: {
      message: '',
      msg: '/objects/tasks/records/search · Returned 14 records',
    },
    httpRequest: { requestMethod: 'POST', status: 201 },
  },
  {
    resource: { attributes: { 'service.name': 'payments-api' } },
    log_level: 'error',
    log: {
      message:
        'Payment provider returned a retryable error. Request retained for retry; no duplicate charge created.',
      error: { code: 'UPSTREAM_UNAVAILABLE', retry_after_seconds: 30 },
    },
    httpRequest: { requestMethod: 'POST', status: 502 },
  },
  {
    deployment_name: 'leadgen-social-platform-facebook-long-running-worker',
    log_level: 'info',
    log: 'Webhook batch processed successfully; 24 records acknowledged and 0 pending. This long deployment name stays readable instead of being clipped into a narrow column.',
    namespace_name: 'workers',
  },
  {
    pod_name: 'ch-indexing-course-worker-7458c9fcb6-mt8pw',
    log_level: 'info',
    log: { msg: 'Indexed course metadata; 18 documents updated' },
    namespace_name: 'workers',
  },
  {
    log_level: 'info',
    log: 'No workload metadata was emitted for this event. Missing fields leave no empty chips.',
  },
  {
    deployment_name: 'emails-api',
    log_level: 'info',
    log: {
      message: 'Digest email queued',
      delivery: { status: 'pending', recipients: 8 },
    },
    httpRequest: { requestMethod: 'POST', status: 202 },
  },
  {
    deployment_name: 'crm-marketplace-webhooks-worker',
    log_level: 'warn',
    log: '{"message":"  ","msg":"Consumer is catching up; oldest pending event is 12 seconds old"}',
  },
  {
    deployment_name: 'billing-api',
    log_level: 'info',
    log: '{raw upstream payload; not JSON}',
    httpRequest: { status: 200 },
  },
];

export const SAMPLE_LOGS: SampleLog[] = events.map((event, i) => ({
  id: `sample-${i}`,
  time: `10:19:${String(25 - i).padStart(2, '0')}.125`,
  event: { cluster_name: 'servers-usc1-stg-cluster', ...event },
}));
