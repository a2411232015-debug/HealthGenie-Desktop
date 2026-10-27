import React, { useEffect, useState } from 'react';
import { Activity, Mail } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { navigate, routeQuery } from '../../lib/router';
import { appBaseUrl, fetchEnabledProviders, supabase } from '../../lib/supabase';
import { errorMessage, showToast } from '../../utils/notifications';
import { Field, inputClass, primaryButton, secondaryButton, Spinner } from '../ui';

type Mode = 'login' | 'signup' | 'forgot';

const translateAuthError = (error: unknown): string => {
  const message = errorMessage(error);
  if (/Invalid login credentials/i.test(message)) return 'Email 或密碼不正確';
  if (/Email not confirmed/i.test(message)) return '還沒完成 Email 驗證，請到信箱點擊確認連結';
  if (/User already registered/i.test(message)) return '這個 Email 已經註冊過了，請直接登入';
  if (/Password should be at least/i.test(message)) return '密碼至少需要 8 個字元';
  if (/rate limit|too many/i.test(message)) return '嘗試次數太多，請稍等幾分鐘再試';
  if (/provider is not enabled|Unsupported provider/i.test(message)) return '平台尚未開啟 Google 登入，請改用 Email';
  if (/Email address not authorized|Error sending (confirmation|recovery|magic link)? ?email/i.test(message)) {
    return '平台目前無法寄出 Email，請稍後再試或聯絡平台客服';
  }
  if (/Signups not allowed/i.test(message)) return '平台目前暫停開放註冊';
  return message;
};

const safeNext = (): string => {
  const next = routeQuery('next') || '/stores';
  return next.startsWith('/') && !next.startsWith('/login') ? next : '/stores';
};

