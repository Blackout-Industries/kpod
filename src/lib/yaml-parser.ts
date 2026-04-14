import yaml from 'js-yaml';
import type { PolicyState, PolicyRule, PortRule, RuleType } from '@/types/policy';
import { generateId } from './utils';

export class PolicyParseError extends Error {
  constructor(message: string, public line?: number) {
    super(message);
    this.name = 'PolicyParseError';
  }
}

interface K8sDoc {
  apiVersion?: string;
  kind?: string;
  metadata?: { name?: string; namespace?: string };
  spec?: {
    podSelector?: { matchLabels?: Record<string, string> } | null;
    policyTypes?: string[];
    ingress?: Array<{
      from?: Array<{
        ipBlock?: { cidr?: string; except?: string[] };
        namespaceSelector?: { matchLabels?: Record<string, string> } | Record<string, never>;
        podSelector?: { matchLabels?: Record<string, string> } | Record<string, never>;
      }>;
      ports?: Array<{ port?: number | string; protocol?: string }>;
    }>;
    egress?: Array<{
      to?: Array<{
        ipBlock?: { cidr?: string; except?: string[] };
        namespaceSelector?: { matchLabels?: Record<string, string> } | Record<string, never>;
        podSelector?: { matchLabels?: Record<string, string> } | Record<string, never>;
      }>;
      ports?: Array<{ port?: number | string; protocol?: string }>;
    }>;
  };
}

function parsePorts(ports?: Array<{ port?: number | string; protocol?: string }>): PortRule[] {
  if (!ports || !Array.isArray(ports)) return [];
  return ports
    .filter(p => p && p.port !== undefined)
    .map(p => ({
      port: p.port!,
      protocol: (p.protocol ?? 'TCP') as PortRule['protocol'],
    }));
}

function extractLabels(
  selector?: { matchLabels?: Record<string, string> } | Record<string, never> | null,
): Record<string, string> {
  if (!selector || typeof selector !== 'object') return {};
  if ('matchLabels' in selector && selector.matchLabels && typeof selector.matchLabels === 'object') {
    return { ...selector.matchLabels };
  }
  return {};
}

function parsePeer(
  peer: {
    ipBlock?: { cidr?: string; except?: string[] };
    namespaceSelector?: unknown;
    podSelector?: unknown;
  },
  ports: PortRule[],
): PolicyRule {
  if (peer.ipBlock) {
    return {
      id: generateId(),
      type: 'outside' as RuleType,
      cidr: peer.ipBlock.cidr,
      except: peer.ipBlock.except,
      ports,
    };
  }
  if (peer.namespaceSelector !== undefined) {
    const ns = peer.namespaceSelector as { matchLabels?: Record<string, string> } | null;
    const ps = peer.podSelector as { matchLabels?: Record<string, string> } | null;
    return {
      id: generateId(),
      type: 'namespace' as RuleType,
      namespaceSelector: extractLabels(ns),
      podSelector: extractLabels(ps),
      ports,
    };
  }
  if (peer.podSelector !== undefined) {
    const ps = peer.podSelector as { matchLabels?: Record<string, string> } | null;
    return {
      id: generateId(),
      type: 'cluster' as RuleType,
      podSelector: extractLabels(ps),
      ports,
    };
  }
  // Empty peer {} — allow all
  return {
    id: generateId(),
    type: 'cluster' as RuleType,
    podSelector: {},
    ports,
  };
}

