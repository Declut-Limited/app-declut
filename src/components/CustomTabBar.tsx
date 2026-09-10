import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import type { NavigationState } from '@react-navigation/native';
import Icon from './Icon';
import { colors, fontFamily, fontSize, radius, spacingX, spacingY } from '@/constants/theme';
import { scale, verticalScale } from '@/utils/styling';
import { useSingleTap } from '@/hooks/useSingleTap';
import { useAuth } from '@/contexts/AuthContext';
import { router } from 'expo-router';
import { getProfileImage } from '@/utils/helpers';

const BAR_HEIGHT = verticalScale(80);
const TAB_ICON_SIZE = verticalScale(26);
const AVATAR_SIZE = verticalScale(24);

const iconNameByRoute: Record<string, string> = {
  home: 'home-2',
  history: 'clock',
};

const labelByRoute: Record<string, string> = {
  home: 'Home',
  history: 'History',
  profile: 'Profile',
};

// CUSTOM TAB BAR — 3 real routes (home/history/profile) + two non-routed actions (search, create
// listing) laid out in fixed visual slots: Home, Search, Create, History, Profile. Search used to
// be its own tab (app/(tabs)/search.tsx, now removed) — tapping it always just redirected into a
// search flow, so it's a plain redirect button here instead, same as Create.
export function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const guard = useSingleTap();

  const homeRoute = state.routes.find((route) => route.name === 'home');
  const historyRoute = state.routes.find((route) => route.name === 'history');
  const profileRoute = state.routes.find((route) => route.name === 'profile');

  function handleCreatePress() {
    router.push('/(modals)/addItemModal');
  }

  function handleSearchPress() {
    router.push('/(modals)/searchResultsModal');
  }

  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom || spacingY.sm }]}>
      {homeRoute ? (
        <TabButton route={homeRoute} index={state.routes.indexOf(homeRoute)} state={state} navigation={navigation} />
      ) : null}

      <Pressable
        onPress={guard(handleSearchPress)}
        style={styles.tabButton}
        accessibilityRole="button"
        accessibilityLabel="Search"
      >
        <Icon name="search-normal" variant="linear" size={TAB_ICON_SIZE} color={colors.gray400} />
        <Text style={[styles.tabLabel, { color: colors.gray400 }]}>Search</Text>
      </Pressable>

      <Pressable
        onPress={guard(handleCreatePress)}
        style={styles.createButton}
        accessibilityRole="button"
        accessibilityLabel="Create listing"
      >
        <Icon name="add" variant="linear" size={verticalScale(40)} color={colors.white} />
      </Pressable>

      {historyRoute ? (
        <TabButton route={historyRoute} index={state.routes.indexOf(historyRoute)} state={state} navigation={navigation} />
      ) : null}
      {profileRoute ? (
        <TabButton route={profileRoute} index={state.routes.indexOf(profileRoute)} state={state} navigation={navigation} />
      ) : null}
    </View>
  );
}

interface TabButtonProps {
  route: NavigationState['routes'][number];
  index: number;
  state: BottomTabBarProps['state'];
  navigation: BottomTabBarProps['navigation'];
}

function TabButton({ route, index, state, navigation }: TabButtonProps) {
  const guard = useSingleTap();
  const { user } = useAuth();
  const isFocused = state.index === index;
  const isProfile = route.name === 'profile';
  const color = isFocused ? colors.primary400 : colors.gray400;

  function onPress() {
    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name);
  }

  const iconElement = isProfile ? (
    <View style={styles.avatarRing}>
      <Image source={getProfileImage(user?.profileImageUrl)} style={styles.avatar} />
    </View>
  ) : (
    <Icon name={iconNameByRoute[route.name] ?? 'home-2'} variant={isFocused ? 'bold' : 'linear'} size={TAB_ICON_SIZE} color={color} />
  );

  return (
    <Pressable onPress={guard(onPress)} style={[styles.tabButton, isFocused && styles.tabButtonActive]} accessibilityRole="button" accessibilityState={{ selected: isFocused }}>
      {iconElement}
      <Text style={[styles.tabLabel, { color }]}>{labelByRoute[route.name] ?? route.name}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: BAR_HEIGHT,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.gray100,
    paddingHorizontal: spacingX.sm,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: verticalScale(2),
    width: verticalScale(35),
    height: verticalScale(50),
    borderRadius: radius.full,
    borderCurve: 'continuous',
  },
  tabButtonActive: {
    backgroundColor: colors.primaryLight,
  },
  tabLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.xs,
  },
  avatarRing: {
    width: AVATAR_SIZE + scale(6),
    height: AVATAR_SIZE + scale(6),
    borderRadius: radius.full,
    borderColor: colors.primary,
    borderCurve: 'continuous',
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: radius.full,
    borderCurve: 'continuous',
  },
  createButton: {
    width: verticalScale(60),
    height: verticalScale(60),
    borderRadius: radius.full,
    borderCurve: 'continuous',
    backgroundColor: colors.primaryHover,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: spacingX.md,
  },
});