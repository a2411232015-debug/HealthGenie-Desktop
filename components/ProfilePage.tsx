import React, { useEffect, useState } from 'react';
import { ChevronRight, Download, LogOut, ShieldCheck, ShoppingBag, Trash2, UtensilsCrossed } from 'lucide-react';
import { isIos, isStandalone, useInstallPrompt } from '../lib/pwa';
import { deleteMyAccount, saveWeight, updateProfile } from '../lib/api';
import { useAuth } from '../lib/auth';
import { cartCount, useCart } from '../lib/cart';
import { ActivityLevel, Gender, HealthProfile } from '../types';
import { bmi, bmiLabel, calculateHealthTargets } from '../utils/health';
import { isValidPhone, taipeiDate } from '../utils/format';
import { errorMessage, showToast } from '../utils/notifications';
import { ErrorState, Field, Modal, PageHeader, PageLoading, Spinner, card, dangerButton, inputClass, primaryButton, secondaryButton } from './ui';
import { clearCart } from '../lib/cart';
import { supabase } from '../lib/supabase';
import { navigate } from '../lib/router';

interface HealthForm {
  gender: Gender | '';
  age: string;
  height: string;
  weight: string;
  targetWeight: string;
  activityLevel: ActivityLevel | '';
}

const toForm = (health: Partial<HealthProfile>): HealthForm => ({
  gender: health.gender || '',
  age: health.age ? String(health.age) : '',
  height: health.height ? String(health.height) : '',
  weight: health.weight ? String(health.weight) : '',
  targetWeight: health.targetWeight ? String(health.targetWeight) : '',
  activityLevel: health.activityLevel || '',
});

