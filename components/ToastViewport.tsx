import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { ToastDetail } from '../utils/notifications';

export const ToastViewport: React.FC = () => {
  const [toast, setToast] = useState<ToastDetail | null>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    const display = (detail: ToastDetail) => {
      if (!detail?.message) return;
      setToast(detail);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setToast(null), 2800);
    };
    const handleToast = (event: Event) => display((event as CustomEvent<ToastDetail>).detail);
    const handleUnimplementedAction = (event: Event) => {
      const button = (event.target as HTMLElement | null)?.closest('button');
      if (!button) return;
      const label = button.textContent?.trim();
      if (label === '完成' || label === '開始') {
        display({ message: '此功能目前為展示版本，尚未開放。', type: 'info' });
      }
    };
    window.addEventListener('healthgenie_toast', handleToast);
    document.addEventListener('click', handleUnimplementedAction);
    return () => {
      window.removeEventListener('healthgenie_toast', handleToast);
      document.removeEventListener('click', handleUnimplementedAction);
      window.clearTimeout(timer.current);
    };
  }, []);

  if (!toast) return null;

  const styles = {
    success: 'bg-emerald-600',
    error: 'bg-red-600',
    info: 'bg-slate-800',
  }[toast.type];
  const icon = {
    success: <CheckCircle2 className="w-5 h-5" />,
    error: <AlertCircle className="w-5 h-5" />,
    info: <Info className="w-5 h-5" />,
  }[toast.type];

  return (
    <div role="status" aria-live="polite" className={`fixed top-5 left-1/2 -translate-x-1/2 z-[200] max-w-[calc(100vw-2rem)] px-5 py-3 rounded-xl text-white shadow-xl flex items-center gap-2 ${styles}`}>
      {icon}
      <span className="font-bold text-sm">{toast.message}</span>
    </div>
  );
};
