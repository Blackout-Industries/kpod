import { useState } from 'react';
import { Pencil, Braces, ShieldCheck, ShieldAlert } from 'lucide-react';
import { usePolicyContext } from '@/state/context';
import { setPodSelector, setMetadata } from '@/state/actions';
import { PodSelectorModal } from '@/components/editors/PodSelectorModal';

export function TargetPodNode() {
  const { state, dispatch } = usePolicyContext();
  const [showModal, setShowModal] = useState(false);

  const hasIngress = state.ingressEnabled || state.ingressRules.length > 0;
  const hasEgress = state.egressEnabled || state.egressRules.length > 0;
  const labelSummary = Object.entries(state.podSelector);

  return (
    <>
      <div
        className="bg-card-bg border-2 border-accent/50 rounded-xl shadow-lg min-w-[240px] max-w-[260px] glow-card"
        data-target-pod
      >
        {/* Icon + Namespace header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-card-border">
          <div className="w-9 h-9 rounded-lg bg-accent/15 flex items-center justify-center shrink-0">
            <Braces size={20} className="text-accent" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-base font-bold text-text-primary truncate">{state.namespace}</div>
            <div className="text-xs text-text-secondary truncate mt-0.5">
              {labelSummary.length > 0
                ? labelSummary.map(([k, v]) => `${k}=${v}`).join(', ')
                : 'All pods in namespace'}
            </div>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="w-8 h-8 rounded-lg border border-card-border flex items-center justify-center text-text-secondary hover:text-accent hover:border-accent/50 transition-colors shrink-0"
          >
            <Pencil size={14} />
          </button>
        </div>

        {/* Deny/Allow badges */}
        <div className="flex gap-2 px-4 py-3">
          <DenyBadge label="Ingress" deny={hasIngress} />
          <DenyBadge label="Egress" deny={hasEgress} />
        </div>
      </div>

      {showModal && (
        <PodSelectorModal
          policyName={state.policyName}
          namespace={state.namespace}
          podSelector={state.podSelector}
          onSave={data => {
            dispatch(setPodSelector(data.podSelector));
            dispatch(setMetadata(data.policyName, data.namespace));
          }}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}

function DenyBadge({ label, deny }: { label: string; deny: boolean }) {
  const Icon = deny ? ShieldAlert : ShieldCheck;

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg ${
        deny
          ? 'bg-badge-deny-bg text-arrow-deny border border-badge-deny-border'
          : 'bg-badge-allow-bg text-arrow-allow border border-badge-allow-border'
      }`}
    >
      <Icon size={12} />
      <span>
        {label}
        <br />
        <span className="font-medium text-[10px] opacity-80">
          Default {deny ? 'Deny' : 'Allow'}
        </span>
      </span>
    </span>
  );
}
