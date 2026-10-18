import { CheckCircle2, AlertTriangle, Info, XCircle, X } from 'lucide-react';
import { useApp } from '../context/AppContext.jsx';

const ICON = { success: CheckCircle2, warning: AlertTriangle, error: XCircle, info: Info };
// Solid (opaque) colours so a toast never blends into what is behind it
const COLOR = {
  success: 'cc-toast-success',
  warning: 'cc-toast-warning',
  error: 'cc-toast-error',
  info: 'cc-toast-info',
};

export default function Toasts() {
  const { toasts, dismissToast } = useApp();
  return (
    <div className="cc-toast-stack" role="status" aria-live="polite">
      {toasts.map(t => {
        const Icon = ICON[t.type] || Info;
        return (
          <div key={t.id} className={`cc-toast ${COLOR[t.type] || COLOR.info}`}>
            <Icon className="cc-toast-icon w-[18px] h-[18px] mt-px shrink-0" />
            <span className="flex-1 min-w-0 break-words">{t.message}</span>
            <button type="button" aria-label="Dismiss" onClick={() => dismissToast(t.id)} className="cc-toast-x shrink-0 -mr-1 -mt-0.5 p-1 rounded-md">
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
