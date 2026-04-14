import { useState, useCallback, useEffect } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table';
import { Plus, X } from 'lucide-react';
import { generateId } from '@/lib/utils';
import { validateCidr } from '@/lib/validators';

interface CidrRow {
  id: string;
  cidr: string;
}

interface CidrEditorProps {
  cidrs: string[];
  onChange: (cidrs: string[]) => void;
  placeholder?: string;
}

interface TableMeta {
  updateData: (rowIndex: number, columnId: string, value: string) => void;
  removeRow: (rowIndex: number) => void;
}

const columns: ColumnDef<CidrRow, string>[] = [
  {
    accessorKey: 'cidr',
    header: 'CIDR',
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
            placeholder="10.0.0.0/8"
            onChange={e => {
              setValue(e.target.value);
              setError(null);
            }}
            onBlur={() => {
              const err = value.trim() ? validateCidr(value.trim()) : null;
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

export function CidrEditor({ cidrs, onChange, placeholder }: CidrEditorProps) {
  const [data, setData] = useState<CidrRow[]>(() =>
    cidrs.map(cidr => ({ id: generateId(), cidr })),
  );

  useEffect(() => {
    setData(cidrs.map(cidr => ({ id: generateId(), cidr })));
  }, [cidrs]);

  const updateData = useCallback(
    (rowIndex: number, _columnId: string, value: string) => {
      setData(prev => {
        const next = prev.map((row, i) =>
          i === rowIndex ? { ...row, cidr: value } : row,
        );
        onChange(next.map(r => r.cidr).filter(Boolean));
        return next;
      });
    },
    [onChange],
  );

  const removeRow = useCallback(
    (rowIndex: number) => {
      setData(prev => {
        const next = prev.filter((_, i) => i !== rowIndex);
        onChange(next.map(r => r.cidr).filter(Boolean));
        return next;
      });
    },
    [onChange],
  );

  const addRow = useCallback(() => {
    setData(prev => [...prev, { id: generateId(), cidr: '' }]);
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
        <Plus size={12} /> {placeholder ?? 'Add CIDR'}
      </button>
    </div>
  );
}
