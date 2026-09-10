import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, Pressable, RefreshControl, StyleSheet, Switch, Text, View } from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Notifications from 'expo-notifications';
import dayjs from 'dayjs';
import { ConfirmModal, PermissionModal, ScreenContainer, ScreenHeader } from '@/components';
import Icon from '@/components/Icon';
import { colors, fontFamily, fontSize, radius, spacingX, spacingY } from '@/constants/theme';
import { verticalScale } from '@/utils/styling';
import { formatNumber, getProfileImage } from '@/utils/helpers';
import { useSingleTap } from '@/hooks/useSingleTap';
import { isVerified, useAuth } from '@/contexts/AuthContext';
import { mediaApi, usersApi } from '@/api';
import { extractErrorMessage } from '@/api/client';
import { getPushToken, savePushToken } from '@/lib/pushToken';
import { showErrorToast } from '@/lib/toast';

export default function ProfileScreen() {
  const { user, signOut, refreshUser } = useAuth();
  const guard = useSingleTap();

  const [refreshing, setRefreshing] = useState(false);
  // Optimistic local preview shown the instant a photo is picked, before the upload/PATCH round-trip resolves.
  const [avatarPreviewUri, setAvatarPreviewUri] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  // Hard-denied gallery/notifications permission — same "send to Settings" primer used in AddItemModal.
  const [permissionPrompt, setPermissionPrompt] = useState<{ target: string; message: string } | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);

  useEffect(() => {
    Notifications.getPermissionsAsync().then(({ status }) => setNotificationsEnabled(status === 'granted'));
  }, []);

  async function onRefresh() {
    setRefreshing(true);
    await refreshUser().catch(() => {});
    setRefreshing(false);
  }

  async function ensureLibraryAccess(): Promise<boolean> {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      if (permission.canAskAgain) {
        showErrorToast('Permission needed', 'Allow photo library access to update your profile photo.');
      } else {
        setPermissionPrompt({
          target: 'your gallery',
          message: 'Photo library access is turned off. Enable it in Settings to update your profile photo.',
        });
      }
      return false;
    }
    return true;
  }

  async function uploadAvatar(uri: string) {
    setAvatarPreviewUri(uri);
    setAvatarUploading(true);
    try {
      const signature = await mediaApi.getUploadSignature();
      const uploaded = await mediaApi.uploadToCloudinary(uri, signature, 'image');
      await usersApi.updateMyProfile({ profileImage: uploaded.secureUrl });
      await refreshUser();
    } catch (e) {
      showErrorToast('Could not update photo', extractErrorMessage(e));
      setAvatarPreviewUri(null);
    } finally {
      setAvatarUploading(false);
    }
  }

  async function pickAvatarFromLibrary() {
    if (!(await ensureLibraryAccess())) return;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, allowsEditing: true, aspect: [1, 1] });
      if (result.canceled || !result.assets[0]) return;
      uploadAvatar(result.assets[0].uri);
    } catch {
      showErrorToast('Something went wrong', 'That photo could not be added — try again.');
    }
  }

  // OS notification permission can only ever be requested, never revoked, from inside the app —
  // both directions of this toggle end up at Settings unless we're asking for the very first time.
  async function handleToggleNotifications(next: boolean) {
    if (!next) {
      setPermissionPrompt({
        target: 'notifications',
        message: 'Notifications are managed in your device Settings. Turn them off there to stop receiving alerts from Declut.',
      });
      return;
    }
    const { status, canAskAgain } = await Notifications.getPermissionsAsync();
    if (status === 'granted') {
      setNotificationsEnabled(true);
      return;
    }
    if (!canAskAgain) {
      setPermissionPrompt({
        target: 'notifications',
        message: 'Notifications are turned off. Enable them in Settings to get updates on your listings, offers, and transactions.',
      });
      return;
    }
    const result = await Notifications.requestPermissionsAsync();
    setNotificationsEnabled(result.status === 'granted');
    if (result.status === 'granted') {
      const token = await getPushToken();
      if (token) savePushToken(token).catch(() => {});
    }
  }

  async function handleSignOut() {
    setLogoutConfirmOpen(false);
    await signOut();
    router.replace('/');
  }

  // No account-deletion endpoint exists yet (see CLAUDE.md's working-style note on flagging gaps) —
  // this confirms intent without silently no-oping or firing a request that doesn't exist.
  function confirmDeleteAccount() {
    Alert.alert('Delete account?', "This will permanently delete your account and can't be undone.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => showErrorToast('Not available yet', "Account deletion isn't available yet — contact support."),
      },
    ]);
  }

  const verified = isVerified(user);
  const displayAvatar = avatarPreviewUri ?? user?.profileImageUrl;

  return (
    <View style={styles.flex}>
      <ScreenContainer
        edges={['top']}
        background={colors.white}
        header={<ScreenHeader title="Profile" showBack={false} />}
        // refreshControl={
        //   <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
        // }
      >
        <View style={styles.avatarBlock}>
          <View style={styles.avatarWrap}>
            <Image source={getProfileImage(displayAvatar)} style={styles.avatar} />
            {avatarUploading ? (
              <View style={styles.avatarOverlay}>
                <ActivityIndicator color={colors.white} />
              </View>
            ) : null}
            <Pressable onPress={guard(pickAvatarFromLibrary)} style={styles.avatarBadge} hitSlop={8}>
              <Icon name="camera" variant="bold" size={verticalScale(16)} color={colors.primary} />
            </Pressable>
          </View>

          <View style={styles.nameRow}>
            <Text style={styles.name}>{user?.name ?? '—'}</Text>
            {verified ? <Icon name="verify" variant="bold" size={verticalScale(18)} color={colors.success} /> : null}
          </View>

          {user?.createdAt ? (
            <View style={styles.metaRow}>
              <Icon name="calendar" variant="linear" size={verticalScale(14)} color={colors.gray400} />
              <Text style={styles.metaText}>Joined {dayjs(user.createdAt).format('MMM. YYYY')}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.statsRow}>
          <StatItem value={(user?.avgRating ?? 0).toFixed(1)} label="Rating" valueColor={colors.warning} />
          <StatDivider />
          <StatItem value={String(user?.listingCount ?? 0)} label="Listings" />
          <StatDivider />
          <StatItem value={String(user?.soldCount ?? 0)} label="Sold" />
          <StatDivider />
          <StatItem value={String(user?.purchaseCount ?? 0)} label="Purchases" />
        </View>

        <View style={styles.escrowRow}>
          <Text style={styles.escrowLabel}>Amount in Escrow</Text>
          <View style={styles.escrowValueRow}>
            <Text style={styles.escrowValue}>
              <Text style={styles.escrowCurrency}>₦ </Text>
              {formatNumber(user?.totalAmountInEscrow ?? 0)}
            </Text>
            <Icon name="shield" variant="bold" size={verticalScale(16)} color={colors.warning} />
          </View>
        </View>

        {/* Referral & Rewards / Feedback have no destination screen yet — rows render per design
            but don't navigate (see chat summary). */}
        <SectionLabel>My Activity</SectionLabel>
        <View style={styles.section}>
          <ProfileMenuRow
            icon={<Icon name="tag" variant="linear" size={verticalScale(20)} color={colors.gray500} />}
            label="My Listings"
            onPress={() => router.push('/(modals)/myListings')}
          />
          <ProfileMenuRow icon={<Icon name="shopping-bag" variant="linear" size={verticalScale(20)} color={colors.gray500} />} label="Referral & Rewards" last />
        </View>

        <SectionLabel>Account</SectionLabel>
        <View style={styles.section}>
          <ProfileMenuRow
            icon={<Icon name="profile-circle" variant="linear" size={verticalScale(20)} color={colors.gray500} />}
            label="Account Details"
            onPress={() => router.push('/(modals)/accountDetails')}
          />
          <ProfileMenuRow
            icon={<Icon name="bank" variant="linear" size={verticalScale(20)} color={colors.gray500} />}
            label="Payment Information"
            onPress={() => router.push('/(modals)/paymentInfo')}
            last
          />
        </View>

        <SectionLabel>Preferences</SectionLabel>
        <View style={styles.section}>
          <ProfileMenuRow
            icon={<Icon name="notification" variant="linear" size={verticalScale(20)} color={colors.gray500} />}
            label="Notifications"
            last
            right={
              <Switch
                value={notificationsEnabled}
                onValueChange={handleToggleNotifications}
                trackColor={{ true: colors.primary, false: colors.gray200 }}
                thumbColor={colors.white}
              />
            }
          />
        </View>

        <SectionLabel>Contact Us</SectionLabel>
        <View style={styles.section}>
          <ProfileMenuRow
            icon={<Icon name="message-question" variant="linear" size={verticalScale(20)} color={colors.gray500} />}
            label="Help & Support"
            onPress={() => router.push('/(legal)/faq')}
          />
          <ProfileMenuRow
            icon={<Icon name="message-text-1" variant="linear" size={verticalScale(20)} color={colors.gray500} />}
            label="Feedback"
            last
          />
        </View>

        <SectionLabel>Legal</SectionLabel>
        <View style={styles.section}>
          <ProfileMenuRow
            icon={<Icon name="shield-tick" variant="linear" size={verticalScale(20)} color={colors.gray500} />}
            label="Privacy Policy"
            onPress={() => router.push('/(legal)/privacy-policy')}
          />
          <ProfileMenuRow
            icon={<Icon name="info-circle" variant="linear" size={verticalScale(20)} color={colors.gray500} />}
            label="Terms of Service"
            onPress={() => router.push('/(legal)/terms-of-use')}
            last
          />
        </View>

        <SectionLabel>Account Options</SectionLabel>
        <View style={styles.section}>
          <ProfileMenuRow
            icon={<Icon name="logout" variant="linear" size={verticalScale(20)} color={colors.danger} />}
            label="Log out"
            labelColor={colors.danger}
            onPress={() => setLogoutConfirmOpen(true)}
            chevron={false}
          />
          <ProfileMenuRow
            icon={<Icon name="trash" variant="linear" size={verticalScale(20)} color={colors.danger} />}
            label="Delete account"
            labelColor={colors.danger}
            onPress={confirmDeleteAccount}
            chevron={false}
            last
          />
        </View>
      </ScreenContainer>

      {permissionPrompt ? (
        <View style={StyleSheet.absoluteFill}>
          <PermissionModal
            target={permissionPrompt.target}
            message={permissionPrompt.message}
            onAllow={() => {
              setPermissionPrompt(null);
              Linking.openSettings();
            }}
            onDismiss={() => setPermissionPrompt(null)}
          />
        </View>
      ) : null}

      {logoutConfirmOpen ? (
        <View style={StyleSheet.absoluteFill}>
          <ConfirmModal
            title="Log out?"
            message="You'll need to sign in again to access your account."
            confirmLabel="Log out"
            onConfirm={handleSignOut}
            onCancel={() => setLogoutConfirmOpen(false)}
          />
        </View>
      ) : null}
    </View>
  );
}

