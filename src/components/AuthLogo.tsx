import React from 'react';
import { Image, StyleSheet } from 'react-native';
import { radius } from '@/constants/theme';
import { verticalScale } from '@/utils/styling';

/** The app mark shown above the auth headlines. */
export function AuthLogo() {
  return <Image source={require('../../assets/icon-192.png')} style={styles.badge} resizeMode="contain" />;
}

const styles = StyleSheet.create({
  badge: {
    width: verticalScale(56),
    height: verticalScale(56),
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    alignSelf: 'center',
  },
});
