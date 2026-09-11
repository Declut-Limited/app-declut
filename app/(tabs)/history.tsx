import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import * as Icons from 'phosphor-react-native';
import dayjs from 'dayjs';
import { EmptyState, ScreenContainer, ScreenHeader } from '@/components';
import { colors, fontFamily, fontSize, radius, spacingX, spacingY } from '@/constants/theme';
import { verticalScale } from '@/utils/styling';
import { formatCurrency, formatDate } from '@/utils/helpers';
import { listingsApi, transactionsApi } from '@/api';
import type { Listing, PurchaseStatusFilter, Transaction, TransactionStatus } from '@/api/types';
import { usePaginatedListings } from '@/hooks/usePaginatedListings';
import { useSingleTap } from '@/hooks/useSingleTap';

const SKELETON_COUNT = 2;
const IMAGE_SIZE = verticalScale(96);
// Buyers inspect within 48h of payment (see CLAUDE.md) — Transaction has no dedicated deadline
// field, so this is computed from whenever the transaction last changed status (updatedAt,
// falling back to createdAt), not a literal backend value.
const INSPECTION_WINDOW_HOURS = 48;

const STATUS_META: Record<TransactionStatus, { label: string; bg: string; text: string }> = {
  pending_payment: { label: 'Pending Payment', bg: colors.gray100, text: colors.gray600 },
  escrow_active: { label: 'Ongoing', bg: colors.warningLight, text: colors.warning },
  awaiting_inspection: { label: 'Ongoing', bg: colors.warningLight, text: colors.warning },
  completed: { label: 'Completed', bg: colors.successLight, text: colors.success },
  cancelled: { label: 'Cancelled', bg: colors.gray100, text: colors.gray500 },
  disputed: { label: 'Disputed', bg: colors.dangerLight, text: colors.danger },
  refunded: { label: 'Refunded', bg: colors.primaryLight, text: colors.primary },
};

// 'active' maps server-side to awaiting_inspection only — not every in-progress status. No "All"
// tab per design — starts on "Active". The design's 4th tab reads "Cancelled", but the documented
// query only accepts active|completed|refunded|disputed (no "cancelled") — mapped to 'refunded'
// as the closest fit rather than sending a value the backend doesn't accept.
const FILTERS: { label: string; value: PurchaseStatusFilter }[] = [
  { label: 'Active', value: 'active' },
  { label: 'Completed', value: 'completed' },
  { label: 'Cancelled', value: 'refunded' },
  { label: 'Disputed', value: 'disputed' },
];

function formatInspectionCountdown(deadline: dayjs.Dayjs): string {
  const now = dayjs();
  if (deadline.isBefore(now)) return 'Inspection overdue';
  const totalMinutes = deadline.diff(now, 'minute');
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  return `${hours}h ${totalMinutes % 60}m`;
}

