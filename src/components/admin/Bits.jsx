// Small shared building blocks for the admin portal.

export function StatTile({ icon: Icon, label, value, color = 'text-slate-800', sub }) {
  return (
    <div className="panel p-4">
      <div className="stat-label text-slate-500 flex items-center gap-1.5">{Icon && <Icon className="w-3.5 h-3.5" />}{label}</div>
      <div className={`text-2xl font-extrabold mt-1 ${color}`}>{value}</div>
      {sub && <div className="text-[11px] text-slate-400 mt-0.5">{sub}</div>}
    </div>
  );
}

export function Section({ title, sub, right, children }) {
  return (
    <section className="panel p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="text-sm font-extrabold text-slate-900">{title}</h3>
          {sub && <p className="text-[11px] text-slate-500 mt-0.5">{sub}</p>}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

// Simple, accessible horizontal bar list (categorical). Colors come from the
// app's existing palette so the whole UI reads as one system.
export function BarList({ items, max, color = '#4f46e5' }) {
  const top = max || Math.max(1, ...items.map(i => i.value));
  return (
    <div className="space-y-2.5">
      {items.map((it, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="w-28 shrink-0 text-xs font-semibold text-slate-600 truncate">{it.label}</span>
          <div className="flex-1 h-5 rounded-md bg-slate-100 overflow-hidden" style={{ background: 'var(--bar-track, #eef1f6)' }}>
            <div className="h-full rounded-md flex items-center justify-end px-2" style={{ width: `${Math.max(6, (it.value / top) * 100)}%`, background: it.color || color }}>
              <span className="text-[10px] font-bold text-white">{it.value}</span>
            </div>
          </div>
        </div>
      ))}
      {items.length === 0 && <p className="text-xs text-slate-400 py-2">No data yet.</p>}
    </div>
  );
}

export function Table({ heads, rows, empty = 'No data.' }) {
  if (!rows.length) return <p className="text-xs text-slate-400 py-3">{empty}</p>;
  return (
    <div className="overflow-x-auto rounded-xl">
      <table className="w-full text-xs report-table">
        <thead>
          <tr>
            {heads.map((h, i) => {
              const isCenter = typeof h === 'object' && (h.center || h.right);
              const align = isCenter ? 'text-center' : 'text-left';
              return (
                <th key={i} className={`${align} py-3 px-4 font-extrabold uppercase tracking-wider`}>
                  {h.label || h}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="hover:bg-slate-100/60 dark:hover:bg-slate-800/50 transition-colors">
              {r.map((c, j) => {
                const h = heads[j];
                const isCenter = typeof h === 'object' && (h.center || h.right);
                const align = isCenter ? 'text-center' : 'text-left';
                return (
                  <td key={j} className={`${align} py-3 px-4 align-middle`}>
                    {c}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
