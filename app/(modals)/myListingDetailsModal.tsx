import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  UIManager,
  useWindowDimensions,
  View,
  ViewStyle,
} from 'react-native';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useVideoPlayer, VideoView } from 'expo-video';
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { StatusBar } from 'expo-status-bar';
import dayjs from 'dayjs';
import { BottomSheetCard, EmptyState, ListingActionsSheet } from '@/components';
import Icon from '@/components/Icon';
import { colors, fontFamily, fontSize, radius, spacingX, spacingY } from '@/constants/theme';
import { verticalScale } from '@/utils/styling';
import { useSingleTap } from '@/hooks/useSingleTap';
import { useListingDetail, usePauseListingMutation, useResumeListingMutation } from '@/hooks/queries/useListings';
import { useMyTransactionForListing } from '@/hooks/queries/useTransactions';
import type { Listing, TransactionStatus } from '@/api/types';
import { extractErrorMessage } from '@/api/client';
import { formatCurrency, formatDate } from '@/utils/helpers';
import { CONDITION_OPTIONS } from '@/constants/formOptions';
import { showErrorToast, showWarningToast } from '@/lib/toast';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface MediaItem {
  uri: string;
  isVideo: boolean;
}

/** Adapts Icon's {name,variant,size,color} shape to EmptyState's Phosphor-shaped icon prop (size?: string | number). */
function DangerIcon({ size, color }: { size?: number | string; color?: string }) {
  return <Icon name="danger" variant="linear" size={typeof size === 'number' ? size : undefined} color={color} />;
}

type NoteTone = 'neutral' | 'info' | 'warning';

// Static copy per status, matching the Figma export verbatim.
const STATUS_NOTE: Record<Listing['status'], { title: string; body: string; tone: NoteTone }> = {
  active: { title: 'Your listing is live', body: 'Buyers can discover and purchase this item right now.', tone: 'info' },
  reported: {
    title: 'Action Required',
    body: "We've identified information in this report that needs your attention. Review the report for what to do next.",
    tone: 'warning',
  },
  pending_sale: {
    title: 'A buyer has secured this item',
    body: 'The listing is no longer available to other buyers while the transaction is being completed.',
    tone: 'warning',
  },
  sold: { title: 'Sold successfully', body: 'This item was successfully sold through Declut.', tone: 'info' },
  paused: { title: 'Listing Paused', body: 'This listing is currently hidden from buyers.', tone: 'neutral' },
  // Admin-only moderation status — distinct from a seller's own Pause. No seller-facing action
  // resumes it themselves (see the CreateListingPayload/Listing.status comment in api/types.ts).
  delisted: {
    title: 'Listing Delisted',
    body: 'This listing was removed by Declut and is no longer visible to buyers. Contact support if you believe this is a mistake.',
    tone: 'warning',
  },
};
// listing.status's exact enum isn't fully confirmed backend-side — fall back rather than crash
// on a status string these maps don't have an entry for yet.
const FALLBACK_STATUS_NOTE = STATUS_NOTE.active;

// transaction.inspectionStatus's shape isn't confirmed against a real response yet, so this
// derives the "Inspection" row from the well-documented transaction.status instead.
const INSPECTION_STATUS_LABEL: Partial<Record<TransactionStatus, string>> = {
  pending_payment: 'Awaiting Payment',
  escrow_active: 'Awaiting Inspection',
  awaiting_inspection: 'Awaiting Inspection',
  completed: 'Inspection Complete',
  disputed: 'Disputed',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
};

// Same status pill styling as myListings.tsx's card list, reused here for the badge row.
const STATUS_STYLES: Record<Listing['status'], { label: string; bg: string; text: string }> = {
  active: { label: 'Active', bg: colors.successLight, text: colors.success },
  pending_sale: { label: 'Sales Pending', bg: colors.warningLight, text: colors.warning700 },
  sold: { label: 'Sold', bg: colors.primaryLight, text: colors.primary },
  reported: { label: 'Reported', bg: colors.dangerLight, text: colors.danger },
  paused: { label: 'Paused', bg: colors.gray100, text: colors.gray500 },
  delisted: { label: 'Delisted', bg: colors.dangerLight, text: colors.danger },
};
const FALLBACK_STATUS_STYLE = STATUS_STYLES.active;

