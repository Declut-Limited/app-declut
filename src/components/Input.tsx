import React, { forwardRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import * as Icons from 'phosphor-react-native';
import { colors, fontFamily, fontSize, radius, spacingX, spacingY } from '@/constants/theme';
import { verticalScale } from '@/utils/styling';
import type { InputProps } from '@/utils/types';

export const Input = forwardRef<TextInput, InputProps>(function Input(
  { label, error, btnIcon, isPassword, style, ...rest },
  ref
) {
  const [hidden, setHidden] = useState(true);
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.wrapper}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View
        style={[
          styles.field,
          focused && styles.fieldFocused,
          error ? styles.fieldError : null,
        ]}
      >
        {btnIcon ? <View style={styles.icon}>{btnIcon}</View> : null}
        <TextInput
          ref={ref}
          style={[styles.input, style]}
          placeholderTextColor={colors.gray400}
          secureTextEntry={isPassword ? hidden : rest.secureTextEntry}
          onFocus={(e) => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
          {...rest}
        />
        {isPassword ? (
          <Text
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Show password' : 'Hide password'}
            onPress={() => setHidden((v) => !v)}
            style={styles.icon}
          >
            {hidden ? (
              <Icons.EyeIcon size={verticalScale(20)} color={colors.gray400} />
            ) : (
              <Icons.EyeSlashIcon size={verticalScale(20)} color={colors.gray400} />
            )}
          </Text>
        ) : null}
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
  },
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
  fieldFocused: {
    borderColor: colors.primary,
  },
  fieldError: {
    borderColor: colors.danger,
  },
  icon: {
    marginHorizontal: spacingX.xs,
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
