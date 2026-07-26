import * as Burnt from 'burnt';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

interface ShowToastOptions {
  title: string;
  message?: string;
  variant?: ToastVariant;
}

/**
 * Thin wrapper around `burnt` (native iOS/Android toast) so call sites pick a
 * variant instead of juggling burnt's preset/haptic/icon options directly.
 * Burnt has no built-in "warning" preset — that variant uses a custom SF
 * Symbol icon on iOS and falls back to a plain native toast on Android.
 */
export function showToast({ title, message, variant = 'info' }: ShowToastOptions) {
  switch (variant) {
    case 'success':
      return Burnt.toast({ title, message, preset: 'done', haptic: 'success' });
    case 'error':
      return Burnt.toast({ title, message, preset: 'error', haptic: 'error' });
    case 'warning':
      return Burnt.toast({
        title,
        message,
        preset: 'custom',
        haptic: 'warning',
        icon: { ios: { name: 'exclamationmark.triangle.fill', color: '#F97316' } },
      });
    case 'info':
    default:
      return Burnt.toast({ title, message, preset: 'none', haptic: 'none' });
  }
}

export function showWarningToast(title: string, message?: string) {
  return showToast({ title, message, variant: 'warning' });
}

export function showErrorToast(title: string, message?: string) {
  return showToast({ title, message, variant: 'error' });
}

export function showSuccessToast(title: string, message?: string) {
  return showToast({ title, message, variant: 'success' });
}
