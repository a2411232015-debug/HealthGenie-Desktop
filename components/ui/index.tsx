import React, { useEffect, useState } from 'react';
import { AlertCircle, Loader2, RefreshCw, X } from 'lucide-react';

export const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 disabled:bg-slate-100';

export const primaryButton =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-teal-300';

export const secondaryButton =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50';

export const dangerButton =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-300';

export const card = 'rounded-2xl border border-slate-100 bg-white shadow-sm';

/** 圖片網址失效時把圖片藏起來，顯示底下的灰色底，而不是破圖示 */
export const hideBrokenImage = (event: React.SyntheticEvent<HTMLImageElement>): void => {
  event.currentTarget.style.visibility = 'hidden';
};

export const Spinner: React.FC<{ className?: string }> = ({ className = 'h-5 w-5' }) => (
  <Loader2 className={`animate-spin ${className}`} aria-hidden />
);

export const PageLoading: React.FC<{ label?: string }> = ({ label = '讀取中…' }) => (
  <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-slate-500" role="status">
    <Spinner className="h-8 w-8 text-teal-600" />
    <span className="text-sm">{label}</span>
  </div>
);

export const ErrorState: React.FC<{ message: string; onRetry?: () => void }> = ({ message, onRetry }) => (
  <div className="flex min-h-[30vh] flex-col items-center justify-center gap-3 p-6 text-center" role="alert">
    <AlertCircle className="h-10 w-10 text-red-400" />
    <p className="font-bold text-slate-700">{message}</p>
    {onRetry && (
      <button onClick={onRetry} className={secondaryButton}>
        <RefreshCw className="h-4 w-4" /> 重新整理
      </button>
    )}
  </div>
);

export const EmptyState: React.FC<{ icon?: React.ReactNode; title: string; text?: string; action?: React.ReactNode }> = ({ icon, title, text, action }) => (
  <div className={`${card} flex flex-col items-center justify-center gap-2 border-dashed px-6 py-14 text-center`}>
    {icon && <div className="mb-2 text-slate-300">{icon}</div>}
    <h3 className="font-bold text-slate-700">{title}</h3>
    {text && <p className="max-w-sm text-sm text-slate-500">{text}</p>}
    {action && <div className="mt-3">{action}</div>}
  </div>
);

export const Field: React.FC<{ label: string; htmlFor?: string; error?: string; hint?: string; children: React.ReactNode; className?: string }> = ({ label, htmlFor, error, hint, children, className = '' }) => (
  <div className={className}>
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-bold text-slate-700">{label}</label>
    {children}
    {hint && !error && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    {error && <p className="mt-1 text-xs font-medium text-red-600">{error}</p>}
  </div>
);

export const Modal: React.FC<{
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'md' | 'lg';
}> = ({ title, onClose, children, footer, size = 'md' }) => {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-900/50 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label={title} className={`flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-2xl ${size === 'lg' ? 'sm:max-w-2xl' : 'sm:max-w-lg'}`}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-lg font-black text-slate-900">{title}</h2>
          <button onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="關閉">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="border-t border-slate-100 bg-slate-50 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
};

export const ConfirmDialog: React.FC<{
  title: string;
  message: React.ReactNode;
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ title, message, confirmLabel, danger, busy, onConfirm, onCancel }) => (
  <Modal
    title={title}
    onClose={onCancel}
    footer={(
      <div className="flex gap-3">
        <button onClick={onCancel} className={`${secondaryButton} flex-1`} disabled={busy}>取消</button>
        <button onClick={onConfirm} className={`${danger ? dangerButton : primaryButton} flex-1`} disabled={busy}>
          {busy && <Spinner className="h-4 w-4" />} {confirmLabel}
        </button>
      </div>
    )}
  >
    <div className="text-slate-600">{message}</div>
  </Modal>
);

/** 需要填寫原因的確認視窗（拒單、取消訂單） */
export const ReasonDialog: React.FC<{
  title: string;
  description: string;
  presets: string[];
  confirmLabel: string;
  busy?: boolean;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}> = ({ title, description, presets, confirmLabel, busy, onConfirm, onCancel }) => {
  const [reason, setReason] = useState('');
  return (
    <Modal
      title={title}
      onClose={onCancel}
      footer={(
        <div className="flex gap-3">
          <button onClick={onCancel} className={`${secondaryButton} flex-1`} disabled={busy}>返回</button>
          <button onClick={() => onConfirm(reason.trim())} className={`${dangerButton} flex-1`} disabled={busy || !reason.trim()}>
            {busy && <Spinner className="h-4 w-4" />} {confirmLabel}
          </button>
        </div>
      )}
    >
      <p className="text-sm text-slate-600">{description}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {presets.map((preset) => (
          <button key={preset} type="button" onClick={() => setReason(preset)} className={`rounded-full border px-3 py-1.5 text-sm ${reason === preset ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            {preset}
          </button>
        ))}
      </div>
      <textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={200} rows={3} className={`${inputClass} mt-3`} placeholder="或自行輸入原因（最多 200 字）" aria-label="原因" />
    </Modal>
  );
};

export const Badge: React.FC<{ tone?: 'slate' | 'teal' | 'amber' | 'red' | 'blue' | 'green'; children: React.ReactNode }> = ({ tone = 'slate', children }) => {
  const tones = {
    slate: 'bg-slate-100 text-slate-600',
    teal: 'bg-teal-50 text-teal-700',
    amber: 'bg-amber-50 text-amber-700',
    red: 'bg-red-50 text-red-700',
    blue: 'bg-blue-50 text-blue-700',
    green: 'bg-emerald-50 text-emerald-700',
  };
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${tones[tone]}`}>{children}</span>;
};

export const PageHeader: React.FC<{ title: string; subtitle?: React.ReactNode; back?: () => void; actions?: React.ReactNode }> = ({ title, subtitle, back, actions }) => (
  <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
    <div className="flex items-start gap-3">
      {back && (
        <button onClick={back} className="mt-0.5 rounded-full p-2 text-slate-500 hover:bg-slate-200" aria-label="返回">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 19-7-7 7-7" /><path d="M19 12H5" /></svg>
        </button>
      )}
      <div>
        <h1 className="text-2xl font-black text-slate-900">{title}</h1>
        {subtitle && <div className="mt-1 text-sm text-slate-500">{subtitle}</div>}
      </div>
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
  </header>
);