export function parseK8sYaml(yamlString: string): PolicyState {
  const doc = yaml.load(yamlString) as K8sDoc;
  if (!doc?.spec) throw new PolicyParseError('Missing spec in NetworkPolicy');

  const policyTypes = doc.spec.policyTypes ?? [];
  const hasIngressType = policyTypes.some(t => String(t).toLowerCase() === 'ingress');
  const hasEgressType = policyTypes.some(t => String(t).toLowerCase() === 'egress');

  const ingressRules: PolicyRule[] = [];
  if (doc.spec.ingress && Array.isArray(doc.spec.ingress)) {
    for (const rule of doc.spec.ingress) {
      if (!rule) continue;
      const ports = parsePorts(rule.ports);
      const peers = rule.from;
      if (peers && Array.isArray(peers) && peers.length > 0) {
        for (const peer of peers) {
          if (!peer) continue;
          ingressRules.push(parsePeer(peer, ports));
        }
      } else {
        ingressRules.push({
          id: generateId(),
          type: 'cluster',
          podSelector: {},
          ports,
        });
      }
    }
  }

  const egressRules: PolicyRule[] = [];
  if (doc.spec.egress && Array.isArray(doc.spec.egress)) {
    for (const rule of doc.spec.egress) {
      if (!rule) continue;
      const ports = parsePorts(rule.ports);
      const peers = rule.to;
      if (peers && Array.isArray(peers) && peers.length > 0) {
        for (const peer of peers) {
          if (!peer) continue;
          egressRules.push(parsePeer(peer, ports));
        }
      } else {
        egressRules.push({
          id: generateId(),
          type: 'cluster',
          podSelector: {},
          ports,
        });
      }
    }
  }

  return {
    policyName: doc.metadata?.name ?? 'imported-policy',
    namespace: doc.metadata?.namespace ?? 'default',
    podSelector: extractLabels(doc.spec.podSelector),
    ingressRules,
    egressRules,
    ingressEnabled: hasIngressType || ingressRules.length > 0,
    egressEnabled: hasEgressType || egressRules.length > 0,
  };
}

interface CiliumEndpoint {
  matchLabels?: Record<string, string>;
}

interface CiliumPortEntry {
  port?: string;
  protocol?: string;
}

interface CiliumToPorts {
  ports?: CiliumPortEntry[];
  rules?: { dns?: Array<{ matchPattern?: string }> };
}

interface CiliumIngressRule {
  fromEndpoints?: CiliumEndpoint[];
  fromEntities?: string[];
  fromCIDR?: string[];
  fromCIDRSet?: Array<{ cidr?: string; except?: string[] }>;
  toPorts?: CiliumToPorts[];
}

interface CiliumEgressRule {
  toEndpoints?: CiliumEndpoint[];
  toEntities?: string[];
  toCIDR?: string[];
  toCIDRSet?: Array<{ cidr?: string; except?: string[] }>;
  toFQDNs?: Array<{ matchPattern?: string; matchName?: string }>;
  toPorts?: CiliumToPorts[];
}

function parseCiliumPorts(toPorts?: CiliumToPorts[]): PortRule[] {
  if (!toPorts || !Array.isArray(toPorts)) return [];
  const result: PortRule[] = [];
  for (const tp of toPorts) {
    if (!tp?.ports || !Array.isArray(tp.ports)) continue;
    for (const p of tp.ports) {
      if (!p?.port) continue;
      const port = /^\d+$/.test(p.port) ? Number(p.port) : p.port;
      result.push({
        port,
        protocol: (p.protocol ?? 'TCP') as PortRule['protocol'],
      });
    }
  }
  return result;
}

function isCiliumDnsEndpoint(
  endpoint: CiliumEndpoint,
  ports: PortRule[],
): boolean {
  const labels = endpoint.matchLabels ?? {};
  return (
    labels['k8s-app'] === 'kube-dns' &&
    (labels['io.kubernetes.pod.namespace'] === 'kube-system' ||
      labels['k8s:kubernetes.io/metadata.name'] === 'kube-system') &&
    ports.some(p => Number(p.port) === 53 && p.protocol === 'UDP')
  );
}

