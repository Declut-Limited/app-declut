import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Icons from 'phosphor-react-native';
import { BottomSheetCard, ScreenContainer, ScreenHeader } from '@/components';
import Icon from '@/components/Icon';
import { colors, fontFamily, fontSize, radius, spacingX, spacingY } from '@/constants/theme';
import { verticalScale } from '@/utils/styling';
import { useMutation } from '@tanstack/react-query';
import { useSingleTap } from '@/hooks/useSingleTap';
import { useAuth } from '@/contexts/AuthContext';
import { reportsApi } from '@/api';
import { useCancelPurchaseMutation } from '@/hooks/queries/useTransactions';
import { extractErrorMessage } from '@/api/client';
import { formatCurrency } from '@/utils/helpers';
import { showErrorToast } from '@/lib/toast';

const CANCEL_FEE_PERCENT = 10;

type ReportReason = 'not_as_described' | 'damaged' | 'wrong_item' | 'other';

const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: 'not_as_described', label: "Item isn't as described" },
  { value: 'damaged', label: 'Item is damaged or faulty' },
  { value: 'wrong_item', label: 'I received the wrong item' },
  { value: 'other', label: 'Something else' },
];

// FULL-SCREEN MODAL — was a BottomSheetCard on listingDetailsModal, promoted to its own route for
// the same reason payoutDetailsModal was: more room, and an explicit close button instead of
// relying on a backdrop tap. Reached from the pending_sale footer's "Report A Problem" button.
export default function SubmitReportModal() {
  const { listingId, transactionId, amount: amountParam } = useLocalSearchParams<{
    listingId: string;
    transactionId?: string;
    amount?: string;
  }>();
  const amount = Number(amountParam) || 0;
  const cancelFee = Math.round(amount * (CANCEL_FEE_PERCENT / 100));
  const refundAmount = amount - cancelFee;

  const guard = useSingleTap();
  const { user, refreshUser } = useAuth();

  const [reason, setReason] = useState<ReportReason | null>(null);
  const [description, setDescription] = useState('');
  const [cancelSheetOpen, setCancelSheetOpen] = useState(false);
  const [cancelSuccessOpen, setCancelSuccessOpen] = useState(false);
  const [reportSuccessOpen, setReportSuccessOpen] = useState(false);

  // Write-only — no list of the caller's own reports exists yet to invalidate, so a plain
  // useMutation (rather than one of the shared hooks) is enough here.
  const createReportMutation = useMutation({ mutationFn: reportsApi.createReport });
  const cancelPurchaseMutation = useCancelPurchaseMutation();
  const submitting = createReportMutation.isPending;

  const canSubmit = !!reason && !submitting && (reason !== 'other' || !!description.trim());

  function handleClose() {
    router.back();
  }

  // POST /reports (regular-user, confirmed 2026-09-14) — title is a short summary, reason is the
  // fuller text. For a predefined option there's no separate free-text, so both just use its
  // label; "Something else" uses the buyer's own description as the reason.
  function handleSubmit() {
    if (!canSubmit || !reason || !listingId || !user?.id) return;
    const selected = REPORT_REASONS.find((r) => r.value === reason);
    const title = reason === 'other' ? 'Something else' : selected?.label ?? 'Reported item';
    const reasonText = reason === 'other' ? description.trim() : selected?.label ?? title;

    createReportMutation.mutate(
      { title, reason: reasonText, listingId, reporterId: user.id },
      {
        onSuccess: () => setReportSuccessOpen(true),
        onError: (e) => showErrorToast('Could not submit report', extractErrorMessage(e)),
      }
    );
  }

  function handleCloseReportSuccess() {
    setReportSuccessOpen(false);
    router.back();
  }

  // Distinct from useCancelTransactionMutation, which is pre-payment only. This is the
  // post-payment, fee-applying cancellation — POST /transactions/:id/cancel-purchase, buyer-only.
  // Closes the confirm sheet immediately and shows the same full-screen overlay
  // listingDetailsModal uses while waiting on a backend confirmation, then the success sheet.
  // onSuccess invalidates the listing/transaction caches (see useTransactions.ts), so
  // listingDetailsModal — still mounted underneath, popped back to on close — picks up the
  // cancelled/refunded status on its own instead of showing what it last rendered before this.
  function handleConfirmCancelPurchase() {
    if (!transactionId) {
      showErrorToast('Could not cancel', 'Missing transaction — please close this and try again.');
      return;
    }
    setCancelSheetOpen(false);
    cancelPurchaseMutation.mutate(transactionId, {
      onSuccess: () => {
        setCancelSuccessOpen(true);
        // totalAmountInEscrow just dropped (refund minus the service fee) — refresh AuthContext's user to match.
        refreshUser().catch(() => {});
      },
      onError: (e) => showErrorToast('Could not cancel purchase', extractErrorMessage(e)),
    });
  }

  // TODO: this pops back to whatever's beneath submitReportModal on the stack (listingDetailsModal),
  // but that screen only fetches its listing/transaction on mount — it won't pick up the now-
  // cancelled/refunded status on its own. Revisit if that screen ends up showing stale state here.
  function handleCloseCancelSuccess() {
    setCancelSuccessOpen(false);
    router.back();
  }

  return (
    <View style={styles.flex}>
      <ScreenContainer
        background={colors.white}
        header={
          <ScreenHeader
            title="What went wrong?"
            showBack={false}
            rightElement={
              <Pressable onPress={guard(handleClose)} style={styles.closeButton} hitSlop={8}>
                <Icons.XIcon size={verticalScale(16)} color={colors.white} weight="bold" />
              </Pressable>
            }
          />
        }
        footer={
          <Pressable
            onPress={canSubmit ? guard(handleSubmit) : undefined}
            disabled={!canSubmit}
            style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
          >
            {submitting ? <ActivityIndicator color={colors.white} /> : <Text style={styles.submitLabel}>Submit Report</Text>}
          </Pressable>
        }
      >
        <Text style={styles.subtitle}>Your money stays frozen in escrow while we look into it.</Text>

        <View style={styles.optionList}>
          {REPORT_REASONS.map((option) => {
            const selected = reason === option.value;
            return (
              <Pressable
                key={option.value}
                onPress={guard(() => setReason(option.value))}
                style={[styles.optionRow, selected && styles.optionRowSelected]}
              >
                <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>{option.label}</Text>
                {selected ? <Icon name="tick-circle" variant="bold" size={verticalScale(24)} color={colors.primary} /> : null}
              </Pressable>
            );
          })}
        </View>

        {reason === 'other' ? (
          <TextInput
            style={styles.descriptionInput}
            placeholder="Describe the issue..."
            placeholderTextColor={colors.gray400}
            value={description}
            onChangeText={setDescription}
            multiline
          />
        ) : null}

        <View style={styles.warningRow}>
          <Icon name="info-circle" variant="bold" size={verticalScale(16)} color={colors.gray500} />
          <Text style={styles.warningText}>False reports can lead to account suspension.</Text>
        </View>

        <View style={styles.divider} />

        <Text style={styles.cancelPrompt}>Nothing wrong with the item — you just can't proceed?</Text>
        <Pressable onPress={guard(() => setCancelSheetOpen(true))} hitSlop={8}>
          <Text style={styles.cancelLink}>Cancel Purchase (10% service fee applies)</Text>
        </Pressable>
      </ScreenContainer>

      {cancelSheetOpen ? (
        <View style={StyleSheet.absoluteFill}>
          <ConfirmCancelSheet
            amount={amount}
            fee={cancelFee}
            refund={refundAmount}
            onGoBack={() => setCancelSheetOpen(false)}
            onConfirm={handleConfirmCancelPurchase}
          />
        </View>
      ) : null}

      {cancelPurchaseMutation.isPending ? (
        <View style={styles.confirmingOverlay}>
          <ActivityIndicator color={colors.white} size="large" />
          <Text style={styles.confirmingText}>Cancelling your purchase…</Text>
        </View>
      ) : null}

      {cancelSuccessOpen ? (
        <View style={StyleSheet.absoluteFill}>
          <CancelSuccessSheet refund={refundAmount} fee={cancelFee} onClose={handleCloseCancelSuccess} />
        </View>
      ) : null}

      {reportSuccessOpen ? (
        <View style={StyleSheet.absoluteFill}>
          <ReportSuccessSheet onClose={handleCloseReportSuccess} />
        </View>
      ) : null}
    </View>
  );
}

