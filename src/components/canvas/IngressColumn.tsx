import { useCallback, useMemo } from 'react';
import { Globe, Braces, Network, Server, Crosshair } from 'lucide-react';
import { usePolicyContext } from '@/state/context';
import { addIngressRule, removeIngressRule, updateIngressRule } from '@/state/actions';
import type { PolicyRule, RuleType } from '@/types/policy';
import { RuleGroupCard, type SubTypeOption } from './RuleGroupCard';
import { findDuplicateRules } from '@/lib/validators';

const outsideSubTypes: SubTypeOption[] = [
  { label: 'From any endpoint', description: 'With or without specific ports', icon: <Server size={14} /> },
  { label: 'From CIDR', description: 'Ex.: 10.2.1.0/28', icon: <Crosshair size={14} />, defaults: { cidr: '' } },
];

const namespaceSubTypes: SubTypeOption[] = [
  { label: 'From any pod', description: 'With or without specific ports', icon: <Server size={14} /> },
  { label: 'From pod selector', description: 'Ex.: env=prod, app=frontend', icon: <Crosshair size={14} />, defaults: { podSelector: {} } },
];

const clusterSubTypes: SubTypeOption[] = [
  { label: 'From everything in the cluster', description: 'With or without specific ports', icon: <Network size={14} /> },
  { label: 'From pod selector', description: 'Ex.: env=prod, app=frontend', icon: <Crosshair size={14} />, defaults: { podSelector: {} } },
];

function getSummary(rule: PolicyRule): string {
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

export function IngressColumn() {
  const { state, dispatch } = usePolicyContext();

  const duplicateIds = useMemo(
    () => findDuplicateRules(state.ingressRules),
    [state.ingressRules],
  );

  const rulesByType = useMemo(() => {
    const groups: Record<RuleType, PolicyRule[]> = { outside: [], namespace: [], cluster: [] };
    for (const rule of state.ingressRules) {
      groups[rule.type].push(rule);
    }
    return groups;
  }, [state.ingressRules]);

  const handleAdd = useCallback(
    (type: RuleType, defaults?: Partial<PolicyRule>) => {
      dispatch(addIngressRule(type, defaults));
    },
    [dispatch],
  );

  const handleUpdate = useCallback(
    (id: string, changes: Partial<PolicyRule>) => {
      dispatch(updateIngressRule(id, changes));
    },
    [dispatch],
  );

  const handleDelete = useCallback(
    (id: string) => {
      dispatch(removeIngressRule(id));
    },
    [dispatch],
  );

  return (
    <div className="flex flex-col gap-3 w-full max-w-[280px]">
      <h3 className="text-base font-bold text-text-primary">Ingress Sources</h3>

      <RuleGroupCard
        icon={<Globe size={16} />}
        title="Outside Cluster"
        subTypes={outsideSubTypes}
        rules={rulesByType.outside}
        direction="ingress"
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
        direction="ingress"
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
        direction="ingress"
        onAdd={defaults => handleAdd('cluster', defaults)}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
        duplicateIds={duplicateIds}
        getSummary={getSummary}
      />
    </div>
  );
}
