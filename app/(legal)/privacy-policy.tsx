import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { LegalDocumentBody, ScreenContainer, ScreenHeader } from '@/components';
import type { LegalSection } from '@/utils/types';
import { colors, fontFamily, fontSize } from '@/constants/theme';
import { verticalScale } from '@/utils/styling';

const SECTIONS: LegalSection[] = [
  {
    paragraphs: [
      'This Mobile Application License Agreement (the "Agreement") is a legal contract between Declut ("we," "us," or "our") and you ("User" or "you"), the end-user of our mobile application ("App"). This Agreement governs your use of the App and related services provided by us.',
    ],
  },
  {
    heading: '1. Posting and Purchasing Used Household Items',
    paragraphs: [
      'The App allows users ("Sellers") to post their used household items for sale, and other users ("Buyers") to express interest, make payments, and arrange for inspections and purchases.',
    ],
  },
  {
    heading: '2. Inspection and Transaction',
    paragraphs: [
      'Buyers must inspect the purchased items within 48 hours after making a payment. If the Buyer is unsatisfied upon inspection, they can request a full refund. If a Buyer cancels a transaction after payment without inspection, a 3% deduction will apply to the refund.',
    ],
  },
  {
    heading: '3. Transaction Fees',
    paragraphs: ['For successful transactions, a service fee of 8% will be deducted from the Seller\'s payment.'],
  },
  {
    heading: 'User Obligations',
    paragraphs: [
      'This section and everything below it was cut off in the delivered screenshot — only the "User Obligations" heading was visible, with no body text. Placeholder pending the rest of the legal copy; do not treat this as reviewed content.',
    ],
  },
];

export default function PrivacyPolicyScreen() {
  return (
    <ScreenContainer header={<ScreenHeader title="Privacy Policy" />}>
      <LegalDocumentBody
        title="License Agreement"
        lastUpdated="25/07/2026"
        intro='Welcome to Declut! These terms outline the conditions under which you may access and use the Declut mobile application and related services. By using the app, you agree to abide by these terms. If you do not agree, please refrain from using the app.'
        sections={SECTIONS}
      />
      <Text style={styles.placeholderNote}>
        ⚠ Content past "User Obligations" is a placeholder — not yet provided in the design and not reviewed legal
        copy.
      </Text>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  placeholderNote: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
    color: colors.warning,
    marginTop: verticalScale(4),
  },
});
