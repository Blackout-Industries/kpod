import { useState, useMemo, useCallback, useRef } from 'react';
import { Copy, Download, Upload, Check } from 'lucide-react';
import { usePolicyContext } from '@/state/context';
import { importState } from '@/state/actions';
import { generateK8sYaml } from '@/lib/yaml-gen-k8s';
import { generateCiliumYaml } from '@/lib/yaml-gen-cilium';
import { detectAndParse } from '@/lib/yaml-parser';
import { sanitizeFilename } from '@/lib/utils';
import { YamlDisplay } from './YamlDisplay';
import { PolicyRating } from './PolicyRating';
import { PolicyWarnings } from './PolicyWarnings';

type TabId = 'k8s' | 'cilium';

export function YamlPanel() {
  const { state, dispatch } = usePolicyContext();
  const [activeTab, setActiveTab] = useState<TabId>('k8s');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const yaml = useMemo(() => {
    if (activeTab === 'k8s') {
      return generateK8sYaml(state);
    }
    return generateCiliumYaml(state);
  }, [state, activeTab]);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(yaml);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [yaml]);

  const handleDownload = useCallback(() => {
    const blob = new Blob([yaml], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${sanitizeFilename(state.policyName)}.yaml`;
    a.click();
    URL.revokeObjectURL(url);
  }, [yaml, state.policyName]);

  const handleUpload = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const { state: parsed, format } = detectAndParse(text);
        dispatch(importState(parsed));
        setActiveTab(format);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to parse YAML');
      }

      // Reset file input
      e.target.value = '';
    },
    [dispatch],
  );

  const handleYamlEdit = useCallback(
    (editedYaml: string) => {
      try {
        const { state: parsed, format } = detectAndParse(editedYaml);
        dispatch(importState(parsed));
        setActiveTab(format);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Invalid YAML');
      }
    },
    [dispatch],
  );

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar + actions */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-divider shrink-0">
        <div className="flex gap-1">
          <TabButton
            label="Kubernetes Network Policy"
            active={activeTab === 'k8s'}
            onClick={() => setActiveTab('k8s')}
          />
          <TabButton
            label="Cilium Network Policy"
            active={activeTab === 'cilium'}
            onClick={() => setActiveTab('cilium')}
          />
        </div>

        <div className="flex items-center gap-2">
          <PolicyRating />
          <div className="w-px h-4 bg-divider" />
          <ActionButton
            icon={copied ? <Check size={14} /> : <Copy size={14} />}
            label={copied ? 'Copied!' : 'Copy'}
            onClick={handleCopy}
          />
          <ActionButton icon={<Download size={14} />} label="Download" onClick={handleDownload} />
          <ActionButton icon={<Upload size={14} />} label="Upload" onClick={handleUpload} />
          <input
            ref={fileInputRef}
            type="file"
            accept=".yaml,.yml"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="px-4 py-1.5 bg-red-900/40 text-red-300 text-xs border-b border-red-800">
          {error}
          <button className="ml-2 underline" onClick={() => setError(null)}>dismiss</button>
        </div>
      )}

      {/* Policy warnings */}
      <PolicyWarnings />

      {/* YAML display */}
      <div className="flex-1 overflow-auto">
        <YamlDisplay yaml={yaml} onYamlChange={handleYamlEdit} />
      </div>
    </div>
  );
}

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      className={`px-3 py-1.5 text-sm font-semibold rounded-t transition-colors ${
        active
          ? 'text-tab-active border-b-2 border-accent'
          : 'text-tab-inactive hover:text-text-primary'
      }`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function ActionButton({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      className="flex items-center gap-1 px-2 py-1 text-xs text-action-text hover:text-text-primary hover:bg-surface rounded transition-colors"
      onClick={onClick}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
