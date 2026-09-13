import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { EmptyState, ScreenContainer, ScreenHeader } from '@/components';
import Icon from '@/components/Icon';
import { colors, fontFamily, fontSize, radius, spacingX, spacingY } from '@/constants/theme';
import { verticalScale } from '@/utils/styling';
import { useSingleTap } from '@/hooks/useSingleTap';
import { useTransactionDetail } from '@/hooks/queries/useTransactions';
import { extractErrorMessage } from '@/api/client';
import { formatCurrency, formatDateFull } from '@/utils/helpers';
import { showWarningToast } from '@/lib/toast';
import type { TransactionStatus } from '@/api/types';

const STATUS_STYLES: Record<TransactionStatus, { label: string; bg: string; text: string }> = {
  pending_payment: { label: 'Pending Payment', bg: colors.gray100, text: colors.gray500 },
  escrow_active: { label: 'In Escrow', bg: colors.warningLight, text: colors.warning700 },
  awaiting_inspection: { label: 'Awaiting Inspection', bg: colors.warningLight, text: colors.warning700 },
  completed: { label: 'Completed', bg: colors.success50, text: colors.success },
  cancelled: { label: 'Cancelled', bg: colors.gray100, text: colors.gray500 },
  disputed: { label: 'Disputed', bg: colors.dangerLight, text: colors.danger },
  refunded: { label: 'Refunded', bg: colors.gray100, text: colors.gray500 },
};

/** Adapts Icon's {name,variant,size,color} shape to EmptyState's Phosphor-shaped icon prop (size?: string | number) — same pattern as myListingDetailsModal.tsx's own DangerIcon. */
function DangerIcon({ size, color }: { size?: number | string; color?: string }) {
  return <Icon name="danger" variant="linear" size={typeof size === 'number' ? size : undefined} color={color} />;
}

