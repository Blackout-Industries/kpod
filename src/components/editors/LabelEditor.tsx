import { useState, useCallback, useEffect } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table';
import { Plus, X } from 'lucide-react';
import { generateId } from '@/lib/utils';
import { validateLabelKey, validateLabelValue } from '@/lib/validators';

interface LabelRow {
  id: string;
  key: string;
  value: string;
}

interface LabelEditorProps {
  labels: Record<string, string>;
  onChange: (labels: Record<string, string>) => void;
}

function toRows(labels: Record<string, string>): LabelRow[] {
  return Object.entries(labels).map(([key, value]) => ({
    id: generateId(),
    key,
    value,
  }));
}

function toRecord(rows: LabelRow[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const row of rows) {
    if (row.key) {
      result[row.key] = row.value;
    }
  }
  return result;
}

const columns: ColumnDef<LabelRow, string>[] = [
  {
    accessorKey: 'key',
    header: 'Key',
    cell: ({ getValue, row, column, table }) => {
      const initialValue = getValue();
      const [value, setValue] = useState(initialValue);
      const [error, setError] = useState<string | null>(null);
      useEffect(() => setValue(initialValue), [initialValue]);
      return (
        <div>
          <input
            className={`w-full bg-transparent border rounded px-2 py-1 text-xs focus:outline-none ${
              error ? 'border-arrow-deny' : 'border-card-border focus:border-accent'
            }`}
            value={value}
            placeholder="key"
            onChange={e => {
              setValue(e.target.value);
              setError(null);
            }}
            onBlur={() => {
              const err = value.trim() ? validateLabelKey(value.trim()) : null;
              setError(err);
              (table.options.meta as TableMeta).updateData(row.index, column.id, value);
            }}
          />
          {error && <div className="text-[10px] text-arrow-deny mt-0.5">{error}</div>}
        </div>
      );
    },
  },
  {
    accessorKey: 'value',
    header: 'Value',
    cell: ({ getValue, row, column, table }) => {
      const initialValue = getValue();
      const [value, setValue] = useState(initialValue);
      const [error, setError] = useState<string | null>(null);
      useEffect(() => setValue(initialValue), [initialValue]);
      return (
        <div>
          <input
            className={`w-full bg-transparent border rounded px-2 py-1 text-xs focus:outline-none ${
              error ? 'border-arrow-deny' : 'border-card-border focus:border-accent'
            }`}
            value={value}
            placeholder="value"
            onChange={e => {
              setValue(e.target.value);
              setError(null);
            }}
            onBlur={() => {
              const err = value ? validateLabelValue(value) : null;
              setError(err);
              (table.options.meta as TableMeta).updateData(row.index, column.id, value);
            }}
          />
          {error && <div className="text-[10px] text-arrow-deny mt-0.5">{error}</div>}
        </div>
      );
    },
  },
  {
    id: 'actions',
    header: '',
    size: 32,
    cell: ({ row, table }) => (
      <button
        className="text-text-secondary hover:text-arrow-deny p-0.5"
        onClick={() => (table.options.meta as TableMeta).removeRow(row.index)}
      >
        <X size={14} />
      </button>
    ),
  },
];

interface TableMeta {
  updateData: (rowIndex: number, columnId: string, value: string) => void;
  removeRow: (rowIndex: number) => void;
}

export function LabelEditor({ labels, onChange }: LabelEditorProps) {
  const [data, setData] = useState<LabelRow[]>(() => toRows(labels));

  useEffect(() => {
    setData(toRows(labels));
  }, [labels]);

  const updateData = useCallback(
    (rowIndex: number, columnId: string, value: string) => {
      setData(prev => {
        const next = prev.map((row, i) =>
          i === rowIndex ? { ...row, [columnId]: value } : row,
        );
        onChange(toRecord(next));
        return next;
      });
    },
    [onChange],
  );

  const removeRow = useCallback(
    (rowIndex: number) => {
      setData(prev => {
        const next = prev.filter((_, i) => i !== rowIndex);
        onChange(toRecord(next));
        return next;
      });
    },
    [onChange],
  );

  const addRow = useCallback(() => {
    setData(prev => [...prev, { id: generateId(), key: '', value: '' }]);
  }, []);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: row => row.id,
    meta: { updateData, removeRow } satisfies TableMeta,
  });

  return (
    <div className="space-y-1">
      {table.getRowModel().rows.length > 0 && (
        <table className="w-full">
          <tbody>
            {table.getRowModel().rows.map(row => (
              <tr key={row.id} className="gap-1">
                {row.getVisibleCells().map(cell => (
                  <td key={cell.id} className="pr-1 py-0.5">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <button
        onClick={addRow}
        className="flex items-center gap-1 text-xs text-accent hover:text-text-primary"
      >
        <Plus size={12} /> Add Label
      </button>
    </div>
  );
}
