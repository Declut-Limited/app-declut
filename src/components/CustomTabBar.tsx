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

const BAR_HEIGHT = verticalScale(76);
const TAB_ICON_SIZE = verticalScale(26);
const AVATAR_SIZE = verticalScale(24);

const iconNameByRoute: Record<string, string> = {
  home: 'home-2',
  search: 'search-normal',
  history: 'clock',
};

const labelByRoute: Record<string, string> = {
  home: 'Home',
  search: 'Search',
  history: 'History',
  profile: 'Profile',
};

// CUSTOM TAB BAR — 4 real routes + a non-routed center action (create listing)
export function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const guard = useSingleTap();
  const middleIndex = Math.ceil(state.routes.length / 2);

  function handleCreatePress() {
    router.push('/(modals)/addItemModal');
  }

  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom || spacingY.sm }]}>
      {state.routes.map((route, index) => {
        if (index === middleIndex) {
          return (
            <React.Fragment key="create">
              <Pressable
                onPress={guard(handleCreatePress)}
                style={styles.createButton}
                accessibilityRole="button"
                accessibilityLabel="Create listing"
              >
                <Icon name="add" variant="linear" size={verticalScale(40)} color={colors.white} />
              </Pressable>
              <TabButton route={route} index={index} state={state} navigation={navigation} />
            </React.Fragment>
          );
        }
        return <TabButton key={route.key} route={route} index={index} state={state} navigation={navigation} />;
      })}
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
  const color = isFocused ? colors.primary : colors.gray400;

  function onPress() {
    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name);
  }

  const iconElement = isProfile ? (
    <View style={styles.avatarRing}>
      <Image source={getProfileImage((user as { avatar?: unknown })?.avatar)} style={styles.avatar} />
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
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: spacingX.md,
  },
});
