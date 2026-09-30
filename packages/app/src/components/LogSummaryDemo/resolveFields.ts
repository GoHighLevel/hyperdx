import { parseJSON } from '@hyperdx/common-utils/dist/core/utils';

export type ResolvedField = { text: string; path: string };

// The preview receives raw events. SQL projection is a separate integration
// step: readableLogColumns currently covers developer defaults, not aliased searches.
function readPath(input: unknown, path: string): unknown {
  const value =
    typeof input === 'string' && input.length < 131_072
      ? parseJSON<unknown>(input)
      : input;
  if (!value || typeof value !== 'object') return undefined;
  for (let end = path.length; end > 0; end = path.lastIndexOf('.', end - 1)) {
    const key = path.slice(0, end);
    if (Object.hasOwn(value, key)) {
      const entry: unknown = Reflect.get(value, key);
      if (end === path.length) return entry;
      const nested = readPath(entry, path.slice(end + 1));
      if (nested !== undefined) return nested;
    }
  }
  return undefined;
}

export function resolveField(
  event: object,
  paths: readonly string[],
  allowObject = false,
): ResolvedField | undefined {
  for (const path of paths) {
    const value = readPath(event, path);
    if (value == null || (typeof value === 'string' && value.trim() === ''))
      continue;
    if (typeof value === 'object') {
      if (allowObject) return { text: JSON.stringify(value), path };
      continue;
    }
    if (['string', 'number', 'boolean'].includes(typeof value)) {
      return { text: String(value), path };
    }
  }
  return undefined;
}

export const resolveMessage = (event: object) =>
  resolveField(
    event,
    [
      'log.message',
      'log.msg',
      'json_payload.message',
      'json_payload.msg',
      'log_message',
      'Summary',
      'Message',
      'message',
      'msg',
      'log',
      'Body',
      'body',
      'textPayload',
    ],
    true,
  );

export const SUMMARY_FIELDS = [
  {
    id: 'deployment_name',
    label: 'deployment_name',
    paths: [
      'deployment_name',
      'resource.attributes.k8s.deployment.name',
      'ResourceAttributes.k8s.deployment.name',
    ],
  },
  {
    id: 'container_name',
    label: 'container_name',
    paths: [
      'container_name',
      'resource.labels.container_name',
      'resource.attributes.k8s.container.name',
      'ResourceAttributes.k8s.container.name',
    ],
  },
  {
    id: 'pod_name',
    label: 'pod_name',
    paths: [
      'pod_name',
      'resource.labels.pod_name',
      'resource.attributes.k8s.pod.name',
      'ResourceAttributes.k8s.pod.name',
    ],
  },
  {
    id: 'node_name',
    label: 'node_name (host)',
    paths: [
      'node_name',
      'resource.attributes.k8s.node.name',
      'ResourceAttributes.k8s.node.name',
      'host',
      'host.name',
      'resource.attributes.host.name',
      'ResourceAttributes.host.name',
    ],
  },
  {
    id: 'cluster_name',
    label: 'cluster_name',
    paths: [
      'cluster_name',
      'resource.labels.cluster_name',
      'resource.attributes.k8s.cluster.name',
      'ResourceAttributes.k8s.cluster.name',
    ],
  },
  {
    id: 'method',
    label: 'Request method',
    paths: [
      'Request Method',
      'json_payload.httpRequest.requestMethod',
      'httpRequest.requestMethod',
      'log.httpRequest.requestMethod',
    ],
  },
  {
    id: 'status',
    label: 'HTTP status',
    paths: [
      'Status',
      'json_payload.httpRequest.status',
      'httpRequest.status',
      'log.httpRequest.status',
    ],
  },
  {
    id: 'namespace',
    label: 'namespace_name',
    paths: ['namespace_name', 'resource.labels.namespace_name'],
  },
  {
    id: 'agent',
    label: 'User agent',
    paths: ['json_payload.httpRequest.userAgent', 'httpRequest.userAgent'],
  },
  {
    id: 'trace',
    label: 'Trace ID',
    paths: ['trace_id', 'log.trace_id', 'json_payload.trace_id', 'TraceId'],
  },
];

export const summaryFieldForPath = (path: string) =>
  SUMMARY_FIELDS.find(field => field.paths.includes(path)) ?? {
    id: `custom:${path}`,
    label: path,
    paths: [path],
  };
