import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, fontFamily, fontSize, radius, spacingX, spacingY } from '@/constants/theme';
import { verticalScale } from '@/utils/styling';
import type { PhoneInputProps } from '@/utils/types';

// Only Nigeria is supported for now — the design shows a static "+234" segment
// with no picker interaction, so there's nothing to build a country switcher against yet.
const COUNTRY_CODE = '+234';
const FLAG = '🇳🇬';

export function PhoneInput({ label, error, onChangeValue, value }: PhoneInputProps) {
  const [local, setLocal] = useState(value?.startsWith(COUNTRY_CODE) ? value.slice(COUNTRY_CODE.length) : value ?? '');
  const [focused, setFocused] = useState(false);

  function handleChange(text: string) {
    const digitsOnly = text.replace(/[^0-9]/g, '');
    setLocal(digitsOnly);
    onChangeValue(`${COUNTRY_CODE}${digitsOnly}`);
  }

  return (
    <View style={styles.wrapper}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={[styles.field, focused && styles.fieldFocused, error ? styles.fieldError : null]}>
        <View style={styles.countrySegment}>
          <Text style={styles.countryText}>
            {FLAG} {COUNTRY_CODE}
          </Text>
        </View>
        <View style={styles.divider} />
        <TextInput
          style={styles.input}
          keyboardType="phone-pad"
          placeholder="803 123 4567"
          placeholderTextColor={colors.gray400}
          value={local}
          onChangeText={handleChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { width: '100%' },
  label: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.gray700,
    marginBottom: spacingY.xs,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: verticalScale(56),
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    backgroundColor: colors.gray100,
    borderWidth: 1,
    borderColor: colors.gray100,
    paddingHorizontal: spacingX.md,
  },
  fieldFocused: { borderColor: colors.primary },
  fieldError: { borderColor: colors.danger },
  countrySegment: {
    paddingRight: spacingX.sm,
  },
  countryText: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.md,
    color: colors.gray900,
  },
  divider: {
    width: 1,
    height: verticalScale(24),
    backgroundColor: colors.gray300,
    marginRight: spacingX.sm,
  },
  input: {
    flex: 1,
    fontFamily: fontFamily.medium,
    fontSize: fontSize.md,
    color: colors.gray900,
    paddingVertical: spacingY.md,
  },
  errorText: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
    color: colors.danger,
    marginTop: spacingY.xs,
  },
});
