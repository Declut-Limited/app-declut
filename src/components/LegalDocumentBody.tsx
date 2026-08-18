import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fontFamily, fontSize, spacingY } from '@/constants/theme';
import type { LegalDocumentBodyProps } from '@/utils/types';

export function LegalDocumentBody({ title, lastUpdated, intro, sections }: LegalDocumentBodyProps) {
  return (
    <View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.lastUpdated}>Last updated on {lastUpdated}</Text>
      <View style={styles.divider} />

      <Text style={styles.paragraph}>{intro}</Text>

      {sections.map((section, index) => (
        <View key={index} style={styles.section}>
          {section.heading ? <Text style={styles.heading}>{section.heading}</Text> : null}
          {section.paragraphs.map((paragraph, pIndex) => (
            <Text key={pIndex} style={styles.paragraph}>
              {paragraph}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize['2xl'],
    color: colors.ink,
  },
  lastUpdated: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.gray400,
    marginTop: spacingY.xs,
  },
  divider: {
    height: 1,
    backgroundColor: colors.gray100,
    marginVertical: spacingY.lg,
  },
  section: {
    marginTop: spacingY.lg,
  },
  heading: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.lg,
    color: colors.ink,
    marginBottom: spacingY.sm,
  },
  paragraph: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.gray600,
    lineHeight: fontSize.sm * 1.6,
    marginBottom: spacingY.sm,
  },
});
