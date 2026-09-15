import {
  CartItem,
  MealRecommendation,
  Nutrition,
  PriceBreakdown,
  ProductOption,
  SelectedOptionSnapshot,
} from '../types';
import { addNutrition, normalizeNutrition, toSafeNumber } from './numbers';

export const formatCurrency = (value: unknown): string =>
  `NT$${new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 0 }).format(
    Math.round(toSafeNumber(value)),
  )}`;

export const optionNutritionDelta = (option: ProductOption): Nutrition => ({
  calories: toSafeNumber(option.caloriesDelta),
  protein: toSafeNumber(option.proteinDelta),
  fat: toSafeNumber(option.fatDelta),
  carbs: toSafeNumber(option.carbsDelta),
  fiber: toSafeNumber(option.fiberDelta),
  sodium: toSafeNumber(option.sodiumDelta),
  sugar: 0,
});

export const productNutrition = (product: MealRecommendation): Nutrition =>
  normalizeNutrition({
    calories: product.calories,
    ...product.macros,
  });

export const createSelectedOptionSnapshot = (
  groupId: string,
  groupName: string,
  option: ProductOption,
): SelectedOptionSnapshot => ({
  groupId,
  groupName,
  optionId: option.id,
  name: option.name,
  priceDelta: toSafeNumber(option.priceDelta),
  nutritionDelta: optionNutritionDelta(option),
});

export const calculatePriceBreakdown = (
  basePrice: unknown,
  options: SelectedOptionSnapshot[],
): PriceBreakdown => {
  const safeBasePrice = Math.max(0, toSafeNumber(basePrice));
  const optionPrice = options.reduce((sum, option) => sum + toSafeNumber(option.priceDelta), 0);
  return {
    basePrice: safeBasePrice,
    optionPrice,
    unitPrice: safeBasePrice + optionPrice,
  };
};

export const calculateUnitNutrition = (
  baseNutrition: Partial<Nutrition> | undefined,
  options: SelectedOptionSnapshot[],
): Nutrition =>
  addNutrition(
    normalizeNutrition(baseNutrition),
    ...options.map((option) => option.nutritionDelta),
  );

export const calculateCartItem = (item: CartItem): CartItem => {
  const selectedOptions = Array.isArray(item.selectedOptions) ? item.selectedOptions : [];
  return {
    ...item,
    quantity: Math.max(1, Math.floor(toSafeNumber(item.quantity) || 1)),
    basePrice: Math.max(0, toSafeNumber(item.basePrice)),
    selectedOptions,
    priceBreakdown: calculatePriceBreakdown(item.basePrice, selectedOptions),
    unitNutrition: calculateUnitNutrition(item.baseNutrition, selectedOptions),
  };
};

export const calculateItemSubtotal = (item: CartItem): number =>
  calculateCartItem(item).priceBreakdown.unitPrice * Math.max(1, toSafeNumber(item.quantity));
