import { scale, verticalScale } from '@/utils/styling';

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

// Two separate scales — horizontal vs vertical — since screen height varies more across devices than width. Keys are the base design-mock pixel value.
export const spacingX = {
  xs: scale(4),
  sm: scale(8),
  md: scale(12),
  lg: scale(16),
  xl: scale(20),
  '2xl': scale(24),
  '3xl': scale(32),
  '4xl': scale(40),
} as const;

export const spacingY = {
  xs: verticalScale(4),
  sm: verticalScale(8),
  md: verticalScale(12),
  lg: verticalScale(16),
  xl: verticalScale(20),
  '2xl': verticalScale(24),
  '3xl': verticalScale(32),
  '4xl': verticalScale(40),
} as const;

// Always paired with `borderCurve: 'continuous'` at the call site (iOS squircle corners).
export const radius = {
  sm: verticalScale(8),
  md: verticalScale(12),
  lg: verticalScale(16),
  xl: verticalScale(20),
  full: 999,
} as const;

// Plus Jakarta Sans — carried over from the website, unconfirmed for mobile (see DESIGN.md).
export const fontFamily = {
  regular: 'PlusJakartaSans_500Medium',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
} as const;

export const fontSize = {
  xs: verticalScale(12),
  sm: verticalScale(14),
  md: verticalScale(16),
  lg: verticalScale(18),
  xl: verticalScale(22),
  '2xl': verticalScale(26),
  '3xl': verticalScale(30),
  '4xl': verticalScale(34),
} as const;

export const theme = { colors, spacingX, spacingY, radius, fontFamily, fontSize };

export type Theme = typeof theme;
