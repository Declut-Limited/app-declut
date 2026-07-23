import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fontFamily, fontSize, spacing } from '@/theme/tokens';

export interface LegalSection {
  heading?: string;
  paragraphs: string[];
}

interface LegalDocumentBodyProps {
  title: string;
  lastUpdated: string;
  intro: string;
  sections: LegalSection[];
}

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
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: colors.gray400,
    marginTop: spacing.xs,
  },
  divider: {
    height: 1,
    backgroundColor: colors.gray100,
    marginVertical: spacing.lg,
  },
  section: {
    marginTop: spacing.lg,
  },
  heading: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.lg,
    color: colors.ink,
    marginBottom: spacing.sm,
  },
  paragraph: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: colors.gray600,
    lineHeight: fontSize.sm * 1.6,
    marginBottom: spacing.sm,
  },
});
