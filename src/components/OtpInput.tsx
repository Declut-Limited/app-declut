import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { MotiView } from 'moti';
import { colors, fontFamily, fontSize, radii, spacing } from '@/theme/tokens';

interface OtpInputProps {
  length?: number;
  value: string;
  onChangeText: (value: string) => void;
  onComplete?: (value: string) => void;
  autoFocus?: boolean;
}

export function OtpInput({ length = 6, value, onChangeText, onComplete, autoFocus }: OtpInputProps) {
  const inputRef = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);
  const digits = Array.from({ length }, (_, i) => value[i] ?? '');

  function handleChangeText(text: string) {
    const digitsOnly = text.replace(/[^0-9]/g, '').slice(0, length);
    onChangeText(digitsOnly);
    if (digitsOnly.length === length) {
      onComplete?.(digitsOnly);
    }
  }

  return (
    <Pressable onPress={() => inputRef.current?.focus()} style={styles.row}>
      {digits.map((digit, index) => {
        const isActive = focused && index === value.length;
        return (
          <MotiView
            key={index}
            from={{ scale: 1 }}
            animate={{ scale: digit ? 1.04 : 1 }}
            transition={{ type: 'timing', duration: 120 }}
            style={[
              styles.box,
              isActive && styles.boxActive,
              digit ? styles.boxFilled : null,
            ]}
          >
            <Text style={styles.digit}>{digit}</Text>
          </MotiView>
        );
      })}
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={handleChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoFocus={autoFocus}
        keyboardType="number-pad"
        maxLength={length}
        style={styles.hiddenInput}
        caretHidden
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  box: {
    width: 48,
    height: 56,
    borderRadius: radii.md,
    backgroundColor: colors.gray100,
    borderWidth: 1,
    borderColor: colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxActive: {
    borderColor: colors.primary,
  },
  boxFilled: {
    borderColor: colors.primary100,
    backgroundColor: colors.primaryLight,
  },
  digit: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.lg,
    color: colors.gray900,
  },
  hiddenInput: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    opacity: 0,
  },
});