interface ConfirmCancelSheetProps {
  amount: number;
  fee: number;
  refund: number;
  onGoBack: () => void;
  onConfirm: () => void;
}

// BottomSheetCard has no footer slot (unlike ScreenContainer above) — its buttons are just the
// last regular children in the content, same as every other confirmation sheet in this app.
function ConfirmCancelSheet({ amount, fee, refund, onGoBack, onConfirm }: ConfirmCancelSheetProps) {
  const guard = useSingleTap();

  return (
    <BottomSheetCard onBackdropPress={guard(onGoBack)} sheetBackgroundColor={colors.white}>
      <View style={styles.cancelIconWrap}>
        <Icon name="card-remove" variant="bold" size={verticalScale(36)} color={colors.error} />
      </View>
      <Text style={styles.cancelSheetTitle}>Cancel this purchase?</Text>
      <Text style={styles.cancelSheetBody}>
        A 10% service fee of <Text style={styles.cancelSheetBold}>{formatCurrency(fee)}</Text> applies — half of it
        compensates the seller for the time lost. You'll be refunded{' '}
        <Text style={styles.cancelSheetBold}>{formatCurrency(refund)}</Text> of your{' '}
        <Text style={styles.cancelSheetBold}>{formatCurrency(amount)}</Text>.
      </Text>
      <View style={styles.cancelSheetButtonRow}>
        <Pressable onPress={guard(onGoBack)} style={styles.cancelSheetGoBackButton}>
          <Text style={styles.cancelSheetGoBackLabel}>Go Back</Text>
        </Pressable>
        <Pressable onPress={guard(onConfirm)} style={styles.cancelSheetConfirmButton}>
          <Text style={styles.cancelSheetConfirmLabel}>Cancel Purchase - Refund {formatCurrency(refund)}</Text>
        </Pressable>
      </View>
    </BottomSheetCard>
  );
}

