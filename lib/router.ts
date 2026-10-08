import { useEffect, useState } from 'react';

// 用網址 # 後面的路徑切換頁面（GitHub Pages 與桌面版都能用）。
// 例如：#/stores、#/store/<店家id>、#/order/<訂單id>、#/merchant/menu

export interface Route {
  /** 第一段，例如 'store' */
  page: string;
  /** 第二段，例如店家 id */
  param: string | null;
  path: string;
}

export const parseRoute = (hash: string = window.location.hash): Route => {
  const path = hash.replace(/^#/, '').split('?')[0] || '/';
  const [page = '', param = null] = path.replace(/^\/+/, '').split('/');
  return { page: page || 'stores', param: param || null, path };
};

export const navigate = (path: string, options: { replace?: boolean } = {}): void => {
  const hash = `#${path.startsWith('/') ? path : `/${path}`}`;
  if (options.replace) {
    window.history.replaceState(null, '', hash);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else if (window.location.hash !== hash) {
    window.location.hash = hash;
  }
};

export const useRoute = (): Route => {
  const [route, setRoute] = useState<Route>(() => parseRoute());
  useEffect(() => {
    const update = () => {
      setRoute(parseRoute());
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);
  return route;
};

/** 讀取 # 後面的查詢參數，例如 #/login?next=/checkout */
export const routeQuery = (name: string): string | null => {
  const query = window.location.hash.split('?')[1] || '';
  return new URLSearchParams(query).get(name);
};