// Buyer-side purchase history — GET /transactions/purchases. The endpoint only returns the bare
// Transaction shape (no listing title/photo/seller), so each visible row's listing is fetched
// separately (GET /listings/:id, which does embed seller.name) and cached by listingId as pages load.
export default function HistoryScreen() {
  const guard = useSingleTap();
  const [filter, setFilter] = useState<PurchaseStatusFilter>('active');
  const [listingsById, setListingsById] = useState<Record<string, Listing>>({});

  const { items, loading, loadingMore, refreshing, error, hasMore, loadMore, refresh } = usePaginatedListings<Transaction>(
    ({ page, limit }) => transactionsApi.listMyPurchases(page, limit, filter),
    true,
    filter
  );

  useEffect(() => {
    const missing = items.filter((t) => !listingsById[t.listingId]);
    if (missing.length === 0) return;
    let cancelled = false;
    Promise.all(
      missing.map((t) =>
        listingsApi
          .getListing(t.listingId)
          .then((listing): [string, Listing] => [t.listingId, listing])
          .catch(() => null)
      )
    ).then((results) => {
      if (cancelled) return;
      setListingsById((prev) => {
        const next = { ...prev };
        for (const result of results) {
          if (result) next[result[0]] = result[1];
        }
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [items]);

  function onPressTransaction(transaction: Transaction) {
    router.push({ pathname: '/(modals)/listingDetailsModal', params: { id: transaction.listingId } });
  }

  return (
    <ScreenContainer edges={['top']} background={colors.white} scroll={false} header={<ScreenHeader title="History" showBack={false} />}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterRow}>
        {FILTERS.map((item) => {
          const active = item.value === filter;
          return (
            <Pressable key={item.label} onPress={guard(() => setFilter(item.value))} style={[styles.filterPill, active && styles.filterPillActive]}>
              <Text style={[styles.filterPillLabel, active && styles.filterPillLabelActive]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <FlatList
        data={loading || refreshing ? [] : items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <PurchaseCard transaction={item} listing={listingsById[item.listingId]} onPress={guard(() => onPressTransaction(item))} />
        )}
        onEndReachedThreshold={0.4}
        onEndReached={hasMore ? loadMore : undefined}
        onRefresh={refresh}
        refreshing={refreshing}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          loading || refreshing ? (
            <PurchaseCardSkeleton count={SKELETON_COUNT} />
          ) : error ? (
            <Text style={styles.message}>{error}</Text>
          ) : (
            <EmptyState icon={Icons.ReceiptIcon} message="No purchases history." />
          )
        }
        ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.primary} style={styles.footerLoading} /> : null}
      />
    </ScreenContainer>
  );
}

interface PurchaseCardProps {
  transaction: Transaction;
  listing?: Listing;
  onPress: () => void;
}

function PurchaseCard({ transaction, listing, onPress }: PurchaseCardProps) {
  const meta = STATUS_META[transaction.status];
  const isActive = transaction.status === 'awaiting_inspection';

  if (!listing) return <PurchaseCardSkeleton count={1} />;

  const deadline = dayjs(transaction.updatedAt ?? transaction.createdAt).add(INSPECTION_WINDOW_HOURS, 'hour');

  return (
    <Pressable onPress={onPress} style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.imageWrap}>
          {listing.mainImageUrl || listing.images[0] ? (
            <Image source={{ uri: listing.mainImageUrl || listing.images[0]?.secureUrl }} style={styles.image} resizeMode="cover" />
          ) : null}
        </View>
        <View style={styles.info}>
          <Text style={styles.itemTitle} numberOfLines={1}>
            {listing.title}
          </Text>
          <Text style={styles.amount}>{formatCurrency(transaction.amount)}</Text>
        </View>
        <View style={styles.metaColumn}>
          <View style={[styles.statusPill, { backgroundColor: meta.bg }]}>
            <Text style={[styles.statusLabel, { color: meta.text }]}>{meta.label}</Text>
          </View>
          {listing.seller?.name ? <Text style={styles.sellerName}>{listing.seller.name}</Text> : null}
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.cardFooter}>
        {isActive ? (
          <>
            <View style={styles.footerLeft}>
              <Icons.ClockIcon size={verticalScale(16)} color={colors.gray400} />
              <Text style={styles.footerText}>
                Inspect in <Text style={styles.footerTextBold}>{formatInspectionCountdown(deadline)}</Text>
              </Text>
            </View>
            <Pressable onPress={onPress} hitSlop={8} style={styles.continueRow}>
              <Text style={styles.continueText}>Continue</Text>
              <Icons.ArrowRightIcon size={verticalScale(16)} color={colors.primary} weight="bold" />
            </Pressable>
          </>
        ) : (
          <Text style={styles.footerText}>
            {transaction.confirmationCode ? `Confirmation code: ${transaction.confirmationCode}` : transaction.updatedAt ? formatDate(transaction.updatedAt) : ''}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

function PurchaseCardSkeleton({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, index) => (
        <View key={index} style={[styles.card, styles.skeletonPulse]}>
          <View style={styles.cardTop}>
            <View style={[styles.imageWrap, styles.skeletonBone]} />
            <View style={styles.info}>
              <View style={[styles.skeletonLine, { width: '75%', height: verticalScale(15) }]} />
              <View style={[styles.skeletonLine, { width: '55%', height: verticalScale(18) }]} />
            </View>
            <View style={styles.metaColumn}>
              <View style={[styles.skeletonLine, styles.skeletonPillBone]} />
              <View style={[styles.skeletonLine, { width: verticalScale(56), height: verticalScale(12) }]} />
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.cardFooter}>
            <View style={[styles.skeletonLine, { width: '45%', height: verticalScale(13) }]} />
            <View style={[styles.skeletonLine, { width: verticalScale(70), height: verticalScale(13) }]} />
          </View>
        </View>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  // No paddingHorizontal on filterRow/listContent below — ScreenContainer's own flexContent
  // wrapper already applies spacingX.lg on all sides when scroll={false} (see ScreenContainer.tsx);
  // re-adding it here was doubling the inset on every element.
  // flexGrow: 0 is the key fix — without it, a horizontal ScrollView sitting among unconstrained
  // flex-column siblings can expand to fill leftover vertical space, and the row's default
  // alignItems:'stretch' then stretches every pill to match that height.
  filterScroll: {
    flexGrow: 0,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingX.sm,
    paddingBottom: spacingY.lg,
  },
  filterPill: {
    height: verticalScale(32),
    borderRadius: radius.full,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: colors.gray200,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacingX.md,
  },
  filterPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterPillLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.sm,
    color: colors.gray600,
  },
  filterPillLabelActive: {
    color: colors.white,
  },
  listContent: {
    flexGrow: 1,
    paddingBottom: spacingY.xl,
  },
  footerLoading: {
    paddingVertical: spacingY.lg,
  },
  message: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.gray400,
    paddingVertical: spacingY.xl,
    textAlign: 'center',
  },
  card: {
    backgroundColor: colors.cardBackground,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    padding: spacingX.md,
    marginBottom: spacingY.md,
  },
  cardTop: {
    flexDirection: 'row',
    gap: spacingX.md,
  },
  imageWrap: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
    backgroundColor: colors.gray100,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  info: {
    flex: 1,
    justifyContent: 'center',
    gap: verticalScale(6),
  },
  itemTitle: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    color: colors.gray700,
  },
  amount: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.lg,
    color: colors.ink,
  },
  metaColumn: {
    alignItems: 'flex-end',
    gap: verticalScale(6),
  },
  statusPill: {
    paddingHorizontal: spacingX.sm,
    paddingVertical: verticalScale(3),
    borderRadius: radius.full,
    borderCurve: 'continuous',
  },
  statusLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: verticalScale(11),
  },
  sellerName: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.gray500,
  },
  divider: {
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.gray200,
    marginVertical: spacingY.md,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  footerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingX.xs,
  },
  footerText: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.gray500,
  },
  footerTextBold: {
    fontFamily: fontFamily.bold,
    color: colors.ink,
  },
  continueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: verticalScale(4),
  },
  continueText: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.md,
    color: colors.primary,
  },
  skeletonPulse: {
    opacity: 0.6,
  },
  skeletonBone: {
    backgroundColor: colors.gray100,
  },
  skeletonLine: {
    borderRadius: 4,
    backgroundColor: colors.gray100,
  },
  skeletonPillBone: {
    width: verticalScale(64),
    height: verticalScale(20),
    borderRadius: radius.full,
  },
});
