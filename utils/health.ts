import { ActivityLevel, Gender, HealthProfile, Nutrition } from '../types';

export interface HealthTargets {
  bmr: number;
  tdee: number;
  dailyCalories: number;
  macros: {
    protein: number;
    carbs: number;
    fat: number;
  };
}

const ACTIVITY_MULTIPLIER: Record<ActivityLevel, number> = {
  [ActivityLevel.SEDENTARY]: 1.2,
  [ActivityLevel.LIGHT]: 1.375,
  [ActivityLevel.MODERATE]: 1.55,
  [ActivityLevel.HEAVY]: 1.725,
};

export const isHealthProfileComplete = (health: Partial<HealthProfile> | undefined): health is HealthProfile =>
  Boolean(
    health
    && (health.gender === Gender.MALE || health.gender === Gender.FEMALE)
    && Number(health.age) >= 10 && Number(health.age) <= 120
    && Number(health.height) >= 100 && Number(health.height) <= 250
    && Number(health.weight) >= 20 && Number(health.weight) <= 400
    && health.activityLevel && ACTIVITY_MULTIPLIER[health.activityLevel],
  );

/**
 * Mifflin-St Jeor 公式。目標體重比目前輕時以 TDEE 85% 作為每日熱量（溫和減脂），
 * 想增重時 +10%，其餘維持 TDEE。三大營養素比例：蛋白質 30%、碳水 40%、脂肪 30%。
 */
export const calculateHealthTargets = (health: Partial<HealthProfile> | undefined): HealthTargets | null => {
  if (!isHealthProfileComplete(health)) return null;
  const base = 10 * health.weight + 6.25 * health.height - 5 * health.age;
  const bmr = health.gender === Gender.MALE ? base + 5 : base - 161;
  const tdee = bmr * ACTIVITY_MULTIPLIER[health.activityLevel];
  const target = Number(health.targetWeight) || health.weight;
  const factor = target < health.weight - 0.5 ? 0.85 : target > health.weight + 0.5 ? 1.1 : 1;
  const dailyCalories = Math.round(tdee * factor);
  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    dailyCalories,
    macros: {
      protein: Math.round((dailyCalories * 0.3) / 4),
      carbs: Math.round((dailyCalories * 0.4) / 4),
      fat: Math.round((dailyCalories * 0.3) / 9),
    },
  };
};

export interface HealthWarning {
  level: 'info' | 'warning' | 'danger';
  text: string;
}

export const generateHealthWarnings = (
  nutrition: Nutrition | null,
  dailyCalories: number | null,
  consumedToday: number,
): HealthWarning[] => {
  if (!nutrition) return [];
  const warnings: HealthWarning[] = [];
  if (nutrition.sodium > 800) {
    warnings.push({ level: 'warning', text: '這份餐點鈉含量較高（超過 800 mg），需控制血壓者建議不要常吃。' });
  }
  if (nutrition.carbs > 60) {
    warnings.push({ level: 'warning', text: '碳水化合物偏高，控糖者可以選擇飯量減半。' });
  }
  if (dailyCalories && consumedToday + nutrition.calories > dailyCalories) {
    warnings.push({ level: 'danger', text: `加上這份後，今天會超過熱量目標 ${dailyCalories} kcal。` });
  } else if (nutrition.protein >= 25) {
    warnings.push({ level: 'info', text: '高蛋白餐點，適合運動後或想維持肌肉量的你。' });
  }
  return warnings;
};

export const bmi = (health: Partial<HealthProfile>): number | null => {
  const height = Number(health.height);
  const weight = Number(health.weight);
  if (!height || !weight) return null;
  return Number((weight / (height / 100) ** 2).toFixed(1));
};

export const bmiLabel = (value: number): string =>
  value < 18.5 ? '體重過輕' : value < 24 ? '健康體位' : value < 27 ? '體重過重' : '肥胖，建議諮詢醫師';
