import React, { useState } from 'react';
import { ActivityIndicator, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import * as Icons from 'phosphor-react-native';
import { BottomSheetCard } from './BottomSheetCard';
import Icon from './Icon';
import { colors, fontFamily, fontSize, radius, spacingX, spacingY } from '@/constants/theme';
import { verticalScale } from '@/utils/styling';
import { formatCurrency } from '@/utils/helpers';
import { extractErrorMessage } from '@/api/client';
import type { Listing } from '@/api/types';
import { useSingleTap } from '@/hooks/useSingleTap';
import { usePauseListingMutation, useResumeListingMutation, useDeleteListingMutation } from '@/hooks/queries/useListings';
import { showErrorToast, showWarningToast } from '@/lib/toast';

interface ListingActionsSheetProps {
  listing: Listing;
  onClose: () => void;
  /** myListingDetailsModal opens this sheet from the listing it's already showing — "View Listing"
   *  there would just navigate back to itself, so that screen omits it. myListings.tsx (tapping a
   *  card in the list) leaves it in, since that's the only way there to a single listing's detail. */
  hideViewListing?: boolean;
  /** Called instead of onClose once a delete actually succeeds. myListingDetailsModal passes
   *  router.back() here — after a delete, the detail query this screen is showing gets removed
   *  from cache (see useDeleteListingMutation), which would otherwise leave the screen stuck
   *  re-fetching a listing that no longer exists and landing on its own "not found" state instead
   *  of just taking the seller back to their list. myListings.tsx doesn't need this: removing the
   *  card via cache invalidation is already the correct visual result on a list screen. */
  onDeleted?: () => void;
}

type SheetView = 'actions' | 'confirm-pause' | 'confirm-resume' | 'confirm-delete' | 'success-pause' | 'success-resume' | 'success-delete';

// Shared between myListings.tsx (tapping a card) and myListingDetailsModal.tsx (the floating
// header's ••• button). Which rows show depends entirely on listing.status:
// - View Listing: always, unless hideViewListing.
// - Edit/Delete Listing: only active or reported.
// - Pause Listing: only active. Resume Listing: only paused.
// - View Transaction / Contact Buyer: only pending_sale or sold.
// - Share Listing: only active.
// Only one sheet is ever mounted at a time — `view` swaps the options list out for a confirmation
// or success sheet instead of stacking one on top of the other. Pause/resume/delete all invalidate
// their own caches (see useListings.ts) — myListings' list and myListingDetailsModal's own detail
// query pick up the change on their own, no manual refetch callback needed here.
export function ListingActionsSheet({ listing, onClose, hideViewListing, onDeleted }: ListingActionsSheetProps) {
  const guard = useSingleTap();
  const [view, setView] = useState<SheetView>('actions');
  const pauseMutation = usePauseListingMutation();
  const resumeMutation = useResumeListingMutation();
  const deleteMutation = useDeleteListingMutation();

  const canPause = listing.status === 'active';
  const canResume = listing.status === 'paused';
  const canShare = listing.status === 'active';
  const canViewTransactionOrContact = listing.status === 'pending_sale' || listing.status === 'sold';
  const canEditOrDelete = listing.status === 'active' || listing.status === 'reported';

  function handleViewListing() {
    onClose();
    router.push({ pathname: '/(modals)/myListingDetailsModal', params: { id: listing._id } });
  }

  // TODO: no listing edit screen exists yet (addItemModal is create-only) — placeholder toast.
  function handleEdit() {
    showWarningToast('Not available yet', "Editing a listing isn't available yet.");
  }

  function confirmPause() {
    pauseMutation.mutate(listing._id, {
      onSuccess: () => setView('success-pause'),
      onError: (e) => {
        showErrorToast('Could not pause listing', extractErrorMessage(e));
        setView('actions');
      },
    });
  }

  function confirmResume() {
    resumeMutation.mutate(listing._id, {
      onSuccess: () => setView('success-resume'),
      onError: (e) => {
        showErrorToast('Could not resume listing', extractErrorMessage(e));
        setView('actions');
      },
    });
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

  function confirmDelete() {
    deleteMutation.mutate(listing._id, {
      onSuccess: () => setView('success-delete'),
      onError: (e) => {
        showErrorToast('Could not delete listing', extractErrorMessage(e));
        setView('actions');
      },
    });
  }

  function handleSuccessClose() {
    if (view === 'success-delete' && onDeleted) onDeleted();
    else onClose();
  }

  if (view === 'confirm-pause') {
    return (
      <ConfirmSheet
        iconName="pause"
        iconBg={colors.gray100}
        iconColor={colors.gray700}
        title="Pause this listing?"
        body="Buyers won't be able to find or purchase this listing while it's paused. You can resume it anytime."
        confirmLabel="Pause Listing"
        confirmBg={colors.primary}
        confirmColor={colors.white}
        loading={pauseMutation.isPending}
        onCancel={() => setView('actions')}
        onConfirm={confirmPause}
      />
    );
  }

  if (view === 'confirm-resume') {
    return (
      <ConfirmSheet
        iconName="refresh"
        iconBg={colors.primary25}
        iconColor={colors.primary}
        title="Resume this listing?"
        body="Your listing will be visible to buyers again and available for purchase."
        confirmLabel="Resume Listing"
        confirmBg={colors.primary}
        confirmColor={colors.white}
        loading={resumeMutation.isPending}
        onCancel={() => setView('actions')}
        onConfirm={confirmResume}
      />
    );
  }

  if (view === 'confirm-delete') {
    return (
      <ConfirmSheet
        iconName="trash"
        iconBg={colors.error50}
        iconColor={colors.danger}
        title="Delete this listing?"
        body="This can't be undone."
        confirmLabel="Delete Listing"
        confirmBg={colors.error50}
        confirmColor={colors.danger}
        loading={deleteMutation.isPending}
        onCancel={() => setView('actions')}
        onConfirm={confirmDelete}
      />
    );
  }

  if (view === 'success-pause') {
    return <DoneSheet title="Listing Paused" body="Buyers can no longer find this listing until you resume it." onClose={handleSuccessClose} />;
  }

  if (view === 'success-resume') {
    return <DoneSheet title="Listing Resumed" body="Your listing is active again and visible to buyers." onClose={handleSuccessClose} />;
  }

  if (view === 'success-delete') {
    return <DoneSheet title="Listing Deleted" body="This listing has been permanently removed." onClose={handleSuccessClose} />;
  }

  return (
    <BottomSheetCard onBackdropPress={guard(onClose)} sheetBackgroundColor={colors.white}>
      <View style={styles.actionsHeaderRow}>
        <Text style={styles.actionsTitle} numberOfLines={1}>
          {listing.title}
        </Text>
        <Pressable onPress={guard(onClose)} style={styles.actionsCloseButton} hitSlop={8}>
          <Icons.XIcon size={verticalScale(16)} color={colors.white} weight="bold" />
        </Pressable>
      </View>

      <View style={styles.actionsList}>
        {hideViewListing ? null : <ActionRow label="View Listing" onPress={guard(handleViewListing)} />}

        {canEditOrDelete ? <ActionRow label="Edit Listing" onPress={guard(handleEdit)} /> : null}

        {canPause ? (
          <ActionRow label="Pause Listing" onPress={guard(() => setView('confirm-pause'))} />
        ) : canResume ? (
          <ActionRow label="Resume Listing" onPress={guard(() => setView('confirm-resume'))} />
        ) : null}

        {canViewTransactionOrContact ? <ActionRow label="View Transaction" onPress={guard(handleViewTransaction)} /> : null}
        {canViewTransactionOrContact ? <ActionRow label="Contact Buyer" onPress={guard(handleContactBuyer)} /> : null}
        {canShare ? <ActionRow label="Share Listing" onPress={guard(handleShare)} /> : null}
        {canEditOrDelete ? <ActionRow label="Delete Listing" onPress={guard(() => setView('confirm-delete'))} danger /> : null}
      </View>
    </BottomSheetCard>
  );
}

interface ActionRowProps {
  label: string;
  onPress: () => void;
  danger?: boolean;
}

function ActionRow({ label, onPress, danger }: ActionRowProps) {
  return (
    <Pressable onPress={onPress} style={[styles.actionRow, danger && styles.actionRowDanger]}>
      <Text style={[styles.actionRowLabel, danger && styles.actionRowLabelDanger]}>{label}</Text>
    </Pressable>
  );
}

interface ConfirmSheetProps {
  iconName: string;
  iconBg: string;
  iconColor: string;
  title: string;
  body: string;
  confirmLabel: string;
  confirmBg: string;
  confirmColor: string;
  loading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

// Same yes/no bottom sheet shape used for pausing, resuming, and deleting — kept local to this
// file since it's only ever reached from the rows above, not reused anywhere else.
function ConfirmSheet({ iconName, iconBg, iconColor, title, body, confirmLabel, confirmBg, confirmColor, loading, onCancel, onConfirm }: ConfirmSheetProps) {
  const guard = useSingleTap();

  return (
    <BottomSheetCard onBackdropPress={loading ? undefined : guard(onCancel)} sheetBackgroundColor={colors.white}>
      <View style={[styles.confirmIconWrap, { backgroundColor: iconBg }]}>
        <Icon name={iconName} variant="bold" size={verticalScale(32)} color={iconColor} />
      </View>
      <Text style={styles.confirmTitle}>{title}</Text>
      <Text style={styles.confirmBody}>{body}</Text>
      <View style={styles.confirmButtonRow}>
        <Pressable onPress={loading ? undefined : guard(onCancel)} disabled={loading} style={styles.confirmCancelButton}>
          <Text style={styles.confirmCancelLabel}>Cancel</Text>
        </Pressable>
        <Pressable onPress={loading ? undefined : guard(onConfirm)} disabled={loading} style={[styles.confirmButton, { backgroundColor: confirmBg }]}>
          {loading ? <ActivityIndicator color={confirmColor} /> : <Text style={[styles.confirmLabel, { color: confirmColor }]}>{confirmLabel}</Text>}
        </Pressable>
      </View>
    </BottomSheetCard>
  );
}

interface DoneSheetProps {
  title: string;
  body: string;
  onClose: () => void;
}

// Success sheet shown after a pause/resume confirm completes — local to this file, same reasoning
// as ConfirmSheet above.
function DoneSheet({ title, body, onClose }: DoneSheetProps) {
  const guard = useSingleTap();

  return (
    <BottomSheetCard onBackdropPress={guard(onClose)} sheetBackgroundColor={colors.white}>
      <View style={styles.doneIconWrap}>
        <Icon name="tick-circle" variant="bold" size={verticalScale(40)} color={colors.success} />
      </View>
      <Text style={styles.confirmTitle}>{title}</Text>
      <Text style={styles.confirmBody}>{body}</Text>
      <Pressable onPress={guard(onClose)} style={styles.doneCloseButton}>
        <Text style={styles.doneCloseLabel}>Close</Text>
      </Pressable>
    </BottomSheetCard>
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
  confirmIconWrap: {
    alignSelf: 'center',
    width: verticalScale(72),
    height: verticalScale(72),
    borderRadius: radius.full,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacingY.lg,
  },
  confirmTitle: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xl,
    color: colors.ink,
    textAlign: 'center',
    marginBottom: spacingY.sm,
  },
  confirmBody: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    lineHeight: fontSize.md * 1.4,
    color: colors.gray500,
    textAlign: 'center',
    marginBottom: spacingY.xl,
  },
  confirmButtonRow: {
    flexDirection: 'row',
    gap: spacingX.md,
    paddingBottom: spacingY.md,
  },
  confirmCancelButton: {
    flex: 1,
    minHeight: verticalScale(56),
    borderRadius: radius.full,
    borderCurve: 'continuous',
    backgroundColor: colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmCancelLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.md,
    color: colors.gray700,
  },
  confirmButton: {
    flex: 1,
    minHeight: verticalScale(56),
    borderRadius: radius.full,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.md,
  },
  doneIconWrap: {
    alignSelf: 'center',
    width: verticalScale(80),
    height: verticalScale(80),
    borderRadius: radius.full,
    borderCurve: 'continuous',
    backgroundColor: colors.successLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacingY.lg,
  },
  doneCloseButton: {
    minHeight: verticalScale(56),
    borderRadius: radius.full,
    borderCurve: 'continuous',
    backgroundColor: colors.backgroundLight,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacingX.xl,
    marginBottom: spacingY.md,
  },
  doneCloseLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.md,
    color: colors.gray700,
  },
});
