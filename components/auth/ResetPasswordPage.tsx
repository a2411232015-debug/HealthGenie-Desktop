import React, { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { navigate } from '../../lib/router';
import { supabase } from '../../lib/supabase';
import { errorMessage, showToast } from '../../utils/notifications';
import { Field, inputClass, primaryButton, Spinner } from '../ui';

export const ResetPasswordPage: React.FC = () => {
  const { session, loading } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password.length < 8) return setError('密碼至少需要 8 個字元');
    if (password !== confirm) return setError('兩次輸入的密碼不一樣');
    setBusy(true);
    setError('');
    const { error: updateError } = await supabase().auth.updateUser({ password });
    setBusy(false);
    if (updateError) return setError(errorMessage(updateError));
    showToast('密碼已更新');
    navigate('/stores');
    return undefined;
  };

  if (!loading && !session) {
    return (
      <div className="mx-auto mt-10 max-w-md rounded-3xl border border-slate-100 bg-white p-8 text-center shadow-sm">
        <p className="font-bold text-slate-700">重設連結已失效，請重新申請。</p>
        <a href="#/login" className="mt-4 inline-block font-bold text-teal-700 hover:underline">回到登入</a>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mx-auto mt-10 max-w-md space-y-4 rounded-3xl border border-slate-100 bg-white p-8 shadow-sm" noValidate>
      <KeyRound className="h-10 w-10 text-teal-600" />
      <h1 className="text-2xl font-black text-slate-900">設定新密碼</h1>
      <Field label="新密碼" htmlFor="new-password" hint="至少 8 個字元">
        <input id="new-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} className={inputClass} autoComplete="new-password" />
      </Field>
      <Field label="再輸入一次" htmlFor="confirm-password">
        <input id="confirm-password" type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} className={inputClass} autoComplete="new-password" />
      </Field>
      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p>}
      <button type="submit" disabled={busy} className={`${primaryButton} w-full py-3`}>{busy && <Spinner className="h-4 w-4" />}更新密碼</button>
    </form>
  );
};
