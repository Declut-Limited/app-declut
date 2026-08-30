import React, { useState } from 'react';
import { LayoutAnimation, Platform, Pressable, StyleSheet, Text, UIManager, View } from 'react-native';
import * as Icons from 'phosphor-react-native';
import { colors, fontFamily, fontSize, spacingX, spacingY } from '@/constants/theme';
import { verticalScale } from '@/utils/styling';
import type { FaqAccordionItemProps } from '@/utils/types';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
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
        {open ? (
          <Icons.MinusIcon size={verticalScale(18)} color={colors.gray500} />
        ) : (
          <Icons.PlusIcon size={verticalScale(18)} color={colors.gray500} />
        )}
      </View>
      {open ? <Text style={styles.answer}>{answer}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  item: {
    paddingVertical: spacingY.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacingX.md,
  },
  question: {
    flex: 1,
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.gray900,
  },
  answer: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.gray500,
    marginTop: spacingY.sm,
    lineHeight: fontSize.sm * 1.5,
  },
});
