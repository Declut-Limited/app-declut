import React, { useState } from 'react';
import { LayoutAnimation, Platform, Pressable, StyleSheet, Text, UIManager, View } from 'react-native';
import { Minus, Plus } from 'phosphor-react-native';
import { colors, fontFamily, fontSize, spacing } from '@/theme/tokens';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface FaqAccordionItemProps {
  question: string;
  answer: string;
}

export function FaqAccordionItem({ question, answer }: FaqAccordionItemProps) {
  const [open, setOpen] = useState(false);

  function toggle() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((v) => !v);
  }

  return (
    <Pressable onPress={toggle} style={styles.item}>
      <View style={styles.row}>
        <Text style={styles.question}>{question}</Text>
        {open ? <Minus size={18} color={colors.gray500} /> : <Plus size={18} color={colors.gray500} />}
      </View>
      {open ? <Text style={styles.answer}>{answer}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  item: {
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  question: {
    flex: 1,
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.gray900,
  },
  answer: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: colors.gray500,
    marginTop: spacing.sm,
    lineHeight: fontSize.sm * 1.5,
  },
});
