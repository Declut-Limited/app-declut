import { scale, verticalScale } from '@/utils/styling';

export const colors = {
  primary: '#2563EB',
  primaryLight: '#EFF6FF',
  primary50: '#DBEAFE',
  primary100: '#BFDBFE',
  primary400: '#3B82F6',
  primaryHover: '#1D4ED8',
  primaryDark: '#1E3A8A',
  primaryLight600: '#026AA2',
  
  background: '#F4F7FA',
  backgroundLight: '#F9FAFB',

  textPrimary: '#1D2939',
  textSecondary: '#475467',

  ink: '#111827',
  success: '#16A34A',
  successLight: '#DCFCE7',
  success50: '#ECFDF3',
  success700: '#027A48',

  warning: '#F97316',
  warning25: '#FFFCF5',
  warning50: '#FFFAEB',
  warningLight: '#FFEDD5',
  warning600: '#DC6803',
  warning700: '#B54708',

  danger: '#DC2626',
  dangerLight: '#FEE2E2',
  goldClick: '#A28300',
  rose: '#F9B4AF',
  rose50: '#FFF1F3',
  rose700: '#C01048',
  error50: '#FEF3F2',
  error: '#F04438',
  error700: '#B42318',

  white: '#FFFFFF',
  black: '#000000',
  // Flat card fill for listing cards (Home) — no shadow, distinct from pure white per design.
  cardBackground: '#FCFCFD',

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
  // DM Serif Text — display serif for large marketplace headlines (e.g. Home's "Welcome back"), not body text. Regular is the only weight this face ships.
  display_400: 'DMSerifText_400Regular',
} as const;

export const fontSize = {
  xs: verticalScale(13),
  sm: verticalScale(15),
  md: verticalScale(18),
  lg: verticalScale(20),
  xl: verticalScale(24),
  '2xl': verticalScale(28),
  '3xl': verticalScale(32),
  '4xl': verticalScale(36),
} as const;

export const theme = { colors, spacingX, spacingY, radius, fontFamily, fontSize };

export type Theme = typeof theme;
