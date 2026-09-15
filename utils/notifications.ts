export type ToastType = 'success' | 'error' | 'info';

export interface ToastDetail {
  message: string;
  type: ToastType;
}

export const showToast = (message: string, type: ToastType = 'success'): void => {
  window.dispatchEvent(
    new CustomEvent<ToastDetail>('healthgenie_toast', {
      detail: { message, type },
    }),
  );
};