export const LoginPage: React.FC = () => {
  const { session } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [googleEnabled, setGoogleEnabled] = useState(false);
  // 桌面版（file://）無法完成 Google 登入；平台沒開 Google 登入時也不顯示按鈕
  const canUseGoogle = window.location.protocol.startsWith('http') && googleEnabled;

  useEffect(() => {
    if (!window.location.protocol.startsWith('http')) return;
    let active = true;
    fetchEnabledProviders().then((providers) => {
      if (active) setGoogleEnabled(providers.google === true);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (session) navigate(safeNext(), { replace: true });
  }, [session]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    const trimmedEmail = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(trimmedEmail)) {
      setError('請輸入正確的 Email');
      return;
    }
    if (mode !== 'forgot' && password.length < 8) {
      setError('密碼至少需要 8 個字元');
      return;
    }
    if (mode === 'signup' && !displayName.trim()) {
      setError('請輸入暱稱');
      return;
    }
    if (mode === 'signup' && !agreed) {
      setError('請先閱讀並同意服務條款與隱私權政策');
      return;
    }
    setBusy(true);
    try {
      const auth = supabase().auth;
      if (mode === 'login') {
        const { error: signInError } = await auth.signInWithPassword({ email: trimmedEmail, password });
        if (signInError) throw signInError;
        showToast('登入成功');
      } else if (mode === 'signup') {
        const { data, error: signUpError } = await auth.signUp({
          email: trimmedEmail,
          password,
          options: { data: { display_name: displayName.trim() }, emailRedirectTo: appBaseUrl() },
        });
        if (signUpError) throw signUpError;
        if (!data.session) setSentTo(trimmedEmail);
        else showToast('註冊成功，歡迎加入！');
      } else {
        const { error: resetError } = await auth.resetPasswordForEmail(trimmedEmail, { redirectTo: appBaseUrl() });
        if (resetError) throw resetError;
        setSentTo(trimmedEmail);
      }
    } catch (caught) {
      setError(translateAuthError(caught));
    } finally {
      setBusy(false);
    }
  };

  const signInWithGoogle = async () => {
    setError('');
    const { error: oauthError } = await supabase().auth.signInWithOAuth({ provider: 'google', options: { redirectTo: appBaseUrl() } });
    if (oauthError) setError(translateAuthError(oauthError));
  };

  if (sentTo) {
    return (
      <div className="mx-auto mt-10 max-w-md rounded-3xl border border-slate-100 bg-white p-8 text-center shadow-sm">
        <Mail className="mx-auto h-12 w-12 text-teal-600" />
        <h1 className="mt-4 text-xl font-black text-slate-900">請到信箱收信</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          我們寄了一封信到 <b>{sentTo}</b>。{mode === 'forgot' ? '點擊信中的連結即可設定新密碼。' : '點擊信中的確認連結後，就可以登入了。'}
        </p>
        <p className="mt-2 text-xs text-slate-400">沒收到的話，請檢查垃圾郵件匣。</p>
        <button onClick={() => { setSentTo(''); setMode('login'); }} className={`${secondaryButton} mt-6 w-full`}>回到登入</button>
      </div>
    );
  }

  return (
    <div className="mx-auto mt-4 max-w-md md:mt-10">
      <div className="rounded-3xl border border-slate-100 bg-white p-8 shadow-sm">
        <div className="flex items-center gap-2 text-xl font-black text-teal-700">
          <span className="rounded-lg bg-teal-600 p-1 text-white"><Activity className="h-4 w-4" /></span>
          HealthGenie
        </div>
        <h1 className="mt-5 text-2xl font-black text-slate-900">
          {mode === 'login' ? '登入' : mode === 'signup' ? '建立帳號' : '忘記密碼'}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {mode === 'forgot' ? '輸入註冊時的 Email，我們會寄重設密碼的連結給你。' : '登入後就能下單、查看訂單和記錄飲食。'}
        </p>

        {mode !== 'forgot' && (
          <div className="mt-6 grid grid-cols-2 rounded-xl bg-slate-100 p-1">
            {(['login', 'signup'] as const).map((value) => (
              <button key={value} type="button" onClick={() => { setMode(value); setError(''); }} className={`rounded-lg py-2 text-sm font-bold ${mode === value ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500'}`}>
                {value === 'login' ? '登入' : '註冊'}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
          {mode === 'signup' && (
            <Field label="暱稱" htmlFor="signup-name">
              <input id="signup-name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={50} className={inputClass} autoComplete="nickname" placeholder="店家與訂單上顯示的名字" />
            </Field>
          )}
          <Field label="Email" htmlFor="auth-email">
            <input id="auth-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} className={inputClass} autoComplete="email" placeholder="you@example.com" />
          </Field>
          {mode !== 'forgot' && (
            <Field label="密碼" htmlFor="auth-password" hint={mode === 'signup' ? '至少 8 個字元' : undefined}>
              <input id="auth-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} className={inputClass} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} />
            </Field>
          )}
          {mode === 'signup' && (
            <label className="flex items-start gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} className="mt-0.5 accent-teal-600" />
              <span>我已閱讀並同意 <a href="#/terms" target="_blank" rel="noreferrer" className="font-bold text-teal-700 hover:underline">服務條款</a> 與 <a href="#/privacy" target="_blank" rel="noreferrer" className="font-bold text-teal-700 hover:underline">隱私權政策</a></span>
            </label>
          )}
          {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700" role="alert">{error}</p>}
          <button type="submit" disabled={busy} className={`${primaryButton} w-full py-3`}>
            {busy && <Spinner className="h-4 w-4" />}
            {mode === 'login' ? '登入' : mode === 'signup' ? '註冊' : '寄送重設連結'}
          </button>
        </form>

        {mode === 'login' && (
          <button type="button" onClick={() => { setMode('forgot'); setError(''); }} className="mt-3 w-full text-center text-sm font-bold text-teal-700 hover:underline">忘記密碼？</button>
        )}
        {mode === 'forgot' && (
          <button type="button" onClick={() => { setMode('login'); setError(''); }} className="mt-3 w-full text-center text-sm font-bold text-teal-700 hover:underline">回到登入</button>
        )}

        {mode !== 'forgot' && canUseGoogle && (
          <>
            <div className="my-6 flex items-center gap-3 text-xs text-slate-400"><span className="h-px flex-1 bg-slate-200" />或<span className="h-px flex-1 bg-slate-200" /></div>
            <button type="button" onClick={signInWithGoogle} className={`${secondaryButton} w-full py-3`}>
              <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden><path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.2-2.1 3.5-5.1 3.5-8.7Z" /><path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24Z" /><path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8l4-3.1Z" /><path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.8 3.6-4.9 6.7-4.9Z" /></svg>
              使用 Google 帳號登入
            </button>
          </>
        )}
      </div>
      <p className="mt-4 text-center text-xs text-slate-400">使用本平台即表示你同意 <a href="#/terms" className="hover:underline">服務條款</a> 與 <a href="#/privacy" className="hover:underline">隱私權政策</a>。</p>
    </div>
  );
};
