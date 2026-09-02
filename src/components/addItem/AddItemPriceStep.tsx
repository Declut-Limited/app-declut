import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, fontFamily, fontSize, radius, spacingX, spacingY } from '@/constants/theme';
import { verticalScale } from '@/utils/styling';
import { formatCurrency } from '@/utils/helpers';

const PLATFORM_FEE_RATE = 0.08;

export interface AddItemPriceStepProps {
  price: string;
  onPriceChange: (value: string) => void;
  error?: string;
}

// Strips commas back to a plain "digits[.digits]" string — the raw form `price` is stored/validated as.
function sanitizePriceInput(text: string): string {
  const digitsAndDot = text.replace(/,/g, '').replace(/[^0-9.]/g, '');
  const firstDot = digitsAndDot.indexOf('.');
  if (firstDot === -1) return digitsAndDot;
  return digitsAndDot.slice(0, firstDot + 1) + digitsAndDot.slice(firstDot + 1).replace(/\./g, '');
}

// Comma-groups the integer part for display, preserving whatever decimal digits are mid-typing.
function formatPriceDisplay(raw: string): string {
  if (!raw) return '';
  const [intPart, decPart] = raw.split('.');
  const groupedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return decPart !== undefined ? `${groupedInt}.${decPart}` : groupedInt;
}

// "Add Item" — step 3 of 3: price + the 8%-fee "you get" preview.
export function AddItemPriceStep({ price, onPriceChange, error }: AddItemPriceStepProps) {
  const [focused, setFocused] = useState(false);
  const numericPrice = Number(price) || 0;
  const youGet = numericPrice * (1 - PLATFORM_FEE_RATE);

  return (
    <View>
      <Text style={styles.title}>Set your price</Text>

      <View style={styles.priceRow}>
        <View style={styles.currencyPill}>
          <Text style={styles.currencyPillText}>Naira</Text>
        </View>
        <View style={[styles.priceInputWrap, focused && styles.priceInputWrapFocused, error ? styles.priceInputWrapError : null]}>
          <TextInput
            style={styles.priceInput}
            value={formatPriceDisplay(price)}
            onChangeText={(text) => onPriceChange(sanitizePriceInput(text))}
            placeholder="0.00"
            placeholderTextColor={colors.gray300}
            keyboardType="decimal-pad"
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
          />
        </View>
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <View style={styles.divider} />

      <View style={styles.youGetRow}>
        <Text style={styles.youGetLabel}>You get</Text>
        <View style={styles.youGetPill}>
          <Text style={styles.youGetValue}>{formatCurrency(youGet, 2).replace('₦', '')}</Text>
        </View>
      </View>

      <View style={styles.tipBanner}>
        <Text style={styles.tipText}>
          Set your item's price, and we'll apply an 8% processing fee. Your final earning will be automatically
          calculated just below the price input box. Start selling with ease!
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize['2xl'],
    color: colors.ink,
    marginBottom: spacingY.xl,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacingX.md,
  },
  currencyPill: {
    backgroundColor: colors.gray100,
    borderRadius: radius.full,
    borderCurve: 'continuous',
    paddingHorizontal: spacingX.md,
    paddingVertical: spacingY.sm,
    marginTop: spacingY.xs,
  },
  currencyPillText: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.md,
    color: colors.gray700,
  },
  priceInputWrap: {
    flex: 1,
    backgroundColor: colors.gray50,
    borderRadius: radius.xl,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: colors.gray200,
    paddingHorizontal: spacingX.lg,
    paddingVertical: spacingY.md,
  },
  priceInputWrapFocused: {
    borderColor: colors.primary,
  },
  priceInputWrapError: {
    borderColor: colors.danger,
  },
  priceInput: {
    fontFamily: fontFamily.bold,
    fontSize: verticalScale(46),
    color: colors.gray700,
    textAlign: 'right',
    padding: 0,
  },
  errorText: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
    color: colors.danger,
    textAlign: 'right',
    marginTop: spacingY.xs,
  },
  divider: {
    height: 1,
    backgroundColor: colors.gray100,
    marginTop: spacingY.lg,
    marginBottom: spacingY.lg,
  },
  youGetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacingY.xl,
  },
  youGetLabel: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.md,
    color: colors.gray500,
  },
  youGetPill: {
    backgroundColor: colors.gray100,
    borderRadius: radius.full,
    borderCurve: 'continuous',
    paddingHorizontal: spacingX.lg,
    paddingVertical: spacingY.sm,
  },
  youGetValue: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.lg,
    color: colors.gray500,
  },
  tipBanner: {
    backgroundColor: colors.warning25,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    padding: spacingX.lg,
  },
  tipText: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    lineHeight: fontSize.md * 1.5,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
