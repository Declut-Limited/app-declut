import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import RNPhoneInput from 'react-native-phone-input';
import { colors, fontFamily, fontSize, radius, spacingX, spacingY } from '@/constants/theme';
import { scale, verticalScale } from '@/utils/styling';
import type { PhoneInputProps } from '@/utils/types';

// Defaults to Nigeria; the flag button opens the full country picker.
const DEFAULT_COUNTRY = 'ng';

export function PhoneInput({ label, error, onChangeValue, value }: PhoneInputProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.wrapper}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <RNPhoneInput
        style={[styles.field, focused && styles.fieldFocused, error ? styles.fieldError : null]}
        flagStyle={styles.flag}
        textStyle={styles.input}
        textProps={{
          placeholder: '803 123 4567',
          placeholderTextColor: colors.gray400,
          onFocus: () => setFocused(true),
          onBlur: () => setFocused(false),
        }}
        offset={spacingX.md}
        initialCountry={DEFAULT_COUNTRY}
        initialValue={value}
        onChangePhoneNumber={onChangeValue}
      />
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
  flag: {
    width: scale(20),
    height: verticalScale(14),
    borderRadius: scale(2),
    borderCurve: 'continuous',
  },
  input: {
    height: verticalScale(24),
    fontFamily: fontFamily.medium,
    fontSize: fontSize.md,
    color: colors.gray900,
  },
  errorText: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
    color: colors.danger,
    marginTop: spacingY.xs,
  },
});
