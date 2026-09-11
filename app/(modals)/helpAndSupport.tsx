import React from 'react';
import { Linking, StyleSheet, Text } from 'react-native';
import { ContactRow, FaqList, ScreenContainer, ScreenHeader } from '@/components';
import Icon from '@/components/Icon';
import { colors, fontFamily, fontSize, spacingY } from '@/constants/theme';
import { verticalScale } from '@/utils/styling';

const SUPPORT_EMAIL = 'Support@Declut.com';
const SUPPORT_PHONE_DISPLAY = '+2349068814-677';
const SUPPORT_PHONE_E164 = '+2349068814677';

export default function HelpAndSupportModal() {
  return (
    <ScreenContainer background={colors.white} header={<ScreenHeader title="Help & Support" />}>
      <FaqList />

      <Text style={styles.sectionTitle}>Still Stuck?</Text>
      <ContactRow
        label="Email"
        value={SUPPORT_EMAIL}
        responseTime="Avg. Response time: 1 hr"
        action={{
          label: 'Email',
          icon: <Icon name="sms" variant="bold" size={verticalScale(14)} color={colors.primary} />,
          onPress: () => Linking.openURL(`mailto:${SUPPORT_EMAIL}`),
        }}
      />
      <ContactRow
        label="Phone"
        value={SUPPORT_PHONE_DISPLAY}
        responseTime="Avg. Response time: 1 min"
        action={{
          label: 'Call',
          icon: <Icon name="call" variant="bold" size={verticalScale(14)} color={colors.primary} />,
          onPress: () => Linking.openURL(`tel:${SUPPORT_PHONE_E164}`),
        }}
      />
      <ContactRow
        label="Chat"
        value="Whatsapp"
        subtitle="Start a conversation on Whatsapp"
        btnIcon={<Icon name="whatsapp" variant="bold" size={verticalScale(20)} color="#25D366" />}
        onPress={() => Linking.openURL(`https://wa.me/${SUPPORT_PHONE_E164.replace('+', '')}`)}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.md,
    color: colors.ink,
    marginTop: spacingY.xl,
    marginBottom: spacingY.md,
  },
});