function parseCiliumEndpoint(
  endpoint: CiliumEndpoint,
  ports: PortRule[],
): PolicyRule {
  const labels = endpoint.matchLabels ?? {};

  // Separate namespace labels (io.kubernetes.pod.namespace or k8s:*) from pod labels
  const podLabels: Record<string, string> = {};
  const nsLabels: Record<string, string> = {};
  let hasNsLabel = false;

  for (const [key, val] of Object.entries(labels)) {
    if (key === 'io.kubernetes.pod.namespace') {
      nsLabels['kubernetes.io/metadata.name'] = val;
      hasNsLabel = true;
    } else if (key.startsWith('k8s:')) {
      nsLabels[key.slice(4)] = val;
      hasNsLabel = true;
    } else {
      podLabels[key] = val;
    }
  }

  // Distinguish {} (no matchLabels key) vs {matchLabels: {}} (empty matchLabels)
  // {} = allow all from cluster → type 'cluster'
  // {matchLabels: {}} = any pod in namespace → type 'namespace'
  if (Object.keys(labels).length === 0) {
    if (endpoint.matchLabels !== undefined) {
      // {matchLabels: {}} → "In Namespace" / any pod
      return {
        id: generateId(),
        type: 'namespace',
        podSelector: {},
        namespaceSelector: {},
        ports,
      };
    }
    // {} → "In Cluster" / everything
    return {
      id: generateId(),
      type: 'cluster',
      podSelector: {},
      ports,
    };
  }

  // DNS rule (kube-dns in kube-system) → type 'cluster' with both selectors
  if (hasNsLabel && isCiliumDnsEndpoint(endpoint, ports)) {
    return {
      id: generateId(),
      type: 'cluster',
      podSelector: podLabels,
      namespaceSelector: nsLabels,
      ports,
    };
  }

  if (hasNsLabel) {
    return {
      id: generateId(),
      type: 'namespace',
      namespaceSelector: nsLabels,
      podSelector: podLabels,
      ports,
    };
  }

  return {
    id: generateId(),
    type: 'cluster',
    podSelector: podLabels,
    ports,
  };
}

export function parseCiliumYaml(yamlString: string): PolicyState {
  const doc = yaml.load(yamlString) as Record<string, unknown>;
  if (!doc?.spec) throw new PolicyParseError('Missing spec in CiliumNetworkPolicy');

  const meta = doc.metadata as { name?: string; namespace?: string } | undefined;
  const spec = doc.spec as {
    endpointSelector?: { matchLabels?: Record<string, string> };
    ingress?: CiliumIngressRule[];
    egress?: CiliumEgressRule[];
  };

  const ingressRules: PolicyRule[] = [];
  if (spec.ingress && Array.isArray(spec.ingress)) {
    for (const rule of spec.ingress) {
      if (!rule) continue;
      const ports = parseCiliumPorts(rule.toPorts);

      // CIDR rules
      if (rule.fromCIDR && Array.isArray(rule.fromCIDR)) {
        for (const cidr of rule.fromCIDR) {
          ingressRules.push({
            id: generateId(),
            type: 'outside',
            cidr: String(cidr),
            ports,
          });
        }
      }
      if (rule.fromCIDRSet && Array.isArray(rule.fromCIDRSet)) {
        for (const cs of rule.fromCIDRSet) {
          ingressRules.push({
            id: generateId(),
            type: 'outside',
            cidr: cs.cidr ?? '',
            except: cs.except,
            ports,
          });
        }
      }

      // Entity rules (e.g., fromEntities: ["cluster", "world"])
      if (rule.fromEntities && Array.isArray(rule.fromEntities)) {
        for (const ent of rule.fromEntities) {
          const entity = String(ent);
          if (entity === 'world') {
            ingressRules.push({ id: generateId(), type: 'outside', entity, ports });
          } else {
            ingressRules.push({ id: generateId(), type: 'cluster', entity, podSelector: {}, ports });
          }
        }
      }

      // Endpoint rules
      if (rule.fromEndpoints && Array.isArray(rule.fromEndpoints)) {
        for (const ep of rule.fromEndpoints) {
          if (!ep) continue;
          ingressRules.push(parseCiliumEndpoint(ep, ports));
        }
      }

      // No peers at all — allow all
      if (!rule.fromEndpoints && !rule.fromCIDR && !rule.fromCIDRSet && !rule.fromEntities) {
        ingressRules.push({
          id: generateId(),
          type: 'cluster',
          podSelector: {},
          ports,
        });
      }
    }
  }

  const egressRules: PolicyRule[] = [];
  if (spec.egress && Array.isArray(spec.egress)) {
    for (const rule of spec.egress) {
      if (!rule) continue;
      const ports = parseCiliumPorts(rule.toPorts);

      // CIDR rules
      if (rule.toCIDR && Array.isArray(rule.toCIDR)) {
        for (const cidr of rule.toCIDR) {
          egressRules.push({
            id: generateId(),
            type: 'outside',
            cidr: String(cidr),
            ports,
          });
        }
      }
      if (rule.toCIDRSet && Array.isArray(rule.toCIDRSet)) {
        for (const cs of rule.toCIDRSet) {
          egressRules.push({
            id: generateId(),
            type: 'outside',
            cidr: cs.cidr ?? '',
            except: cs.except,
            ports,
          });
        }
      }

      // Entity rules (e.g., toEntities: ["cluster", "world"])
      if (rule.toEntities && Array.isArray(rule.toEntities)) {
        for (const ent of rule.toEntities) {
          const entity = String(ent);
          if (entity === 'world') {
            egressRules.push({ id: generateId(), type: 'outside', entity, ports });
          } else {
            egressRules.push({ id: generateId(), type: 'cluster', entity, podSelector: {}, ports });
          }
        }
      }

      // FQDN rules (e.g., toFQDNs: [{matchPattern: "*.google.com"}])
      if (rule.toFQDNs && Array.isArray(rule.toFQDNs)) {
        for (const fqdnEntry of rule.toFQDNs) {
          const fqdn = fqdnEntry.matchPattern ?? fqdnEntry.matchName ?? '';
          egressRules.push({ id: generateId(), type: 'outside', fqdn, ports });
        }
      }

      // Endpoint rules
      if (rule.toEndpoints && Array.isArray(rule.toEndpoints)) {
        for (const ep of rule.toEndpoints) {
          if (!ep) continue;
          egressRules.push(parseCiliumEndpoint(ep, ports));
        }
      }

      // No peers at all — allow all
      if (!rule.toEndpoints && !rule.toCIDR && !rule.toCIDRSet && !rule.toEntities && !rule.toFQDNs) {
        egressRules.push({
          id: generateId(),
          type: 'cluster',
          podSelector: {},
          ports,
        });
      }
    }
  }

  return {
    policyName: meta?.name ?? 'imported-cilium-policy',
    namespace: meta?.namespace ?? 'default',
    podSelector: spec.endpointSelector?.matchLabels ?? {},
    ingressRules,
    egressRules,
    ingressEnabled: ingressRules.length > 0,
    egressEnabled: egressRules.length > 0,
  };
}

