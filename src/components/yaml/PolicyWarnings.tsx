import { useMemo, useState } from 'react';
import { AlertTriangle, AlertCircle, Info, ChevronDown, ChevronUp } from 'lucide-react';
import { usePolicyContext } from '@/state/context';
import { computeWarnings, type PolicyWarning } from '@/lib/validators';

const ICONS = {
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
} as const;

const COLORS = {
  error: 'text-arrow-deny',
  warning: 'text-rating-2',
  info: 'text-text-secondary',
} as const;

export function PolicyWarnings() {
  const { state } = usePolicyContext();
  const warnings = useMemo(() => computeWarnings(state), [state]);
  const [expanded, setExpanded] = useState(false);

  if (warnings.length === 0) return null;

  const errors = warnings.filter(w => w.level === 'error');
  const warns = warnings.filter(w => w.level === 'warning');
  const infos = warnings.filter(w => w.level === 'info');

  const summary = [
    errors.length > 0 ? `${errors.length} error${errors.length > 1 ? 's' : ''}` : null,
    warns.length > 0 ? `${warns.length} warning${warns.length > 1 ? 's' : ''}` : null,
    infos.length > 0 ? `${infos.length} info` : null,
  ].filter(Boolean).join(', ');

  return (
    <div className="border-b border-divider">
      <button
        onClick={() => setExpanded(prev => !prev)}
        className="flex items-center gap-2 w-full px-4 py-1.5 text-xs hover:bg-surface/50 transition-colors"
      >
        {errors.length > 0 ? (
          <AlertCircle size={12} className="text-arrow-deny shrink-0" />
        ) : warns.length > 0 ? (
          <AlertTriangle size={12} className="text-rating-2 shrink-0" />
        ) : (
          <Info size={12} className="text-text-secondary shrink-0" />
        )}
        <span className="text-text-secondary">{summary}</span>
        <span className="ml-auto">
          {expanded ? <ChevronUp size={12} className="text-text-secondary" /> : <ChevronDown size={12} className="text-text-secondary" />}
        </span>
      </button>

      {expanded && (
        <div className="px-4 pb-2 space-y-0.5 max-h-[150px] overflow-y-auto">
          {warnings.map((w, i) => (
            <WarningLine key={i} warning={w} />
          ))}
        </div>
      )}
    </div>
  );
}

function WarningLine({ warning }: { warning: PolicyWarning }) {
  const Icon = ICONS[warning.level];
  const color = COLORS[warning.level];

  return (
    <div className="flex items-start gap-1.5 text-[11px]">
      <Icon size={11} className={`${color} shrink-0 mt-0.5`} />
      <span className="text-text-secondary">{warning.message}</span>
    </div>
  );
}
