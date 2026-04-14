import yaml from 'js-yaml';
import type { PolicyState, PolicyRule, PortRule } from '@/types/policy';

interface K8sNetworkPolicy {
  apiVersion: string;
  kind: string;
  metadata: { name: string; namespace: string };
  spec: {
    podSelector: { matchLabels?: Record<string, string> };
    policyTypes?: string[];
    ingress?: K8sIngressRule[];
    egress?: K8sEgressRule[];
  };
}

interface K8sPortSpec {
  port: number | string;
  protocol: string;
}

interface K8sPeerSpec {
  ipBlock?: { cidr: string; except?: string[] };
  namespaceSelector?: { matchLabels: Record<string, string> };
  podSelector?: { matchLabels: Record<string, string> };
}

interface K8sIngressRule {
  from?: K8sPeerSpec[];
  ports?: K8sPortSpec[];
}

interface K8sEgressRule {
  to?: K8sPeerSpec[];
  ports?: K8sPortSpec[];
}

function mapPorts(ports: PortRule[]): K8sPortSpec[] | undefined {
  if (ports.length === 0) return undefined;
  return ports.map(p => ({
    port: typeof p.port === 'string' && /^\d+$/.test(p.port) ? Number(p.port) : p.port,
    protocol: p.protocol,
  }));
}

function mapRuleToPeer(rule: PolicyRule): K8sPeerSpec {
  switch (rule.type) {
    case 'outside': {
      const block: K8sPeerSpec['ipBlock'] = { cidr: rule.cidr ?? '0.0.0.0/0' };
      if (rule.except && rule.except.length > 0) {
        block.except = rule.except;
      }
      return { ipBlock: block };
    }
    case 'namespace': {
      const peer: K8sPeerSpec = {};
      if (rule.namespaceSelector && Object.keys(rule.namespaceSelector).length > 0) {
        peer.namespaceSelector = { matchLabels: rule.namespaceSelector };
      } else {
        peer.namespaceSelector = { matchLabels: {} };
      }
      if (rule.podSelector && Object.keys(rule.podSelector).length > 0) {
        peer.podSelector = { matchLabels: rule.podSelector };
      }
      return peer;
    }
    case 'cluster': {
      if (rule.podSelector && Object.keys(rule.podSelector).length > 0) {
        return { podSelector: { matchLabels: rule.podSelector } };
      }
      return { podSelector: { matchLabels: {} } };
    }
  }
}

export function generateK8sYaml(state: PolicyState): string {
  const manifest: K8sNetworkPolicy = {
    apiVersion: 'networking.k8s.io/v1',
    kind: 'NetworkPolicy',
    metadata: {
      name: state.policyName,
      namespace: state.namespace,
    },
    spec: {
      podSelector:
        Object.keys(state.podSelector).length > 0
          ? { matchLabels: state.podSelector }
          : {},
    },
  };

  const policyTypes: string[] = [];
  if (state.ingressEnabled || state.ingressRules.length > 0) policyTypes.push('Ingress');
  if (state.egressEnabled || state.egressRules.length > 0) policyTypes.push('Egress');
  if (policyTypes.length > 0) {
    manifest.spec.policyTypes = policyTypes;
  }

  if (state.ingressRules.length > 0) {
    manifest.spec.ingress = state.ingressRules.map(rule => {
      const entry: K8sIngressRule = {
        from: [mapRuleToPeer(rule)],
      };
      const ports = mapPorts(rule.ports);
      if (ports) entry.ports = ports;
      return entry;
    });
  }

  if (state.egressRules.length > 0) {
    manifest.spec.egress = state.egressRules.map(rule => {
      const entry: K8sEgressRule = {
        to: [mapRuleToPeer(rule)],
      };
      const ports = mapPorts(rule.ports);
      if (ports) entry.ports = ports;
      return entry;
    });
  }

  return yaml.dump(manifest, {
    noRefs: true,
    lineWidth: -1,
    quotingType: '"',
    noCompatMode: true,
  });
}
