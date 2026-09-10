import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { BottomSheetCard, ScreenContainer, ScreenHeader } from '@/components';
import Icon from '@/components/Icon';
import { OptionPickerSheet } from '@/components/addItem/OptionPickerSheet';
import { colors, fontFamily, fontSize, radius, spacingX, spacingY } from '@/constants/theme';
import { verticalScale } from '@/utils/styling';
import { useSingleTap } from '@/hooks/useSingleTap';
import { useAuth } from '@/contexts/AuthContext';
import { banksApi, bankAccountsApi } from '@/api';
import { extractErrorMessage } from '@/api/client';
import type { Bank } from '@/api/types';
import { showErrorToast } from '@/lib/toast';

const NUBAN_LENGTH = 10;
const RESOLVE_DEBOUNCE_MS = 500;

// FULL-SCREEN MODAL — two entry points. (1) Shown right after a listing's first publish, only
// when the signed-in user has no bank account on file yet (User.hasPayoutDetails) — was a
// BottomSheetCard; now its own route so there's room to breathe and an explicit Skip instead of
// relying on a backdrop tap. (2) "Change Account" from Payment Info, passing an existing
// bankAccountId — there's no DELETE /bank-accounts endpoint, so "changing" your payout account
// means PATCHing the existing one via this same form instead of creating a second one (which
// would 409 anyway, since it's one account per user).
export default function PayoutDetailsModal() {
  const { bankAccountId } = useLocalSearchParams<{ bankAccountId?: string }>();
  const isEditing = !!bankAccountId;
  const guard = useSingleTap();
  const { refreshUser } = useAuth();

  const [banks, setBanks] = useState<Bank[]>([]);
  const [banksLoading, setBanksLoading] = useState(true);
  const [banksError, setBanksError] = useState<string | null>(null);
  const [bankPickerOpen, setBankPickerOpen] = useState(false);

  const [bankCode, setBankCode] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountFocused, setAccountFocused] = useState(false);
  const [resolvedName, setResolvedName] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const selectedBank = banks.find((b) => b.code === bankCode);

  useEffect(() => {
    banksApi
      .getBanks()
      .then(setBanks)
      .catch((e) => setBanksError(extractErrorMessage(e, 'Could not load banks.')))
      .finally(() => setBanksLoading(false));
  }, []);

  // Re-resolves whenever either half of the pair changes — a stale resolved name for a since-
  // edited bank/account number must never be the one that gets submitted.
  useEffect(() => {
    setResolvedName(null);
    setResolveError(null);
    if (!bankCode || accountNumber.length !== NUBAN_LENGTH) return;

    let cancelled = false;
    setResolving(true);
    const timer = setTimeout(() => {
      banksApi
        .resolveBankAccount(bankCode, accountNumber)
        .then((result) => {
          if (!cancelled) setResolvedName(result.accountName);
        })
        .catch((e) => {
          if (!cancelled) setResolveError(extractErrorMessage(e, 'Could not verify this account.'));
        })
        .finally(() => {
          if (!cancelled) setResolving(false);
        });
    }, RESOLVE_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [bankCode, accountNumber]);

  const canSave = !!bankCode && !!resolvedName && !resolving && !saving;

  function handleSkip() {
    router.dismissTo('/(tabs)/home');
  }

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    try {
      if (bankAccountId) {
        await bankAccountsApi.updateBankAccount(bankAccountId, { bankCode, accountNumber });
      } else {
        await bankAccountsApi.createBankAccount({ bankCode, accountNumber });
      }
      refreshUser(); // picks up the now-true hasPayoutDetails for next time
      setSaveSuccess(true);
    } catch (e) {
      showErrorToast('Could not save bank account', extractErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.flex}>
      <ScreenContainer
        background={colors.white}
        header={
          <ScreenHeader
            title={isEditing ? 'Change Payout Account' : 'Payout Details'}
            showBack={isEditing}
            rightElement={
              isEditing ? null : (
                <Pressable onPress={guard(handleSkip)} hitSlop={8}>
                  <Text style={styles.skipText}>Skip</Text>
                </Pressable>
              )
            }
          />
        }
        footer={
          <Pressable
            onPress={canSave ? guard(handleSave) : undefined}
            disabled={!canSave}
            style={[styles.saveButton, !canSave && styles.saveButtonDisabled]}
          >
            {saving ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={[styles.saveButtonLabel, !canSave && styles.saveButtonLabelDisabled]}>Save Account</Text>
            )}
          </Pressable>
        }
      >
        <View style={styles.iconWrap}>
          <Icon name="bank" variant="bold" size={verticalScale(36)} color={colors.primary} />
        </View>
        <Text style={styles.title}>Where should your payouts go?</Text>
        <Text style={styles.subtitle}>
          Add your bank account once — we'll automatically send your earnings here whenever your sales are paid out.
        </Text>

        <Pressable onPress={guard(() => setBankPickerOpen(true))} style={styles.fieldBox}>
          {selectedBank ? (
            <View style={styles.bankLogoWrap}>
              <Image source={{ uri: selectedBank.logoUrl }} style={styles.bankLogo} />
            </View>
          ) : null}
          <View style={styles.fieldTextColumn}>
            <Text style={styles.fieldLabel}>Bank name</Text>
            <Text style={[styles.fieldValue, !selectedBank && styles.fieldValuePlaceholder]}>{selectedBank?.name || 'Select your bank'}</Text>
          </View>
          <Icon name="arrow-right-2" variant="linear" size={verticalScale(16)} color={colors.gray400} />
        </Pressable>

        <View style={[styles.fieldBox, accountFocused && styles.fieldBoxFocused]}>
          <View style={styles.fieldTextColumn}>
            <Text style={styles.fieldLabel}>Account number</Text>
            <TextInput
              style={styles.fieldInput}
              value={accountNumber}
              onChangeText={(text) => setAccountNumber(text.replace(/[^0-9]/g, '').slice(0, NUBAN_LENGTH))}
              placeholder="0123456789"
              placeholderTextColor={colors.gray400}
              keyboardType="number-pad"
              maxLength={NUBAN_LENGTH}
              onFocus={() => setAccountFocused(true)}
              onBlur={() => setAccountFocused(false)}
            />
          </View>
          {resolving ? <ActivityIndicator color={colors.primary} /> : null}
        </View>
        {resolveError ? <Text style={styles.errorText}>{resolveError}</Text> : null}

        {resolvedName ? (
          <View style={[styles.fieldBox, styles.fieldBoxReadOnly]}>
            <View style={styles.fieldTextColumn}>
              <Text style={styles.fieldLabel}>Account name</Text>
              <Text style={styles.fieldValue}>{resolvedName}</Text>
            </View>
          </View>
        ) : null}

        <View style={styles.footnote}>
          <Icon name="info-circle" variant="bold" size={verticalScale(16)} color={colors.gray400} />
          <Text style={styles.footnoteText}>You can change this anytime in Payment methods.</Text>
        </View>
      </ScreenContainer>

      {bankPickerOpen ? (
        <View style={StyleSheet.absoluteFill}>
          <OptionPickerSheet
            title="Select your bank"
            options={banks.map((b) => ({ label: b.name, value: b.code, imageUrl: b.logoUrl }))}
            value={bankCode}
            onSelect={(value) => {
              setBankCode(value);
              setBankPickerOpen(false);
            }}
            onClose={() => setBankPickerOpen(false)}
            loading={banksLoading}
            error={banksError}
          />
        </View>
      ) : null}

      {saveSuccess ? (
        <View style={StyleSheet.absoluteFill}>
          <PayoutSuccessSheet onClose={guard(() => router.dismissTo(isEditing ? '/(modals)/paymentInfo' : '/(tabs)/home'))} />
        </View>
      ) : null}
    </View>
  );
}

