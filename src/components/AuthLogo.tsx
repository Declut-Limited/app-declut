import React from 'react';
import { Image, StyleSheet } from 'react-native';
import { radii } from '@/theme/tokens';

/** The app mark shown above the auth headlines. */
export function AuthLogo() {
  return <Image source={require('../../assets/icon-192.png')} style={styles.badge} resizeMode="contain" />;
}

const styles = StyleSheet.create({
  badge: {
    width: 56,
    height: 56,
    borderRadius: radii.lg,
    alignSelf: 'center',
  },
});
