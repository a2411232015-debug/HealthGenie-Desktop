import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { ToastDetail } from '../utils/notifications';

export const ToastViewport: React.FC = () => {
  const [toast, setToast] = useState<ToastDetail | null>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    const handleToast = (event: Event) => {
      const detail = (event as CustomEvent<ToastDetail>).detail;
      if (!detail?.message) return;
      setToast(detail);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setToast(null), detail.type === 'error' ? 5000 : 3000);
    };
    window.addEventListener('healthgenie_toast', handleToast);
    return () => {
      window.removeEventListener('healthgenie_toast', handleToast);
      window.clearTimeout(timer.current);
    };
  }, []);

  if (!toast) return null;
  const style = { success: 'bg-emerald-600', error: 'bg-red-600', info: 'bg-slate-800' }[toast.type];
  const icon = {
    success: <CheckCircle2 className="h-5 w-5 shrink-0" />,
    error: <AlertCircle className="h-5 w-5 shrink-0" />,
    info: <Info className="h-5 w-5 shrink-0" />,
  }[toast.type];

  return (
    <div role="status" aria-live="polite" className={`fixed left-1/2 top-5 z-[200] flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-2 rounded-xl px-5 py-3 text-white shadow-xl ${style}`}>
      {icon}
      <span className="text-sm font-bold">{toast.message}</span>
    </div>
  );
};