const NOTE_TONE_STYLES: Record<NoteTone, { bg: string; iconBg: string; text: string }> = {
  neutral: { bg: colors.backgroundLight, iconBg: colors.gray700, text: colors.gray700 },
  info: { bg: colors.primary25, iconBg: colors.primary, text: colors.primary },
  warning: { bg: colors.warning25, iconBg: colors.warning700, text: colors.warning700 },
};

function StatusNoteCard({ title, body, tone }: { title: string; body: string; tone: NoteTone }) {
  const toneStyle = NOTE_TONE_STYLES[tone];

  return (
    <View style={[styles.noteCard, { backgroundColor: toneStyle.bg }]}>
      <View style={[styles.noteIconWrap, { backgroundColor: toneStyle.iconBg }]}>
        <Text style={styles.noteIconText}>!</Text>
      </View>
      <View style={styles.noteTextColumn}>
        <Text style={[styles.noteTitle, { color: toneStyle.text }]}>{title}</Text>
        <Text style={[styles.noteBody, { color: toneStyle.text }]}>{body}</Text>
      </View>
    </View>
  );
}

interface DetailRow {
  label: string;
  value: string;
}

function DetailsCard({ rows }: { rows: DetailRow[] }) {
  return (
    <View style={styles.detailsCard}>
      {rows.map((row, index) => (
        <View key={row.label} style={[styles.detailsRow, index < rows.length - 1 && styles.detailsRowDivider]}>
          <Text style={styles.detailsRowLabel}>{row.label}</Text>
          <Text style={styles.detailsRowValue}>{row.value}</Text>
        </View>
      ))}
    </View>
  );
}

const PAUSE_RESUME_CONFIRM_COPY = {
  pause: {
    iconName: 'pause',
    iconBg: colors.gray100,
    iconColor: colors.gray700,
    title: 'Pause this listing?',
    body: "Buyers won't be able to find or purchase this listing while it's paused. You can resume it anytime.",
    confirmLabel: 'Pause Listing',
  },
  resume: {
    iconName: 'refresh',
    iconBg: colors.primary25,
    iconColor: colors.primary,
    title: 'Resume this listing?',
    body: 'Your listing will be visible to buyers again and available for purchase.',
    confirmLabel: 'Resume Listing',
  },
};

interface PauseResumeConfirmSheetProps {
  action: 'pause' | 'resume';
  loading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

// Confirm bottom sheet for the footer's Pause/Reactivate buttons — a separate, local copy of the
// same shape ListingActionsSheet.tsx uses for its own Pause/Resume rows, since that file's version
// is private to it and this screen's footer triggers pause/resume independently of that sheet.
function PauseResumeConfirmSheet({ action, loading, onCancel, onConfirm }: PauseResumeConfirmSheetProps) {
  const guard = useSingleTap();
  const copy = PAUSE_RESUME_CONFIRM_COPY[action];

  return (
    <BottomSheetCard onBackdropPress={loading ? undefined : guard(onCancel)} sheetBackgroundColor={colors.white}>
      <View style={[styles.confirmIconWrap, { backgroundColor: copy.iconBg }]}>
        <Icon name={copy.iconName} variant="bold" size={verticalScale(32)} color={copy.iconColor} />
      </View>
      <Text style={styles.confirmTitle}>{copy.title}</Text>
      <Text style={styles.confirmBody}>{copy.body}</Text>
      <View style={styles.confirmButtonRow}>
        <Pressable onPress={loading ? undefined : guard(onCancel)} disabled={loading} style={styles.confirmCancelButton}>
          <Text style={styles.confirmCancelLabel}>Cancel</Text>
        </Pressable>
        <Pressable onPress={loading ? undefined : guard(onConfirm)} disabled={loading} style={styles.confirmButton}>
          {loading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.confirmButtonLabel}>{copy.confirmLabel}</Text>}
        </Pressable>
      </View>
    </BottomSheetCard>
  );
}

