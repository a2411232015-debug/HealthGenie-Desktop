import { DependencyList, useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage } from '../utils/notifications';

export interface QueryState<T> {
  data: T | undefined;
  error: string | null;
  loading: boolean;
  /** 重新讀取；silent = true 時不顯示讀取中 */
  reload: (silent?: boolean) => Promise<void>;
  setData: (updater: T | ((current: T | undefined) => T)) => void;
}

export const useQuery = <T,>(fetcher: () => Promise<T>, deps: DependencyList, enabled = true): QueryState<T> => {
  const [data, setDataState] = useState<T | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(enabled);
  const requestId = useRef(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const reload = useCallback(async (silent = false) => {
    const id = ++requestId.current;
    if (!silent) setLoading(true);
    try {
      const result = await fetcherRef.current();
      if (id === requestId.current) {
        setDataState(result);
        setError(null);
      }
    } catch (caught) {
      if (id === requestId.current) setError(errorMessage(caught));
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps]);

  const setData = useCallback((updater: T | ((current: T | undefined) => T)) => {
    setDataState((current) => (typeof updater === 'function' ? (updater as (value: T | undefined) => T)(current) : updater));
  }, []);

  return { data, error, loading, reload, setData };
};

/** 每隔一段時間、以及切回這個分頁時重新整理（商家接單頁在背景也要持續檢查新訂單） */
export const useAutoRefresh = (refresh: () => void, intervalMs: number, enabled = true, runWhenHidden = false): void => {
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  useEffect(() => {
    if (!enabled) return undefined;
    const timer = window.setInterval(() => {
      if (runWhenHidden || document.visibilityState === 'visible') refreshRef.current();
    }, intervalMs);
    const onVisible = () => {
      if (document.visibilityState === 'visible') refreshRef.current();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [intervalMs, enabled, runWhenHidden]);
};
