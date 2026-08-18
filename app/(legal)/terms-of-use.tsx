import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { LegalDocumentBody, ScreenContainer, ScreenHeader } from '@/components';
import type { LegalSection } from '@/utils/types';
import { colors, fontFamily, fontSize } from '@/constants/theme';

const SECTIONS: LegalSection[] = [
  {
    heading: '1. App Usage',
    paragraphs: [
      '1.1 You must be at least 18 years old to use the app.',
      '1.2 Your use of the app is solely at your own risk. We do not guarantee the accuracy or reliability of any content or information provided on the app.',
    ],
  },
  {
    heading: '2. User Accounts',
    paragraphs: [
      '2.1 You agree to provide accurate and complete information when creating your account.',
      '2.2 You are responsible for maintaining the confidentiality of your account details and agree not to share them with others.',
    ],
  },
  {
    heading: '3. Listings & Transactions',
    paragraphs: [
      '3.1 When creating listings, you must provide accurate and honest information about the items you are selling.',
      '3.2 Buyers and sellers are responsible for their transactions. Declut is not responsible for the quality, condition, or legality of items listed.',
      '3.3 Buyers should inspect items before confirming pick-up, as irreversible payment to the seller will be initiated upon confirmation.',
    ],
  },
  {
    heading: '4. Prohibited Activities',
    paragraphs: [
      'This section and everything below it was cut off in the delivered screenshot — only the "4. Prohibited Activities" heading was visible, with no body text. Placeholder pending the rest of the legal copy; do not treat this as reviewed content.',
    ],
  },
];

export default function TermsOfUseScreen() {
  return (
    <ScreenContainer header={<ScreenHeader title="Terms of Use" />}>
      <LegalDocumentBody
        title="Terms of Use"
        lastUpdated="1/7/2026"
        intro="Welcome to Declut! These terms outline the conditions under which you may access and use the Declut mobile application and related services. By using the app, you agree to abide by these terms. If you do not agree, please refrain from using the app."
        sections={SECTIONS}
      />
      <Text style={styles.placeholderNote}>
        ⚠ Content past "4. Prohibited Activities" is a placeholder — not yet provided in the design and not reviewed
        legal copy.
      </Text>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  placeholderNote: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
    color: colors.warning,
    marginTop: 4,
  },
});
