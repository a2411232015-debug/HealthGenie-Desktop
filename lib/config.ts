// 平台營運者資訊：會顯示在隱私權政策與服務條款頁面。
// 在 .env.local（或 GitHub Actions）設定 VITE_OPERATOR_NAME 與 VITE_CONTACT_EMAIL。
export const PLATFORM_NAME = 'HealthGenie';
export const OPERATOR_NAME = String(import.meta.env.VITE_OPERATOR_NAME || '').trim() || 'HealthGenie 平台營運團隊';
export const CONTACT_EMAIL = String(import.meta.env.VITE_CONTACT_EMAIL || '').trim();
export const POLICY_UPDATED_AT = '2026 年 10 月 9 日';
