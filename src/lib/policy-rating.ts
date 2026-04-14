import type { PolicyState, PolicyRule } from '@/types/policy';

function isSpecific(rule: PolicyRule): boolean {
  const hasLabels =
    (rule.podSelector && Object.keys(rule.podSelector).length > 0) ||
    (rule.namespaceSelector && Object.keys(rule.namespaceSelector).length > 0) ||
    (rule.type === 'outside' && !!rule.cidr);

  const hasPorts = rule.ports.length > 0;
  return !!hasLabels && hasPorts;
}

export function computeRating(state: PolicyState): 1 | 2 | 3 | 4 {
  const hasIngress = state.ingressRules.length > 0;
  const hasEgress = state.egressRules.length > 0;

  if (!hasIngress && !hasEgress) return 1;
  if (!hasIngress || !hasEgress) return 2;

  const allRules = [...state.ingressRules, ...state.egressRules];
  const allSpecific = allRules.every(isSpecific);

  return allSpecific ? 4 : 3;
}
