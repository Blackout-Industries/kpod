import type { PolicyState, PolicyRule } from '@/types/policy';
import type { PolicyAction } from './actions';
import { generateId } from '@/lib/utils';

export const initialState: PolicyState = {
  policyName: 'my-network-policy',
  namespace: 'default',
  podSelector: {},
  ingressRules: [],
  egressRules: [],
  ingressEnabled: false,
  egressEnabled: false,
};

function createRule(action: { ruleType: PolicyState['ingressRules'][number]['type']; defaults?: Partial<PolicyRule> }): PolicyRule {
  return {
    id: generateId(),
    type: action.ruleType,
    ports: [],
    ...action.defaults,
  };
}

export function policyReducer(state: PolicyState, action: PolicyAction): PolicyState {
  switch (action.type) {
    case 'ADD_INGRESS_RULE':
      return {
        ...state,
        ingressRules: [...state.ingressRules, createRule(action.payload)],
        ingressEnabled: true,
      };

    case 'REMOVE_INGRESS_RULE': {
      const ingressRules = state.ingressRules.filter(r => r.id !== action.payload.id);
      return {
        ...state,
        ingressRules,
        ingressEnabled: ingressRules.length > 0 ? true : state.ingressEnabled,
      };
    }

    case 'UPDATE_INGRESS_RULE':
      return {
        ...state,
        ingressRules: state.ingressRules.map(r =>
          r.id === action.payload.id ? { ...r, ...action.payload.changes } : r,
        ),
      };

    case 'ADD_EGRESS_RULE':
      return {
        ...state,
        egressRules: [...state.egressRules, createRule(action.payload)],
        egressEnabled: true,
      };

    case 'REMOVE_EGRESS_RULE': {
      const egressRules = state.egressRules.filter(r => r.id !== action.payload.id);
      return {
        ...state,
        egressRules,
        egressEnabled: egressRules.length > 0 ? true : state.egressEnabled,
      };
    }

    case 'UPDATE_EGRESS_RULE':
      return {
        ...state,
        egressRules: state.egressRules.map(r =>
          r.id === action.payload.id ? { ...r, ...action.payload.changes } : r,
        ),
      };

    case 'SET_POD_SELECTOR':
      return {
        ...state,
        podSelector: action.payload.podSelector,
      };

    case 'SET_METADATA':
      return {
        ...state,
        ...(action.payload.policyName !== undefined && { policyName: action.payload.policyName }),
        ...(action.payload.namespace !== undefined && { namespace: action.payload.namespace }),
      };

    case 'IMPORT_STATE':
      return {
        ...action.payload,
        ingressEnabled: action.payload.ingressEnabled ?? action.payload.ingressRules.length > 0,
        egressEnabled: action.payload.egressEnabled ?? action.payload.egressRules.length > 0,
      };

    default:
      return state;
  }
}
