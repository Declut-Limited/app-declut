import React, { useEffect, useState } from 'react';
import { Linking, StyleSheet, Switch, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import * as Notifications from 'expo-notifications';
import { PermissionModal, ScreenContainer, ScreenHeader } from '@/components';
import { colors, fontFamily, fontSize, radius, spacingX, spacingY } from '@/constants/theme';
import { verticalScale } from '@/utils/styling';
import { useAuth } from '@/contexts/AuthContext';
import { extractErrorMessage } from '@/api/client';
import type { UpdateNotificationSettingsPayload } from '@/api/types';
import { useMyNotificationSettings, useUpdateNotificationSettingsMutation } from '@/hooks/queries/useNotificationSettings';
import { getPushToken, savePushToken } from '@/lib/pushToken';
import { showErrorToast } from '@/lib/toast';

const SWITCH_ON_COLOR = '#101828';

export default function NotificationSettingModal() {
  const { user } = useAuth();
  const { data: settings, isLoading: loading, error: settingsQueryError } = useMyNotificationSettings(user?.id);
  const error = settingsQueryError ? extractErrorMessage(settingsQueryError, 'Could not load notification settings.') : null;
  const updateMutation = useUpdateNotificationSettingsMutation(user?.id);
  const [permissionPrompt, setPermissionPrompt] = useState<{ target: string; message: string } | null>(null);

  function patch(payload: UpdateNotificationSettingsPayload) {
    updateMutation.mutate(payload, {
      onError: (e) => showErrorToast('Could not update', extractErrorMessage(e)),
    });
  }

  // OS push permission can only be requested, never revoked, from inside the app — turning this ON
  // may need a permission prompt (or a redirect to Settings if hard-denied) before the backend
  // channel preference is saved; turning it OFF is a pure app-level preference, no OS involvement.
  async function handleTogglePush(next: boolean) {
    if (!settings) return;
    if (next) {
      const { status, canAskAgain } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') {
        if (!canAskAgain) {
          setPermissionPrompt({
            target: 'notifications',
            message: 'Notifications are turned off. Enable them in Settings to get updates on your listings, offers, and transactions.',
          });
          return;
        }
        const result = await Notifications.requestPermissionsAsync();
        if (result.status !== 'granted') return;
        const token = await getPushToken();
        if (token) savePushToken(token).catch(() => {});
      }
    }
    const channels = { push: next, email: settings.channels.email };
    patch({ channels });
  }

  function handleToggleEmail(next: boolean) {
    if (!settings) return;
    const channels = { push: settings.channels.push, email: next };
    patch({ channels });
  }

  return (
    <View style={styles.flex}>
      <ScreenContainer background={colors.white} header={<ScreenHeader title="Notifications" />}>
        {loading ? (
          <NotificationSettingsSkeleton />
        ) : error || !settings ? (
          <Text style={styles.errorText}>{error ?? 'Could not load notification settings.'}</Text>
        ) : (
          <>
            <View style={styles.channelsCard}>
              <Text style={styles.groupLabel}>NOTIFICATION CHANNELS</Text>
              <SettingRow
                title="Push Notifications"
                description="Receive notifications directly on this device."
                value={settings.channels.push}
                onValueChange={handleTogglePush}
              />
              <SettingRow
                title="Email Notifications"
                description="Receive eligible Declut updates by email."
                value={settings.channels.email}
                onValueChange={handleToggleEmail}
                last
              />
            </View>

            <Text style={styles.sectionLabel}>TRANSACTIONS</Text>
            <SettingRow
              title="Transaction Updates"
              description="Get updates about your purchases, sales and transaction progress."
              value={settings.transactionUpdates}
              onValueChange={(next) => patch({ transactionUpdates: next })}
            />
            <SettingRow
              title="Inspection Reminders"
              description="Receive reminders about upcoming inspection deadlines and required actions."
              required
            />
            <SettingRow
              title="Payment & Escrow Updates"
              description="Get notified when payments are secured, released or refunded."
              required
            />
            <SettingRow
              title="Dispute Updates"
              description="Receive updates when there is activity on a reported issue or dispute."
              value={settings.disputeUpdates}
              onValueChange={(next) => patch({ disputeUpdates: next })}
              last
            />
            <Text style={styles.footnote}>Some critical transaction notifications may be required for the service to operate safely.</Text>

            <Text style={styles.sectionLabel}>MARKETPLACE</Text>
            <SettingRow title="Listing Activity" description="Get updates about items you've listed on Declut." required last />

            <Text style={styles.sectionLabel}>OFFERS & UPDATES</Text>
            <SettingRow title="Product Updates" description="Be the first to know about new Declut features and improvements." required />
            <SettingRow
              title="Referral & Rewards"
              description="Get updates about your referrals, progress and rewards."
              value={settings.referralAndRewards}
              onValueChange={(next) => patch({ referralAndRewards: next })}
              last
            />
          </>
        )}
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
    </View>
  );
}

