import { useState } from 'react';
import { X } from 'lucide-react';
import { LabelEditor } from './LabelEditor';
import { validatePolicyName, validateNamespace } from '@/lib/validators';

interface PodSelectorModalProps {
  policyName: string;
  namespace: string;
  podSelector: Record<string, string>;
  onSave: (data: { policyName: string; namespace: string; podSelector: Record<string, string> }) => void;
  onClose: () => void;
}

export function PodSelectorModal({
  policyName: initName,
  namespace: initNs,
  podSelector: initLabels,
  onSave,
  onClose,
}: PodSelectorModalProps) {
  const [policyName, setPolicyName] = useState(initName);
  const [namespace, setNamespace] = useState(initNs);
  const [podSelector, setPodSelector] = useState<Record<string, string>>(initLabels);
  const [selectAll, setSelectAll] = useState(Object.keys(initLabels).length === 0);

  const nameError = validatePolicyName(policyName);
  const nsError = validateNamespace(namespace);
  const hasErrors = nameError !== null || nsError !== null;

  const handleSave = () => {
    if (hasErrors) return;
    onSave({
      policyName: policyName.trim(),
      namespace: namespace.trim(),
      podSelector: selectAll ? {} : podSelector,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-card-bg border border-card-border rounded-xl shadow-xl w-full max-w-md mx-4 glow-card">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-card-border">
          <h3 className="text-sm font-semibold text-text-primary">Pod Selector Configuration</h3>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-4 py-4 space-y-4">
          <div>
            <label className="text-xs font-medium text-text-secondary block mb-1">Policy Name</label>
            <input
              className={`w-full border rounded px-3 py-1.5 text-sm bg-transparent text-text-primary focus:outline-none ${
                nameError ? 'border-arrow-deny' : 'border-card-border focus:border-accent'
              }`}
              value={policyName}
              placeholder="my-network-policy"
              onChange={e => setPolicyName(e.target.value)}
            />
            {nameError && <div className="text-[10px] text-arrow-deny mt-0.5">{nameError}</div>}
          </div>

          <div>
            <label className="text-xs font-medium text-text-secondary block mb-1">Namespace</label>
            <input
              className={`w-full border rounded px-3 py-1.5 text-sm bg-transparent text-text-primary focus:outline-none ${
                nsError ? 'border-arrow-deny' : 'border-card-border focus:border-accent'
              }`}
              value={namespace}
              placeholder="default"
              onChange={e => setNamespace(e.target.value)}
            />
            {nsError && <div className="text-[10px] text-arrow-deny mt-0.5">{nsError}</div>}
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="select-all"
              checked={selectAll}
              onChange={e => setSelectAll(e.target.checked)}
              className="rounded border-card-border"
            />
            <label htmlFor="select-all" className="text-xs text-text-secondary">
              Select all pods in namespace (empty selector)
            </label>
          </div>

          {!selectAll && (
            <div>
              <label className="text-xs font-medium text-text-secondary block mb-1">Pod Selector Labels</label>
              <LabelEditor labels={podSelector} onChange={setPodSelector} />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-card-border">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-medium text-text-secondary border border-card-border rounded hover:bg-surface"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={hasErrors}
            className={`px-3 py-1.5 text-xs font-medium text-white bg-accent rounded ${
              hasErrors ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-80'
            }`}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
