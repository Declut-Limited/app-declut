import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fontFamily, fontSize, spacingX, spacingY } from '@/constants/theme';
import type { LegalBlock, LegalDocumentBodyProps, LegalSubsection } from '@/utils/types';

function Blocks({ blocks }: { blocks: LegalBlock[] }) {
  return (
    <>
      {blocks.map((block, index) =>
        block.type === 'bullets' ? (
          <View key={index} style={styles.bulletList}>
            {block.items.map((item, itemIndex) => (
              <View key={itemIndex} style={styles.bulletRow}>
                <Text style={styles.bulletDot}>{'•'}</Text>
                <Text style={styles.bulletText}>{item}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text key={index} style={styles.paragraph}>
            {block.text}
          </Text>
        )
      )}
    </>
  );
}

function Subsection({ heading, blocks }: LegalSubsection) {
  return (
    <View style={styles.subsection}>
      {heading ? <Text style={styles.subheading}>{heading}</Text> : null}
      <Blocks blocks={blocks} />
    </View>
  );
}

export function LegalDocumentBody({ title, lastUpdated, effectiveDate, intro, sections }: LegalDocumentBodyProps) {
  const introParagraphs = Array.isArray(intro) ? intro : [intro];

  return (
    <View>
      <Text style={styles.title}>{title}</Text>
      {effectiveDate ? <Text style={styles.lastUpdated}>Effective Date: {effectiveDate}</Text> : null}
      <Text style={styles.lastUpdated}>Last updated on {lastUpdated}</Text>
      <View style={styles.divider} />

      {introParagraphs.map((paragraph, index) => (
        <Text key={index} style={styles.paragraph}>
          {paragraph}
        </Text>
      ))}

      {sections.map((section, index) => (
        <View key={index} style={styles.section}>
          {section.heading ? <Text style={styles.heading}>{section.heading}</Text> : null}
          {section.blocks ? <Blocks blocks={section.blocks} /> : null}
          {section.subsections?.map((subsection, subIndex) => (
            <Subsection key={subIndex} heading={subsection.heading} blocks={subsection.blocks} />
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
  subsection: {
    marginTop: spacingY.md,
  },
  heading: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.lg,
    color: colors.ink,
    marginBottom: spacingY.sm,
  },
  subheading: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.md,
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
  bulletList: {
    marginBottom: spacingY.sm,
  },
  bulletRow: {
    flexDirection: 'row',
    gap: spacingX.sm,
    marginBottom: spacingY.xs,
  },
  bulletDot: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.gray600,
  },
  bulletText: {
    flex: 1,
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.gray600,
    lineHeight: fontSize.sm * 1.6,
  },
});