function StatItem({ value, label, valueColor }: { value: string; label: string; valueColor?: string }) {
  return (
    <View style={styles.statItem}>
      <Text style={[styles.statValue, valueColor ? { color: valueColor } : null]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function StatDivider() {
  return <View style={styles.statDivider} />;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

interface ProfileMenuRowProps {
  icon: React.ReactNode;
  label: string;
  labelColor?: string;
  onPress?: () => void;
  right?: React.ReactNode;
  chevron?: boolean;
  /** Skips the bottom hairline — set on the last row in a section. */
  last?: boolean;
}

function ProfileMenuRow({ icon, label, labelColor, onPress, right, chevron = true, last }: ProfileMenuRowProps) {
  const guard = useSingleTap();

  return (
    <Pressable
      onPress={onPress ? guard(onPress) : undefined}
      style={[styles.menuRow, !last && styles.menuRowDivider]}
      accessibilityRole={onPress ? 'button' : undefined}
    >
      <View style={styles.menuRowIcon}>{icon}</View>
      <Text style={[styles.menuRowLabel, labelColor ? { color: labelColor } : null]}>{label}</Text>
      {right ?? (chevron ? <Icon name="arrow-right-2" variant="linear" size={verticalScale(18)} color={colors.gray300} /> : null)}
    </Pressable>
  );
}

const AVATAR_SIZE = verticalScale(96);

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  avatarBlock: {
    alignItems: 'center',
    marginBottom: spacingY.xl,
  },
  avatarWrap: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    marginBottom: spacingY.md,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: radius.full,
    borderCurve: 'continuous',
    backgroundColor: colors.gray100,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  avatarOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radius.full,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(17, 24, 39, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: verticalScale(32),
    height: verticalScale(32),
    borderRadius: radius.full,
    borderCurve: 'continuous',
    backgroundColor: colors.primaryLight,
    borderWidth: 2,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingX.xs,
  },
  name: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xl,
    color: colors.ink,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingX.xs,
    marginTop: verticalScale(4),
  },
  metaText: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.gray400,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacingY.xl,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: verticalScale(2),
  },
  statValue: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xl,
    color: colors.ink,
  },
  statLabel: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
    color: colors.gray400,
  },
  statDivider: {
    width: 1,
    height: verticalScale(28),
    backgroundColor: colors.gray200,
  },
  escrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.gray50,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    paddingHorizontal: spacingX.lg,
    paddingVertical: spacingY.lg,
    marginBottom: spacingY.xl,
  },
  escrowLabel: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.gray500,
  },
  escrowValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingX.xs,
  },
  escrowValue: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.lg,
    color: colors.primary,
  },
  escrowCurrency: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.md,
    color: colors.primary,
  },
  sectionLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.xs,
    color: colors.gray400,
    letterSpacing: 0.5,
    marginBottom: spacingY.sm,
  },
  section: {
    paddingHorizontal: spacingX.sm,
    paddingVertical: spacingY.xs,
    marginBottom: spacingY.xl,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingX.md,
    paddingVertical: spacingY.lg,
  },
  menuRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
  },
  menuRowIcon: {
    width: verticalScale(32),
    alignItems: 'center',
  },
  menuRowLabel: {
    flex: 1,
    fontFamily: fontFamily.medium,
    fontSize: fontSize.md,
    color: colors.gray900,
  },
});
