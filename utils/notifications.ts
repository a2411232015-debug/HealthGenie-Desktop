export type ToastType = 'success' | 'error' | 'info';

export interface ToastDetail {
  message: string;
  type: ToastType;
}

export const showToast = (message: string, type: ToastType = 'success'): void => {
  window.dispatchEvent(new CustomEvent<ToastDetail>('healthgenie_toast', { detail: { message, type } }));
};

export const errorMessage = (error: unknown, fallback = '發生錯誤，請稍後再試'): string => {
  if (!error) return fallback;
  const message = typeof error === 'string'
    ? error
    : typeof error === 'object' && error !== null && 'message' in error
      ? String((error as { message: unknown }).message)
      : '';
  if (!message) return fallback;
  if (/Failed to fetch|NetworkError|Load failed/i.test(message)) return '網路連線失敗，請確認網路後再試一次';
  if (/JWT expired|invalid JWT|not authenticated/i.test(message)) return '登入已過期，請重新登入';
  if (/permission denied|row-level security/i.test(message)) return '沒有權限執行這個動作';
  if (/duplicate key/i.test(message)) return '資料重複，請檢查後再試';
  if (/violates check constraint/i.test(message)) return '資料格式不正確，請檢查欄位';
  return message;
};

// ===== 商家新訂單提示 =====

let audioContext: AudioContext | null = null;

/** 必須在使用者點擊後呼叫一次，瀏覽器才允許播放聲音 */
export const unlockAudio = async (): Promise<boolean> => {
  try {
    const Context = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Context) return false;
    audioContext = audioContext || new Context();
    if (audioContext.state === 'suspended') await audioContext.resume();
    return audioContext.state === 'running';
  } catch {
    return false;
  }
};

export const playNewOrderSound = (): void => {
  if (!audioContext || audioContext.state !== 'running') return;
  const start = audioContext.currentTime;
  [0, 0.25, 0.5].forEach((offset, index) => {
    const oscillator = audioContext!.createOscillator();
    const gain = audioContext!.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = index === 2 ? 1175 : 880;
    gain.gain.setValueAtTime(0.0001, start + offset);
    gain.gain.exponentialRampToValueAtTime(0.4, start + offset + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + 0.2);
    oscillator.connect(gain).connect(audioContext!.destination);
    oscillator.start(start + offset);
    oscillator.stop(start + offset + 0.22);
  });
};

export const requestDesktopNotifications = async (): Promise<boolean> => {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  return (await Notification.requestPermission()) === 'granted';
};

export const showDesktopNotification = (title: string, body: string): void => {
  try {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body, tag: 'healthgenie-new-order' });
    }
  } catch {
    // 部分瀏覽器（例如 iOS Safari）不支援，忽略即可
  }
};
