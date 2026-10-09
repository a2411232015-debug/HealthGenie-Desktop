import { useSyncExternalStore } from 'react';

// 「加到主畫面」：Android／電腦版 Chrome 會觸發 beforeinstallprompt；iPhone 需要從 Safari 分享選單手動加入。

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferred = event as InstallPromptEvent;
  notify();
});
window.addEventListener('appinstalled', () => {
  deferred = null;
  notify();
});

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const isStandalone = (): boolean =>
  window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;

export const isIos = (): boolean => /iphone|ipad|ipod/i.test(navigator.userAgent);

export const useInstallPrompt = (): { canInstall: boolean; install: () => Promise<boolean> } => {
  const event = useSyncExternalStore(subscribe, () => deferred, () => null);
  return {
    canInstall: Boolean(event),
    install: async () => {
      if (!deferred) return false;
      const current = deferred;
      deferred = null;
      notify();
      await current.prompt();
      return (await current.userChoice).outcome === 'accepted';
    },
  };
};
