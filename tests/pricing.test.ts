// 前端試算必須與資料庫 place_order() 的結果一致（數字與 supabase/tests/platform_test.sql 相同）
import { describe, expect, test } from 'vitest';
import { Product } from '../types';
import { computeLine, computeTotals } from '../utils/pricing';

const bento: Product = {
  id: 'f1', merchantId: 'm1', name: '舒肥雞胸便當', description: '', category: '便當', price: 150, imageUrl: '',
  nutrition: { calories: 520, protein: 42, fat: 12, carbs: 58, fiber: 6, sodium: 650 },
  allergens: [], available: true, sortOrder: 0,
  optionGroups: [
    { id: 'rice', name: '飯量', type: 'single', required: true, minSelect: 1, maxSelect: 1, options: [
      { id: 'rice_normal', name: '正常', priceDelta: 0, caloriesDelta: 0, proteinDelta: 0, fatDelta: 0, carbsDelta: 0, fiberDelta: 0, sodiumDelta: 0, available: true },
      { id: 'rice_half', name: '減半', priceDelta: -10, caloriesDelta: -100, proteinDelta: 0, fatDelta: 0, carbsDelta: -22, fiberDelta: 0, sodiumDelta: 0, available: true },
      { id: 'rice_brown', name: '糙米', priceDelta: 10, caloriesDelta: 10, proteinDelta: 0, fatDelta: 0, carbsDelta: 0, fiberDelta: 2, sodiumDelta: 0, available: false },
    ] },
    { id: 'extra', name: '加料', type: 'multiple', required: false, minSelect: 0, maxSelect: 2, options: [
      { id: 'egg', name: '溫泉蛋', priceDelta: 20, caloriesDelta: 70, proteinDelta: 6, fatDelta: 5, carbsDelta: 0, fiberDelta: 0, sodiumDelta: 0, available: true },
      { id: 'veg', name: '加青菜', priceDelta: 15, caloriesDelta: 25, proteinDelta: 0, fatDelta: 0, carbsDelta: 0, fiberDelta: 3, sodiumDelta: 0, available: true },
      { id: 'tofu', name: '加豆腐', priceDelta: 15, caloriesDelta: 80, proteinDelta: 8, fatDelta: 0, carbsDelta: 0, fiberDelta: 0, sodiumDelta: 0, available: true },
    ] },
  ],
};
const tea: Product = { ...bento, id: 'f2', name: '無糖綠茶', price: 30, nutrition: {}, optionGroups: [] };

describe('computeLine', () => {
  test('與資料庫相同的單價與營養', () => {
    const line = computeLine(bento, ['rice_half', 'egg', 'veg']);
    expect(line.errors).toEqual({});
    expect(line.unitPrice).toBe(175);
    expect(line.unitNutrition?.calories).toBe(515);
    expect(line.unitNutrition?.protein).toBe(48);
    expect(line.unitNutrition?.carbs).toBe(36);
    expect(line.options.map((option) => option.name)).toEqual(['減半', '溫泉蛋', '加青菜']);
  });
  test('沒有營養標示的餐點回傳 null', () => {
    expect(computeLine(tea, []).unitNutrition).toBeNull();
  });
  test('必選沒選', () => {
    expect(computeLine(bento, ['egg']).errors.rice).toBe('請選擇飯量');
  });
  test('單選選兩個', () => {
    expect(computeLine(bento, ['rice_normal', 'rice_half']).errors.rice).toBe('飯量最多選擇 1 項');
  });
  test('複選超過上限', () => {
    expect(computeLine(bento, ['rice_normal', 'egg', 'veg', 'tofu']).errors.extra).toBe('加料最多選擇 2 項');
  });
  test('停售選項', () => {
    expect(computeLine(bento, ['rice_brown']).errors.rice).toContain('已停售');
  });
  test('不存在的選項', () => {
    expect(computeLine(bento, ['rice_normal', 'free_steak']).errors._options).toBeDefined();
  });
});

describe('computeTotals', () => {
  const merchant = { deliveryFee: 40, serviceFee: 10, discount: 15 };
  test('自取：與資料庫測試的 375 相同', () => {
    const totals = computeTotals(merchant, [{ unitPrice: 175, quantity: 2 }, { unitPrice: 30, quantity: 1 }], 'pickup');
    expect(totals).toEqual({ subtotal: 380, deliveryFee: 0, serviceFee: 10, discount: 15, total: 375, itemCount: 3 });
  });
  test('外送：與資料庫測試的 195 相同', () => {
    expect(computeTotals(merchant, [{ unitPrice: 80, quantity: 2 }], 'delivery').total).toBe(195);
  });
  test('折扣不會讓金額變成負數', () => {
    expect(computeTotals({ deliveryFee: 0, serviceFee: 0, discount: 100 }, [{ unitPrice: 30, quantity: 1 }], 'pickup').total).toBe(0);
  });
});
