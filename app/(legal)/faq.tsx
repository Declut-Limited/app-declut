import React from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { Envelope, Phone, WhatsappLogo } from 'phosphor-react-native';
import { Card, ContactRow, FaqAccordionItem, ScreenContainer, ScreenHeader } from '@/components';
import { colors, fontFamily, fontSize, spacing } from '@/theme/tokens';

// Answers here are a reasonable first draft, not reviewed copy — only the
// questions themselves came from the delivered design.
const FAQS = [
  {
    question: 'How do I list my item for sale on Declut?',
    answer:
      'From the app, start a new listing, add clear photos, a description, condition, and a price, then submit. Your listing goes live once it\'s reviewed.',
  },
  {
    question: 'What types of items can I sell on Declut?',
    answer:
      'Pre-owned household items in good, working condition — furniture, appliances, electronics, and similar. Prohibited or unsafe items aren\'t allowed.',
  },
  {
    question: 'How does payment work on Declut?',
    answer:
      'Buyers pay upfront and the payment is held in escrow. Funds are only released to the seller once the buyer confirms the item matches its description.',
  },
  {
    question: 'Can I negotiate the price of an item with the seller?',
    answer:
      'Yes — buyers can make an offer on a listing, and sellers can accept, reject, or counter it until both sides agree on a price.',
  },
  {
    question: "What happens if I'm not satisfied with my purchase?",
    answer:
      'You can inspect the item before releasing payment. If it doesn\'t match its description, you can raise a dispute instead of confirming the transaction.',
  },
];

const SUPPORT_EMAIL = 'Support@Declut.com';
const SUPPORT_PHONE_DISPLAY = '+2349068814-677';
const SUPPORT_PHONE_E164 = '+2349068814677';

export default function FaqScreen() {
  return (
    <ScreenContainer header={<ScreenHeader title="Help & Support" />}>
      <Text style={[styles.sectionTitle, styles.firstSectionTitle]}>Frequently Asked Questions</Text>
      <View style={styles.faqList}>
        {FAQS.map((faq) => (
          <FaqAccordionItem key={faq.question} question={faq.question} answer={faq.answer} />
        ))}
      </View>

      <Text style={styles.sectionTitle}>Still Stuck?</Text>
      <Card style={styles.contactCard}>
        <ContactRow
          label="Email"
          value={SUPPORT_EMAIL}
          responseTime="Avg. Response time: 1 hr"
          action={{
            label: 'Email',
            icon: <Envelope size={14} color={colors.primary} weight="bold" />,
            onPress: () => Linking.openURL(`mailto:${SUPPORT_EMAIL}`),
          }}
        />
        <ContactRow
          label="Phone"
          value={SUPPORT_PHONE_DISPLAY}
          responseTime="Avg. Response time: 1 min"
          action={{
            label: 'Call',
            icon: <Phone size={14} color={colors.primary} weight="bold" />,
            onPress: () => Linking.openURL(`tel:${SUPPORT_PHONE_E164}`),
          }}
        />
        <ContactRow
          label="Chat"
          value="Whatsapp"
          subtitle="Start a conversation on Whatsapp"
          btnIcon={<WhatsappLogo size={20} color="#25D366" weight="fill" />}
          onPress={() => Linking.openURL(`https://wa.me/${SUPPORT_PHONE_E164.replace('+', '')}`)}
        />
      </Card>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.md,
    color: colors.ink,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  firstSectionTitle: {
    marginTop: 0,
  },
  faqList: {
    backgroundColor: colors.white,
  },
  contactCard: {
    padding: spacing.lg,
  },
});
