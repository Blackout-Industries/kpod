import { useState, useCallback, useEffect } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table';
import { Plus, X } from 'lucide-react';
import { generateId } from '@/lib/utils';
import { validatePort } from '@/lib/validators';
import type { PortRule, Protocol } from '@/types/policy';

interface PortRow extends PortRule {
  id: string;
}

interface PortEditorProps {
  ports: PortRule[];
  onChange: (ports: PortRule[]) => void;
}

interface TableMeta {
  updateData: (rowIndex: number, columnId: string, value: string) => void;
  removeRow: (rowIndex: number) => void;
}

const PROTOCOLS: Protocol[] = ['TCP', 'UDP', 'SCTP'];

const columns: ColumnDef<PortRow, unknown>[] = [
  {
    accessorKey: 'port',
    header: 'Port',
    cell: ({ getValue, row, column, table }) => {
      const initialValue = String(getValue() ?? '');
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
            placeholder="port (1-65535)"
            onChange={e => {
              setValue(e.target.value);
              setError(null);
            }}
            onBlur={() => {
              const err = value.trim() ? validatePort(value.trim()) : null;
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
    accessorKey: 'protocol',
    header: 'Protocol',
    cell: ({ getValue, row, column, table }) => {
      const value = getValue() as string;
      return (
        <select
          className="w-full bg-transparent border border-card-border rounded px-1 py-1 text-xs focus:outline-none focus:border-accent"
          value={value}
          onChange={e =>
            (table.options.meta as TableMeta).updateData(row.index, column.id, e.target.value)
          }
        >
          {PROTOCOLS.map(p => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
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

function toPortRules(rows: PortRow[]): PortRule[] {
  return rows.map(({ port, protocol }) => ({
    port: typeof port === 'string' && /^\d+$/.test(port) ? Number(port) : port,
    protocol,
  }));
}

export function PortEditor({ ports, onChange }: PortEditorProps) {
  const [data, setData] = useState<PortRow[]>(() =>
    ports.map(p => ({ ...p, id: generateId() })),
  );

  useEffect(() => {
    setData(ports.map(p => ({ ...p, id: generateId() })));
  }, [ports]);

  const updateData = useCallback(
    (rowIndex: number, columnId: string, value: string) => {
      setData(prev => {
        const next = prev.map((row, i) =>
          i === rowIndex ? { ...row, [columnId]: value } : row,
        );
        onChange(toPortRules(next));
        return next;
      });
    },
    [onChange],
  );

  const removeRow = useCallback(
    (rowIndex: number) => {
      setData(prev => {
        const next = prev.filter((_, i) => i !== rowIndex);
        onChange(toPortRules(next));
        return next;
      });
    },
    [onChange],
  );

  const addRow = useCallback(() => {
    setData(prev => [
      ...prev,
      { id: generateId(), port: '', protocol: 'TCP' as Protocol },
    ]);
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
              <tr key={row.id}>
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
        <Plus size={12} /> Add Port
      </button>
    </div>
  );
}
