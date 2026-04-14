import type { PolicyRule, PolicyState, RuleType } from '@/types/policy';

export type PolicyAction =
  | { type: 'ADD_INGRESS_RULE'; payload: { ruleType: RuleType; defaults?: Partial<PolicyRule> } }
  | { type: 'REMOVE_INGRESS_RULE'; payload: { id: string } }
  | { type: 'UPDATE_INGRESS_RULE'; payload: { id: string; changes: Partial<PolicyRule> } }
  | { type: 'ADD_EGRESS_RULE'; payload: { ruleType: RuleType; defaults?: Partial<PolicyRule> } }
  | { type: 'REMOVE_EGRESS_RULE'; payload: { id: string } }
  | { type: 'UPDATE_EGRESS_RULE'; payload: { id: string; changes: Partial<PolicyRule> } }
  | { type: 'SET_POD_SELECTOR'; payload: { podSelector: Record<string, string> } }
  | { type: 'SET_METADATA'; payload: { policyName?: string; namespace?: string } }
  | { type: 'IMPORT_STATE'; payload: PolicyState };

export const addIngressRule = (ruleType: RuleType, defaults?: Partial<PolicyRule>): PolicyAction => ({
  type: 'ADD_INGRESS_RULE',
  payload: { ruleType, defaults },
});

export const removeIngressRule = (id: string): PolicyAction => ({
  type: 'REMOVE_INGRESS_RULE',
  payload: { id },
});

export const updateIngressRule = (id: string, changes: Partial<PolicyRule>): PolicyAction => ({
  type: 'UPDATE_INGRESS_RULE',
  payload: { id, changes },
});

export const addEgressRule = (ruleType: RuleType, defaults?: Partial<PolicyRule>): PolicyAction => ({
  type: 'ADD_EGRESS_RULE',
  payload: { ruleType, defaults },
});

export const removeEgressRule = (id: string): PolicyAction => ({
  type: 'REMOVE_EGRESS_RULE',
  payload: { id },
});

export const updateEgressRule = (id: string, changes: Partial<PolicyRule>): PolicyAction => ({
  type: 'UPDATE_EGRESS_RULE',
  payload: { id, changes },
});

export const setPodSelector = (podSelector: Record<string, string>): PolicyAction => ({
  type: 'SET_POD_SELECTOR',
  payload: { podSelector },
});

export const setMetadata = (policyName?: string, namespace?: string): PolicyAction => ({
  type: 'SET_METADATA',
  payload: { policyName, namespace },
});

export const importState = (state: PolicyState): PolicyAction => ({
  type: 'IMPORT_STATE',
  payload: state,
});
