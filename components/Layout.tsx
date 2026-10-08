import React from 'react';
import {
  Activity,
  ClipboardList,
  HeartPulse,
  LogIn,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Store,
  UserCircle,
  UtensilsCrossed,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { cartCount, useCart } from '../lib/cart';
import { navigate, Route } from '../lib/router';
import { formatCurrency } from '../utils/pricing';

interface NavEntry {
  path: string;
  pages: string[];
  label: string;
  icon: React.ReactNode;
  badge?: number;
}

const NavLink: React.FC<{ entry: NavEntry; active: boolean }> = ({ entry, active }) => (
  <a
    href={`#${entry.path}`}
    className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm transition ${active ? 'bg-teal-50 font-bold text-teal-700' : 'font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
    aria-current={active ? 'page' : undefined}
  >
    <span className={active ? 'text-teal-600' : 'text-slate-400'}>{entry.icon}</span>
    <span className="flex-1">{entry.label}</span>
    {entry.badge ? <span className="rounded-full bg-teal-600 px-2 py-0.5 text-xs font-bold text-white">{entry.badge}</span> : null}
  </a>
);

export const Layout: React.FC<{ route: Route; children: React.ReactNode }> = ({ route, children }) => {
  const { session, profile, merchant } = useAuth();
  const cart = useCart();
  const count = cartCount(cart);
  const cartTotal = cart.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

  const customerNav: NavEntry[] = [
    { path: '/stores', pages: ['stores', 'store'], label: '店家點餐', icon: <Store className="h-5 w-5" /> },
    { path: '/recommend', pages: ['recommend'], label: '健康推薦', icon: <Sparkles className="h-5 w-5" /> },
    { path: '/cart', pages: ['cart', 'checkout'], label: '購物車', icon: <ShoppingBag className="h-5 w-5" />, badge: count },
    { path: '/orders', pages: ['orders', 'order'], label: '我的訂單', icon: <ClipboardList className="h-5 w-5" /> },
    { path: '/health', pages: ['health'], label: '健康紀錄', icon: <HeartPulse className="h-5 w-5" /> },
    { path: '/me', pages: ['me'], label: '我的帳戶', icon: <UserCircle className="h-5 w-5" /> },
  ];
  const businessNav: NavEntry[] = [
    ...(session ? [{
      path: merchant ? '/merchant/orders' : '/merchant/apply',
      pages: ['merchant'],
      label: merchant ? '商家後台' : '成為合作店家',
      icon: <UtensilsCrossed className="h-5 w-5" />,
    }] : []),
    ...(profile?.isAdmin ? [{ path: '/admin', pages: ['admin'], label: '平台管理', icon: <ShieldCheck className="h-5 w-5" /> }] : []),
  ];
  const mobileNav: NavEntry[] = [
    customerNav[0],
    customerNav[1],
    customerNav[3],
    customerNav[4],
    { ...customerNav[5], label: '我的', pages: ['me', 'merchant', 'admin', 'login'] },
  ];
  const showCartBar = count > 0 && ['stores', 'store', 'recommend'].includes(route.page);
  const hideMobileNav = ['checkout', 'login', 'reset-password'].includes(route.page);

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="fixed z-20 hidden h-full w-64 flex-col border-r border-slate-200 bg-white px-3 md:flex">
        <a href="#/stores" className="flex items-center gap-2 px-4 pb-6 pt-7 text-2xl font-black tracking-tight text-teal-700">
          <span className="rounded-lg bg-teal-600 p-1 text-white"><Activity className="h-5 w-5" /></span>
          HealthGenie
        </a>
        <nav className="flex-1 space-y-1 overflow-y-auto" aria-label="主要選單">
          {customerNav.map((entry) => <NavLink key={entry.path} entry={entry} active={entry.pages.includes(route.page)} />)}
          {businessNav.length > 0 && <p className="px-4 pb-1 pt-5 text-xs font-bold uppercase tracking-wider text-slate-400">店家與管理</p>}
          {businessNav.map((entry) => <NavLink key={entry.path} entry={entry} active={entry.pages.includes(route.page)} />)}
        </nav>
        <div className="border-t border-slate-100 py-4">
          {session ? (
            <a href="#/me" className="flex items-center gap-3 rounded-xl px-4 py-2 hover:bg-slate-50">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-100 font-black text-teal-700">
                {(profile?.displayName || '我').slice(0, 1)}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold text-slate-800">{profile?.displayName || '會員'}</span>
                <span className="block text-xs text-slate-400">查看帳戶</span>
              </span>
            </a>
          ) : (
            <button onClick={() => navigate(`/login?next=${encodeURIComponent(route.path)}`)} className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-3 text-sm font-bold text-white hover:bg-teal-700">
              <LogIn className="h-4 w-4" /> 登入 / 註冊
            </button>
          )}
        </div>
      </aside>

      <main className={`mx-auto w-full max-w-[1400px] flex-1 p-4 md:ml-64 md:p-8 ${showCartBar ? 'pb-40' : 'pb-24'} md:pb-12`}>
        {children}
      </main>

      {showCartBar && (
        <a href="#/cart" className="fixed bottom-20 left-4 right-4 z-40 flex items-center justify-between rounded-2xl bg-teal-600 px-5 py-3.5 text-white shadow-xl shadow-teal-900/20 md:bottom-8 md:left-auto md:right-8 md:w-96">
          <span className="flex items-center gap-2 font-bold">
            <ShoppingBag className="h-5 w-5" /> 購物車 {count} 件
            <span className="max-w-[8rem] truncate text-xs font-medium text-teal-100">· {cart.merchantName}</span>
          </span>
          <span className="font-black">{formatCurrency(cartTotal)} →</span>
        </a>
      )}

      {!hideMobileNav && (
        <nav className="fixed bottom-0 left-0 right-0 z-50 flex justify-around border-t border-slate-200 bg-white px-1 pb-[env(safe-area-inset-bottom)] pt-1 md:hidden" aria-label="手機選單">
          {mobileNav.map((entry) => {
            const active = entry.pages.includes(route.page);
            return (
              <a key={entry.path} href={`#${entry.path}`} className={`flex w-16 flex-col items-center rounded-xl py-1.5 ${active ? 'text-teal-700' : 'text-slate-500'}`}>
                {entry.icon}
                <span className="mt-0.5 text-[11px] font-bold">{entry.label}</span>
              </a>
            );
          })}
        </nav>
      )}
    </div>
  );
};
