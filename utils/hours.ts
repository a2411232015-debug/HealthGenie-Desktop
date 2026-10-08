import { OpeningSlot } from '../types';

// 規則與資料庫的 is_open_at() 相同：一律用台灣時間判斷，支援跨夜時段（例如 18:00–02:00）。

export const WEEKDAY_LABELS = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const WEEKDAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export const isValidTime = (value: string): boolean => TIME_PATTERN.test(value);

const toMinutes = (value: string): number => {
  const match = TIME_PATTERN.exec(value);
  return match ? Number(match[1]) * 60 + Number(match[2]) : Number.NaN;
};

export const taipeiClock = (date: Date): { day: number; minutes: number } => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Taipei',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value || '';
  return {
    day: WEEKDAY_INDEX[get('weekday')] ?? 0,
    minutes: Number(get('hour')) * 60 + Number(get('minute')),
  };
};

export const validateOpeningHours = (slots: OpeningSlot[]): string | null => {
  for (const slot of slots) {
    if (!isValidTime(slot.open) || !isValidTime(slot.close)) return `${WEEKDAY_LABELS[slot.day] || ''}的時間格式不正確`;
    if (slot.open === slot.close) return `${WEEKDAY_LABELS[slot.day]}的開店與打烊時間不能相同`;
  }
  return null;
};

export const isOpenAt = (slots: OpeningSlot[], date: Date = new Date()): boolean => {
  if (!Array.isArray(slots) || validateOpeningHours(slots)) return false;
  const { day, minutes } = taipeiClock(date);
  const yesterday = (day + 6) % 7;
  return slots.some((slot) => {
    const open = toMinutes(slot.open);
    const close = toMinutes(slot.close);
    if (close > open) return slot.day === day && minutes >= open && minutes < close;
    return (slot.day === day && minutes >= open) || (slot.day === yesterday && minutes < close);
  });
};

export const slotsForDay = (slots: OpeningSlot[], day: number): OpeningSlot[] =>
  slots.filter((slot) => slot.day === day).sort((a, b) => a.open.localeCompare(b.open));

export const formatSlot = (slot: OpeningSlot): string =>
  `${slot.open}–${toMinutes(slot.close) <= toMinutes(slot.open) ? '隔天 ' : ''}${slot.close}`;

export const describeDay = (slots: OpeningSlot[], day: number): string => {
  const today = slotsForDay(slots, day);
  return today.length === 0 ? '公休' : today.map(formatSlot).join('、');
};

export const describeToday = (slots: OpeningSlot[], date: Date = new Date()): string =>
  `今日 ${describeDay(slots, taipeiClock(date).day)}`;

export const defaultOpeningHours = (): OpeningSlot[] =>
  [1, 2, 3, 4, 5, 6].flatMap((day) => [
    { day, open: '11:00', close: '14:00' },
    { day, open: '17:00', close: '20:30' },
  ]);
