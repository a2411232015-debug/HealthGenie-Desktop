import { useEffect, useState } from 'react';
import { calculateHealthTargets, HealthTargets } from '../utils/health';
import { startOfTaipeiDay } from '../utils/format';
import { fetchFoodLogs } from './api';
import { useAuth } from './auth';

export interface TodayIntake {
  targets: HealthTargets | null;
  consumedCalories: number;
  loaded: boolean;
}

/** 今天已吃的熱量（來自飲食紀錄）與每日目標，給推薦與健康提醒使用 */
export const useTodayIntake = (): TodayIntake => {
  const { userId, profile } = useAuth();
  const [consumed, setConsumed] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!userId) {
      setConsumed(0);
      setLoaded(true);
      return undefined;
    }
    let active = true;
    const load = () => {
      fetchFoodLogs(startOfTaipeiDay())
        .then((logs) => { if (active) setConsumed(logs.reduce((sum, log) => sum + log.calories, 0)); })
        .catch(() => undefined)
        .finally(() => { if (active) setLoaded(true); });
    };
    load();
    window.addEventListener('food_logs_updated', load);
    return () => {
      active = false;
      window.removeEventListener('food_logs_updated', load);
    };
  }, [userId]);

  return { targets: calculateHealthTargets(profile?.health), consumedCalories: consumed, loaded };
};

export const notifyFoodLogsUpdated = (): void => {
  window.dispatchEvent(new Event('food_logs_updated'));
};