interface CancelSuccessSheetProps {
  refund: number;
  fee: number;
  onClose: () => void;
}

function CancelSuccessSheet({ refund, fee, onClose }: CancelSuccessSheetProps) {
  const guard = useSingleTap();

  return (
    <BottomSheetCard onBackdropPress={guard(onClose)} sheetBackgroundColor={colors.white}>
      <View style={styles.successIconWrap}>
        <Icon name="tick-circle" variant="bold" size={verticalScale(72)} color={colors.success} />
      </View>
      <Text style={styles.successTitle}>Purchase Cancelled</Text>
      <Text style={styles.successSubtitle}>
        {formatCurrency(refund)} will be refunded to your bank account within 24 hours ({formatCurrency(fee)} service fee
        applied)
      </Text>
      <Pressable onPress={guard(onClose)} style={styles.successCloseButton}>
        <Text style={styles.successCloseLabel}>Close</Text>
      </Pressable>
    </BottomSheetCard>
  );
}

// Shown once the report is actually submitted, in place of the toast-and-close this used to do —
// same shape as CancelSuccessSheet above, local to this file for the same reason.
function ReportSuccessSheet({ onClose }: { onClose: () => void }) {
  const guard = useSingleTap();

  return (
    <BottomSheetCard onBackdropPress={guard(onClose)} sheetBackgroundColor={colors.white}>
      <View style={styles.successIconWrap}>
        <Icon name="tick-circle" variant="bold" size={verticalScale(72)} color={colors.success} />
      </View>
      <Text style={styles.successTitle}>Report Submitted</Text>
      <Text style={styles.successSubtitle}>We'll look into it and follow up if needed.</Text>
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
  closeButton: {
    width: verticalScale(32),
    height: verticalScale(32),
    borderRadius: radius.full,
    borderCurve: 'continuous',
    backgroundColor: colors.gray700,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtitle: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.md,
    color: colors.gray500,
    marginBottom: spacingY.xl,
  },
  optionList: {
    gap: spacingY.xs,
    marginBottom: spacingY.lg,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacingX.md,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    paddingHorizontal: spacingX.lg,
    paddingVertical: spacingY.lg,
  },
  optionRowSelected: {
    backgroundColor: colors.primaryLight,
  },
  optionLabel: {
    flex: 1,
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.lg,
    color: colors.gray700,
  },
  optionLabelSelected: {
    color: colors.ink,
  },
  descriptionInput: {
    minHeight: verticalScale(90),
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    backgroundColor: colors.gray50,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: spacingX.md,
    paddingVertical: spacingY.md,
    fontFamily: fontFamily.medium,
    fontSize: fontSize.md,
    color: colors.ink,
    textAlignVertical: 'top',
    marginBottom: spacingY.lg,
  },
  submitButton: {
    minHeight: verticalScale(56),
    borderRadius: radius.full,
    borderCurve: 'continuous',
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacingY.md,
  },
  submitButtonDisabled: {
    backgroundColor: colors.gray100,
  },
  submitLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.lg,
    color: colors.white,
  },
  warningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacingX.xs,
    marginBottom: spacingY.xl,
  },
  warningText: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.gray500,
  },
  divider: {
    height: 1,
    backgroundColor: colors.gray100,
    marginBottom: spacingY.xl,
  },
  cancelPrompt: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.gray500,
    textAlign: 'center',
    marginBottom: spacingY.xs,
  },
  cancelLink: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.md,
    color: colors.ink,
    textAlign: 'center',
    textDecorationLine: 'underline',
    marginBottom: spacingY.md,
  },
  cancelIconWrap: {
    alignSelf: 'center',
    width: verticalScale(88),
    height: verticalScale(88),
    borderRadius: radius.full,
    borderCurve: 'continuous',
    backgroundColor: colors.error50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacingY.xl,
    marginBottom: spacingY.xl,
  },
  cancelSheetTitle: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xl,
    color: colors.ink,
    textAlign: 'center',
    marginBottom: spacingY.md,
  },
  cancelSheetBody: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    lineHeight: fontSize.md * 1.4,
    color: colors.gray500,
    textAlign: 'center',
    marginBottom: spacingY.xl,
  },
  cancelSheetBold: {
    fontFamily: fontFamily.bold,
    color: colors.gray700,
  },
  cancelSheetButtonRow: {
    flexDirection: 'row',
    gap: spacingX.md,
    paddingBottom: spacingY.md,
  },
  cancelSheetGoBackButton: {
    flex: 1,
    minHeight: verticalScale(56),
    borderRadius: radius.full,
    borderCurve: 'continuous',
    backgroundColor: colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacingX.md,
  },
  cancelSheetGoBackLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.md,
    color: colors.gray700,
  },
  cancelSheetConfirmButton: {
    flex: 2,
    minHeight: verticalScale(56),
    borderRadius: radius.full,
    borderCurve: 'continuous',
    backgroundColor: colors.error50,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacingX.md,
  },
  cancelSheetConfirmLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.md,
    color: colors.error,
    textAlign: 'center',
  },
  confirmingOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 30,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacingY.md,
    backgroundColor: 'rgba(17, 24, 39, 0.85)',
  },
  confirmingText: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.md,
    color: colors.white,
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
