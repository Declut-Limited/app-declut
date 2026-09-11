import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, Switch, Text, View } from 'react-native';
import * as Notifications from 'expo-notifications';
import { PermissionModal, ScreenContainer, ScreenHeader } from '@/components';
import { colors, fontFamily, fontSize, radius, spacingX, spacingY } from '@/constants/theme';
import { verticalScale } from '@/utils/styling';
import { useAuth } from '@/contexts/AuthContext';
import { notificationSettingsApi } from '@/api';
import { extractErrorMessage } from '@/api/client';
import type { NotificationSettings, UpdateNotificationSettingsPayload } from '@/api/types';
import { getPushToken, savePushToken } from '@/lib/pushToken';
import { showErrorToast } from '@/lib/toast';

const SWITCH_ON_COLOR = '#101828';

export default function NotificationSettingModal() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [permissionPrompt, setPermissionPrompt] = useState<{ target: string; message: string } | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    notificationSettingsApi
      .getMyNotificationSettings(user.id)
      .then((data) => {
        if (!cancelled) setSettings(data);
      })
      .catch((e) => {
        if (!cancelled) setError(extractErrorMessage(e, 'Could not load notification settings.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  // Optimistic — reverts on failure. `optimistic` only ever contains fields PATCH actually accepts.
  async function patch(payload: UpdateNotificationSettingsPayload, optimistic: Partial<NotificationSettings>) {
    if (!user?.id || !settings) return;
    const previous = settings;
    setSettings({ ...settings, ...optimistic });
    try {
      const updated = await notificationSettingsApi.updateMyNotificationSettings(user.id, payload);
      setSettings(updated);
    } catch (e) {
      setSettings(previous);
      showErrorToast('Could not update', extractErrorMessage(e));
    }
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
    patch({ channels }, { channels });
  }

  function handleToggleEmail(next: boolean) {
    if (!settings) return;
    const channels = { push: settings.channels.push, email: next };
    patch({ channels }, { channels });
  }

  return (
    <View style={styles.flex}>
      <ScreenContainer background={colors.white} header={<ScreenHeader title="Notifications" />}>
        {loading ? (
          <ActivityIndicator color={colors.primary} style={styles.loading} />
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
              onValueChange={(next) => patch({ transactionUpdates: next }, { transactionUpdates: next })}
            />
            <SettingRow
              title="Inspection Reminders"
              description="Receive reminders about upcoming inspection deadlines and required actions."
              value={settings.inspectionReminders}
              onValueChange={(next) => patch({ inspectionReminders: next }, { inspectionReminders: next })}
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
              onValueChange={(next) => patch({ disputeUpdates: next }, { disputeUpdates: next })}
              last
            />
            <Text style={styles.footnote}>Some critical transaction notifications may be required for the service to operate safely.</Text>

            <Text style={styles.sectionLabel}>MARKETPLACE</Text>
            <SettingRow title="Listing Activity" description="Get updates about items you've listed on Declut." required last />

            <Text style={styles.sectionLabel}>OFFERS & UPDATES</Text>
            <SettingRow title="Product Updates" description="Be the first to know about new Declut features and improvements." required />
            {/* Design shows this as a toggle, but PATCH rejects referralAndRewards (400) — Required
                pill like the other backend-locked fields, not a toggle that can't actually persist. */}
            <SettingRow title="Referral & Rewards" description="Get updates about your referrals, progress and rewards." required last />
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

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  loading: {
    marginTop: spacingY.xl,
  },
  errorText: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.danger,
    textAlign: 'center',
    marginTop: spacingY.xl,
  },
  // No marginBottom — the next sectionLabel's own marginTop already provides that gap, same as
  // every other section transition on this screen; adding both would double it up here only.
  // No paddingBottom either — the last row inside already contributes its own bottom padding via
  // `row`'s paddingVertical, so paddingTop is intentionally smaller than a full row's padding to
  // roughly balance the label's own height sitting above the first row.
  channelsCard: {
    backgroundColor: colors.cardBackground,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    paddingHorizontal: spacingX.md,
    paddingTop: spacingY.md,
  },
  groupLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.xs,
    color: colors.gray400,
    letterSpacing: 0.5,
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