const PAUSE_RESUME_SUCCESS_COPY = {
  pause: { title: 'Listing Paused', body: 'Buyers can no longer find this listing until you resume it.' },
  resume: { title: 'Listing Resumed', body: 'Your listing is active again and visible to buyers.' },
};

function PauseResumeSuccessSheet({ action, onClose }: { action: 'pause' | 'resume'; onClose: () => void }) {
  const guard = useSingleTap();
  const copy = PAUSE_RESUME_SUCCESS_COPY[action];

  return (
    <BottomSheetCard onBackdropPress={guard(onClose)} sheetBackgroundColor={colors.white}>
      <View style={styles.doneIconWrap}>
        <Icon name="tick-circle" variant="bold" size={verticalScale(40)} color={colors.success} />
      </View>
      <Text style={styles.confirmTitle}>{copy.title}</Text>
      <Text style={styles.confirmBody}>{copy.body}</Text>
      <Pressable onPress={guard(onClose)} style={styles.doneCloseButton}>
        <Text style={styles.doneCloseLabel}>Close</Text>
      </Pressable>
    </BottomSheetCard>
  );
}

// Seller's own view of a listing — the basics only (hero, title, meta, description, brand,
// condition, defects). No buyer-transaction conditionals (escrow note, seller contact card,
// purchase-complete/review sections) and no footer actions — those live on listingDetailsModal,
// which this deliberately doesn't inherit. Reached from My Listings' action sheet ("View Listing").
export default function MyListingDetailsModal() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const guard = useSingleTap();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const heroScrollRef = useRef<ScrollView>(null);

  // Same scroll-driven floating header fade-in + status bar light/dark flip as listingDetailsModal.
  const scrollY = useSharedValue(0);
  const [statusBarStyle, setStatusBarStyle] = useState<'light' | 'dark'>('light');
  const isStatusBarDark = useSharedValue(false);
  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
    const shouldBeDark = event.contentOffset.y > FLOATING_HEADER_FADE_END;
    if (shouldBeDark !== isStatusBarDark.value) {
      isStatusBarDark.value = shouldBeDark;
      runOnJS(setStatusBarStyle)(shouldBeDark ? 'dark' : 'light');
    }
  });
  const floatingHeaderStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [FLOATING_HEADER_FADE_START, FLOATING_HEADER_FADE_END], [0, 1], 'clamp'),
  }));

  const [activeIndex, setActiveIndex] = useState(0);
  const [actionSheetOpen, setActionSheetOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'pause' | 'resume' | null>(null);
  const [successAction, setSuccessAction] = useState<'pause' | 'resume' | null>(null);

  const {
    data: listing,
    isLoading: isInitialLoading,
    isFetching,
    error: listingQueryError,
    refetch: refetchQuery,
  } = useListingDetail(id);
  // Pull-to-refresh intentionally shows the same full-page skeleton as the initial fetch (see
  // handleRefresh below), not a lightweight native spinner over stale content.
  const loading = isInitialLoading || isFetching;
  const error = listingQueryError ? extractErrorMessage(listingQueryError, 'Could not load this listing.') : null;

  // Unlike listingDetailsModal, this screen used to lean on useListingDetail's own refetchInterval
  // to pick up a buyer's action (confirm/cancel) without the seller having to pull-to-refresh — now
  // that polling's gone (see useListings.ts), refetch on every focus instead, matching the buyer
  // screen's own pattern, so returning to this screen is what catches the seller up.
  useFocusEffect(
    useCallback(() => {
      refetchQuery();
    }, [refetchQuery])
  );

  const pauseMutation = usePauseListingMutation();
  const resumeMutation = useResumeListingMutation();
  const pauseResumeLoading = confirmAction === 'pause' ? pauseMutation.isPending : resumeMutation.isPending;

  // The seller's own transaction for this listing, once a buyer has paid — no GET
  // /transactions/by-listing endpoint, so this pulls the seller's own transactions (the general
  // /transactions endpoint, not the buyer-only /transactions/purchases) and matches by listing id.
  const { data: transaction = null } = useMyTransactionForListing(
    listing?._id,
    !!listing && (listing.status === 'pending_sale' || listing.status === 'sold')
  );

  // Thumbnail taps drive the carousel programmatically; swiping drives activeIndex the other way
  // via the ScrollView's onMomentumScrollEnd below — both paths stay in sync either way.
  function goToMediaIndex(index: number) {
    setActiveIndex(index);
    heroScrollRef.current?.scrollTo({ x: index * screenWidth, animated: true });
  }

  // Pulling to refresh (the RefreshControl on the scroll view below) reuses the query's own
  // refetch — `loading` only reflects the very first fetch, so this doesn't flash the full skeleton.
  function handleRefresh() {
    refetchQuery();
  }

  // PATCH /listings/:id only accepts the request while the listing is active (400 otherwise — see
  // the Postman collection), but this button also shows on the paused footer as a secondary
  // action — resuming first is what actually makes editing possible there.
  function handleEdit() {
    if (listing?.status !== 'active') {
      showWarningToast('Resume first', 'Resume this listing before making changes to it.');
      return;
    }
    router.push({ pathname: '/(modals)/addItemModal', params: { listingId: listing._id } });
  }

  function confirmPause() {
    if (!listing) return;
    pauseMutation.mutate(listing._id, {
      onSuccess: () => {
        setConfirmAction(null);
        setSuccessAction('pause');
      },
      onError: (e) => {
        showErrorToast('Could not pause listing', extractErrorMessage(e));
        setConfirmAction(null);
      },
    });
  }

  function confirmResume() {
    if (!listing) return;
    resumeMutation.mutate(listing._id, {
      onSuccess: () => {
        setConfirmAction(null);
        setSuccessAction('resume');
      },
      onError: (e) => {
        showErrorToast('Could not resume listing', extractErrorMessage(e));
        setConfirmAction(null);
      },
    });
  }

  // TODO: no support-contact flow exists yet — placeholder toast.
  function handleContactSupport() {
    showWarningToast('Not available yet', "Contacting support isn't available yet.");
  }

  // TODO: no report-detail screen exists yet — placeholder toast.
  function handleViewReport() {
    showWarningToast('Not available yet', "Viewing the report isn't available yet.");
  }

  // TODO: no messaging/contact feature exists yet — placeholder toast.
  function handleContactBuyer() {
    showWarningToast('Not available yet', "Contacting the buyer isn't available yet.");
  }

  function handleViewTransaction() {
    if (!transaction) {
      showErrorToast('Could not open transaction', 'Please close this and try again in a moment.');
      return;
    }
    router.push({ pathname: '/(modals)/transactionDetailsModal', params: { transactionId: transaction._id } });
  }

  // TODO: no prefill-from-existing-listing flow exists yet — placeholder toast.
  function handleRelistSimilar() {
    showWarningToast('Not available yet', "Relisting a similar item isn't available yet.");
  }

  if (loading) {
    return (
      <View style={styles.root}>
        <ListingDetailsSkeleton />
        <Pressable
          onPress={guard(() => router.back())}
          style={[styles.overlayButton, { top: insets.top + spacingY.sm }]}
          hitSlop={8}
        >
          <Icon name="arrow-left" variant="linear" size={verticalScale(20)} color={colors.gray900} />
        </Pressable>
      </View>
    );
  }

  if (error || !listing) {
    return (
      <SafeAreaView style={styles.centerFlex} edges={['top', 'bottom']}>
        <Pressable onPress={guard(() => router.back())} style={[styles.overlayButton, styles.plainBackButton]} hitSlop={8}>
          <Icon name="arrow-left" variant="linear" size={verticalScale(20)} color={colors.gray900} />
        </Pressable>
        <EmptyState icon={DangerIcon} message={error ?? 'Listing not found.'} />
      </SafeAreaView>
    );
  }

  const mediaItems: MediaItem[] = [
    ...listing.images.map((img) => ({ uri: img.secureUrl, isVideo: false })),
    ...(listing.video ? [{ uri: listing.video.secureUrl, isVideo: true }] : []),
  ];
  const conditionLabel = CONDITION_OPTIONS.find((option) => option.value === listing.condition)?.label ?? listing.condition;
  const statusStyle = STATUS_STYLES[listing.status] ?? FALLBACK_STATUS_STYLE;
  const statusNote = STATUS_NOTE[listing.status] ?? FALLBACK_STATUS_NOTE;

  return (
    <View style={styles.root}>
      <StatusBar style={statusBarStyle} animated />
      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={handleRefresh} tintColor={colors.primary} colors={[colors.primary]} progressBackgroundColor={colors.white} />
        }
      >
        <View style={styles.hero}>
          {mediaItems.length > 0 ? (
            <ScrollView
              ref={heroScrollRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) => {
                setActiveIndex(Math.round(e.nativeEvent.contentOffset.x / screenWidth));
              }}
            >
              {mediaItems.map((item, index) =>
                item.isVideo ? (
                  <View key={index} style={{ width: screenWidth }}>
                    <PlayableHeroVideo uri={item.uri} />
                  </View>
                ) : (
                  <Image
                    key={index}
                    source={{ uri: item.uri }}
                    style={[styles.heroImage, { width: screenWidth }]}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                  />
                )
              )}
            </ScrollView>
          ) : (
            <View style={[styles.heroImage, styles.heroEmpty]} />
          )}

          {mediaItems.length > 1 ? (
            <View style={styles.thumbnailRow}>
              {mediaItems.map((item, index) => (
                <Pressable
                  key={index}
                  onPress={guard(() => goToMediaIndex(index))}
                  style={[styles.thumbnail, index === activeIndex && styles.thumbnailActive]}
                >
                  <Image source={{ uri: item.uri }} style={styles.thumbnailImage} contentFit="cover" cachePolicy="memory-disk" />
                  {item.isVideo ? (
                    <View style={styles.thumbnailPlayOverlay}>
                      <Icon name="play-circle" variant="bold" size={verticalScale(20)} color={colors.white} />
                    </View>
                  ) : null}
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>

        <View style={styles.body}>
          <View style={styles.badgeRow}>
            <View style={[styles.statusPill, { backgroundColor: statusStyle.bg }]}>
              <Text style={[styles.statusPillText, { color: statusStyle.text }]}>{statusStyle.label}</Text>
            </View>
            <Text style={styles.postedText}>Posted {formatDate(listing.createdAt)}</Text>
          </View>

          <Text style={styles.title}>{listing.title}</Text>

          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Icon name="location" variant="bold" size={verticalScale(18)} color={colors.danger} />
              <Text style={styles.metaText} numberOfLines={1}>
                {listing.locationLabel}
              </Text>
            </View>
            <View style={styles.metaItem}>
              <Icon name="eye" variant="bold" size={verticalScale(18)} color={colors.gray400} />
              <Text style={styles.metaText}>{listing.views ?? 0} views</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <StatusNoteCard {...statusNote} />

          {listing.status === 'pending_sale' && transaction ? (
            <>
              <Text style={styles.detailsSectionLabel}>DETAILS</Text>
              <DetailsCard
                rows={[
                  { label: 'Buyer', value: transaction.buyer?.name ?? '—' },
                  { label: 'Transaction ID', value: transaction.reference ?? transaction._id },
                  { label: 'Payment', value: 'Secured in Escrow' },
                  { label: 'Inspection', value: INSPECTION_STATUS_LABEL[transaction.status] ?? '—' },
                  {
                    label: 'Inspection Deadline',
                    value: transaction.inspectionDeadlineAt ? dayjs(transaction.inspectionDeadlineAt).format('D MMM, YYYY; h:mm A') : '—',
                  },
                ]}
              />
            </>
          ) : null}

          {listing.status === 'sold' && transaction ? (
            <DetailsCard
              rows={[
                { label: 'Sale Price', value: formatCurrency(transaction.amount) },
                { label: 'Sold On', value: transaction.updatedAt ? dayjs(transaction.updatedAt).format('D MMM, YYYY; h:mm A') : '—' },
                { label: 'Buyer', value: transaction.buyer?.name ?? '—' },
                { label: 'Transaction ID', value: transaction.reference ?? transaction._id },
              ]}
            />
          ) : null}

          <Text style={styles.sectionTitle}>Description</Text>
          <Text style={styles.sectionBody}>{listing.description}</Text>

          {listing?.specs?.brand ? (
            <Text style={styles.labeledRow}>
              <Text style={styles.labeledRowLabel}>Brand: </Text>
              <Text style={styles.labeledRowValue}>{listing.specs.brand}</Text>
            </Text>
          ) : null}

          <Text style={styles.labeledRow}>
            <Text style={styles.labeledRowLabel}>Item Condition: </Text>
            <Text style={styles.labeledRowValue}>{conditionLabel}</Text>
          </Text>

          {listing.hasDefect && listing.defectDescription ? (
            <>
              <Text style={[styles.sectionTitle, styles.defectsTitle]}>Defects</Text>
              <Text style={styles.sectionBody}>{listing.defectDescription}</Text>
            </>
          ) : null}
        </View>
      </Animated.ScrollView>

      <View style={styles.floatingHeaderWrap}>
        <Animated.View style={[styles.floatingHeaderBackground, floatingHeaderStyle]} />
        <View style={[styles.floatingHeaderRow, { paddingTop: insets.top + spacingY.sm }]}>
          <Pressable onPress={guard(() => router.back())} style={styles.floatingHeaderButton} hitSlop={8}>
            <Icon name="arrow-left" variant="linear" size={verticalScale(22)} color={colors.gray900} />
          </Pressable>
          <Pressable
            onPress={guard(() => setActionSheetOpen(true))}
            style={[styles.floatingHeaderButton, { backgroundColor: colors.primary25 }]}
            hitSlop={8}
          >
            <Icon name="more" variant="linear" size={verticalScale(22)} color={colors.primary} />
          </Pressable>
        </View>
      </View>

      <SafeAreaView edges={['bottom']} style={styles.footerSafeArea}>
        <View style={styles.footerRow}>
          {listing.status === 'paused' ? (
            <>
              <Pressable onPress={guard(handleEdit)} style={styles.footerSecondaryButton}>
                <Text style={styles.footerSecondaryLabel}>Edit Listing</Text>
              </Pressable>
              <Pressable onPress={guard(() => setConfirmAction('resume'))} style={styles.footerPrimaryButton}>
                <Text style={styles.footerPrimaryLabel}>Reactivate Listing</Text>
              </Pressable>
            </>
          ) : listing.status === 'active' ? (
            <>
              <Pressable onPress={guard(() => setConfirmAction('pause'))} style={styles.footerSecondaryButton}>
                <Text style={styles.footerSecondaryLabel}>Pause Listing</Text>
              </Pressable>
              <Pressable onPress={guard(handleEdit)} style={styles.footerPrimaryButton}>
                <Text style={styles.footerPrimaryLabel}>Edit Listing</Text>
              </Pressable>
            </>
          ) : listing.status === 'reported' ? (
            <>
              <Pressable onPress={guard(handleContactSupport)} style={styles.footerSecondaryButton}>
                <Text style={styles.footerSecondaryLabel}>Contact Support</Text>
              </Pressable>
              <Pressable onPress={guard(handleViewReport)} style={styles.footerPrimaryButton}>
                <Text style={styles.footerPrimaryLabel}>View Report</Text>
              </Pressable>
            </>
          ) : listing.status === 'pending_sale' ? (
            <>
              <Pressable onPress={guard(handleContactBuyer)} style={styles.footerSecondaryButton}>
                <Text style={styles.footerSecondaryLabel}>Contact Buyer</Text>
              </Pressable>
              <Pressable onPress={guard(handleViewTransaction)} style={styles.footerPrimaryButton}>
                <Text style={styles.footerPrimaryLabel}>View Transaction</Text>
              </Pressable>
            </>
          ) : listing.status === 'delisted' ? (
            // Admin-only moderation status — no seller-facing resume action, unlike Pause. Same
            // "Contact Support" pattern as 'reported' below, since that's the only real next step.
            <Pressable onPress={guard(handleContactSupport)} style={styles.footerPrimaryButton}>
              <Text style={styles.footerPrimaryLabel}>Contact Support</Text>
            </Pressable>
          ) : (
            <>
              <Pressable onPress={guard(handleRelistSimilar)} style={styles.footerSecondaryButton}>
                <Text style={styles.footerSecondaryLabel}>Relist Similar Item</Text>
              </Pressable>
              <Pressable onPress={guard(handleViewTransaction)} style={styles.footerPrimaryButton}>
                <Text style={styles.footerPrimaryLabel}>View Transaction</Text>
              </Pressable>
            </>
          )}
        </View>
      </SafeAreaView>

      {actionSheetOpen ? (
        <View style={StyleSheet.absoluteFill}>
          <ListingActionsSheet
            listing={listing}
            onClose={() => setActionSheetOpen(false)}
            onDeleted={() => router.back()}
            hideViewListing
          />
        </View>
      ) : confirmAction === 'pause' ? (
        <PauseResumeConfirmSheet
          action="pause"
          loading={pauseResumeLoading}
          onCancel={() => setConfirmAction(null)}
          onConfirm={confirmPause}
        />
      ) : confirmAction === 'resume' ? (
        <PauseResumeConfirmSheet
          action="resume"
          loading={pauseResumeLoading}
          onCancel={() => setConfirmAction(null)}
          onConfirm={confirmResume}
        />
      ) : successAction === 'pause' ? (
        <PauseResumeSuccessSheet action="pause" onClose={() => setSuccessAction(null)} />
      ) : successAction === 'resume' ? (
        <PauseResumeSuccessSheet action="resume" onClose={() => setSuccessAction(null)} />
      ) : null}
    </View>
  );
}

/** Its own component so useVideoPlayer only mounts/tears down when the video is actually the active hero. */
function PlayableHeroVideo({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
  });

  return <VideoView player={player} style={styles.heroImage} contentFit="cover" nativeControls />;
}

function Bone({
  width,
  height,
  radius: cornerRadius = 4,
  style,
}: {
  width: number | `${number}%`;
  height: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[{ width, height, borderRadius: cornerRadius, borderCurve: 'continuous', backgroundColor: colors.gray100 }, style]} />;
}

/** Mirrors the loaded layout's shape so nothing jumps once the fetch resolves — same pulse technique as ListingCardSkeleton. */
function ListingDetailsSkeleton() {
  const opacity = useSharedValue(0.5);

  useEffect(() => {
    opacity.value = withRepeat(withTiming(1, { duration: 700, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [opacity]);

  const pulseStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View style={[styles.root, pulseStyle]}>
      <View style={[styles.hero, styles.heroEmpty]} />
      <View style={styles.body}>
        <View style={styles.badgeRow}>
          <Bone width={verticalScale(80)} height={verticalScale(24)} radius={radius.full} />
          <Bone width={verticalScale(100)} height={verticalScale(16)} />
        </View>
        <Bone width="80%" height={verticalScale(28)} style={styles.skeletonTitle} />
        <View style={styles.metaRow}>
          <Bone width={verticalScale(100)} height={verticalScale(16)} />
          <Bone width={verticalScale(48)} height={verticalScale(16)} />
        </View>
        <View style={styles.divider} />
        <Bone width={verticalScale(110)} height={verticalScale(20)} style={styles.skeletonBlockGap} />
        <Bone width="100%" height={verticalScale(14)} style={styles.skeletonLineGap} />
        <Bone width="100%" height={verticalScale(14)} style={styles.skeletonLineGap} />
        <Bone width="60%" height={verticalScale(14)} style={styles.skeletonBlockGap} />
        <Bone width="50%" height={verticalScale(16)} style={styles.skeletonLineGap} />
        <Bone width="60%" height={verticalScale(16)} />
      </View>
    </Animated.View>
  );
}

const HERO_HEIGHT = verticalScale(340);
const FLOATING_HEADER_FADE_START = HERO_HEIGHT * 0.15;
const FLOATING_HEADER_FADE_END = HERO_HEIGHT * 0.5;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.white,
  },
  centerFlex: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
  scrollContent: {
    paddingBottom: spacingY['3xl'],
  },
  hero: {
    height: HERO_HEIGHT,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroEmpty: {
    backgroundColor: colors.gray100,
  },
  overlayButton: {
    position: 'absolute',
    left: spacingX.xl,
    width: verticalScale(40),
    height: verticalScale(40),
    borderRadius: radius.full,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  plainBackButton: {
    position: 'relative',
    top: spacingY.md,
    marginLeft: spacingX.xl,
  },
  floatingHeaderWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  floatingHeaderBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.white,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  floatingHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacingX.xl,
    paddingBottom: spacingY.sm,
  },
  floatingHeaderButton: {
    width: verticalScale(40),
    height: verticalScale(40),
    borderRadius: radius.full,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbnailRow: {
    position: 'absolute',
    bottom: spacingY.lg,
    left: spacingX.xl,
    flexDirection: 'row',
    gap: spacingX.sm,
  },
  thumbnail: {
    width: verticalScale(56),
    height: verticalScale(56),
    borderRadius: radius.full,
    borderCurve: 'continuous',
    borderWidth: 2,
    borderColor: colors.white,
    overflow: 'hidden',
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  thumbnailActive: {
    borderColor: colors.primary,
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  thumbnailPlayOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(17, 24, 39, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    paddingHorizontal: spacingX.lg,
    paddingTop: spacingY.xl,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  postedText: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.sm,
    color: colors.goldClick,
  },
  title: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xl,
    color: colors.ink,
    marginBottom: spacingY.sm,
  },
  skeletonTitle: {
    marginBottom: spacingY.sm,
  },
  skeletonLineGap: {
    marginBottom: spacingY.xs,
  },
  skeletonBlockGap: {
    marginBottom: spacingY.lg,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingX.lg,
    marginBottom: spacingY.lg,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingX.xs,
    flexShrink: 1,
  },
  metaText: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.md,
    color: colors.gray500,
  },
  divider: {
    height: 1,
    backgroundColor: colors.gray100,
    marginBottom: spacingY.xl,
  },
  sectionTitle: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.lg,
    color: colors.ink,
    marginBottom: spacingY.md,
  },
  defectsTitle: {
    marginTop: spacingY.lg,
  },
  sectionBody: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    lineHeight: fontSize.md * 1.5,
    color: colors.gray500,
    marginBottom: spacingY.lg,
  },
  labeledRow: {
    marginBottom: spacingY.md,
  },
  labeledRowLabel: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.md,
    color: colors.ink,
  },
  labeledRowValue: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    color: colors.gray500,
  },
  noteCard: {
    flexDirection: 'row',
    gap: spacingX.md,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    padding: spacingX.lg,
    marginBottom: spacingY.xl,
  },
  noteIconWrap: {
    width: verticalScale(24),
    height: verticalScale(24),
    borderRadius: radius.full,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteIconText: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.sm,
    color: colors.white,
  },
  noteTextColumn: {
    flex: 1,
    gap: verticalScale(4),
  },
  noteTitle: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.md,
  },
  noteBody: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm * 1.4,
  },
  detailsSectionLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.xs,
    color: colors.gray400,
    letterSpacing: 0.5,
    marginBottom: spacingY.sm,
  },
  detailsCard: {
    backgroundColor: colors.cardBackground,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    paddingHorizontal: spacingX.lg,
    marginBottom: spacingY.xl,
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
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.md,
    color: colors.ink,
    textAlign: 'right',
  },
  footerSafeArea: {
    paddingHorizontal: spacingX.lg,
    paddingTop: spacingY.md,
    paddingBottom: spacingY.md,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.gray100,
  },
  footerRow: {
    flexDirection: 'row',
    gap: spacingX.md,
  },
  footerSecondaryButton: {
    flex: 1,
    minHeight: verticalScale(56),
    borderRadius: radius.full,
    borderCurve: 'continuous',
    backgroundColor: colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacingX.md,
  },
  footerSecondaryLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.md,
    color: colors.gray700,
  },
  footerPrimaryButton: {
    flex: 1,
    minHeight: verticalScale(56),
    borderRadius: radius.full,
    borderCurve: 'continuous',
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacingX.md,
  },
  footerPrimaryLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.md,
    color: colors.white,
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
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButtonLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.md,
    color: colors.white,
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
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacingX.xl,
    marginBottom: spacingY.md,
  },
  doneCloseLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.md,
    color: colors.white,
  },
});