export function detectAndParse(yamlString: string): { state: PolicyState; format: 'k8s' | 'cilium' } {
  let doc: Record<string, unknown> | null;
  try {
    doc = yaml.load(yamlString) as Record<string, unknown> | null;
  } catch (e) {
    throw new PolicyParseError(`Invalid YAML syntax: ${e instanceof Error ? e.message : 'parse error'}`);
  }

  if (!doc || typeof doc !== 'object') {
    throw new PolicyParseError('Empty or invalid YAML document');
  }

  const kind = String(doc.kind ?? '').toLowerCase();
  const api = String(doc.apiVersion ?? '').toLowerCase();

  // Cilium detection
  if (kind.includes('cilium') || api.includes('cilium')) {
    return { state: parseCiliumYaml(yamlString), format: 'cilium' };
  }

  // K8s detection — lenient
  if (kind.includes('networkpolicy') || api.includes('networking.k8s.io')) {
    return { state: parseK8sYaml(yamlString), format: 'k8s' };
  }

  // Fallback: if it has a spec with policy-like fields, try K8s
  if (doc.spec && typeof doc.spec === 'object') {
    const spec = doc.spec as Record<string, unknown>;
    if (spec.ingress || spec.egress || spec.podSelector !== undefined || spec.policyTypes) {
      return { state: parseK8sYaml(yamlString), format: 'k8s' };
    }
  }

  throw new PolicyParseError(
    `Unsupported policy: ${doc.apiVersion ?? 'unknown'}/${doc.kind ?? 'unknown'}`,
  );
}
