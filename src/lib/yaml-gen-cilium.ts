import yaml from 'js-yaml';
import type { PolicyState, PolicyRule, PortRule } from '@/types/policy';

interface CiliumPort {
  port: string;
  protocol: string;
}

interface CiliumToPorts {
  ports: CiliumPort[];
  rules?: { dns?: Array<{ matchPattern: string }> };
}

function mapPorts(ports: PortRule[]): CiliumToPorts | undefined {
  if (ports.length === 0) return undefined;
  return {
    ports: ports.map(p => ({
      port: String(p.port),
      protocol: p.protocol,
    })),
  };
}

function isDnsRule(rule: PolicyRule): boolean {
  return (
    rule.type === 'cluster' &&
    rule.podSelector?.['k8s-app'] === 'kube-dns' &&
    rule.ports.some(p => Number(p.port) === 53 && p.protocol === 'UDP')
  );
}

function mapIngressRule(rule: PolicyRule): Record<string, unknown> {
  const entry: Record<string, unknown> = {};

  if (rule.entity) {
    // Entity-based rule (e.g., fromEntities: ["cluster"])
    entry.fromEntities = [rule.entity];
  } else if (rule.type === 'outside') {
    if (rule.fqdn) {
      // FQDNs are egress-only in Cilium; fall back to CIDR for ingress
      entry.fromCIDR = [rule.cidr ?? '0.0.0.0/0'];
    } else {
      entry.fromCIDR = [rule.cidr ?? '0.0.0.0/0'];
      if (rule.except && rule.except.length > 0) {
        entry.fromCIDRSet = [{ cidr: rule.cidr ?? '0.0.0.0/0', except: rule.except }];
        delete entry.fromCIDR;
      }
    }
  } else {
    const labels: Record<string, string> = { ...(rule.podSelector ?? {}) };
    if (rule.type === 'namespace' && rule.namespaceSelector) {
      for (const [k, v] of Object.entries(rule.namespaceSelector)) {
        labels[`k8s:${k}`] = v;
      }
    }
    if (Object.keys(labels).length === 0 && rule.type === 'cluster') {
      entry.fromEndpoints = [{}];
    } else {
      entry.fromEndpoints = [{ matchLabels: labels }];
    }
  }

  const toPorts = mapPorts(rule.ports);
  if (toPorts) entry.toPorts = [toPorts];

  return entry;
}

function mapEgressRule(rule: PolicyRule): Record<string, unknown> {
  const entry: Record<string, unknown> = {};

  if (rule.entity) {
    // Entity-based rule (e.g., toEntities: ["cluster"])
    entry.toEntities = [rule.entity];
  } else if (rule.fqdn) {
    // FQDN-based rule
    entry.toFQDNs = [{ matchPattern: rule.fqdn }];
  } else if (rule.type === 'outside') {
    entry.toCIDR = [rule.cidr ?? '0.0.0.0/0'];
    if (rule.except && rule.except.length > 0) {
      entry.toCIDRSet = [{ cidr: rule.cidr ?? '0.0.0.0/0', except: rule.except }];
      delete entry.toCIDR;
    }
  } else {
    const labels: Record<string, string> = { ...(rule.podSelector ?? {}) };
    if (rule.type === 'namespace' && rule.namespaceSelector) {
      for (const [k, v] of Object.entries(rule.namespaceSelector)) {
        labels[`k8s:${k}`] = v;
      }
    }
    if (rule.namespaceSelector) {
      const nsName = rule.namespaceSelector['kubernetes.io/metadata.name'];
      if (nsName) {
        labels['io.kubernetes.pod.namespace'] = nsName;
      }
    }
    if (Object.keys(labels).length === 0 && rule.type === 'cluster') {
      entry.toEndpoints = [{}];
    } else {
      entry.toEndpoints = [{ matchLabels: labels }];
    }
  }

  // Special DNS rule
  if (isDnsRule(rule)) {
    const toPorts: CiliumToPorts = {
      ports: [{ port: '53', protocol: 'UDP' }],
      rules: { dns: [{ matchPattern: '*' }] },
    };
    entry.toPorts = [toPorts];
  } else {
    const toPorts = mapPorts(rule.ports);
    if (toPorts) entry.toPorts = [toPorts];
  }

  return entry;
}

export function generateCiliumYaml(state: PolicyState): string {
  const manifest: Record<string, unknown> = {
    apiVersion: 'cilium.io/v2',
    kind: 'CiliumNetworkPolicy',
    metadata: {
      name: state.policyName,
      namespace: state.namespace,
    },
    spec: {
      endpointSelector:
        Object.keys(state.podSelector).length > 0
          ? { matchLabels: state.podSelector }
          : {},
    },
  };

  const spec = manifest.spec as Record<string, unknown>;

  if (state.ingressRules.length > 0) {
    spec.ingress = state.ingressRules.map(mapIngressRule);
  }

  if (state.egressRules.length > 0) {
    spec.egress = state.egressRules.map(mapEgressRule);
  }

  return yaml.dump(manifest, {
    noRefs: true,
    lineWidth: -1,
    quotingType: '"',
    noCompatMode: true,
  });
}
