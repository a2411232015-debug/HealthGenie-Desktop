export const formatDateTime = (value: string | null | undefined): string => {
  if (!value) return '—';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '—';
  return date.toLocaleString('zh-TW', {
    timeZone: 'Asia/Taipei',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
};

export const formatTime = (value: string | null | undefined): string => {
  if (!value) return '—';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '—';
  return date.toLocaleTimeString('zh-TW', { timeZone: 'Asia/Taipei', hour: '2-digit', minute: '2-digit', hour12: false });
};

export const minutesAgo = (value: string, now: number = Date.now()): string => {
  const diff = Math.max(0, Math.round((now - new Date(value).getTime()) / 60000));
  if (diff < 1) return '剛剛';
  if (diff < 60) return `${diff} 分鐘前`;
  const hours = Math.floor(diff / 60);
  if (hours < 24) return `${hours} 小時前`;
  return `${Math.floor(hours / 24)} 天前`;
};

/** 台灣時間的 YYYY-MM-DD */
export const taipeiDate = (date: Date = new Date()): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);

/** 台灣時間某一天 00:00 對應的 ISO 時間 */
export const startOfTaipeiDay = (date: Date = new Date()): string =>
  new Date(`${taipeiDate(date)}T00:00:00+08:00`).toISOString();

export const isValidPhone = (phone: string): boolean =>
  /^(09\d{8}|0[2-8]\d{6,8})$/.test(phone.replace(/[\s-]/g, ''));

export const formatNumber = (value: number | null | undefined, unit = ''): string => {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return '—';
  const number = Number(value);
  return `${Number.isInteger(number) ? number : number.toFixed(1)}${unit ? ` ${unit}` : ''}`;
};