// Shown once the bank account is actually saved, in place of an immediate dismiss — mirrors the
// listing-publish success sheet so both post-publish confirmations feel consistent.
function PayoutSuccessSheet({ onClose }: { onClose: () => void }) {
  const guard = useSingleTap();

  return (
    <BottomSheetCard onBackdropPress={guard(onClose)}>
      <View style={styles.successIconWrap}>
        <Icon name="tick-circle" variant="bold" size={verticalScale(72)} color={colors.success} />
      </View>
      <Text style={styles.successTitle}>Success</Text>
      <Text style={styles.successSubtitle}>
        Your payout details have been saved. We'll send your earnings here whenever your sales are paid out.
      </Text>
      <Pressable onPress={guard(onClose)} style={styles.successCloseButton}>
        <Text style={styles.successCloseLabel}>Close</Text>
      </Pressable>
    </BottomSheetCard>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  skipText: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.sm,
    color: colors.gray500,
  },
  iconWrap: {
    alignSelf: 'center',
    width: verticalScale(72),
    height: verticalScale(72),
    borderRadius: radius.full,
    borderCurve: 'continuous',
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacingY.xl,
    marginBottom: spacingY.lg,
  },
  title: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xl,
    color: colors.ink,
    textAlign: 'center',
    marginBottom: spacingY.sm,
  },
  subtitle: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.md,
    lineHeight: fontSize.md * 1.4,
    color: colors.gray500,
    textAlign: 'center',
    marginBottom: spacingY.xl,
  },
  fieldBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacingX.sm,
    minHeight: verticalScale(64),
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.gray200,
    paddingHorizontal: spacingX.md,
    paddingVertical: spacingY.sm,
    marginBottom: spacingY.md,
  },
  fieldBoxFocused: {
    borderColor: colors.primary,
  },
  fieldBoxReadOnly: {
    backgroundColor: colors.gray50,
    borderColor: colors.gray50,
  },
  fieldTextColumn: {
    flex: 1,
  },
  bankLogoWrap: {
    width: verticalScale(32),
    height: verticalScale(32),
    borderRadius: radius.full,
    borderCurve: 'continuous',
    backgroundColor: colors.gray100,
    overflow: 'hidden',
  },
  bankLogo: {
    width: '100%',
    height: '100%',
  },
  fieldLabel: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.gray400,
    marginBottom: verticalScale(2),
  },
  fieldValue: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.md,
    color: colors.gray900,
  },
  fieldValuePlaceholder: {
    fontFamily: fontFamily.medium,
    color: colors.gray400,
  },
  fieldInput: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.md,
    color: colors.gray900,
    padding: 0,
  },
  errorText: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
    color: colors.danger,
    marginTop: -spacingY.sm,
    marginBottom: spacingY.md,
  },
  saveButton: {
    minHeight: verticalScale(56),
    borderRadius: radius.full,
    borderCurve: 'continuous',
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacingY.md,
  },
  saveButtonDisabled: {
    backgroundColor: colors.gray100,
  },
  saveButtonLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.lg,
    color: colors.white,
  },
  saveButtonLabelDisabled: {
    color: colors.gray400,
  },
  footnote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacingX.xs,
    marginTop: spacingY.md,
  },
  footnoteText: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.gray500,
  },
  successIconWrap: {
    alignSelf: 'center',
    marginTop: spacingY.xl,
    marginBottom: spacingY.xl,
  },
  successTitle: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xl,
    color: colors.ink,
    textAlign: 'center',
    marginBottom: spacingY.sm,
  },
  successSubtitle: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.md,
    lineHeight: fontSize.md * 1.4,
    color: colors.gray500,
    textAlign: 'center',
    marginBottom: spacingY['2xl'],
  },
  successCloseButton: {
    alignSelf: 'center',
    minHeight: verticalScale(52),
    borderRadius: radius.full,
    borderCurve: 'continuous',
    backgroundColor: colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacingX['3xl'],
    marginBottom: spacingY.md,
  },
  successCloseLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.md,
    color: colors.gray700,
  },
});
