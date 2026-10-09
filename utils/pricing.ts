import {
  CartItem,
  Fulfillment,
  Merchant,
  Nutrition,
  NutritionKey,
  OptionGroup,
  Product,
  SelectedOption,
} from '../types';

// 這裡的計算規則與資料庫的 compute_order_item() / place_order() 相同。
// 前端只用來「先算給顧客看」；真正收費的金額一律以伺服器計算結果為準。

export const NUTRITION_KEYS: NutritionKey[] = ['calories', 'protein', 'fat', 'carbs', 'fiber', 'sodium', 'sugar'];

const OPTION_DELTA_KEYS: Partial<Record<NutritionKey, keyof OptionGroup['options'][number]>> = {
  calories: 'caloriesDelta',
  protein: 'proteinDelta',
  fat: 'fatDelta',
  carbs: 'carbsDelta',
  fiber: 'fiberDelta',
  sodium: 'sodiumDelta',
};

export const toNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const formatCurrency = (value: unknown): string =>
  `NT$${new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 0 }).format(Math.round(toNumber(value)))}`;

export const hasNutrition = (nutrition: Partial<Nutrition> | null | undefined): boolean =>
  nutrition !== null && nutrition !== undefined && nutrition.calories !== undefined && nutrition.calories !== null;

const round1 = (value: number): number => Math.round(value * 10) / 10;

export const emptyNutrition = (): Nutrition => ({
  calories: 0, protein: 0, fat: 0, carbs: 0, fiber: 0, sodium: 0, sugar: 0,
});

export const addNutrition = (total: Nutrition, value: Nutrition | null, times = 1): Nutrition => {
  if (!value) return total;
  const next = { ...total };
  NUTRITION_KEYS.forEach((key) => {
    next[key] = round1(next[key] + toNumber(value[key]) * times);
  });
  return next;
};

export const groupLimits = (group: OptionGroup): { min: number; max: number } => ({
  min: Math.max(toNumber(group.minSelect), group.required ? 1 : 0),
  max: group.type === 'single' ? 1 : Math.max(1, toNumber(group.maxSelect)),
});

export interface LineResult {
  options: SelectedOption[];
  optionPrice: number;
  unitPrice: number;
  unitNutrition: Nutrition | null;
  /** key = 群組 id，value = 錯誤訊息 */
  errors: Record<string, string>;
}

export const computeLine = (product: Product, selectedOptionIds: string[]): LineResult => {
  const selected = new Set(selectedOptionIds);
  const options: SelectedOption[] = [];
  const errors: Record<string, string> = {};
  let optionPrice = 0;
  let matched = 0;
  const withNutrition = hasNutrition(product.nutrition);
  const totals = emptyNutrition();
  if (withNutrition) {
    NUTRITION_KEYS.forEach((key) => { totals[key] = toNumber(product.nutrition[key]); });
  }

  product.optionGroups.forEach((group) => {
    let count = 0;
    group.options.forEach((option) => {
      if (!selected.has(option.id)) return;
      count += 1;
      matched += 1;
      if (option.available === false) errors[group.id] = `「${option.name}」已停售`;
      optionPrice += Math.round(toNumber(option.priceDelta));
      options.push({
        groupId: group.id,
        groupName: group.name,
        optionId: option.id,
        name: option.name,
        priceDelta: Math.round(toNumber(option.priceDelta)),
      });
      if (withNutrition) {
        (Object.keys(OPTION_DELTA_KEYS) as NutritionKey[]).forEach((key) => {
          const field = OPTION_DELTA_KEYS[key];
          if (field) totals[key] += toNumber(option[field]);
        });
      }
    });
    const { min, max } = groupLimits(group);
    if (count < min) errors[group.id] = `請選擇${group.name}`;
    else if (count > max) errors[group.id] = `${group.name}最多選擇 ${max} 項`;
  });

  if (matched !== selected.size) errors._options = '選項已更新，請重新選擇';

  const unitNutrition = withNutrition
    ? NUTRITION_KEYS.reduce((result, key) => ({ ...result, [key]: Math.max(0, round1(totals[key])) }), emptyNutrition())
    : null;

  return {
    options,
    optionPrice,
    unitPrice: product.price + optionPrice,
    unitNutrition,
    errors,
  };
};

export const cartItemKey = (productId: string, optionIds: string[], remark: string): string =>
  `${productId}|${[...optionIds].sort().join(',')}|${remark.trim()}`;

export interface OrderTotals {
  subtotal: number;
  deliveryFee: number;
  serviceFee: number;
  discount: number;
  total: number;
  itemCount: number;
}

export const computeTotals = (
  merchant: Pick<Merchant, 'deliveryFee' | 'serviceFee' | 'discount'>,
  items: Pick<CartItem, 'unitPrice' | 'quantity'>[],
  fulfillment: Fulfillment,
): OrderTotals => {
  const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const deliveryFee = fulfillment === 'delivery' ? merchant.deliveryFee : 0;
  const serviceFee = merchant.serviceFee;
  const discount = Math.min(merchant.discount, subtotal + deliveryFee + serviceFee);
  return {
    subtotal,
    deliveryFee,
    serviceFee,
    discount,
    total: subtotal + deliveryFee + serviceFee - discount,
    itemCount,
  };
};

export const cartNutrition = (items: Pick<CartItem, 'unitNutrition' | 'quantity'>[]): { total: Nutrition; complete: boolean } => ({
  total: items.reduce((sum, item) => addNutrition(sum, item.unitNutrition, item.quantity), emptyNutrition()),
  complete: items.every((item) => item.unitNutrition !== null),
});
