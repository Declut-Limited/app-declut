import React, { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import * as Icons from 'phosphor-react-native';
import { BottomSheetCard } from './BottomSheetCard';
import { colors, fontFamily, fontSize, radius, spacingX, spacingY } from '@/constants/theme';
import { verticalScale } from '@/utils/styling';
import { formatCurrency } from '@/utils/helpers';
import { listingsApi } from '@/api';
import { extractErrorMessage } from '@/api/client';
import type { Listing } from '@/api/types';
import { useSingleTap } from '@/hooks/useSingleTap';
import { showErrorToast, showSuccessToast, showWarningToast } from '@/lib/toast';

interface ListingActionsSheetProps {
  listing: Listing;
  onClose: () => void;
  /** Refetches after an action actually changes something (pause/delete) — a list refresh on
   *  myListings, a single-listing refetch on myListingDetailsModal. */
  onChanged: () => void;
  /** myListingDetailsModal opens this sheet from the listing it's already showing — "View Listing"
   *  there would just navigate back to itself, so that screen omits it. myListings.tsx (tapping a
   *  card in the list) leaves it in, since that's the only way there to a single listing's detail. */
  hideViewListing?: boolean;
}

// Shared between myListings.tsx (tapping a card) and myListingDetailsModal.tsx (the floating
// header's ••• button). Which rows show depends entirely on listing.status:
// - View Listing: always, unless hideViewListing.
// - Edit/Delete Listing: only active or flagged.
// - Pause Listing: only active. Resume Listing: only archived (paused) — no confirmed
//   "unarchive"/"reactivate" endpoint exists yet, so Resume is a placeholder for now.
// - View Transaction / Contact Buyer: only pending_sale or sold.
// - Share Listing: only active.
export function ListingActionsSheet({ listing, onClose, onChanged, hideViewListing }: ListingActionsSheetProps) {
  const guard = useSingleTap();
  const [pendingAction, setPendingAction] = useState<'pause' | 'delete' | null>(null);
  const busy = pendingAction !== null;

  const canPause = listing.status === 'active';
  const canResume = listing.status === 'archived';
  const canShare = listing.status === 'active';
  const canViewTransactionOrContact = listing.status === 'pending_sale' || listing.status === 'sold';
  const canEditOrDelete = listing.status === 'active' || listing.status === 'flagged';

  function handleViewListing() {
    onClose();
    router.push({ pathname: '/(modals)/myListingDetailsModal', params: { id: listing._id } });
  }

  // TODO: no listing edit screen exists yet (addItemModal is create-only) — placeholder toast.
  function handleEdit() {
    showWarningToast('Not available yet', "Editing a listing isn't available yet.");
  }

  async function handlePause() {
    setPendingAction('pause');
    try {
      await listingsApi.archiveListing(listing._id);
      showSuccessToast('Listing paused', 'Buyers can no longer find this listing.');
      onChanged();
      onClose();
    } catch (e) {
      showErrorToast('Could not pause listing', extractErrorMessage(e));
    } finally {
      setPendingAction(null);
    }
  }

  // TODO: only an Archive listing endpoint is documented — no unarchive/reactivate counterpart yet.
  function handleResume() {
    showWarningToast('Not available yet', "Resuming a paused listing isn't wired up yet.");
  }

  // TODO: no seller-side transaction-detail screen exists yet — placeholder toast.
  function handleViewTransaction() {
    showWarningToast('Not available yet', "Viewing the transaction isn't available yet.");
  }

  // TODO: no messaging/contact feature exists yet — placeholder toast.
  function handleContactBuyer() {
    showWarningToast('Not available yet', "Contacting the buyer isn't available yet.");
  }

  async function handleShare() {
    try {
      await Share.share({ message: `Check out "${listing.title}" on Declut — ${formatCurrency(listing.price)}` });
    } catch {
      // User cancelled or the native share sheet failed — nothing actionable to surface.
    }
  }

  function handleDelete() {
    Alert.alert('Delete this listing?', "This can't be undone.", [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: confirmDelete },
    ]);
  }

  async function confirmDelete() {
    setPendingAction('delete');
    try {
      await listingsApi.deleteListing(listing._id);
      showSuccessToast('Listing deleted');
      onChanged();
      onClose();
    } catch (e) {
      showErrorToast('Could not delete listing', extractErrorMessage(e));
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <BottomSheetCard onBackdropPress={busy ? undefined : guard(onClose)} sheetBackgroundColor={colors.white}>
      <View style={styles.actionsHeaderRow}>
        <Text style={styles.actionsTitle} numberOfLines={1}>
          {listing.title}
        </Text>
        <Pressable onPress={busy ? undefined : guard(onClose)} style={styles.actionsCloseButton} hitSlop={8}>
          <Icons.XIcon size={verticalScale(16)} color={colors.white} weight="bold" />
        </Pressable>
      </View>

      <View style={styles.actionsList}>
        {hideViewListing ? null : <ActionRow label="View Listing" onPress={guard(handleViewListing)} disabled={busy} />}

        {canEditOrDelete ? <ActionRow label="Edit Listing" onPress={guard(handleEdit)} disabled={busy} /> : null}

        {canPause ? (
          <ActionRow label="Pause Listing" onPress={guard(handlePause)} disabled={busy} loading={pendingAction === 'pause'} />
        ) : canResume ? (
          <ActionRow label="Resume Listing" onPress={guard(handleResume)} disabled={busy} />
        ) : null}

        {canViewTransactionOrContact ? <ActionRow label="View Transaction" onPress={guard(handleViewTransaction)} disabled={busy} /> : null}
        {canViewTransactionOrContact ? <ActionRow label="Contact Buyer" onPress={guard(handleContactBuyer)} disabled={busy} /> : null}
        {canShare ? <ActionRow label="Share Listing" onPress={guard(handleShare)} disabled={busy} /> : null}
        {canEditOrDelete ? (
          <ActionRow label="Delete Listing" onPress={guard(handleDelete)} disabled={busy} loading={pendingAction === 'delete'} danger />
        ) : null}
      </View>
    </BottomSheetCard>
  );
}

interface ActionRowProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  danger?: boolean;
}

function ActionRow({ label, onPress, disabled, loading, danger }: ActionRowProps) {
  return (
    <Pressable onPress={disabled ? undefined : onPress} disabled={disabled} style={[styles.actionRow, danger && styles.actionRowDanger]}>
      {loading ? (
        <ActivityIndicator color={danger ? colors.danger : colors.gray700} />
      ) : (
        <Text style={[styles.actionRowLabel, danger && styles.actionRowLabelDanger]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  actionsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacingX.md,
    marginBottom: spacingY.xl,
  },
  actionsTitle: {
    flex: 1,
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xl,
    color: colors.ink,
  },
  actionsCloseButton: {
    width: verticalScale(32),
    height: verticalScale(32),
    borderRadius: radius.full,
    borderCurve: 'continuous',
    backgroundColor: colors.gray700,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionsList: {
    gap: spacingY.xs,
    paddingBottom: spacingY.xl,
    marginBottom: spacingY.xl,
  },
  actionRow: {
    minHeight: verticalScale(56),
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    backgroundColor: colors.cardBackground,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacingX.lg,
  },
  actionRowDanger: {
    backgroundColor: colors.error25,
  },
  actionRowLabel: {
    alignSelf: 'flex-start',
    fontFamily: fontFamily.medium,
    fontSize: fontSize.lg,
    color: colors.gray700,
  },
  actionRowLabelDanger: {
    color: colors.danger,
  },
});
