import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { FaqAccordionItem } from './FaqAccordionItem';
import { colors, fontFamily, fontSize, spacingY } from '@/constants/theme';

// Delivered copy (verbatim) — Q1's answer mentions a "My posts" tab that doesn't match this
// app's actual navigation (no such tab exists; posting goes through the (+) add-listing button),
// and Q4's "fixed, non-negotiable" pricing contradicts the real Offers/negotiation feature this
// backend supports (see CLAUDE.md's scope note) — kept as-is since this is delivered FAQ text, not
// something to silently correct.
const FAQS = [
  {
    question: 'How do I list my item for sale on Declut?',
    answer: 'To list an item, simply create an account, click on the "My posts" tab',
  },
  {
    question: 'What types of items can I sell on Declut?',
    answer:
      'You can sell a wide variety of household items such as furniture, clothing, accessories, and more. However, certain prohibited items such as weapons, drugs, and counterfeit goods are not allowed.',
  },
  {
    question: 'How does payment work on Declut?',
    answer:
      'Buyers can securely pay for items using various payment methods such as credit cards, and transfers. Sellers receive payment once the buyer confirms receipt of the item.',
  },
  {
    question: 'Can I negotiate the price of an item with the seller?',
    answer: "No, you can't. The prices of items are fixed, and non-negotiable.",
  },
  {
    question: "What happens if I'm not satisfied with my purchase?",
    answer:
      'If you encounter any issues with your purchase, click the "I don\'t like item" button at the bottom of the page and fill the form that appears. We review immediately and your money is refunded in full.',
  },
];

/** "Frequently Asked Questions" accordion list — used by Help & Support. */
export function FaqList() {
  return (
    <View>
      <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
      <View style={styles.faqList}>
        {FAQS.map((faq) => (
          <FaqAccordionItem key={faq.question} question={faq.question} answer={faq.answer} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.md,
    color: colors.ink,
    marginBottom: spacingY.md,
  },
  faqList: {
    backgroundColor: colors.white,
  },
});