interface SettingRowProps {
  title: string;
  description: string;
  value?: boolean;
  onValueChange?: (next: boolean) => void;
  required?: boolean;
  disabled?: boolean;
  last?: boolean;
}

function SettingRow({ title, description, value, onValueChange, required, disabled, last }: SettingRowProps) {
  return (
    <View style={[styles.row, !last && styles.rowDivider]}>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowDescription}>{description}</Text>
      </View>
      {required ? (
        <View style={styles.requiredPill}>
          <Text style={styles.requiredPillText}>Required</Text>
        </View>
      ) : (
        <Switch
          value={value}
          onValueChange={onValueChange}
          disabled={disabled}
          trackColor={{ true: SWITCH_ON_COLOR, false: colors.gray200 }}
          thumbColor={colors.white}
          style={[{ transform: [{ scale: 1.2 }] }]}
        />
      )}
    </View>
  );
}

function Bone({ width, height, radius: cornerRadius = 4, style }: { width: number | `${number}%`; height: number; radius?: number; style?: object }) {
  return <View style={[{ width, height, borderRadius: cornerRadius, borderCurve: 'continuous', backgroundColor: colors.gray100 }, style]} />;
}

function SettingRowSkeleton({ last }: { last?: boolean }) {
  return (
    <View style={[styles.row, !last && styles.rowDivider]}>
      <View style={styles.rowText}>
        <Bone width="55%" height={verticalScale(15)} />
        <Bone width="85%" height={verticalScale(13)} />
      </View>
      <Bone width={verticalScale(44)} height={verticalScale(26)} radius={radius.full} />
    </View>
  );
}

function SectionLabelSkeleton({ width }: { width: number }) {
  return <Bone width={verticalScale(width)} height={verticalScale(11)} style={styles.sectionLabelSkeleton} />;
}

/** Mirrors the loaded layout's shape (channels card + section row counts) so nothing jumps once the fetch resolves. */
function NotificationSettingsSkeleton() {
  const opacity = useSharedValue(0.5);

  useEffect(() => {
    opacity.value = withRepeat(withTiming(1, { duration: 700, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [opacity]);

  const pulseStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View style={pulseStyle}>
      <View style={styles.channelsCard}>
        <Bone width={verticalScale(150)} height={verticalScale(11)} style={styles.groupLabelSkeleton} />
        <SettingRowSkeleton />
        <SettingRowSkeleton last />
      </View>

      <SectionLabelSkeleton width={90} />
      <SettingRowSkeleton />
      <SettingRowSkeleton />
      <SettingRowSkeleton />
      <SettingRowSkeleton last />

      <SectionLabelSkeleton width={110} />
      <SettingRowSkeleton last />

      <SectionLabelSkeleton width={140} />
      <SettingRowSkeleton />
      <SettingRowSkeleton last />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  errorText: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.danger,
    textAlign: 'center',
    marginTop: spacingY.xl,
  },
  channelsCard: {
    backgroundColor: colors.cardBackground,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    // paddingHorizontal: spacingX.md,
    paddingTop: spacingY.md,
  },
  groupLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.xs,
    color: colors.gray400,
    letterSpacing: 0.5,
    marginBottom: spacingY.sm,
  },
  groupLabelSkeleton: {
    marginBottom: spacingY.sm,
  },
  sectionLabelSkeleton: {
    marginTop: spacingY.xl,
    marginBottom: spacingY.sm,
  },
  sectionLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.xs,
    color: colors.gray400,
    letterSpacing: 0.5,
    marginTop: spacingY.xl,
    marginBottom: spacingY.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingX.md,
    paddingVertical: spacingY.lg,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
  },
  rowText: {
    flex: 1,
    gap: verticalScale(6),
  },
  rowTitle: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.md,
    color: colors.gray900,
  },
  rowDescription: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm * 1.4,
    color: colors.gray500,
  },
  requiredPill: {
    paddingHorizontal: spacingX.md,
    paddingVertical: spacingY.xs,
    borderRadius: radius.full,
    borderCurve: 'continuous',
    backgroundColor: colors.gray100,
  },
  requiredPillText: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.sm,
    color: colors.gray600,
  },
  footnote: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
    color: colors.gray400,
    lineHeight: fontSize.xs * 1.4,
    marginTop: spacingY.md,
  },
});
