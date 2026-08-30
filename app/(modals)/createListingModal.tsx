import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BackButton, ScreenContainer } from '@/components';
import { colors, fontFamily, fontSize, spacingY } from '@/constants/theme';

// STUB MODAL — LISTING-CREATION FLOW NOT YET DESIGNED
export default function CreateListingModal() {
  return (
    <ScreenContainer edges={['top', 'bottom']} background={colors.white}>
      <View style={styles.header}>
        <Text style={styles.title}>Create Listing</Text>
        <BackButton iconType="cancel" />
      </View>
      <Text style={styles.subtitle}>This screen hasn't been designed yet.</Text>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacingY.xl,
  },
  title: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize['2xl'],
    color: colors.ink,
  },
  subtitle: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.gray500,
  },
});
