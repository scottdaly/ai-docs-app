import { useToastStore, Toast, ToastType } from '../store/useToastStore';
import { RiCloseLine, RiCheckboxCircleLine, RiErrorWarningLine, RiInformationLine, RiAlertLine } from '@remixicon/react';
import { useEffect, useState } from 'react';

const iconMap: Record<ToastType, React.ReactNode> = {
  success: <RiCheckboxCircleLine size={18} className="text-green-500" />,
  error: <RiErrorWarningLine size={18} className="text-red-500" />,
  warning: <RiAlertLine size={18} className="text-yellow-500" />,
  info: <RiInformationLine size={18} className="text-blue-500" />,
};

const bgMap: Record<ToastType, string> = {
  success: 'border-green-500/30 bg-green-500/10',
  error: 'border-red-500/30 bg-red-500/10',
  warning: 'border-yellow-500/30 bg-yellow-500/10',
  info: 'border-blue-500/30 bg-blue-500/10',
};

function ToastItem({ toast }: { toast: Toast }) {
  const { removeToast } = useToastStore();
  const [isExiting, setIsExiting] = useState(false);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => removeToast(toast.id), 150);
  };

  // Start exit animation before auto-removal
  useEffect(() => {
    if (toast.duration && toast.duration > 0) {
      const exitTimer = setTimeout(() => {
        setIsExiting(true);
      }, toast.duration - 150);
      return () => clearTimeout(exitTimer);
    }
  }, [toast.duration]);

  return (
    <div
      className={`
        flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg
        backdrop-blur-sm transition-all duration-150
        ${bgMap[toast.type]}
        ${isExiting ? 'opacity-0 translate-x-4' : 'opacity-100 translate-x-0'}
      `}
      style={{
        animation: isExiting ? undefined : 'slideIn 0.15s ease-out',
      }}
    >
      {iconMap[toast.type]}
      <span className="text-sm text-foreground flex-1">{toast.message}</span>
      <button
        onClick={handleClose}
        className="p-1 rounded hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground"
      >
        <RiCloseLine size={14} />
      </button>
    </div>
  );
}

export function ToastContainer() {
  const { toasts } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
      <style>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(1rem);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  );
}
