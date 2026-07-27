/**
 * Design tokens from docs/DESIGN.md.
 * Grays/spacing/radii are estimated (not in DESIGN.md yet) — flagged there under Open Items.
 */

export const colors = {
  primary: '#2563EB',
  primaryLight: '#EFF6FF',
  primary100: '#BFDBFE',
  primaryDark: '#1E3A8A',

  background: '#F4F7FA',
  backgroundLight: '#F9FAFB',

  ink: '#111827',
  success: '#16A34A',
  successLight: '#DCFCE7',
  warning: '#F97316',
  warningLight: '#FFEDD5',
  danger: '#DC2626',
  dangerLight: '#FEE2E2',

  white: '#FFFFFF',
  black: '#000000',

  // Estimated gray scale — not confirmed in DESIGN.md
  gray50: '#F9FAFB',
  gray100: '#F3F4F6',
  gray200: '#E5E7EB',
  gray300: '#D1D5DB',
  gray400: '#9CA3AF',
  gray500: '#6B7280',
  gray600: '#4B5563',
  gray700: '#374151',
  gray900: '#111827',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 999,
} as const;

// Plus Jakarta Sans — carried over from the website, unconfirmed for mobile (see DESIGN.md).
export const fontFamily = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
} as const;

export const fontSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 22,
  '2xl': 26,
  '3xl': 30,
  '4xl': 32,
  '5xl': 34,
} as const;

export const theme = { colors, spacing, radii, fontFamily, fontSize };

export type Theme = typeof theme;
