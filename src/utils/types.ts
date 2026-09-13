import type { ReactElement, ReactNode } from 'react';
import type { PressableProps, RefreshControlProps, StyleProp, TextInputProps, ViewProps, ViewStyle } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';
import type { Edge } from 'react-native-safe-area-context';
import type { Listing } from '@/api/types';
import type { DropdownOption } from '@/constants/formOptions';

export type ButtonVariant = 'dark' | 'primary' | 'outline' | 'ghost';

export interface ButtonProps extends Omit<PressableProps, 'style' | 'onPress'> {
  label: string;
  variant?: ButtonVariant;
  loading?: boolean;
  btnIcon?: ReactNode;
  onPress?: () => void | Promise<void>;
  tapGuardDelay?: number;
}

export interface SocialButtonProps extends Omit<PressableProps, 'style' | 'onPress'> {
  label: string;
  loading?: boolean;
  onPress?: () => void | Promise<void>;
}

export type PillVariant = 'primary' | 'success' | 'warning';

export interface PillProps {
  label: string;
  variant?: PillVariant;
}

export interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  btnIcon?: ReactNode;
  /** Renders a trailing eye/eye-slash toggle and manages secureTextEntry internally. */
  isPassword?: boolean;
  /** Trailing slot on the opposite side from btnIcon — e.g. a picker's chevron, or a map icon. Ignored when isPassword is set. */
  customIcon?: ReactNode;
  /** Overrides the field container (background/border), not the text style — `style` already covers the TextInput itself. */
  fieldStyle?: StyleProp<ViewStyle>;
}

export interface PhoneInputProps {
  label?: string;
  error?: string;
  /** Full E.164 number, e.g. "+2348031234567". */
  onChangeValue: (e164: string) => void;
  value?: string;
}

export interface FormDropdownProps {
  label?: string;
  placeholder: string;
  data: DropdownOption[];
  value?: string;
  onChange: (value: string) => void;
  error?: string;
}

export interface OtpInputProps {
  length?: number;
  value: string;
  onChangeText: (value: string) => void;
  onComplete?: (value: string) => void;
  autoFocus?: boolean;
}

export interface ScreenContainerProps extends ViewProps {
  scroll?: boolean;
  background?: string;
  /** Renders full-width above the padded/scrollable content, so a header's divider can bleed edge-to-edge. */
  header?: ReactNode;
  /** Renders full-width below the scrollable/content area, pinned to the bottom (e.g. a Previous/Next bar) — stays fixed while the content above it scrolls. */
  footer?: ReactNode;
  /** Defaults to ['top', 'bottom'] — pass ['top'] for tab screens, since the custom tab bar already handles its own bottom safe-area inset. */
  edges?: Edge[];
  /** Passed straight through to the internal ScrollView — only applies when scroll is true. */
  refreshControl?: ReactElement<RefreshControlProps>;
  /** Defaults to true. False skips the keyboard-padding behavior, letting the keyboard float on top of the content instead. */
  avoidKeyboard?: boolean;
}

export interface StepHeaderProps {
  step: number;
  total: number;
  onBack?: () => void;
}

export type BackButtonIconType = 'back' | 'cancel' | 'drop';

export interface BackButtonProps extends Omit<PressableProps, 'style' | 'onPress'> {
  iconSize?: number;
  iconType?: BackButtonIconType;
  /** Overrides the default router.back() — e.g. to dismiss a modal step instead of navigating away. */
  customAction?: () => void;
  style?: ViewProps['style'];
}

export interface ScreenHeaderProps {
  title: string;
  /** Overrides the default router.back(). */
  onBack?: () => void;
  showBack?: boolean;
  rightElement?: ReactNode;
}

export interface FaqAccordionItemProps {
  question: string;
  answer: string;
}

export interface ContactRowAction {
  label: string;
  icon: ReactNode;
  onPress: () => void;
}

export interface ContactRowProps {
  label: string;
  value: string;
  subtitle?: string;
  btnIcon?: ReactNode;
  action?: ContactRowAction;
  responseTime?: string;
  /** Makes the whole row tappable (used by the Chat row, which has no action pill). */
  onPress?: () => void;
}

export type LegalBlock = { type: 'paragraph'; text: string } | { type: 'bullets'; items: string[] };

export interface LegalSubsection {
  heading?: string;
  blocks: LegalBlock[];
}

export interface LegalSection {
  heading?: string;
  blocks?: LegalBlock[];
  /** Sub-headed groups within a section — e.g. Privacy Policy's "Information You Provide" under "1. Information We Collect". */
  subsections?: LegalSubsection[];
}

export interface LegalDocumentBodyProps {
  title: string;
  lastUpdated: string;
  /** Shown as a separate line above "Last updated" when a document states both dates. */
  effectiveDate?: string;
  intro: string | string[];
  sections: LegalSection[];
}

export interface BottomSheetCardProps extends ViewProps {
  /** When provided, the backdrop becomes tappable-to-dismiss. Omitted (default) keeps the backdrop inert — the KYC chain relies on that to stay non-dismissible. */
  onBackdropPress?: () => void;
  /** Overrides the sheet's own background (default colors.background) — for callers whose design wants a plain white sheet instead. */
  sheetBackgroundColor?: string;
}

export interface TextLinkProps {
  text: string;
  actionLabel: string;
  onPress: () => void | Promise<void>;
}

export interface LegalConsentTextProps {
  onPressTerms?: () => void;
  onPressPrivacy?: () => void;
}

export interface PaginationDotsProps {
  count: number;
  scrollX: SharedValue<number>;
  screenWidth: number;
}


/** "Listings Near You" / search-result card — smaller image, peach "New" badge. Only real differences from RecentListingCard are image width and badge tint. */
export interface ListingCardProps {
  listing: Listing;
  onPress: () => void;
  /** Current device coordinates, for a client-computed "(Xkm)" distance — omitted (no distance shown) if either is undefined. */
  userLat?: number;
  userLng?: number;
}

/** "Recently Posted" card — larger image, lavender "New" badge. Only real differences from ListingCard are image width and badge tint. */
export interface RecentListingCardProps {
  listing: Listing;
  onPress: () => void;
  userLat?: number;
  userLng?: number;
}
