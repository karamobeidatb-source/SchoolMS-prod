import { useState, useMemo } from 'react';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Search } from 'lucide-react';

export default function DataTable({
  columns,
  data = [],
  onRowClick,
  searchable = true,
  pageSize = 10,
  emptyMessage = 'No records found',
}) {
  const [search, setSearch] = useState('');
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    if (!search) return data;
    const q = search.toLowerCase();
    return data.filter((row) =>
      columns.some((col) => {
        const val = col.accessor ? (typeof col.accessor === 'function' ? col.accessor(row) : row[col.accessor]) : '';
        return String(val || '').toLowerCase().includes(q);
      })
    );
  }, [data, search, columns]);

  const sorted = useMemo(() => {
    if (!sortCol) return filtered;
    const col = columns.find((c) => c.key === sortCol);
    if (!col) return filtered;
    return [...filtered].sort((a, b) => {
      const av = typeof col.accessor === 'function' ? col.accessor(a) : a[col.accessor];
      const bv = typeof col.accessor === 'function' ? col.accessor(b) : b[col.accessor];
      const cmp = String(av || '').localeCompare(String(bv || ''), undefined, { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sortCol, sortDir, columns]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const paged = sorted.slice(page * pageSize, (page + 1) * pageSize);

  const handleSort = (key) => {
    if (sortCol === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortCol(key);
      setSortDir('asc');
    }
  };

  return (
    <div>
      {searchable && (
        <div className="mb-4 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="input pl-10"
          />
        </div>
      )}

      <div className="overflow-x-auto rounded-lg" style={{ border: '1px solid var(--border-default)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ backgroundColor: 'var(--surface-secondary)', borderBottom: '1px solid var(--border-default)' }}>
              {columns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => col.sortable !== false && handleSort(col.key)}
                  className={`px-4 py-3 text-left font-medium ${col.sortable !== false ? 'cursor-pointer select-none' : ''} ${col.className || ''}`}
                  style={{ color: 'var(--text-secondary)' }}
                  onMouseEnter={(e) => { if (col.sortable !== false) e.currentTarget.style.color = 'var(--text-primary)'; }}
                  onMouseLeave={(e) => { if (col.sortable !== false) e.currentTarget.style.color = 'var(--text-secondary)'; }}
                >
                  <div className="flex items-center gap-1">
                    {col.header}
                    {sortCol === col.key && (
                      sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center" style={{ color: 'var(--text-tertiary)' }}>
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              paged.map((row, i) => (
                <tr
                  key={row._id || row.id || i}
                  onClick={() => onRowClick?.(row)}
                  className={`transition-colors duration-fast ${onRowClick ? 'cursor-pointer' : ''}`}
                  style={{
                    borderBottom: '1px solid var(--border-subtle)',
                    backgroundColor: i % 2 === 0 ? 'var(--surface-primary)' : 'var(--surface-secondary)',
                  }}
                  onMouseEnter={(e) => { if (onRowClick) e.currentTarget.style.backgroundColor = 'var(--surface-hover)'; }}
                  onMouseLeave={(e) => { if (onRowClick) e.currentTarget.style.backgroundColor = i % 2 === 0 ? 'var(--surface-primary)' : 'var(--surface-secondary)'; }}
                >
                  {columns.map((col) => (
                    <td key={col.key} className={`px-4 py-3 ${col.className || ''}`}>
                      {col.render
                        ? col.render(row)
                        : typeof col.accessor === 'function'
                        ? col.accessor(row)
                        : row[col.accessor]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {sorted.length > pageSize && (
        <div className="flex items-center justify-between mt-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <span>Showing {page * pageSize + 1}-{Math.min((page + 1) * pageSize, sorted.length)} of {sorted.length}</span>
          <div className="flex items-center gap-2">
            <button
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
              className="p-1.5 rounded-lg transition-colors duration-fast disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ border: '1px solid var(--border-default)' }}
              onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = 'var(--surface-hover)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = ''; }}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span>Page {page + 1} of {totalPages}</span>
            <button
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
              className="p-1.5 rounded-lg transition-colors duration-fast disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ border: '1px solid var(--border-default)' }}
              onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = 'var(--surface-hover)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = ''; }}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
