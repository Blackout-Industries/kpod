import { Plus, X } from 'lucide-react';

export interface PolicyPage {
  id: string;
  label: string;
}

interface PolicyPageBarProps {
  pages: PolicyPage[];
  activeId: string;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onRename: (id: string, label: string) => void;
}

export function PolicyPageBar({ pages, activeId, onSelect, onAdd, onRemove, onRename }: PolicyPageBarProps) {
  return (
    <div className="flex items-center gap-1 px-3 py-1.5 bg-surface border-b border-divider shrink-0 overflow-x-auto">
      {pages.map(page => (
        <div
          key={page.id}
          className={`group flex items-center gap-1.5 px-3 py-1.5 rounded-t text-sm font-medium cursor-pointer transition-colors ${
            page.id === activeId
              ? 'bg-card-bg text-text-primary border border-b-0 border-card-border'
              : 'text-text-secondary hover:text-text-primary hover:bg-card-bg/50'
          }`}
          onClick={() => onSelect(page.id)}
        >
          <span
            contentEditable
            suppressContentEditableWarning
            spellCheck={false}
            className="outline-none min-w-[40px]"
            onBlur={e => {
              const text = e.currentTarget.textContent?.trim();
              if (text && text !== page.label) {
                onRename(page.id, text);
              }
            }}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                (e.target as HTMLSpanElement).blur();
              }
            }}
          >
            {page.label}
          </span>
          {pages.length > 1 && (
            <button
              onClick={e => {
                e.stopPropagation();
                onRemove(page.id);
              }}
              className="opacity-0 group-hover:opacity-100 text-text-secondary hover:text-arrow-deny transition-opacity p-0.5"
            >
              <X size={12} />
            </button>
          )}
        </div>
      ))}
      <button
        onClick={onAdd}
        className="flex items-center gap-1 px-2 py-1.5 text-text-secondary hover:text-accent transition-colors text-sm"
        title="Add new policy page"
      >
        <Plus size={14} />
      </button>
    </div>
  );
}
