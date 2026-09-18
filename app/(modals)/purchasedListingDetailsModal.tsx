import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  ViewStyle,
} from 'react-native';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useVideoPlayer, VideoView } from 'expo-video';
import axios from 'axios';
import dayjs from 'dayjs';
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
import { BottomSheetCard, EmptyState } from '@/components';
import Icon from '@/components/Icon';
import * as Icons from 'phosphor-react-native';
import { colors, fontFamily, fontSize, radius, spacingX, spacingY } from '@/constants/theme';
import { verticalScale } from '@/utils/styling';
import { useSingleTap } from '@/hooks/useSingleTap';
import { useAuth } from '@/contexts/AuthContext';
import { useListingDetail } from '@/hooks/queries/useListings';
import {
  useConfirmTransactionMutation,
  useMyPurchaseForListing,
  useRequestInspectionExtensionMutation,
  useTransactionDetail,
} from '@/hooks/queries/useTransactions';
import { useLeaveReviewMutation, useReviewForListing } from '@/hooks/queries/useReviews';
import { useListingSubscription } from '@/hooks/realtime/useListingSubscription';
import { useSystemSettings } from '@/hooks/queries/useSystemSettings';
import type { Listing, PurchaseStatusFilter, Review, SystemSettingsInspectionWindow, Transaction, TransactionStatus } from '@/api/types';
import { extractErrorMessage } from '@/api/client';
import { formatCurrency, formatDate, getListingShareMessage, getProfileImage } from '@/utils/helpers';
import { CONDITION_OPTIONS } from '@/constants/formOptions';
import { showErrorToast, showSuccessToast, showWarningToast } from '@/lib/toast';

// Fallback only, used the one frame before GET /settings resolves — the real figure is
// settings.inspectionWindow.inspectionPeriod (days) once useSystemSettings loads.
const INSPECTION_WINDOW_HOURS_FALLBACK = 48;

// Reuses the Places API key — same Google Cloud project. If the static map comes back blank/403,
// "Maps Static API" needs enabling for this key in Google Cloud Console.
const GOOGLE_STATIC_MAPS_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY ?? '';

interface MediaItem {
  uri: string;
  isVideo: boolean;
}

/** Adapts Icon's {name,variant,size,color} shape to EmptyState's Phosphor-shaped icon prop (size?: string | number). */
function DangerIcon({ size, color }: { size?: number | string; color?: string }) {
  return <Icon name="danger" variant="linear" size={typeof size === 'number' ? size : undefined} color={color} />;
}

interface ListingNotFoundStateProps {
  message: string;
  onGoBack: () => void;
  onBrowseListings: () => void;
}

