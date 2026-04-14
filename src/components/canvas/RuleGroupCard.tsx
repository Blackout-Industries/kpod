import { useState, useRef, useEffect, useCallback, type ReactNode } from 'react';
import { Plus, X, ChevronDown, ChevronUp } from 'lucide-react';
import type { PolicyRule } from '@/types/policy';
import { LabelEditor } from '@/components/editors/LabelEditor';
import { PortEditor } from '@/components/editors/PortEditor';
import { CidrEditor } from '@/components/editors/CidrEditor';

export interface SubTypeOption {
  label: string;
  description: string;
  icon: ReactNode;
  defaults?: Partial<PolicyRule>;
  disabled?: boolean;
  disabledLabel?: string;
}

interface RuleGroupCardProps {
  icon: ReactNode;
  title: string;
  subTypes: SubTypeOption[];
  rules: PolicyRule[];
  direction: 'ingress' | 'egress';
  onAdd: (defaults?: Partial<PolicyRule>) => void;
  onUpdate: (id: string, changes: Partial<PolicyRule>) => void;
  onDelete: (id: string) => void;
  duplicateIds: Set<string>;
  getSummary: (rule: PolicyRule) => string;
}

function getPortSummary(rule: PolicyRule): string {
  if (rule.ports.length === 0) return '';
  return rule.ports.map(p => `:${p.port}`).join(', ');
}

export function RuleGroupCard({
  icon,
  title,
  subTypes,
  rules,
  direction,
  onAdd,
  onUpdate,
  onDelete,
  duplicateIds,
  getSummary,
}: RuleGroupCardProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showPicker) return;
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showPicker]);

  const handleLabelChange = useCallback(
    (id: string, field: 'podSelector' | 'namespaceSelector') => (labels: Record<string, string>) => {
      onUpdate(id, { [field]: labels });
    },
    [onUpdate],
  );

  return (
    <div className="bg-card-bg border border-card-border rounded-lg shadow-sm glow-card">
      {/* Group Header */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        <span className="text-text-secondary shrink-0">{icon}</span>
        <span className="text-sm font-bold text-text-primary flex-1">{title}</span>
        <div className="relative" ref={pickerRef}>
          <button
            onClick={() => setShowPicker(prev => !prev)}
            className="text-text-secondary hover:text-text-primary p-0.5"
          >
            <Plus size={16} />
          </button>
          {showPicker && (
            <div className="absolute top-full right-0 mt-1 z-20 bg-card-bg border border-card-border rounded-lg shadow-lg py-1 min-w-[250px]">
              <div className="px-3 py-1.5 text-[11px] font-semibold text-text-secondary uppercase tracking-wider">
                Rule type
              </div>
              {subTypes.map((opt, i) => (
                <button
                  key={i}
                  disabled={opt.disabled}
                  className={`flex items-start gap-2.5 w-full px-3 py-2 text-left ${
                    opt.disabled
                      ? 'opacity-40 cursor-not-allowed'
                      : 'hover:bg-surface'
                  }`}
                  onClick={() => {
                    if (opt.disabled) return;
                    onAdd(opt.defaults);
                    setShowPicker(false);
                  }}
                >
                  <span className="text-text-secondary mt-0.5">{opt.icon}</span>
                  <div>
                    <div className="text-xs font-medium text-text-primary">
                      {opt.label}
                      {opt.disabled && opt.disabledLabel && (
                        <span className="ml-1.5 text-[10px] text-text-secondary font-normal">
                          ({opt.disabledLabel})
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-text-secondary leading-tight">{opt.description}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Sub-rule rows */}
      {rules.length > 0 && (
        <div className="border-t border-card-border divide-y divide-card-border/50">
          {rules.map(rule => {
            const expanded = expandedId === rule.id;
            const summary = getSummary(rule);
            const portSummary = getPortSummary(rule);
            const isDuplicate = duplicateIds.has(rule.id);

            return (
              <div
                key={rule.id}
                className={isDuplicate ? 'bg-rating-2/10' : ''}
                data-rule-id={rule.id}
                data-direction={direction}
              >
                {/* Row header */}
                <div
                  className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-surface/50 group"
                  onClick={() => setExpandedId(prev => prev === rule.id ? null : rule.id)}
                >
                  <span className="text-xs text-text-primary flex-1 truncate">{summary}</span>
                  {portSummary && (
                    <span className="text-[11px] text-text-secondary shrink-0 font-mono">
                      &rarr; {portSummary}
                    </span>
                  )}
                  <button
                    onClick={e => { e.stopPropagation(); onDelete(rule.id); }}
                    className="text-text-secondary hover:text-arrow-deny p-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                  >
                    <X size={12} />
                  </button>
                  <span className="text-text-secondary shrink-0">
                    {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </span>
                </div>

                {/* Expanded editor */}
                {expanded && (
                  <div className="border-t border-card-border/50 px-3 py-2 space-y-3 bg-surface/30">
                    {rule.entity && (
                      <div>
                        <label className="text-[11px] font-medium text-text-secondary block mb-1">Entity</label>
                        <span className="text-xs text-text-primary">{rule.entity}</span>
                      </div>
                    )}

                    {rule.fqdn !== undefined && (
                      <div>
                        <label className="text-[11px] font-medium text-text-secondary block mb-1">FQDN Pattern</label>
                        <input
                          className="w-full bg-transparent border border-card-border rounded px-2 py-1 text-xs text-text-primary focus:outline-none focus:border-accent"
                          value={rule.fqdn ?? ''}
                          placeholder="*.example.com"
                          onChange={e => onUpdate(rule.id, { fqdn: e.target.value })}
                        />
                      </div>
                    )}

                    {rule.type === 'outside' && !rule.entity && !rule.fqdn && (
                      <>
                        <div>
                          <label className="text-[11px] font-medium text-text-secondary block mb-1">CIDR</label>
                          <input
                            className="w-full bg-transparent border border-card-border rounded px-2 py-1 text-xs text-text-primary focus:outline-none focus:border-accent"
                            value={rule.cidr ?? ''}
                            placeholder="10.0.0.0/8"
                            onChange={e => onUpdate(rule.id, { cidr: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-medium text-text-secondary block mb-1">Except CIDRs</label>
                          <CidrEditor
                            cidrs={rule.except ?? []}
                            onChange={except => onUpdate(rule.id, { except })}
                            placeholder="Add exception"
                          />
                        </div>
                      </>
                    )}

                    {rule.type === 'namespace' && !rule.entity && (
                      <>
                        <div>
                          <label className="text-[11px] font-medium text-text-secondary block mb-1">Namespace Selector</label>
                          <LabelEditor
                            labels={rule.namespaceSelector ?? {}}
                            onChange={handleLabelChange(rule.id, 'namespaceSelector')}
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-medium text-text-secondary block mb-1">Pod Selector</label>
                          <LabelEditor
                            labels={rule.podSelector ?? {}}
                            onChange={handleLabelChange(rule.id, 'podSelector')}
                          />
                        </div>
                      </>
                    )}

                    {rule.type === 'cluster' && !rule.entity && (
                      <div>
                        <label className="text-[11px] font-medium text-text-secondary block mb-1">Pod Selector</label>
                        <LabelEditor
                          labels={rule.podSelector ?? {}}
                          onChange={handleLabelChange(rule.id, 'podSelector')}
                        />
                      </div>
                    )}

                    <div>
                      <label className="text-[11px] font-medium text-text-secondary block mb-1">Ports</label>
                      <PortEditor
                        ports={rule.ports}
                        onChange={ports => onUpdate(rule.id, { ports })}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
