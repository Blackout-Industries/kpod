export type RuleType = 'outside' | 'namespace' | 'cluster';
export type Protocol = 'TCP' | 'UDP' | 'SCTP';

export interface PortRule {
  port: number | string;
  protocol: Protocol;
}

export interface PolicyRule {
  id: string;
  type: RuleType;
  cidr?: string;
  except?: string[];
  fqdn?: string;
  entity?: string;
  namespaceSelector?: Record<string, string>;
  podSelector?: Record<string, string>;
  ports: PortRule[];
}

export type IngressRule = PolicyRule;
export type EgressRule = PolicyRule;

export interface PolicyState {
  policyName: string;
  namespace: string;
  podSelector: Record<string, string>;
  ingressRules: IngressRule[];
  egressRules: EgressRule[];
  ingressEnabled: boolean;
  egressEnabled: boolean;
}