// FULL-SCREEN MODAL — reached from the seller's own "View Transaction" (myListingDetailsModal's
// footer, and myListings.tsx via ListingActionsSheet's row), GET /transactions/:id. The Figma
// export shows a fully-completed happy path (4 green checkmarks), but the PROGRESS section is
// driven off `transaction.progress` — the backend's own audit-log timeline, oldest-first (see the
// Postman collection's note on this endpoint) — so an in-progress transaction just shows however
// many steps have actually happened so far, rather than a hardcoded 4-step list with fake
// pending/upcoming states this screen has no way to predict. "Amount paid out" is the transaction's
// raw `amount` — commissionPercentage exists on the model but the Postman collection confirms it
// isn't wired into payout math server-side yet, so computing a "net of commission" figure here
// would just be a fabricated number that doesn't match what actually lands in the seller's wallet.
export default function TransactionDetailsModal() {
  const { transactionId } = useLocalSearchParams<{ transactionId: string }>();
  const guard = useSingleTap();
  const { data: transaction, isLoading: loading, error: queryError } = useTransactionDetail(transactionId);
  const error = queryError ? extractErrorMessage(queryError, 'Could not load this transaction.') : null;

  // TODO: no messaging/contact feature exists yet — placeholder toast (same copy myListingDetailsModal/ListingActionsSheet already use for this).
  function handleContactBuyer() {
    showWarningToast('Not available yet', "Contacting the buyer isn't available yet.");
  }

  const statusStyle = transaction ? STATUS_STYLES[transaction.status] : null;
  const progress = transaction?.progress ?? [];

  return (
    <ScreenContainer
      background={colors.white}
      header={<ScreenHeader title="Transaction Details" />}
      footer={
        transaction ? (
          <Pressable onPress={guard(handleContactBuyer)} style={styles.footerButton}>
            <Text style={styles.footerButtonLabel}>Contact Buyer</Text>
          </Pressable>
        ) : undefined
      }
    >
      {loading ? (
        <TransactionDetailsSkeleton />
      ) : error || !transaction ? (
        <EmptyState icon={DangerIcon} message={error ?? 'Transaction not found.'} />
      ) : (
        <>
          <View style={styles.amountCard}>
            <Text style={styles.amountLabel}>Amount paid out</Text>
            <Text style={styles.amountValue}>{formatCurrency(transaction.amount)}</Text>
            {statusStyle ? (
              <View style={[styles.statusPill, { backgroundColor: statusStyle.bg }]}>
                <Text style={[styles.statusPillText, { color: statusStyle.text }]}>{statusStyle.label}</Text>
              </View>
            ) : null}
          </View>

          {progress.length > 0 ? (
            <>
              <Text style={styles.sectionLabel}>PROGRESS</Text>
              <View style={styles.timeline}>
                {progress.map((step, index) => (
                  <View key={`${step.event}-${index}`} style={styles.timelineRow}>
                    <View style={styles.timelineMarkerColumn}>
                      <Icon name="tick-circle" variant="bold" size={verticalScale(24)} color={colors.success} />
                      {index < progress.length - 1 ? <View style={styles.timelineLine} /> : null}
                    </View>
                    <View style={styles.timelineTextColumn}>
                      <Text style={styles.timelineTitle}>{step.label}</Text>
                      <Text style={styles.timelineSubtitle}>{formatDateFull(step.createdAt)}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </>
          ) : null}

          <View style={styles.detailsCard}>
            <DetailRow label="Item" value={transaction.listing?.title ?? '—'} />
            <DetailRow label="Buyer" value={transaction.buyer?.name ?? '—'} />
            <DetailRow label="Transaction ID" value={transaction.reference ?? transaction._id} />
            <DetailRow label="Payment method" value="Declut Escrow" last />
          </View>
        </>
      )}
    </ScreenContainer>
  );
}

function DetailRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.detailsRow, !last && styles.detailsRowDivider]}>
      <Text style={styles.detailsRowLabel}>{label}</Text>
      <Text style={styles.detailsRowValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function Bone({ width, height, style }: { width: number | `${number}%`; height: number; style?: object }) {
  return <View style={[{ width, height, borderRadius: 4, backgroundColor: colors.gray100 }, style]} />;
}

/** Mirrors the loaded layout's shape so nothing jumps once the fetch resolves — same static
 *  placeholder technique as other detail screens in this app (no pulse animation needed here since
 *  this fetch is normally fast and the screen is reached via an explicit tap, not a passive scroll). */
function TransactionDetailsSkeleton() {
  return (
    <>
      <View style={[styles.amountCard, styles.skeletonAmountCard]}>
        <Bone width={verticalScale(100)} height={verticalScale(14)} style={styles.skeletonGapSm} />
        <Bone width={verticalScale(160)} height={verticalScale(36)} style={styles.skeletonGapSm} />
        <Bone width={verticalScale(90)} height={verticalScale(24)} style={{ borderRadius: radius.full }} />
      </View>
      <Bone width={verticalScale(80)} height={verticalScale(14)} style={styles.skeletonSectionLabel} />
      {[0, 1, 2].map((i) => (
        <View key={i} style={styles.timelineRow}>
          <View style={styles.timelineMarkerColumn}>
            <Bone width={verticalScale(24)} height={verticalScale(24)} style={{ borderRadius: radius.full }} />
            {i < 2 ? <View style={styles.timelineLine} /> : null}
          </View>
          <View style={styles.timelineTextColumn}>
            <Bone width="60%" height={verticalScale(16)} style={styles.skeletonGapXs} />
            <Bone width="40%" height={verticalScale(13)} />
          </View>
        </View>
      ))}
      <View style={[styles.detailsCard, styles.skeletonDetailsCard]}>
        <Bone width="100%" height={verticalScale(48)} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  amountCard: {
    backgroundColor: colors.backgroundLight,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    padding: spacingX.xl,
    marginBottom: spacingY['2xl'],
  },
  skeletonAmountCard: {
    gap: spacingY.sm,
  },
  amountLabel: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.md,
    color: colors.gray500,
    marginBottom: spacingY.sm,
  },
  amountValue: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize['3xl'],
    color: colors.ink,
    marginBottom: spacingY.md,
  },
  statusPill: {
    alignSelf: 'flex-start',
    borderRadius: radius.full,
    borderCurve: 'continuous',
    paddingHorizontal: spacingX.md,
    paddingVertical: spacingY.xs,
  },
  statusPillText: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.sm,
  },
  sectionLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.xs,
    color: colors.gray400,
    letterSpacing: 0.5,
    marginBottom: spacingY.md,
  },
  skeletonSectionLabel: {
    marginBottom: spacingY.lg,
  },
  timeline: {
    marginBottom: spacingY['2xl'],
  },
  timelineRow: {
    flexDirection: 'row',
    gap: spacingX.md,
  },
  timelineMarkerColumn: {
    alignItems: 'center',
    width: verticalScale(24),
  },
  timelineLine: {
    flex: 1,
    width: 2,
    minHeight: verticalScale(28),
    backgroundColor: colors.successLight,
    marginVertical: verticalScale(2),
  },
  timelineTextColumn: {
    flex: 1,
    paddingBottom: spacingY.lg,
  },
  timelineTitle: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.md,
    color: colors.ink,
    marginBottom: verticalScale(2),
  },
  timelineSubtitle: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: colors.gray400,
  },
  skeletonGapSm: {
    marginBottom: spacingY.sm,
  },
  skeletonGapXs: {
    marginBottom: verticalScale(6),
  },
  detailsCard: {
    backgroundColor: colors.cardBackground,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    paddingHorizontal: spacingX.lg,
  },
  skeletonDetailsCard: {
    padding: spacingX.lg,
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacingX.md,
    paddingVertical: spacingY.lg,
  },
  detailsRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
  },
  detailsRowLabel: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.md,
    color: colors.gray500,
  },
  detailsRowValue: {
    flexShrink: 1,
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.md,
    color: colors.ink,
    textAlign: 'right',
  },
  footerButton: {
    minHeight: verticalScale(56),
    borderRadius: radius.full,
    borderCurve: 'continuous',
    backgroundColor: colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerButtonLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.md,
    color: colors.gray700,
  },
});
