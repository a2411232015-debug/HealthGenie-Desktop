// 與資料庫 is_open_at() 的測試案例相同
import { describe, expect, test } from 'vitest';
import { describeDay, isOpenAt, validateOpeningHours } from '../utils/hours';

const lunchMonday = [{ day: 1, open: '11:00', close: '14:00' }];
const lateFriday = [{ day: 5, open: '18:00', close: '02:00' }];

describe('isOpenAt', () => {
  test('週一中午營業中', () => expect(isOpenAt(lunchMonday, new Date('2026-10-05T12:00:00+08:00'))).toBe(true));
  test('打烊時間整點就不能下單', () => expect(isOpenAt(lunchMonday, new Date('2026-10-05T14:00:00+08:00'))).toBe(false));
  test('週二沒有營業', () => expect(isOpenAt(lunchMonday, new Date('2026-10-06T12:00:00+08:00'))).toBe(false));
  test('週五跨夜營業到週六凌晨', () => expect(isOpenAt(lateFriday, new Date('2026-10-10T01:30:00+08:00'))).toBe(true));
  test('跨夜時段結束後打烊', () => expect(isOpenAt(lateFriday, new Date('2026-10-10T02:30:00+08:00'))).toBe(false));
  test('用台北時間判斷', () => expect(isOpenAt(lunchMonday, new Date('2026-10-05T04:00:00Z'))).toBe(true));
  test('沒有營業時間就是休息', () => expect(isOpenAt([], new Date())).toBe(false));
});

describe('validateOpeningHours', () => {
  test('開店與打烊相同不合法', () => expect(validateOpeningHours([{ day: 1, open: '10:00', close: '10:00' }])).not.toBeNull());
  test('格式錯誤不合法', () => expect(validateOpeningHours([{ day: 1, open: '25:00', close: '10:00' }])).not.toBeNull());
  test('正常時間', () => expect(validateOpeningHours(lunchMonday)).toBeNull());
});

test('describeDay', () => {
  expect(describeDay([...lateFriday, { day: 5, open: '11:00', close: '14:00' }], 5)).toBe('11:00–14:00、18:00–隔天 02:00');
  expect(describeDay(lunchMonday, 0)).toBe('公休');
});
