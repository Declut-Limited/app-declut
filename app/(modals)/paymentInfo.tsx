import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { BottomSheetCard, ScreenContainer, ScreenHeader } from '@/components';
import Icon from '@/components/Icon';
import { colors, fontFamily, fontSize, radius, spacingX, spacingY } from '@/constants/theme';
import { verticalScale } from '@/utils/styling';
import { useSingleTap } from '@/hooks/useSingleTap';
import { useAuth } from '@/contexts/AuthContext';
import { bankAccountsApi } from '@/api';
import { extractErrorMessage } from '@/api/client';
import type { BankAccount } from '@/api/types';
import { showErrorToast } from '@/lib/toast';

function bankInitials(shortName: string): string {
  const words = shortName.trim().split(/\s+/);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return shortName.slice(0, 2).toUpperCase();
}

export default function PaymentInfoModal() {
  const { user, refreshUser } = useAuth();
  const guard = useSingleTap();

  const [account, setAccount] = useState<BankAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [removeSuccess, setRemoveSuccess] = useState(false);

  useEffect(() => {
    if (!user?.id || !user.hasPayoutDetails) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    bankAccountsApi
      .getMyBankAccount(user.id)
      .then((data) => {
        if (!cancelled) setAccount(data);
      })
      .catch((e) => {
        if (!cancelled) setError(extractErrorMessage(e, 'Could not load your payout account.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.hasPayoutDetails]);

  function onAddAccount() {
    router.push('/(modals)/payoutDetailsModal');
  }

  async function handleConfirmRemove() {
    if (!account || removing) return;
    setRemoving(true);
    try {
      await bankAccountsApi.deleteBankAccount(account.id);
      await refreshUser(); // picks up the now-false hasPayoutDetails
      setAccount(null);
      setRemoveConfirmOpen(false);
      setRemoveSuccess(true);
    } catch (e) {
      setRemoveConfirmOpen(false);
      showErrorToast('Could not remove account', extractErrorMessage(e));
    } finally {
      setRemoving(false);
    }
  }

  return (
    <ScreenContainer edges={['top', 'bottom']} background={colors.white} header={<ScreenHeader title="Payment Info" />}>
      <View style={styles.banner}>
        <View style={styles.bannerIconWrap}>
          <Icon name="information" variant="bold" size={verticalScale(20)} color={colors.white} />
        </View>
        <View style={styles.bannerTextColumn}>
          <Text style={styles.bannerTitle}>Payout Account</Text>
          <Text style={styles.bannerBody}>When a buyer confirms your item, your payout (after the 6% Declut commission) is sent here.</Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={styles.loading} />
      ) : error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : account ? (
        <View style={styles.accountCard}>
          <View style={styles.accountCardHeader}>
            <View style={styles.bankBadge}>
              <Text style={styles.bankBadgeText}>{bankInitials(account.shortName)}</Text>
            </View>
            <Pressable onPress={guard(() => setRemoveConfirmOpen(true))} hitSlop={8}>
              <Text style={styles.changeText}>Remove Account</Text>
            </Pressable>
          </View>
          <View style={styles.accountCardDivider} />
          <Text style={styles.bankName}>{account.shortName}</Text>
          <Text style={styles.accountMeta}>
            {account.accountHolderName} <Text style={styles.accountMetaDivider}>|</Text> {account.maskedAccountNumber}
          </Text>
        </View>
      ) : (
        <View style={styles.emptyCard}>
          <Icon name="bank" variant="linear" size={verticalScale(32)} color={colors.gray400} />
          <Text style={styles.emptyText}>You haven't added a payout account yet.</Text>
          <Pressable onPress={guard(onAddAccount)} style={styles.addButton}>
            <Text style={styles.addButtonLabel}>Add Payout Account</Text>
          </Pressable>
        </View>
      )}

      <Text style={styles.footnote}>Buyers never see your account details. Declut never asks for your card PIN or OTP.</Text>

      {removeConfirmOpen ? (
        <View style={StyleSheet.absoluteFill}>
          <RemoveAccountConfirmSheet
            removing={removing}
            onKeep={() => setRemoveConfirmOpen(false)}
            onRemove={handleConfirmRemove}
          />
        </View>
      ) : null}

      {removeSuccess ? (
        <View style={StyleSheet.absoluteFill}>
          <RemoveAccountSuccessSheet
            onClose={() => setRemoveSuccess(false)}
            onAddNewAccount={() => {
              setRemoveSuccess(false);
              onAddAccount();
            }}
          />
        </View>
      ) : null}
    </ScreenContainer>
  );
}

interface RemoveAccountConfirmSheetProps {
  removing: boolean;
  onKeep: () => void;
  onRemove: () => void;
}

function RemoveAccountConfirmSheet({ removing, onKeep, onRemove }: RemoveAccountConfirmSheetProps) {
  const guard = useSingleTap();

  return (
    <BottomSheetCard onBackdropPress={removing ? undefined : guard(onKeep)}>
      <View style={styles.sheetIconWrap}>
        <Icon name="card-remove" variant="bold" size={verticalScale(40)} color={colors.danger} />
      </View>
      <Text style={styles.sheetTitle}>Remove this account?</Text>
      <Text style={styles.sheetBody}>
        Are you sure you want to remove this bank account? Any future payouts will be paused until a new account is added.
      </Text>

      <View style={styles.sheetButtonRow}>
        <Pressable onPress={removing ? undefined : guard(onKeep)} disabled={removing} style={[styles.sheetButton, styles.sheetButtonKeep]}>
          <Text style={styles.sheetButtonKeepLabel}>Keep</Text>
        </Pressable>
        <Pressable onPress={removing ? undefined : guard(onRemove)} disabled={removing} style={[styles.sheetButton, styles.sheetButtonRemove]}>
          {removing ? <ActivityIndicator color={colors.danger} /> : <Text style={styles.sheetButtonRemoveLabel}>Remove Account</Text>}
        </Pressable>
      </View>
    </BottomSheetCard>
  );
}

interface RemoveAccountSuccessSheetProps {
  onClose: () => void;
  onAddNewAccount: () => void;
}

function RemoveAccountSuccessSheet({ onClose, onAddNewAccount }: RemoveAccountSuccessSheetProps) {
  const guard = useSingleTap();

  return (
    <BottomSheetCard onBackdropPress={guard(onClose)}>
      <View style={styles.successIconWrap}>
        <Icon name="tick-circle" variant="bold" size={verticalScale(72)} color={colors.success} />
      </View>
      <Text style={styles.sheetTitle}>Success</Text>
      <Text style={styles.sheetBody}>
        Your bank account has been removed. You won't receive future payouts until you add another bank account.
      </Text>

      <View style={styles.sheetButtonRow}>
        <Pressable onPress={guard(onClose)} style={[styles.sheetButton, styles.sheetButtonKeep]}>
          <Text style={styles.sheetButtonKeepLabel}>Close</Text>
        </Pressable>
        <Pressable onPress={guard(onAddNewAccount)} style={[styles.sheetButton, styles.sheetButtonAdd]}>
          <Text style={styles.sheetButtonAddLabel}>Add New Account</Text>
        </Pressable>
      </View>
    </BottomSheetCard>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    gap: spacingX.md,
    backgroundColor: colors.warning25,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    padding: spacingX.lg,
    marginBottom: spacingY.xl,
  },
  bannerIconWrap: {
    width: verticalScale(32),
    height: verticalScale(32),
    borderRadius: radius.full,
    borderCurve: 'continuous',
    backgroundColor: colors.warning600,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerTextColumn: {
    flex: 1,
    gap: verticalScale(4),
  },
  bannerTitle: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.md,
    color: colors.ink,
  },
  bannerBody: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm * 1.4,
    color: colors.gray500,
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
  accountCard: {
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: colors.gray100,
    padding: spacingX.lg,
  },
  accountCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bankBadge: {
    width: verticalScale(44),
    height: verticalScale(44),
    borderRadius: radius.full,
    borderCurve: 'continuous',
    backgroundColor: colors.warning,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bankBadgeText: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.sm,
    color: colors.white,
  },
  changeText: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.sm,
    color: colors.danger,
  },
  accountCardDivider: {
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.gray200,
    marginVertical: spacingY.md,
  },
  bankName: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.lg,
    color: colors.gray600,
    marginBottom: verticalScale(4),
  },
  accountMeta: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.gray500,
  },
  accountMetaDivider: {
    color: colors.gray300,
  },
  emptyCard: {
    alignItems: 'center',
    gap: spacingY.md,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: colors.gray100,
    paddingVertical: spacingY['2xl'],
    paddingHorizontal: spacingX.lg,
  },
  emptyText: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.gray500,
    textAlign: 'center',
  },
  addButton: {
    minHeight: verticalScale(44),
    borderRadius: radius.full,
    borderCurve: 'continuous',
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacingX.xl,
  },
  addButtonLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.md,
    color: colors.white,
  },
  footnote: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.gray400,
    textAlign: 'center',
    marginTop: spacingY.xl,
  },
  sheetIconWrap: {
    alignSelf: 'center',
    width: verticalScale(96),
    height: verticalScale(96),
    borderRadius: radius.full,
    borderCurve: 'continuous',
    backgroundColor: colors.dangerLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacingY.xl,
    marginBottom: spacingY.lg,
  },
  successIconWrap: {
    alignSelf: 'center',
    marginTop: spacingY.xl,
    marginBottom: spacingY.lg,
  },
  sheetTitle: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xl,
    color: colors.ink,
    textAlign: 'center',
    marginBottom: spacingY.sm,
  },
  sheetBody: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.md,
    lineHeight: fontSize.md * 1.4,
    color: colors.gray500,
    textAlign: 'center',
    marginBottom: spacingY.xl,
  },
  sheetButtonRow: {
    flexDirection: 'row',
    gap: spacingX.md,
    marginBottom: spacingY.md,
  },
  sheetButton: {
    flex: 1,
    minHeight: verticalScale(52),
    borderRadius: radius.full,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetButtonKeep: {
    backgroundColor: colors.gray100,
  },
  sheetButtonKeepLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.md,
    color: colors.gray700,
  },
  sheetButtonRemove: {
    backgroundColor: colors.dangerLight,
  },
  sheetButtonRemoveLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.md,
    color: colors.danger,
  },
  sheetButtonAdd: {
    backgroundColor: colors.primary,
  },
  sheetButtonAddLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.md,
    color: colors.white,
  },
});
