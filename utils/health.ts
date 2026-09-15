import { ActivityLevel, Gender, UserProfile } from '../types';

export interface HealthTargets {
  bmr: number;
  tdee: number;
  dailyCalories: number;
  macros: {
    protein: number; // grams
    carbs: number;   // grams
    fat: number;     // grams
  };
}

const getActivityMultiplier = (level: ActivityLevel): number => {
  switch (level) {
    case ActivityLevel.SEDENTARY: return 1.2;
    case ActivityLevel.LIGHT: return 1.375;
    case ActivityLevel.MODERATE: return 1.55;
    case ActivityLevel.HEAVY: return 1.725;
    default: return 1.2;
  }
};

// ==========================================
// 核心生理運算引擎
// 注意：這部分邏輯目前在前端執行。
// 未來若需更複雜的個人化模型，建議遷移至後端 Python 服務。
// ==========================================
export const calculateHealthTargets = (profile: UserProfile): HealthTargets => {
  const { weight, height, age, gender, activityLevel } = profile;

  // 1. 計算 BMR (基礎代謝率) - 使用 Mifflin-St Jeor 公式
  // Python 實作提示: 
  // def calculate_bmr(weight, height, age, gender): ...
  let bmr = (10 * weight) + (6.25 * height) - (5 * age);
  
  if (gender === Gender.MALE) {
    bmr += 5;
  } else {
    bmr -= 161;
  }

  // 2. 計算 TDEE (每日總消耗熱量)
  const tdee = bmr * getActivityMultiplier(activityLevel);

  // 3. 設定熱量目標 (減脂模式：TDEE * 0.85)
  // 這部分係數可根據用戶目標 (增肌/維持/減脂) 動態調整
  const dailyCalories = Math.round(tdee * 0.85);

  // 4. 計算營養素比例 (Protein 30%, Carbs 40%, Fat 30%)
  // 轉換公式：蛋白質/碳水 = 4 kcal/g, 脂肪 = 9 kcal/g
  const macros = {
    protein: Math.round((dailyCalories * 0.30) / 4),
    carbs: Math.round((dailyCalories * 0.40) / 4),
    fat: Math.round((dailyCalories * 0.30) / 9),
  };

  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    dailyCalories,
    macros
  };
};

export interface HealthWarning {
  type: 'base' | 'info' | 'success' | 'warning' | 'danger';
  text: string;
  color: string;
}

export const generateHealthWarnings = (
  meal: { calories: number; macros: { sodium?: number; carbs?: number; fiber?: number; protein?: number; sugar?: number; } },
  userProfile: { tdee: number },
  dailyIntake: number
): HealthWarning[] => {
  const warnings: HealthWarning[] = [];
  
  if ((meal.macros.sodium ?? 0) > 800) {
    warnings.push({
      type: 'warning',
      text: '⚠️ 此餐鈉含量較高，不建議高血壓族群頻繁食用。',
      color: 'text-orange-600 font-medium'
    });
  }

  if ((meal.macros.carbs ?? 0) > 60) {
    warnings.push({
      type: 'warning',
      text: '⚠️ 此餐碳水偏高，控糖者建議減少飯量。',
      color: 'text-yellow-600 font-medium'
    });
  }

  if (dailyIntake + meal.calories >= userProfile.tdee * 0.85) {
    warnings.push({
      type: 'danger',
      text: '🛑 加總此餐後，你今天將攝取超過熱量預算 85%！',
      color: 'text-red-600 font-bold'
    });
  }

  return warnings;
};