export const ProfilePage: React.FC = () => {
  const { userId, email, profile, merchant, loading, setProfile, signOut, refreshProfile } = useAuth();
  const cart = useCart();
  const [account, setAccount] = useState({ displayName: '', phone: '', defaultAddress: '' });
  const [health, setHealth] = useState<HealthForm>(toForm({}));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<'' | 'account' | 'health'>('');
  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [busyDelete, setBusyDelete] = useState(false);
  const installer = useInstallPrompt();

  useEffect(() => {
    if (!profile) return;
    setAccount({ displayName: profile.displayName, phone: profile.phone, defaultAddress: profile.defaultAddress });
    setHealth(toForm(profile.health));
  }, [profile]);

  if (!loading && !profile) return <ErrorState message="無法讀取帳戶資料" onRetry={() => void refreshProfile().catch(() => undefined)} />;
  if (!profile || !userId) return <PageLoading />;

  const saveAccount = async (event: React.FormEvent) => {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (!account.displayName.trim()) next.displayName = '請輸入暱稱';
    if (account.phone.trim() && !isValidPhone(account.phone)) next.phone = '電話格式不正確';
    setErrors(next);
    if (Object.keys(next).length) return;
    setSaving('account');
    try {
      setProfile(await updateProfile(userId, { ...account, phone: account.phone.replace(/[\s-]/g, '') }));
      showToast('帳戶資料已儲存');
    } catch (caught) {
      showToast(errorMessage(caught), 'error');
    } finally {
      setSaving('');
    }
  };

  const saveHealth = async (event: React.FormEvent) => {
    event.preventDefault();
    const next: Record<string, string> = {};
    const age = Number(health.age);
    const height = Number(health.height);
    const weight = Number(health.weight);
    const target = health.targetWeight.trim() ? Number(health.targetWeight) : undefined;
    if (!health.gender) next.gender = '請選擇';
    if (!(age >= 10 && age <= 120)) next.age = '請輸入 10–120';
    if (!(height >= 100 && height <= 250)) next.height = '請輸入 100–250';
    if (!(weight >= 20 && weight <= 400)) next.weight = '請輸入 20–400';
    if (target !== undefined && !(target >= 20 && target <= 400)) next.targetWeight = '請輸入 20–400';
    if (!health.activityLevel) next.activityLevel = '請選擇';
    setErrors(next);
    if (Object.keys(next).length) return;
    setSaving('health');
    try {
      const nextHealth: HealthProfile = {
        gender: health.gender as Gender,
        age,
        height,
        weight: Math.round(weight * 10) / 10,
        targetWeight: target,
        activityLevel: health.activityLevel as ActivityLevel,
      };
      setProfile(await updateProfile(userId, { health: nextHealth }));
      if (nextHealth.weight !== profile.health.weight) await saveWeight(userId, nextHealth.weight, taipeiDate());
      showToast('健康資料已儲存');
    } catch (caught) {
      showToast(errorMessage(caught), 'error');
    } finally {
      setSaving('');
    }
  };

  const removeAccount = async () => {
    setBusyDelete(true);
    setDeleteError('');
    try {
      await deleteMyAccount();
      clearCart();
      navigate('/stores', { replace: true });
      await supabase().auth.signOut({ scope: 'local' }).catch(() => undefined);
      showToast('帳號與個人資料已刪除，謝謝你使用 HealthGenie', 'info');
    } catch (caught) {
      setDeleteError(errorMessage(caught));
      setBusyDelete(false);
    }
  };

  const previewTargets = calculateHealthTargets({
    gender: health.gender || undefined,
    age: Number(health.age),
    height: Number(health.height),
    weight: Number(health.weight),
    targetWeight: Number(health.targetWeight) || undefined,
    activityLevel: health.activityLevel || undefined,
  });
  const bmiValue = bmi({ height: Number(health.height), weight: Number(health.weight) });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="我的帳戶" subtitle={email} />

      <nav className={`${card} divide-y divide-slate-100`}>
        <a href="#/cart" className="flex items-center gap-3 px-5 py-4 hover:bg-slate-50 md:hidden">
          <ShoppingBag className="h-5 w-5 text-teal-600" /><span className="flex-1 font-bold">購物車</span>
          {cartCount(cart) > 0 && <span className="rounded-full bg-teal-600 px-2 py-0.5 text-xs font-bold text-white">{cartCount(cart)}</span>}
          <ChevronRight className="h-4 w-4 text-slate-400" />
        </a>
        <a href={merchant ? '#/merchant/orders' : '#/merchant/apply'} className="flex items-center gap-3 px-5 py-4 hover:bg-slate-50">
          <UtensilsCrossed className="h-5 w-5 text-teal-600" />
          <span className="flex-1">
            <span className="block font-bold">{merchant ? '商家後台' : '成為合作店家'}</span>
            <span className="block text-xs text-slate-500">{merchant ? `${merchant.name} · 接單、菜單、營業設定` : '開店上架你的健康餐點'}</span>
          </span>
          <ChevronRight className="h-4 w-4 text-slate-400" />
        </a>
        {profile.isAdmin && (
          <a href="#/admin" className="flex items-center gap-3 px-5 py-4 hover:bg-slate-50">
            <ShieldCheck className="h-5 w-5 text-teal-600" /><span className="flex-1 font-bold">平台管理</span><ChevronRight className="h-4 w-4 text-slate-400" />
          </a>
        )}
      </nav>

      <form onSubmit={saveAccount} className={`${card} space-y-4 p-5`} noValidate>
        <h2 className="font-black text-slate-900">帳戶資料</h2>
        <Field label="暱稱" htmlFor="profile-name" error={errors.displayName}>
          <input id="profile-name" value={account.displayName} maxLength={50} onChange={(event) => setAccount({ ...account, displayName: event.target.value })} className={inputClass} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="手機" htmlFor="profile-phone" error={errors.phone} hint="結帳時自動帶入">
            <input id="profile-phone" type="tel" value={account.phone} onChange={(event) => setAccount({ ...account, phone: event.target.value })} className={inputClass} placeholder="0912345678" />
          </Field>
          <Field label="常用外送地址" htmlFor="profile-address">
            <input id="profile-address" value={account.defaultAddress} maxLength={200} onChange={(event) => setAccount({ ...account, defaultAddress: event.target.value })} className={inputClass} />
          </Field>
        </div>
        <button type="submit" disabled={saving === 'account'} className={primaryButton}>{saving === 'account' && <Spinner className="h-4 w-4" />}儲存帳戶資料</button>
      </form>

      <form onSubmit={saveHealth} className={`${card} space-y-4 p-5`} noValidate>
        <div>
          <h2 className="font-black text-slate-900">健康資料</h2>
          <p className="mt-1 text-xs text-slate-500">只有你自己看得到，用來計算每日熱量目標與推薦餐點。</p>
        </div>
        <Field label="生理性別" error={errors.gender}>
          <div className="flex gap-3">
            {[Gender.MALE, Gender.FEMALE].map((gender) => (
              <button type="button" key={gender} onClick={() => setHealth({ ...health, gender })} className={`flex-1 rounded-xl border-2 py-2.5 font-bold ${health.gender === gender ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-slate-100 text-slate-500'}`}>{gender}</button>
            ))}
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Field label="年齡" htmlFor="health-age" error={errors.age}><input id="health-age" type="number" inputMode="numeric" value={health.age} onChange={(event) => setHealth({ ...health, age: event.target.value })} className={inputClass} /></Field>
          <Field label="身高 (cm)" htmlFor="health-height" error={errors.height}><input id="health-height" type="number" inputMode="decimal" value={health.height} onChange={(event) => setHealth({ ...health, height: event.target.value })} className={inputClass} /></Field>
          <Field label="體重 (kg)" htmlFor="health-weight" error={errors.weight}><input id="health-weight" type="number" step="0.1" inputMode="decimal" value={health.weight} onChange={(event) => setHealth({ ...health, weight: event.target.value })} className={inputClass} /></Field>
          <Field label="目標體重" htmlFor="health-target" error={errors.targetWeight}><input id="health-target" type="number" step="0.1" inputMode="decimal" value={health.targetWeight} onChange={(event) => setHealth({ ...health, targetWeight: event.target.value })} className={inputClass} placeholder="選填" /></Field>
        </div>
        <Field label="日常活動量" htmlFor="health-activity" error={errors.activityLevel}>
          <select id="health-activity" value={health.activityLevel} onChange={(event) => setHealth({ ...health, activityLevel: event.target.value as ActivityLevel })} className={inputClass}>
            <option value="">請選擇</option>
            {Object.values(ActivityLevel).map((level) => <option key={level} value={level}>{level}</option>)}
          </select>
        </Field>
        {(bmiValue || previewTargets) && (
          <div className="grid gap-3 rounded-xl bg-teal-50 p-4 sm:grid-cols-2">
            {bmiValue && <div><p className="text-xs font-bold text-teal-800">BMI</p><p className="text-2xl font-black text-slate-900">{bmiValue}</p><p className="text-xs text-teal-800">{bmiLabel(bmiValue)}</p></div>}
            {previewTargets && <div><p className="text-xs font-bold text-teal-800">建議每日熱量</p><p className="text-2xl font-black text-slate-900">{previewTargets.dailyCalories} kcal</p><p className="text-xs text-teal-800">蛋白質約 {previewTargets.macros.protein} g</p></div>}
          </div>
        )}
        <button type="submit" disabled={saving === 'health'} className={primaryButton}>{saving === 'health' && <Spinner className="h-4 w-4" />}儲存健康資料</button>
      </form>

      {!isStandalone() && (installer.canInstall || isIos()) && window.location.protocol.startsWith('http') && (
        <section className={`${card} flex flex-col gap-3 p-5 sm:flex-row sm:items-center`}>
          <Download className="h-6 w-6 shrink-0 text-teal-600" />
          <div className="flex-1">
            <p className="font-bold text-slate-900">把 HealthGenie 加到主畫面</p>
            <p className="text-sm text-slate-500">{installer.canInstall ? '像 App 一樣從桌面直接打開，點餐更快。' : '在 Safari 點下方「分享」按鈕，再選「加入主畫面」。'}</p>
          </div>
          {installer.canInstall && <button onClick={() => void installer.install()} className={primaryButton}>安裝</button>}
        </section>
      )}

      <button onClick={() => void signOut()} className={`${secondaryButton} w-full`}><LogOut className="h-4 w-4" />登出</button>

      <section className="rounded-2xl border border-red-100 bg-red-50/40 p-5">
        <h2 className="font-black text-red-800">刪除帳號</h2>
        <p className="mt-1 text-sm text-red-900/80">刪除後，你的健康資料、飲食與體重紀錄會立即刪除，過去訂單上的姓名、電話與地址也會清除，無法復原。</p>
        <button onClick={() => { setDeleting(true); setConfirmText(''); setDeleteError(''); }} className={`${secondaryButton} mt-3 border-red-200 text-red-700`}><Trash2 className="h-4 w-4" />刪除我的帳號</button>
      </section>
      <p className="text-center text-xs text-slate-400"><a href="#/privacy" className="hover:underline">隱私權政策</a> · <a href="#/terms" className="hover:underline">服務條款</a></p>

      {deleting && (
        <Modal
          title="確定要刪除帳號？"
          onClose={() => !busyDelete && setDeleting(false)}
          footer={(
            <div className="flex gap-3">
              <button onClick={() => setDeleting(false)} disabled={busyDelete} className={`${secondaryButton} flex-1`}>取消</button>
              <button onClick={removeAccount} disabled={busyDelete || confirmText.trim() !== '刪除'} className={`${dangerButton} flex-1`}>{busyDelete && <Spinner className="h-4 w-4" />}永久刪除</button>
            </div>
          )}
        >
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600">
            <li>健康資料、飲食紀錄、體重紀錄會全部刪除</li>
            <li>過去的訂單只保留金額與品項給店家對帳，不含你的姓名與聯絡方式</li>
            <li>有進行中的訂單、或你經營店家時，需要先處理完才能刪除</li>
          </ul>
          <label htmlFor="confirm-delete" className="mt-4 block text-sm font-bold text-slate-700">請輸入「刪除」兩個字確認</label>
          <input id="confirm-delete" value={confirmText} onChange={(event) => setConfirmText(event.target.value)} className={`${inputClass} mt-2`} autoComplete="off" />
          {deleteError && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{deleteError}</p>}
        </Modal>
      )}
    </div>
  );
};
