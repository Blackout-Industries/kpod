import { useCallback, useMemo } from 'react';
import { Globe, Braces, Network, Shield, Server, Crosshair } from 'lucide-react';
import { usePolicyContext } from '@/state/context';
import { addEgressRule, removeEgressRule, updateEgressRule } from '@/state/actions';
import type { PolicyRule, RuleType } from '@/types/policy';
import { RuleGroupCard, type SubTypeOption } from './RuleGroupCard';
import { findDuplicateRules } from '@/lib/validators';

const DNS_DEFAULTS: Partial<PolicyRule> = {
  podSelector: { 'k8s-app': 'kube-dns' },
  namespaceSelector: { 'kubernetes.io/metadata.name': 'kube-system' },
  ports: [{ port: 53, protocol: 'UDP' }],
};

const outsideSubTypes: SubTypeOption[] = [
  { label: 'To any endpoint', description: 'With or without specific ports', icon: <Server size={14} /> },
  { label: 'To CIDR', description: 'Ex.: 10.2.1.0/28', icon: <Crosshair size={14} />, defaults: { cidr: '' } },
];

const namespaceSubTypes: SubTypeOption[] = [
  { label: 'To any pod', description: 'With or without specific ports', icon: <Server size={14} /> },
  { label: 'To pod selector', description: 'Ex.: env=prod, app=frontend', icon: <Crosshair size={14} />, defaults: { podSelector: {} } },
];

function getClusterSubTypes(hasDns: boolean): SubTypeOption[] {
  return [
    { label: 'To everything in the cluster', description: 'With or without specific ports', icon: <Network size={14} /> },
    { label: 'To pod selector', description: 'Ex.: env=prod, app=frontend', icon: <Crosshair size={14} />, defaults: { podSelector: {} } },
    {
      label: 'Kubernetes DNS',
      description: 'Port 53 UDP to kube-dns in kube-system',
      icon: <Shield size={14} />,
      defaults: DNS_DEFAULTS,
      disabled: hasDns,
      disabledLabel: 'added',
    },
  ];
}

function getSummary(rule: PolicyRule): string {
  // Special DNS detection
  if (
    rule.type === 'cluster' &&
    rule.podSelector?.['k8s-app'] === 'kube-dns' &&
    rule.ports.some(p => Number(p.port) === 53 && p.protocol === 'UDP')
  ) {
    return 'Kubernetes DNS';
  }

  if (rule.entity) return rule.entity === 'world' ? 'Any endpoint' : `Entity: ${rule.entity}`;
  if (rule.fqdn) return rule.fqdn;

  switch (rule.type) {
    case 'outside':
      return rule.cidr || 'Any endpoint';
    case 'namespace': {
      const ps = Object.entries(rule.podSelector ?? {});
      if (ps.length > 0) return ps.map(([k, v]) => `${k}=${v}`).join(', ');
      return 'Any pod';
    }
    case 'cluster': {
      const ps = Object.entries(rule.podSelector ?? {});
      if (ps.length > 0) return ps.map(([k, v]) => `${k}=${v}`).join(', ');
      return 'Everything in the cluster';
    }
  }
}

export function EgressColumn() {
  const { state, dispatch } = usePolicyContext();

  const hasDnsRule = state.egressRules.some(
    r => r.type === 'cluster' &&
      r.podSelector?.['k8s-app'] === 'kube-dns' &&
      r.ports.some(p => Number(p.port) === 53 && p.protocol === 'UDP'),
  );

  const duplicateIds = useMemo(
    () => findDuplicateRules(state.egressRules),
    [state.egressRules],
  );

  const rulesByType = useMemo(() => {
    const groups: Record<RuleType, PolicyRule[]> = { outside: [], namespace: [], cluster: [] };
    for (const rule of state.egressRules) {
      groups[rule.type].push(rule);
    }
    return groups;
  }, [state.egressRules]);

  const clusterSubTypes = useMemo(() => getClusterSubTypes(hasDnsRule), [hasDnsRule]);

  const handleAdd = useCallback(
    (type: RuleType, defaults?: Partial<PolicyRule>) => {
      // Prevent duplicate DNS
      if (type === 'cluster' && defaults?.podSelector?.['k8s-app'] === 'kube-dns' && hasDnsRule) {
        return;
      }
      dispatch(addEgressRule(type, defaults));
    },
    [dispatch, hasDnsRule],
  );

  const handleUpdate = useCallback(
    (id: string, changes: Partial<PolicyRule>) => {
      dispatch(updateEgressRule(id, changes));
    },
    [dispatch],
  );

  const handleDelete = useCallback(
    (id: string) => {
      dispatch(removeEgressRule(id));
    },
    [dispatch],
  );

  return (
    <div className="flex flex-col gap-3 w-full max-w-[280px]">
      <h3 className="text-base font-bold text-text-primary">Egress Destinations</h3>

      <RuleGroupCard
        icon={<Globe size={16} />}
        title="Outside Cluster"
        subTypes={outsideSubTypes}
        rules={rulesByType.outside}
        direction="egress"
        onAdd={defaults => handleAdd('outside', defaults)}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
        duplicateIds={duplicateIds}
        getSummary={getSummary}
      />

      <RuleGroupCard
        icon={<Braces size={16} />}
        title="In Namespace"
        subTypes={namespaceSubTypes}
        rules={rulesByType.namespace}
        direction="egress"
        onAdd={defaults => handleAdd('namespace', defaults)}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
        duplicateIds={duplicateIds}
        getSummary={getSummary}
      />

      <RuleGroupCard
        icon={<Network size={16} />}
        title="In Cluster"
        subTypes={clusterSubTypes}
        rules={rulesByType.cluster}
        direction="egress"
        onAdd={defaults => handleAdd('cluster', defaults)}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
        duplicateIds={duplicateIds}
        getSummary={getSummary}
      />
    </div>
  );
}
