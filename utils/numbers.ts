import { Nutrition, NutritionDelta } from '../types';

export const toSafeNumber = (value: unknown): number => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
};

export const clampNumber = (value: unknown, min: number, max: number): number =>
  Math.min(max, Math.max(min, toSafeNumber(value)));

export const EMPTY_NUTRITION: Nutrition = {
  calories: 0,
  protein: 0,
  fat: 0,
  carbs: 0,
  fiber: 0,
  sodium: 0,
  sugar: 0,
};

export const normalizeNutrition = (
  value?: Partial<Nutrition> | Partial<NutritionDelta> | null,
): Nutrition => ({
  calories: toSafeNumber(value?.calories),
  protein: toSafeNumber(value?.protein),
  fat: toSafeNumber(value?.fat),
  carbs: toSafeNumber(value?.carbs),
  fiber: toSafeNumber(value?.fiber),
  sodium: toSafeNumber(value?.sodium),
  sugar: toSafeNumber(value?.sugar),
});

export const addNutrition = (...values: Array<Partial<Nutrition> | undefined>): Nutrition =>
  values.reduce<Nutrition>(
    (total, value) => {
      const safe = normalizeNutrition(value);
      return {
        calories: total.calories + safe.calories,
        protein: total.protein + safe.protein,
        fat: total.fat + safe.fat,
        carbs: total.carbs + safe.carbs,
        fiber: total.fiber + safe.fiber,
        sodium: total.sodium + safe.sodium,
        sugar: total.sugar + safe.sugar,
      };
    },
    { ...EMPTY_NUTRITION },
  );

export const multiplyNutrition = (value: Partial<Nutrition>, quantity: unknown): Nutrition => {
  const multiplier = Math.max(0, toSafeNumber(quantity));
  const safe = normalizeNutrition(value);
  return Object.fromEntries(
    Object.entries(safe).map(([key, amount]) => [key, amount * multiplier]),
  ) as unknown as Nutrition;
};

export const hasNutritionData = (
  calories: unknown,
  macros?: Partial<Omit<Nutrition, 'calories'>>,
): boolean => {
  const values = [calories, macros?.protein, macros?.fat, macros?.carbs, macros?.fiber, macros?.sodium];
  return values.some((value) => value !== undefined && value !== null && value !== '');
};

export const formatNutritionValue = (value: unknown, unit: string): string => {
  if (value === undefined || value === null || value === '') return '尚未提供';
  const safe = toSafeNumber(value);
  return `${Number.isInteger(safe) ? safe : safe.toFixed(1)} ${unit}`;
};
