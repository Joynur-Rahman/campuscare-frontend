import { CheckCircle2, AlertTriangle, Info, XCircle, X } from 'lucide-react';
import { useApp } from '../context/AppContext.jsx';

const ICON = { success: CheckCircle2, warning: AlertTriangle, error: XCircle, info: Info };
const COLOR = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
  error: 'border-rose-200 bg-rose-50 text-rose-800',
  info: 'border-slate-200 bg-white text-slate-800',
};

export default function Toasts() {
  const { toasts, dismissToast } = useApp();
  return (
    <div className="fixed bottom-4 right-4 z-[200] flex flex-col gap-2 w-[min(360px,90vw)]">
      {toasts.map(t => {
        const Icon = ICON[t.type] || Info;
        return (
          <div key={t.id} className={`flex items-start gap-2.5 px-4 py-3 rounded-xl border shadow-lg text-sm font-semibold ${COLOR[t.type] || COLOR.info}`}>
            <Icon className="w-4 h-4 mt-0.5 shrink-0" />
            <span className="flex-1">{t.message}</span>
            <button onClick={() => dismissToast(t.id)} className="opacity-60 hover:opacity-100"><X className="w-4 h-4" /></button>
          </div>
        );
      })}
    </div>
  );
}