// Same dedicated 404 state as listingDetailsModal's own copy — see that file's comment.
function ListingNotFoundState({ message, onGoBack, onBrowseListings }: ListingNotFoundStateProps) {
  const guard = useSingleTap();

  return (
    <SafeAreaView style={styles.notFoundRoot} edges={['top', 'bottom']}>
      <View style={styles.notFoundContent}>
        <View style={styles.notFoundIconWrap}>
          <Icons.SmileyXEyesIcon size={verticalScale(60)} color={colors.gray400} />
        </View>
        <Text style={styles.notFoundTitle}>Listing Not Found</Text>
        <Text style={styles.notFoundBody}>{message}</Text>

        <Pressable onPress={guard(onBrowseListings)} style={styles.notFoundPrimaryButton}>
          <Text style={styles.notFoundPrimaryLabel}>Browse Other Listings</Text>
        </Pressable>
        <Pressable onPress={guard(onGoBack)} hitSlop={8} style={styles.notFoundSecondaryButton}>
          <Text style={styles.notFoundSecondaryLabel}>Go Back</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

// Maps a transaction's real status onto History's own filter pills, so the back button below can return there on the tab that actually matches what was just viewed instead of always "Active" (History resets to Active on blur — see history.tsx). 'refunded' covers both cancelled and refunded transactions, matching History's own "Cancelled" pill (its `value` is 'refunded').
function toHistoryFilter(status: TransactionStatus | undefined): PurchaseStatusFilter {
  switch (status) {
    case 'completed':
      return 'completed';
    case 'cancelled':
    case 'refunded':
      return 'refunded';
    case 'disputed':
      return 'disputed';
    default:
      return 'active';
  }
}

// Buyer's own view of a purchase — everything listingDetailsModal used to own once a transaction existed on a listing (escrow hold, confirm/report, seller contact, review), now split out so that screen can stay a plain browsing view. Reached from History (tapping a purchase) or, once a checkout completes, replacing listingDetailsModal in the stack — so back from here always returns to History, never to a "Buy Now" page for an item already bought.
export default function PurchasedListingDetailsModal() {
  const { id, transactionId } = useLocalSearchParams<{ id: string; transactionId?: string }>();
  const { user, refreshUser } = useAuth();
  const guard = useSingleTap();
  useListingSubscription(id, true);
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
  const [confirmSheetOpen, setConfirmSheetOpen] = useState(false);
  const [confirmingTransaction, setConfirmingTransaction] = useState(false);
  const [reviewSheetOpen, setReviewSheetOpen] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');

  const {
    data: listing,
    isLoading: isInitialLoading,
    error: listingQueryError,
    refetch: reloadListing,
  } = useListingDetail(id);
  const error = listingQueryError ? extractErrorMessage(listingQueryError, 'Could not load this listing.') : null;
  const isNotFound = axios.isAxiosError(listingQueryError) && listingQueryError.response?.status === 404;

  const [manualRefreshing, setManualRefreshing] = useState(false);
  const loading = isInitialLoading || manualRefreshing;

  const reloadListingWithSkeleton = useCallback(async () => {
    setManualRefreshing(true);
    try {
      await reloadListing();
    } finally {
      setManualRefreshing(false);
    }
  }, [reloadListing]);

  useFocusEffect(
    useCallback(() => {
      reloadListingWithSkeleton();
    }, [reloadListingWithSkeleton])
  );

  // Prefers a direct single-transaction fetch when History (or the post-checkout handoff) already
  // knows the exact transactionId — falls back to the best-effort "first page of my purchases"
  // lookup listingDetailsModal used to do, for the rare case this screen is reached without one.
  const { data: transactionDirect = null } = useTransactionDetail(transactionId);
  const needsFallbackLookup = !transactionId && !!listing && (listing.status === 'pending_sale' || listing.status === 'sold');
  const { data: myTransactionFallback = null } = useMyPurchaseForListing(
    listing?._id,
    listing?.status === 'sold' ? 'completed' : 'active',
    needsFallbackLookup
  );
  const myTransaction = transactionDirect ?? myTransactionFallback;

  // The buyer's own review for this listing, once sold — drives whether Buyer Feedback shows the
  // review or a "rate this seller" prompt.
  const { data: myReview = null } = useReviewForListing(listing?._id, listing?.status === 'sold');

  const confirmTransactionMutation = useConfirmTransactionMutation();
  const leaveReviewMutation = useLeaveReviewMutation();

  // Inspection-deadline extension — settings/mutation live here (not inside EscrowHoldNote) since the confirm sheet is rendered at this component's top level, same as every other sheet below.
  const { data: settings } = useSystemSettings();
  const requestExtensionMutation = useRequestInspectionExtensionMutation();
  const [extendSheetOpen, setExtendSheetOpen] = useState(false);
  const [extendSuccessDeadline, setExtendSuccessDeadline] = useState<string | null>(null);

  // Always returns to History (never a plain router.back()) — this screen can be reached via a router.replace from after checkout, which means History may not even be the previous screen on the stack. ?status= tells History which filter pill to land on, since it otherwise always resets to Active on blur (see history.tsx).
  function handleBack() {
    router.replace({ pathname: '/(tabs)/history', params: { status: toHistoryFilter(myTransaction?.status) } });
  }

  function handleRequestExtension() {
    if (!myTransaction) return;
    requestExtensionMutation.mutate(myTransaction._id, {
      onSuccess: (result) => {
        setExtendSheetOpen(false);
        setExtendSuccessDeadline(result.inspectionExtensionEndDate ?? null);
      },
      onError: (e) => showErrorToast('Could not extend deadline', extractErrorMessage(e)),
    });
  }

  // Thumbnail taps drive the carousel programmatically; swiping drives activeIndex the other way via the ScrollView's onMomentumScrollEnd below — both paths stay in sync either way.
  function goToMediaIndex(index: number) {
    setActiveIndex(index);
    heroScrollRef.current?.scrollTo({ x: index * screenWidth, animated: true });
  }

  async function handleShare() {
    if (!listing) return;
    try {
      await Share.share({ message: getListingShareMessage(listing) });
    } catch {
      // User cancelled or the native share sheet failed — nothing actionable to surface.
    }
  }

  function handleConfirmItemFine() {
    setConfirmSheetOpen(true);
  }

  // Buyer's own "item is fine, release my money" action — distinct from confirmCode (that's the seller entering a code the buyer read out to them in person). On success: the review prompt opens right away while the listing (now 'sold') refetches in the background, so the page is already showing the post-sale content by the time the review sheet is dismissed.
  function handleConfirmPayment() {
    if (!listing || !myTransaction) {
      showErrorToast('Could not confirm', 'Please close this and try again in a moment.');
      return;
    }
    setConfirmSheetOpen(false);
    setConfirmingTransaction(true);
    confirmTransactionMutation.mutate(myTransaction._id, {
      onSuccess: () => {
        showSuccessToast('Item confirmed', 'Funds have been released to the seller.');
        setConfirmingTransaction(false);
        setReviewRating(0);
        setReviewComment('');
        setReviewSheetOpen(true);
        // totalAmountInEscrow just went down — refresh AuthContext's user to match.
        refreshUser().catch(() => {});
      },
      onError: (e) => {
        showErrorToast('Could not confirm', extractErrorMessage(e));
        setConfirmingTransaction(false);
      },
    });
  }

  function handleOpenReviewSheet() {
    setReviewRating(0);
    setReviewComment('');
    setReviewSheetOpen(true);
  }

  function handleSubmitReview() {
    if (!listing) return;
    if (reviewRating < 1) {
      showErrorToast('Please select a rating', 'Tap a star to rate the seller.');
      return;
    }
    leaveReviewMutation.mutate(
      { listingId: listing._id, rating: reviewRating, comment: reviewComment.trim() || undefined },
      {
        onSuccess: () => {
          setReviewSheetOpen(false);
          showSuccessToast('Thanks for the feedback!', 'Your review has been posted.');
        },
        onError: (e) => {
          showErrorToast('Could not submit review', extractErrorMessage(e));
        },
      }
    );
  }

  function handleReportProblem() {
    if (!listing) return;
    router.push({
      pathname: '/(modals)/submitReportModal',
      params: {
        listingId: listing._id,
        transactionId: myTransaction?._id ?? '',
        amount: String(myTransaction?.amount ?? listing.price),
      },
    });
  }

  if (loading) {
    return (
      <View style={styles.root}>
        <ListingDetailsSkeleton />
        <Pressable onPress={guard(handleBack)} style={[styles.overlayButton, { top: insets.top + spacingY.sm }]} hitSlop={8}>
          <Icon name="arrow-left" variant="linear" size={verticalScale(20)} color={colors.gray900} />
        </Pressable>
      </View>
    );
  }

  if (isNotFound) {
    return (
      <ListingNotFoundState
        message={error ?? 'This listing could not be found.'}
        onGoBack={handleBack}
        onBrowseListings={() => router.replace('/(tabs)/home')}
      />
    );
  }

  if (error || !listing) {
    return (
      <SafeAreaView style={styles.centerFlex} edges={['top', 'bottom']}>
        <Pressable onPress={guard(handleBack)} style={[styles.overlayButton, styles.plainBackButton]} hitSlop={8}>
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

  return (
    <View style={styles.root}>
      <StatusBar style={statusBarStyle} animated />
      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={reloadListingWithSkeleton} tintColor={colors.primary} colors={[colors.primary]} progressBackgroundColor={colors.white} />
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
            <View style={styles.conditionPill}>
              <Text style={styles.conditionPillText}>{conditionLabel}</Text>
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
              <Icons.StarIcon size={verticalScale(18)} color={colors.primary} weight="fill" />
              <Text style={styles.metaText}>{(listing.seller?.trustScore ?? 0).toFixed(1)}</Text>
            </View>
            <View style={styles.metaItem}>
              <Icon name="eye" variant="bold" size={verticalScale(18)} color={colors.gray400} />
              <Text style={styles.metaText}>{listing.views ?? 0} views</Text>
            </View>
          </View>

          <View style={styles.divider} />

          {listing.status === 'sold' ? (
            <PurchaseCompleteNote amount={myTransaction?.amount ?? listing.price} reference={myTransaction?.reference} />
          ) : null}

          {listing.status === 'sold' ? (
            <BuyerFeedbackSection
              review={myReview}
              buyerName={user?.name ?? 'You'}
              buyerAvatar={user?.profileImageUrl}
              onRateSeller={handleOpenReviewSheet}
            />
          ) : null}

          {listing.status === 'pending_sale' || listing.status === 'sold' ? (
            <SellerContactCard
              seller={listing.seller}
              address={listing.address ?? listing.locationLabel}
              coordinates={listing.location.coordinates}
              compact={listing.status === 'sold'}
            />
          ) : null}

          {listing.status === 'pending_sale' ? (
            <EscrowHoldNote
              transaction={myTransaction}
              fallbackAmount={listing.price}
              inspectionWindow={settings?.inspectionWindow}
              onRequestExtend={() => setExtendSheetOpen(true)}
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
          <Pressable onPress={guard(handleBack)} style={styles.floatingHeaderButton} hitSlop={8}>
            <Icon name="arrow-left" variant="linear" size={verticalScale(22)} color={colors.gray900} />
          </Pressable>
          <Pressable
            onPress={guard(handleShare)}
            style={[styles.floatingHeaderButton, { backgroundColor: colors.primary50 }]}
            hitSlop={8}
          >
            <Icons.ExportIcon size={verticalScale(24)} color={colors.primary} />
          </Pressable>
        </View>
      </View>

      <SafeAreaView edges={['bottom']} style={styles.footerSafeArea}>
        {listing.status === 'pending_sale' ? (
          <>
            <Pressable onPress={guard(handleConfirmItemFine)} style={styles.confirmFineButton}>
              <Text style={styles.confirmFineButtonLabel}>Item is Fine - Pay the Seller</Text>
            </Pressable>
            <Pressable onPress={guard(handleReportProblem)} style={styles.reportProblemButton}>
              <Text style={styles.reportProblemButtonLabel}>Report A Problem With This Item</Text>
            </Pressable>
          </>
        ) : (
          <Pressable onPress={guard(() => router.replace('/'))} style={styles.findDealButton}>
            <Text style={styles.findDealButtonLabel}>Find Your Next Deal</Text>
          </Pressable>
        )}
      </SafeAreaView>

      {confirmSheetOpen ? (
        <View style={StyleSheet.absoluteFill}>
          <ConfirmPaySheet
            amount={myTransaction?.amount ?? listing.price}
            sellerName={listing.seller?.name ?? 'the seller'}
            onCancel={() => setConfirmSheetOpen(false)}
            onConfirm={handleConfirmPayment}
          />
        </View>
      ) : null}

      {reviewSheetOpen ? (
        <View style={StyleSheet.absoluteFill}>
          <RateSellerSheet
            listing={listing}
            rating={reviewRating}
            comment={reviewComment}
            submitting={leaveReviewMutation.isPending}
            onRatingChange={setReviewRating}
            onCommentChange={setReviewComment}
            onDismiss={() => setReviewSheetOpen(false)}
            onSubmit={handleSubmitReview}
          />
        </View>
      ) : null}

      {extendSheetOpen && myTransaction ? (
        <View style={StyleSheet.absoluteFill}>
          <ExtendDeadlineConfirmSheet
            transaction={myTransaction}
            inspectionWindow={settings?.inspectionWindow}
            loading={requestExtensionMutation.isPending}
            onCancel={() => setExtendSheetOpen(false)}
            onConfirm={handleRequestExtension}
          />
        </View>
      ) : null}

      {extendSuccessDeadline ? (
        <View style={StyleSheet.absoluteFill}>
          <ExtendSuccessSheet deadline={extendSuccessDeadline} onClose={() => setExtendSuccessDeadline(null)} />
        </View>
      ) : null}

      {confirmingTransaction ? (
        <View style={styles.confirmingOverlay}>
          <ActivityIndicator color={colors.white} size="large" />
          <Text style={styles.confirmingText}>Releasing payment to the seller…</Text>
        </View>
      ) : null}
    </View>
  );
}

interface SellerContactCardProps {
  seller?: Listing['seller'];
  address?: string;
  /** GeoJSON [lng, lat] — flipped for Google's lat,lng-ordered APIs below. */
  coordinates: [number, number];
  /** Once sold, there's nothing left to arrange — just who you dealt with, no call button or map. */
  compact?: boolean;
}

// Pickup contact + location, matching the "unlocking the seller's details" step buyers land on
// after payment. Drops the call button/map in compact mode (status === 'sold') since there's no
// pickup left to arrange.
function SellerContactCard({ seller, address, coordinates, compact }: SellerContactCardProps) {
  const guard = useSingleTap();
  const [lng, lat] = coordinates;
  const hasCoords = !compact && Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0);
  const staticMapUrl = hasCoords
    ? `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=20&size=650x300&scale=6&markers=color:red%7C${lat},${lng}&key=${GOOGLE_STATIC_MAPS_KEY}`
    : null;

  function handleCall() {
    if (!seller?.phoneNumber) return;
    Linking.openURL(`tel:${seller.phoneNumber}`).catch(() => {});
  }

  function handleOpenMaps() {
    if (!hasCoords) return;
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`).catch(() => {});
  }

  return (
    <View style={styles.sellerCard}>
      <View style={styles.sellerHeaderRow}>
        <Image
          source={getProfileImage(seller?.profileImageUrl)}
          style={[styles.sellerAvatar, compact && styles.sellerAvatarRinged]}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
        <View style={styles.sellerHeaderText}>
          <Text style={styles.sellerName} numberOfLines={1}>
            {seller?.name ?? 'Seller'}
          </Text>
          <Text style={styles.sellerSubtext}>
            {seller?.totalSales ?? 0} Sales{seller?.createdAt ? `  •  Member since ${dayjs(seller.createdAt).format('YYYY')}` : ''}
          </Text>
        </View>
        {seller?.phoneNumber && !compact ? (
          <Pressable onPress={guard(handleCall)} style={styles.sellerCallButton} hitSlop={8}>
            <Icon name="call" variant="linear" size={verticalScale(20)} color={colors.primary} />
          </Pressable>
        ) : null}
      </View>

      {staticMapUrl ? (
        <>
          <View style={styles.sellerDivider} />
          <View style={styles.sellerMapWrap}>
            <Image source={{ uri: staticMapUrl }} style={styles.sellerMapImage} contentFit="cover" cachePolicy="memory-disk" />
          </View>
          {address ? (
            <Text style={styles.sellerAddress} numberOfLines={2}>
              {address}
            </Text>
          ) : null}
          <Pressable onPress={guard(handleOpenMaps)} style={styles.sellerMapsButton}>
            <Text style={styles.sellerMapsButtonLabel}>Open in Google Maps</Text>
          </Pressable>
        </>
      ) : null}
    </View>
  );
}

// Shown while a transaction on this listing is actually holding funds (status === 'pending_sale'). Two card shapes off myTransaction's real inspection fields — these flow through every transaction response (list and detail alike) with no extra wiring, see Transaction in api/types.ts:
//   1. inspectionPeriodEnded === false → the countdown card, with its own "Extend by N days"
//      button — extension can be requested proactively, not only once the window has run out.
//   2. inspectionPeriodEnded === true → the expired card, same extend button when still available.
// Both buttons only show while allowExtension is on AND the one-time extension hasn't been used yet (inspectionExtended === false) — allowExtension is the system-wide "can extensions happen at all" toggle, checked alongside (not instead of) the per-transaction inspectionExtended state. Once extended, inspectionExtensionEndDate supersedes inspectionDeadlineAt entirely — the two are never combined/averaged, only one is ever the "active" deadline at a time. Tapping either button opens the shared ExtendDeadlineConfirmSheet (rendered at the top level, see the main component).
function EscrowHoldNote({
  transaction,
  fallbackAmount,
  inspectionWindow,
  onRequestExtend,
}: {
  transaction: Transaction | null;
  fallbackAmount: number;
  inspectionWindow: SystemSettingsInspectionWindow | undefined;
  onRequestExtend: () => void;
}) {
  const guard = useSingleTap();

  const amount = transaction?.amount ?? fallbackAmount;
  const periodEnded = transaction?.inspectionPeriodEnded ?? false;
  const extended = transaction?.inspectionExtended ?? false;
  const activeDeadline = extended ? transaction?.inspectionExtensionEndDate : transaction?.inspectionDeadlineAt;
  const canRequestExtension = !!inspectionWindow?.allowExtension && !extended;
  const extensionDays = inspectionWindow?.maxExtensionPeriod ?? 5;
  // inspectionPeriod is denominated in days — same unit as maxExtensionPeriod/inspectionExtendedBy.
  const windowHours = inspectionWindow ? inspectionWindow.inspectionPeriod * 24 : INSPECTION_WINDOW_HOURS_FALLBACK;

  if (periodEnded) {
    return (
      <View style={styles.escrowExpiredCard}>
        <View style={styles.escrowTitleRow}>
          <Icon name="danger" variant="bold" size={verticalScale(18)} color={colors.danger} />
          <Text style={styles.escrowExpiredTitle}>Inspection Deadline Expired</Text>
        </View>
        <Text style={styles.escrowExpiredBody}>The inspection period for this transaction has ended.</Text>
        {activeDeadline ? (
          <Text style={styles.escrowExpiredDeadline}>Deadline was {dayjs(activeDeadline).format('D MMM, YYYY. h:mm A')}.</Text>
        ) : null}

        {canRequestExtension ? (
          <Pressable onPress={guard(onRequestExtend)} style={styles.escrowExpiredButton}>
            <Text style={styles.escrowExpiredButtonLabel}>
              Extend by {extensionDays} day{extensionDays === 1 ? '' : 's'}
            </Text>
          </Pressable>
        ) : extended ? (
          <Pressable
            onPress={guard(() => showWarningToast('Not available yet', "Contacting support isn't available yet."))}
            style={styles.escrowExpiredButton}
          >
            <Text style={styles.escrowExpiredButtonLabel}>Contact Support</Text>
          </Pressable>
        ) : (
          <Text style={styles.escrowExpiredUnavailableText}>Extensions aren't available for this transaction.</Text>
        )}
      </View>
    );
  }

  return (
    <View style={styles.escrowCard}>
      <View style={styles.escrowTitleRow}>
        <Icon name="shield-tick" variant="bold" size={verticalScale(18)} color={colors.warning700} />
        <Text style={styles.escrowTitle}>{formatCurrency(amount, 2)} Held In Escrow</Text>
      </View>
      <Text style={styles.escrowBody}>
        Pick up and inspect within {windowHours} hours. No pickup by then and the order auto-cancels with a 10% fee
        (half compensates the seller). After handover, funds release automatically at the end of the window unless
        you report a problem.
      </Text>

      {activeDeadline ? (
        <View style={styles.inspectionDeadlineCard}>
          <Text style={styles.inspectionDeadlineLabel}>INSPECTION DEADLINE</Text>
          <View style={styles.inspectionDeadlineRow}>
            <Text style={styles.inspectionDeadlineDate}>
              {dayjs(activeDeadline).format('MMM D, YYYY')} <Text style={styles.inspectionDeadlineDot}>•</Text>{' '}
              {dayjs(activeDeadline).format('h:mm A')}
            </Text>
            <CountdownPill targetIso={activeDeadline} />
          </View>

          {canRequestExtension ? (
            <>
              <View style={styles.inspectionDeadlineDivider} />
              <Pressable onPress={guard(onRequestExtend)} style={styles.inspectionExtendButton}>
                <Text style={styles.inspectionExtendButtonLabel}>
                  Extend by {extensionDays} day{extensionDays === 1 ? '' : 's'}
                </Text>
              </Pressable>
            </>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

interface ExtendDeadlineConfirmSheetProps {
  transaction: Transaction;
  inspectionWindow: SystemSettingsInspectionWindow | undefined;
  loading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

// Reached from either of EscrowHoldNote's two "Extend by N days" buttons — same confirmation
// either way. New deadline is computed client-side (current active deadline + maxExtensionPeriod
// days) purely for this preview; the real value comes back from the request itself and is applied
// via useRequestInspectionExtensionMutation's cache invalidation once confirmed.
function ExtendDeadlineConfirmSheet({ transaction, inspectionWindow, loading, onCancel, onConfirm }: ExtendDeadlineConfirmSheetProps) {
  const guard = useSingleTap();
  const extensionDays = inspectionWindow?.maxExtensionPeriod ?? 5;
  const currentDeadline = transaction.inspectionExtended ? transaction.inspectionExtensionEndDate : transaction.inspectionDeadlineAt;
  const newDeadline = currentDeadline ? dayjs(currentDeadline).add(extensionDays, 'day') : null;

  function formatDeadline(value: string | dayjs.Dayjs) {
    const d = typeof value === 'string' ? dayjs(value) : value;
    return `${d.format('D MMM YYYY')} ▪ ${d.format('h:mm A')}`;
  }

  return (
    <BottomSheetCard onBackdropPress={loading ? undefined : guard(onCancel)} sheetBackgroundColor={colors.white}>
      <View style={styles.extendIconWrap}>
        <Icons.ClockIcon size={verticalScale(28)} color={colors.primary} weight="bold" />
      </View>
      <Text style={styles.extendTitle}>Extend Inspection Deadline?</Text>
      <Text style={styles.extendSubtitle}>
        Need more time to inspect the item? You can extend your inspection deadline by {extensionDays} day
        {extensionDays === 1 ? '' : 's'}.
      </Text>

      <View style={styles.extendDetailsCard}>
        <View style={styles.extendDetailsRow}>
          <Text style={styles.extendDetailsLabel}>Current deadline</Text>
          <Text style={styles.extendDetailsValue}>{currentDeadline ? formatDeadline(currentDeadline) : '—'}</Text>
        </View>
        <View style={styles.extendDetailsRow}>
          <Text style={styles.extendDetailsLabel}>Extension</Text>
          <Text style={styles.extendDetailsExtensionValue}>
            +{extensionDays} day{extensionDays === 1 ? '' : 's'}
          </Text>
        </View>
        <View style={[styles.extendDetailsRow, styles.extendDetailsRowHighlighted]}>
          <Text style={styles.extendDetailsLabel}>New deadline</Text>
          <Text style={styles.extendDetailsNewValue}>{newDeadline ? formatDeadline(newDeadline) : '—'}</Text>
        </View>
      </View>

      <Text style={styles.extendNote}>Once confirmed, your new deadline will apply to this transaction.</Text>

      <View style={styles.extendWarningBanner}>
        <Icon name="danger" variant="bold" size={verticalScale(16)} color={colors.warning700} />
        <Text style={styles.extendWarningText}>This extension can only be used once for this transaction.</Text>
      </View>

      <Pressable onPress={loading ? undefined : guard(onConfirm)} disabled={loading} style={styles.extendConfirmButton}>
        {loading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.extendConfirmLabel}>Extend Deadline</Text>}
      </Pressable>
      <Pressable onPress={loading ? undefined : guard(onCancel)} disabled={loading} hitSlop={8} style={styles.extendCancelButton}>
        <Text style={styles.extendCancelLabel}>Not Now</Text>
      </Pressable>

      <View style={styles.extendFooterNote}>
        <Icon name="info-circle" variant="bold" size={verticalScale(14)} color={colors.gray400} />
        <Text style={styles.extendFooterNoteText}>Your payment stays secured in escrow either way</Text>
      </View>
    </BottomSheetCard>
  );
}

// Shown once the extension actually succeeds, in place of a toast — same DoneSheet shape/copy
// pattern used elsewhere (ListingActionsSheet's pause/resume/delete, submitReportModal's report
// success), Close button styled backgroundLight to match those too.
function ExtendSuccessSheet({ deadline, onClose }: { deadline: string; onClose: () => void }) {
  const guard = useSingleTap();

  return (
    <BottomSheetCard onBackdropPress={guard(onClose)} sheetBackgroundColor={colors.white}>
      <View style={styles.extendSuccessIconWrap}>
        <Icon name="tick-circle" variant="bold" size={verticalScale(64)} color={colors.success} />
      </View>
      <Text style={styles.extendTitle}>Deadline Extended</Text>
      <Text style={styles.extendSubtitle}>
        Your new inspection deadline is {dayjs(deadline).format('D MMM YYYY')} ▪ {dayjs(deadline).format('h:mm A')}.
      </Text>
      <Pressable onPress={guard(onClose)} style={styles.extendSuccessCloseButton}>
        <Text style={styles.extendSuccessCloseLabel}>Close</Text>
      </Pressable>
    </BottomSheetCard>
  );
}

function formatRemaining(targetIso: string): string {
  const diffMs = dayjs(targetIso).diff(dayjs());
  if (diffMs <= 0) return 'Expired';
  const totalMinutes = Math.floor(diffMs / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h remaining`;
  if (hours > 0) return `${hours}h ${minutes}m remaining`;
  return `${minutes} min${minutes === 1 ? '' : 's'} remaining`;
}

// Own component so the 30s tick only re-renders this small pill, not the whole EscrowHoldNote.
function CountdownPill({ targetIso }: { targetIso: string }) {
  const [label, setLabel] = useState(() => formatRemaining(targetIso));

  useEffect(() => {
    setLabel(formatRemaining(targetIso));
    const timer = setInterval(() => setLabel(formatRemaining(targetIso)), 30000);
    return () => clearInterval(timer);
  }, [targetIso]);

  return (
    <View style={styles.inspectionCountdownRow}>
      <Icons.ClockIcon size={verticalScale(14)} color={colors.warning700} weight="bold" />
      <Text style={styles.inspectionCountdownText}>{label}</Text>
    </View>
  );
}

interface StarRowProps {
  rating: number;
  size?: number;
  interactive?: boolean;
  onChange?: (next: number) => void;
  style?: StyleProp<ViewStyle>;
}

function StarRow({ rating, size = 16, interactive, onChange, style }: StarRowProps) {
  const guard = useSingleTap();

  return (
    <View style={[styles.starRow, style]}>
      {[1, 2, 3, 4, 5].map((value) =>
        interactive ? (
          <Pressable key={value} onPress={guard(() => onChange?.(value))} hitSlop={4}>
            <Icons.StarIcon size={verticalScale(size)} color={value <= rating ? colors.goldPrimary : colors.gray300} weight="fill" />
          </Pressable>
        ) : (
          <Icons.StarIcon key={value} size={verticalScale(size)} color={value <= rating ? colors.goldPrimary : colors.gray300} weight="fill" />
        )
      )}
    </View>
  );
}

// Only shown once a listing is sold — the amount/reference of the buyer's own now-completed transaction.
function PurchaseCompleteNote({ amount, reference }: { amount: number; reference?: string }) {
  return (
    <View style={styles.purchaseCompleteCard}>
      <View style={styles.purchaseCompleteTitleRow}>
        <Icon name="security-safe" variant="bold" size={verticalScale(18)} color={colors.success} />
        <Text style={styles.purchaseCompleteTitle}>Purchase complete - Seller paid</Text>
      </View>
      <Text style={styles.purchaseCompleteSubtitle}>
        {formatCurrency(amount, 2)}
        {reference ? `  •  Ref: ${reference}` : ''}
      </Text>
    </View>
  );
}

interface BuyerFeedbackSectionProps {
  review: Review | null;
  buyerName: string;
  buyerAvatar?: string;
  onRateSeller: () => void;
}

// Shows the buyer's own review once left (GET /reviews/listing/:listingId), or a prompt to leave
// one — the sheet itself is opened automatically right after confirmTransaction succeeds, but a
// buyer who tapped "Maybe Later" there needs another way back into it.
function BuyerFeedbackSection({ review, buyerName, buyerAvatar, onRateSeller }: BuyerFeedbackSectionProps) {
  const guard = useSingleTap();

  return (
    <View style={styles.feedbackSection}>
      <Text style={styles.feedbackSectionTitle}>Buyer Feedback</Text>
      {review ? (
        <View style={styles.feedbackCard}>
          <View style={styles.feedbackCardHeader}>
            <Image source={getProfileImage(buyerAvatar)} style={styles.feedbackAvatar} contentFit="cover" cachePolicy="memory-disk" />
            <Text style={styles.feedbackName} numberOfLines={1}>
              {buyerName}
            </Text>
            <StarRow rating={review.rating} size={16} />
          </View>
          <Text style={styles.feedbackComment}>{review.comment || "No Comment"}</Text>
        </View>
      ) : (
        <Pressable onPress={guard(onRateSeller)} style={styles.feedbackPrompt}>
          <Text style={styles.feedbackPromptText}>You haven't rated this seller yet.</Text>
          <Text style={styles.feedbackPromptLink}>Rate Seller</Text>
        </Pressable>
      )}
    </View>
  );
}

interface ConfirmPaySheetProps {
  amount: number;
  sellerName: string;
  onCancel: () => void;
  onConfirm: () => void;
}

// Gate in front of the pending_sale footer's "Item is Fine - Pay the Seller" button — an irreversible action (calls POST / transactions/:id/confirm-transaction, releasing escrow), so it gets its own explicit yes/no step rather than firing straight off the footer tap. Closes immediately on confirm — the full-screen confirmingOverlay takes over from there while the request is in flight.
function ConfirmPaySheet({ amount, sellerName, onCancel, onConfirm }: ConfirmPaySheetProps) {
  const guard = useSingleTap();

  return (
    <BottomSheetCard onBackdropPress={guard(onCancel)} sheetBackgroundColor={colors.white}>
      <View style={styles.confirmPayIconWrap}>
        <Icon name="shield-security" variant="bold" size={verticalScale(36)} color={colors.success} />
      </View>
      <Text style={styles.confirmPayTitle}>Pay {formatCurrency(amount)} to {sellerName}?</Text>
      <Text style={styles.confirmPaySubtitle}>
        Only confirm if you've checked the item and it's what you paid for.{' '}
        <Text style={styles.confirmPaySubtitleBold}>This releases your money and can't be reversed.</Text>
      </Text>
      <View style={styles.confirmPayButtonRow}>
        <Pressable onPress={guard(onCancel)} style={styles.confirmPayCancelButton}>
          <Text style={styles.confirmPayCancelLabel}>Not yet, I'm still checking</Text>
        </Pressable>
        <Pressable onPress={guard(onConfirm)} style={styles.confirmPayConfirmButton}>
          <Text style={styles.confirmPayConfirmLabel}>Yes, Pay the Seller</Text>
        </Pressable>
      </View>
    </BottomSheetCard>
  );
}

interface RateSellerSheetProps {
  listing: Listing;
  rating: number;
  comment: string;
  submitting: boolean;
  onRatingChange: (next: number) => void;
  onCommentChange: (next: string) => void;
  onDismiss: () => void;
  onSubmit: () => void;
}

// Opened automatically right after confirmTransaction succeeds (also reachable again via the
// Buyer Feedback section's "Rate Seller" prompt if dismissed with "Maybe Later" the first time).
function RateSellerSheet({ listing, rating, comment, submitting, onRatingChange, onCommentChange, onDismiss, onSubmit }: RateSellerSheetProps) {
  const guard = useSingleTap();
  const seller = listing.seller;

  return (
    <BottomSheetCard onBackdropPress={submitting ? undefined : guard(onDismiss)} sheetBackgroundColor={colors.white}>
      <Text style={styles.rateSheetTitle}>How did this deal go?</Text>

      <View style={styles.rateSheetItemRow}>
        <Image source={{ uri: listing.mainImageUrl }} style={styles.rateSheetItemImage} contentFit="cover" cachePolicy="memory-disk" />
        <View style={styles.rateSheetItemText}>
          <Text style={styles.rateSheetItemTitle} numberOfLines={1}>
            {listing.title}
          </Text>
          <Text style={styles.rateSheetItemPrice}>{formatCurrency(listing.price)}</Text>
        </View>
        <View style={styles.rateSheetItemMeta}>
          <View style={styles.rateSheetReleasedPill}>
            <Text style={styles.rateSheetReleasedPillText}>Released</Text>
          </View>
          <Text style={styles.rateSheetSellerName} numberOfLines={1}>
            {seller?.name ?? 'Seller'}
          </Text>
        </View>
      </View>

      <Text style={styles.rateSheetSectionTitle}>Rate Seller</Text>

      <View style={styles.rateSheetSellerRow}>
        <Image source={getProfileImage(seller?.profileImageUrl)} style={styles.rateSheetSellerAvatar} contentFit="cover" cachePolicy="memory-disk" />
        <View>
          <Text style={styles.rateSheetSellerRowName}>{seller?.name ?? 'Seller'}</Text>
          <View style={styles.rateSheetSellerRowMeta}>
            <Icons.StarIcon size={verticalScale(14)} color={colors.goldPrimary} weight="fill" />
            <Text style={styles.rateSheetSellerRowMetaText}>
              {(seller?.trustScore ?? 0).toFixed(1)} ({seller?.totalSales ?? 0} items sold)
            </Text>
          </View>
        </View>
      </View>

      <StarRow rating={rating} size={36} interactive onChange={submitting ? undefined : onRatingChange} style={styles.rateSheetStars} />

      <TextInput
        style={styles.rateSheetCommentInput}
        placeholder="Tell other buyers about the seller (optional)"
        placeholderTextColor={colors.gray400}
        value={comment}
        onChangeText={onCommentChange}
        multiline
        editable={!submitting}
      />

      <View style={styles.rateSheetButtonRow}>
        <Pressable onPress={submitting ? undefined : guard(onDismiss)} disabled={submitting} style={styles.rateSheetLaterButton}>
          <Text style={styles.rateSheetLaterLabel}>Maybe Later</Text>
        </Pressable>
        <Pressable onPress={submitting ? undefined : guard(onSubmit)} disabled={submitting} style={styles.rateSheetSubmitButton}>
          {submitting ? <ActivityIndicator color={colors.white} /> : <Text style={styles.rateSheetSubmitLabel}>Submit Review</Text>}
        </Pressable>
      </View>
    </BottomSheetCard>
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
        <Bone width="100%" height={verticalScale(90)} radius={radius.lg} style={styles.skeletonBlockGap} />
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
// Fade-in window for the floating header's white background (and the status bar's light→dark
// flip) — moved earlier than the old [0.6, 1] * HERO_HEIGHT range so it kicks in soon after the
// user starts scrolling instead of waiting until they're almost past the whole hero image.
const FLOATING_HEADER_FADE_START = HERO_HEIGHT * 0.15;
const FLOATING_HEADER_FADE_END = HERO_HEIGHT * 0.5;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.white,
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
  centerFlex: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
  notFoundRoot: {
    flex: 1,
    backgroundColor: colors.white,
  },
  notFoundContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacingX['2xl'],
  },
  notFoundIconWrap: {
    width: verticalScale(96),
    height: verticalScale(96),
    borderRadius: radius.full,
    borderCurve: 'continuous',
    backgroundColor: colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacingY.xl,
  },
  notFoundTitle: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize['2xl'],
    color: colors.ink,
    textAlign: 'center',
    marginBottom: spacingY.sm,
  },
  notFoundBody: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    lineHeight: fontSize.md * 1.4,
    color: colors.gray500,
    textAlign: 'center',
    marginBottom: spacingY['2xl'],
  },
  notFoundPrimaryButton: {
    width: '100%',
    minHeight: verticalScale(56),
    borderRadius: radius.full,
    borderCurve: 'continuous',
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacingX.xl,
    marginBottom: spacingY.md,
  },
  notFoundPrimaryLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.lg,
    color: colors.white,
  },
  notFoundSecondaryButton: {
    minHeight: verticalScale(44),
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacingX.xl,
  },
  notFoundSecondaryLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.md,
    color: colors.gray500,
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
  conditionPill: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primaryLight,
    borderRadius: radius.full,
    borderCurve: 'continuous',
    paddingHorizontal: spacingX.md,
    paddingVertical: spacingY.xs,
  },
  conditionPillText: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.sm,
    color: colors.primary,
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
  sellerCard: {
    backgroundColor: colors.cardBackground,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    padding: spacingX.md,
    marginBottom: spacingY.xl,
  },
  sellerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingX.md,
  },
  sellerAvatar: {
    width: verticalScale(56),
    height: verticalScale(56),
    borderRadius: radius.full,
    borderCurve: 'continuous',
    backgroundColor: colors.gray100,
  },
  sellerAvatarRinged: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  sellerHeaderText: {
    flex: 1,
    gap: verticalScale(4),
  },
  sellerName: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.lg,
    color: colors.ink,
  },
  sellerSubtext: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.gray500,
  },
  sellerCallButton: {
    width: verticalScale(44),
    height: verticalScale(44),
    borderRadius: radius.full,
    borderCurve: 'continuous',
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sellerDivider: {
    height: 1,
    backgroundColor: colors.gray100,
    marginVertical: spacingY.lg,
  },
  sellerMapWrap: {
    width: '100%',
    height: verticalScale(160),
    borderRadius: radius.md,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: colors.gray100,
  },
  sellerMapImage: {
    width: '100%',
    height: '100%',
  },
  sellerAddress: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.gray600,
    marginTop: spacingY.md,
  },
  sellerMapsButton: {
    marginTop: spacingY.md,
    minHeight: verticalScale(40),
    borderRadius: radius.md,
    borderCurve: 'continuous',
    backgroundColor: colors.primary50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sellerMapsButtonLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.sm,
    color: colors.primary,
  },
  escrowCard: {
    backgroundColor: colors.warning25,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    padding: spacingX.lg,
    marginBottom: spacingY.xl,
  },
  escrowTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingX.xs,
    marginBottom: spacingY.sm,
  },
  escrowTitle: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.lg,
    color: colors.warning700,
  },
  escrowBody: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    lineHeight: fontSize.sm * 1.8,
    color: colors.warning600,
    marginBottom: spacingY.md,
  },
  inspectionDeadlineCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    padding: spacingX.lg,
  },
  inspectionDeadlineLabel: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.sm,
    color: colors.ink,
    letterSpacing: 0.3,
    marginBottom: spacingY.sm,
  },
  inspectionDeadlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacingX.sm,
  },
  inspectionDeadlineDate: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.md,
    color: colors.gray700,
  },
  inspectionDeadlineDot: {
    color: colors.gray300,
  },
  inspectionCountdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingX.xs,
  },
  inspectionCountdownText: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.sm,
    color: colors.warning700,
  },
  inspectionDeadlineDivider: {
    height: 1,
    borderStyle: 'dashed',
    borderTopWidth: 1,
    borderColor: colors.gray200,
    marginVertical: spacingY.md,
  },
  inspectionExtendButton: {
    minHeight: verticalScale(48),
    borderRadius: radius.full,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: colors.gray200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inspectionExtendButtonLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.md,
    color: colors.gray700,
  },
  escrowExpiredCard: {
    backgroundColor: colors.error50,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    padding: spacingX.lg,
    marginBottom: spacingY.xl,
  },
  escrowExpiredTitle: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.lg,
    color: colors.danger,
  },
  escrowExpiredBody: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    lineHeight: fontSize.sm * 1.8,
    color: colors.danger,
    marginBottom: spacingY.xs,
  },
  escrowExpiredDeadline: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.danger,
    marginBottom: spacingY.lg,
  },
  escrowExpiredButton: {
    minHeight: verticalScale(52),
    borderRadius: radius.full,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: colors.dangerLight,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacingX.lg,
  },
  escrowExpiredButtonLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.md,
    color: colors.danger,
  },
  escrowExpiredUnavailableText: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.danger,
    textAlign: 'center',
  },
  extendIconWrap: {
    alignSelf: 'center',
    width: verticalScale(72),
    height: verticalScale(72),
    borderRadius: radius.full,
    borderCurve: 'continuous',
    backgroundColor: colors.primary25,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacingY.lg,
    marginBottom: spacingY.lg,
  },
  extendTitle: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xl,
    color: colors.ink,
    textAlign: 'center',
    marginBottom: spacingY.xs,
  },
  extendSubtitle: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    lineHeight: fontSize.md * 1.4,
    color: colors.gray500,
    textAlign: 'center',
    marginBottom: spacingY.lg,
  },
  extendDetailsCard: {
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    overflow: 'hidden',
    marginBottom: spacingY.md,
  },
  extendDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacingX.md,
    backgroundColor: colors.gray50,
    paddingHorizontal: spacingX.lg,
    paddingVertical: spacingY.md,
  },
  extendDetailsRowHighlighted: {
    backgroundColor: colors.primary25,
  },
  extendDetailsLabel: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.md,
    color: colors.gray500,
  },
  extendDetailsValue: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.md,
    color: colors.ink,
  },
  extendDetailsExtensionValue: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.md,
    color: colors.warning700,
  },
  extendDetailsNewValue: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.md,
    color: colors.primary,
  },
  extendNote: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: colors.gray500,
    textAlign: 'center',
    marginBottom: spacingY.md,
  },
  extendWarningBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacingX.sm,
    backgroundColor: colors.warning25,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    padding: spacingX.md,
    marginBottom: spacingY.lg,
  },
  extendWarningText: {
    flex: 1,
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm * 1.4,
    color: colors.warning700,
  },
  extendConfirmButton: {
    minHeight: verticalScale(52),
    borderRadius: radius.full,
    borderCurve: 'continuous',
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacingY.sm,
  },
  extendConfirmLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.lg,
    color: colors.white,
  },
  extendCancelButton: {
    alignSelf: 'center',
    paddingVertical: spacingY.xs,
    paddingHorizontal: spacingX.xl,
    marginBottom: spacingY.sm,
  },
  extendCancelLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.md,
    color: colors.gray600,
  },
  extendFooterNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacingX.xs,
    marginBottom: spacingY.xs,
  },
  extendFooterNoteText: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.gray400,
  },
  extendSuccessIconWrap: {
    alignSelf: 'center',
    marginTop: spacingY.lg,
    marginBottom: spacingY.lg,
  },
  extendSuccessCloseButton: {
    minHeight: verticalScale(52),
    borderRadius: radius.full,
    borderCurve: 'continuous',
    backgroundColor: colors.backgroundLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacingY.md,
  },
  extendSuccessCloseLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.md,
    color: colors.gray700,
  },
  starRow: {
    flexDirection: 'row',
    gap: spacingX.xs,
  },
  purchaseCompleteCard: {
    backgroundColor: colors.success25,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    padding: spacingX.lg,
    marginBottom: spacingY.xl,
  },
  purchaseCompleteTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingX.xs,
    marginBottom: spacingY.xs,
  },
  purchaseCompleteTitle: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.md,
    color: colors.success,
  },
  purchaseCompleteSubtitle: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.success,
  },
  feedbackSection: {
    marginBottom: spacingY.xl,
  },
  feedbackSectionTitle: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.lg,
    color: colors.ink,
    marginBottom: spacingY.md,
  },
  feedbackCard: {
    backgroundColor: colors.warning25,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    padding: spacingX.lg,
  },
  feedbackCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingX.sm,
    marginBottom: spacingY.sm,
  },
  feedbackAvatar: {
    width: verticalScale(36),
    height: verticalScale(36),
    borderRadius: radius.full,
    borderCurve: 'continuous',
    backgroundColor: colors.gray100,
  },
  feedbackName: {
    flex: 1,
    fontFamily: fontFamily.bold,
    fontSize: fontSize.md,
    color: colors.ink,
  },
  feedbackComment: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm * 1.5,
    color: colors.gray600,
  },
  feedbackPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.cardBackground,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    paddingHorizontal: spacingX.lg,
    paddingVertical: spacingY.lg,
  },
  feedbackPromptText: {
    flex: 1,
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.gray500,
  },
  feedbackPromptLink: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.sm,
    color: colors.primary,
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
  footerSafeArea: {
    paddingHorizontal: spacingX.lg,
    paddingTop: spacingY.md,
    paddingBottom: spacingY.md,
    backgroundColor: colors.white,
    gap: spacingY.md,
    borderTopWidth: 1,
    borderTopColor: colors.gray100,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 6,
  },
  confirmFineButton: {
    minHeight: verticalScale(56),
    borderRadius: radius.full,
    borderCurve: 'continuous',
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacingX.xl,
  },
  confirmFineButtonLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.lg,
    color: colors.white,
  },
  reportProblemButton: {
    minHeight: verticalScale(56),
    borderRadius: radius.full,
    borderCurve: 'continuous',
    backgroundColor: colors.error25,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacingX.xl,
  },
  reportProblemButtonLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.lg,
    color: colors.error,
  },
  findDealButton: {
    minHeight: verticalScale(56),
    borderRadius: radius.full,
    borderCurve: 'continuous',
    backgroundColor: colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacingX.xl,
  },
  findDealButtonLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.lg,
    color: colors.gray700,
  },
  confirmPayIconWrap: {
    alignSelf: 'center',
    width: verticalScale(88),
    height: verticalScale(88),
    borderRadius: radius.full,
    borderCurve: 'continuous',
    backgroundColor: colors.success50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacingY.xl,
    marginBottom: spacingY.xl,
  },
  confirmPayTitle: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xl,
    color: colors.ink,
    textAlign: 'center',
    marginBottom: spacingY.md,
  },
  confirmPaySubtitle: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    lineHeight: fontSize.md * 1.4,
    color: colors.gray500,
    textAlign: 'center',
    marginBottom: spacingY.xl,
  },
  confirmPaySubtitleBold: {
    fontFamily: fontFamily.bold,
    color: colors.ink,
  },
  confirmPayButtonRow: {
    flexDirection: 'row',
    gap: spacingX.md,
    paddingBottom: spacingY.md,
  },
  confirmPayCancelButton: {
    flex: 1,
    minHeight: verticalScale(56),
    borderRadius: radius.full,
    borderCurve: 'continuous',
    backgroundColor: colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacingX.md,
  },
  confirmPayCancelLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.md,
    color: colors.gray600,
    textAlign: 'center',
  },
  confirmPayConfirmButton: {
    flex: 1,
    minHeight: verticalScale(56),
    borderRadius: radius.full,
    borderCurve: 'continuous',
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacingX.md,
  },
  confirmPayConfirmLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.md,
    color: colors.white,
    textAlign: 'center',
  },
  rateSheetTitle: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xl,
    color: colors.ink,
    textAlign: 'center',
    marginBottom: spacingY.xl,
  },
  rateSheetItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingX.md,
    backgroundColor: colors.gray50,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    padding: spacingX.md,
    marginBottom: spacingY.xl,
  },
  rateSheetItemImage: {
    width: verticalScale(56),
    height: verticalScale(56),
    borderRadius: radius.md,
    borderCurve: 'continuous',
    backgroundColor: colors.gray100,
  },
  rateSheetItemText: {
    flex: 1,
    gap: verticalScale(4),
  },
  rateSheetItemTitle: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.sm,
    color: colors.ink,
  },
  rateSheetItemPrice: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.md,
    color: colors.ink,
  },
  rateSheetItemMeta: {
    alignItems: 'flex-end',
    gap: verticalScale(4),
  },
  rateSheetReleasedPill: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.full,
    borderCurve: 'continuous',
    paddingHorizontal: spacingX.sm,
    paddingVertical: verticalScale(2),
  },
  rateSheetReleasedPillText: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.xs,
    color: colors.primary,
  },
  rateSheetSellerName: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
    color: colors.gray500,
  },
  rateSheetSectionTitle: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.lg,
    color: colors.ink,
    marginBottom: spacingY.md,
    textAlign: "center"
  },
  rateSheetSellerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacingX.md,
    marginBottom: spacingY.xl,
  },
  rateSheetSellerAvatar: {
    width: verticalScale(52),
    height: verticalScale(52),
    borderRadius: radius.full,
    borderCurve: 'continuous',
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: colors.gray100,
  },
  rateSheetSellerRowName: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.md,
    color: colors.ink,
    marginBottom: verticalScale(4),
  },
  rateSheetSellerRowMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingX.xs,
  },
  rateSheetSellerRowMetaText: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.gray500,
  },
  rateSheetStars: {
    alignSelf: 'center',
    gap: spacingX.md,
    marginBottom: spacingY.xl,
  },
  rateSheetCommentInput: {
    minHeight: verticalScale(90),
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    backgroundColor: colors.gray50,
    paddingHorizontal: spacingX.md,
    paddingVertical: spacingY.md,
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.ink,
    textAlignVertical: 'top',
    marginBottom: spacingY.xl,
  },
  rateSheetButtonRow: {
    flexDirection: 'row',
    gap: spacingX.md,
    paddingBottom: spacingY.md,
  },
  rateSheetLaterButton: {
    flex: 1,
    minHeight: verticalScale(56),
    borderRadius: radius.full,
    borderCurve: 'continuous',
    backgroundColor: colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacingX.md,
  },
  rateSheetLaterLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.md,
    color: colors.gray600,
  },
  rateSheetSubmitButton: {
    flex: 2,
    minHeight: verticalScale(56),
    borderRadius: radius.full,
    borderCurve: 'continuous',
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacingX.md,
  },
  rateSheetSubmitLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.md,
    color: colors.white,
  },
});
