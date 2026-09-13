import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  LayoutAnimation,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
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
import { WebView } from 'react-native-webview';
import type { ShouldStartLoadRequest, WebViewNavigation } from 'react-native-webview/lib/WebViewTypes';
import { ErrorBoundary } from 'react-error-boundary';
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
import { useQueryClient } from '@tanstack/react-query';
import { BottomSheetCard, EmptyState } from '@/components';
import Icon from '@/components/Icon';
import * as Icons from 'phosphor-react-native';
import { colors, fontFamily, fontSize, radius, spacingX, spacingY } from '@/constants/theme';
import { verticalScale } from '@/utils/styling';
import { useSingleTap } from '@/hooks/useSingleTap';
import { useAuth } from '@/contexts/AuthContext';
import { listingsApi, transactionsApi, usersApi } from '@/api';
import { queryKeys } from '@/api/queryKeys';
import { useListingDetail } from '@/hooks/queries/useListings';
import {
  useCancelTransactionMutation,
  useCheckoutMutation,
  useConfirmTransactionMutation,
  useMyPurchaseForListing,
} from '@/hooks/queries/useTransactions';
import { useLeaveReviewMutation, useReviewForListing } from '@/hooks/queries/useReviews';
import { calculatePaystackFee } from '@/lib/paystackFees';
import type { Listing, Review } from '@/api/types';
import { extractErrorMessage } from '@/api/client';
import { formatCurrency, formatDate, getProfileImage } from '@/utils/helpers';
import { CONDITION_OPTIONS } from '@/constants/formOptions';
import { showErrorToast, showSuccessToast, showWarningToast } from '@/lib/toast';

const PAYSTACK_CALLBACK_URL = 'declut://payment-callback';
const PAYMENT_POLL_INTERVAL_MS = 2000;
const PAYMENT_POLL_MAX_ATTEMPTS = 10;
const INSPECTION_WINDOW_HOURS = 48;

// Reuses the Places API key — same Google Cloud project. If the static map comes back blank/403,
// "Maps Static API" needs enabling for this key in Google Cloud Console.
const GOOGLE_STATIC_MAPS_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY ?? '';

// Static copy, not backend-driven — matches the Figma export verbatim. "Extend by 24 hours" has
// no backing endpoint yet (nothing in the Postman collection covers a per-transaction inspection
// extension), so the link below just surfaces a toast rather than pretending to call something real.
const ESCROW_NOTE_BODY = `Pick up and inspect within ${INSPECTION_WINDOW_HOURS} hours. No pickup by then and the order auto-cancels with a 10% fee (half compensates the seller). After handover, funds release automatically at the end of the window unless you report a problem.`;

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Polls until the transaction reaches escrow_active (payment confirmed) or attempts run out. */
async function getTransactionResult(transactionId: string) {
  if (__DEV__) console.log(`[Checkout] polling transaction=${transactionId} (up to ${PAYMENT_POLL_MAX_ATTEMPTS} attempts, ${PAYMENT_POLL_INTERVAL_MS}ms apart)`);
  for (let attempt = 0; attempt < PAYMENT_POLL_MAX_ATTEMPTS; attempt++) {
    await wait(PAYMENT_POLL_INTERVAL_MS);
    try {
      const transaction = await transactionsApi.getTransaction(transactionId);
      if (__DEV__) console.log(`[Checkout] poll attempt ${attempt + 1}/${PAYMENT_POLL_MAX_ATTEMPTS} — status=${transaction.status}`);
      if (transaction.status === 'escrow_active') {
        if (__DEV__) console.log(`[Checkout] transaction=${transactionId} confirmed escrow_active`);
        return transaction;
      }
    } catch (e) {
      if (__DEV__) console.warn(`[Checkout] poll attempt ${attempt + 1}/${PAYMENT_POLL_MAX_ATTEMPTS} failed (transient, retrying)`, e);
    }
  }
  if (__DEV__) console.warn(`[Checkout] transaction=${transactionId} did not reach escrow_active within ${PAYMENT_POLL_MAX_ATTEMPTS} attempts`);
  return null;
}

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

interface AccordionEntry {
  /** @gems-group/icons name, rendered via <Icon variant="bold" />. */
  icon: string;
  title: string;
  body: string;
}

// Static copy, not backend-driven — matches the Figma export verbatim.
const SAFETY_TIPS: AccordionEntry[] = [
  {
    icon: 'lock',
    title: 'How This Transaction Works',
    body:
      'We will never contact you first. Always interact only within Declut to stay protected. If this item fits your needs, tap "Show Interest" to proceed. Payments are held securely in escrow until you inspect and confirm the item. Once payment is successful, the seller’s details will be shared with you for pickup.',
  },
  {
    icon: 'location',
    title: 'Before You Proceed',
    body: "Please check the item's location and be sure you can access it easily. You'll be responsible for any delivery or transportation costs.",
  },
  {
    icon: 'search-normal',
    title: 'Inspection & Pickup',
    body: 'You are expected to inspect and pick up the item within 48 hours of payment. Only confirm the item if you are fully satisfied with its condition.',
  },
  {
    icon: 'wallet-money',
    title: 'Refunds & Cancellations',
    body: 'If you decide not to proceed after payment (e.g., change of mind or logistics), a 10% service fee may apply. Refunds are processed once all conditions have been met.',
  },
];

const ORDER_PROCESS: AccordionEntry[] = [
  {
    icon: 'lock',
    title: 'Make Payment',
    body: 'To express your interest in the item, please proceed by making the required payment.',
  },
  {
    icon: 'location',
    title: 'Details of the Item Owner/Seller',
    body: "Upon successful payment, you will promptly receive the details of the item's owner or seller. This step finalizes the transaction and is irreversible.",
  },
  {
    icon: 'search-normal',
    title: 'Inspection & Pickup',
    body: 'You are expected to inspect and pick up the item within 48 hours of payment. Only confirm the item if you are fully satisfied with its condition.',
  },
  {
    icon: 'wallet-money',
    title: 'Refunds & Cancellations',
    body: 'If you decide not to proceed after payment (e.g., change of mind or logistics), a 10% service fee may apply. Refunds are processed once all conditions have been met.',
  },
];

export default function ListingDetailsModal() {
  const { id, isMine = 'false', resumeTransactionId } = useLocalSearchParams<{
    id: string;
    isMine?: string;
    /** Set by app/payment-callback.tsx when the Paystack redirect is caught cold (app was
     *  backgrounded/killed mid-checkout) instead of by the live WebView still being mounted. */
    resumeTransactionId?: string;
  }>();
  const isOwnListing = isMine === 'true';
  const { user } = useAuth();
  const guard = useSingleTap();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const heroScrollRef = useRef<ScrollView>(null);

  // Drives the floating back/share header's background fade-in — transparent over the hero,
  // solid once scrolled roughly past it — and the status bar content color riding along with it:
  // light (white) while it's still over the photo, dark (black) once the header goes opaque white.
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

  const queryClient = useQueryClient();
  const [activeIndex, setActiveIndex] = useState(0);
  const [paymentStep, setPaymentStep] = useState<'none' | 'terms' | "summary" | 'success'>('none');
  // The "Pay ₦X to seller?" gate in front of confirmTransaction — an irreversible action.
  const [confirmSheetOpen, setConfirmSheetOpen] = useState(false);
  const [confirmingTransaction, setConfirmingTransaction] = useState(false);
  // In-app checkout — the Paystack page renders inside a WebView instead of handing off to the
  // system browser, so it reads as part of the app rather than a separate app switch.
  const [checkout, setCheckout] = useState<{ transactionId: string; url: string } | null>(null);
  const [confirmingPayment, setConfirmingPayment] = useState(false);
  const [reviewSheetOpen, setReviewSheetOpen] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');

  // `isLoading || isFetching` — pulling to refresh (the RefreshControl below) shows the same
  // full-page skeleton as the initial fetch, not a lightweight native spinner over stale content.
  const {
    data: listing,
    isLoading: isInitialLoading,
    isFetching,
    error: listingQueryError,
    refetch: reloadListing,
  } = useListingDetail(id);
  const loading = isInitialLoading || isFetching;
  const error = listingQueryError ? extractErrorMessage(listingQueryError, 'Could not load this listing.') : null;

  // Refetches on first focus, and again every time this screen regains focus — after paying,
  // confirming inspection/completion, or reporting a problem/requesting a refund on
  // submitReportModal, all of which only ever report back by popping to here.
  useFocusEffect(
    useCallback(() => {
      reloadListing();
    }, [reloadListing])
  );

  // Registers a view 5s after the listing actually loads — the backend owns de-duping (one
  // counted view per viewer/listing per hour), so this just needs to fire once; no toast either
  // way, a view registration is never something the buyer needs to see confirmed or fail. When it
  // actually counts, silently invalidate (no skeleton — this is cosmetic, not a state change worth
  // reloadListing's full-page treatment) so the views count on screen reflects the bump.
  useEffect(() => {
    if (!listing) return;
    const timer = setTimeout(() => {
      listingsApi
        .registerListingView(listing._id)
        .then((result) => {
          if (!result.counted) return;
          // Written straight into the cache instead of invalidateQueries — an invalidate would
          // flip this query's own isFetching (loading below is isInitialLoading || isFetching),
          // which re-triggers the full-page skeleton for what's meant to be an invisible bump.
          listingsApi
            .getListing(listing._id)
            .then((data) => queryClient.setQueryData(queryKeys.listings.detail(listing._id), data))
            .catch(() => {});
        })
        .catch(() => {});
    }, 5000);
    return () => clearTimeout(timer);
  }, [listing, queryClient]);

  // The buyer's transaction behind this listing (pending_sale → awaiting_inspection, sold →
  // completed) — the listing itself doesn't carry a transactionId, so this is found by matching
  // the buyer's own transactions to this listing. Status filter matches the listing status:
  // 'active' maps server-side to awaiting_inspection while pending_sale, 'completed' once sold.
  // Best-effort: only looks at the first page, so a buyer with many simultaneous purchases in the
  // same bucket could miss a match further back.
  const showBuyerTransaction = !!listing && (listing.status === 'pending_sale' || listing.status === 'sold');
  const { data: myTransaction = null } = useMyPurchaseForListing(
    listing?._id,
    listing?.status === 'sold' ? 'completed' : 'active',
    showBuyerTransaction
  );

  // The buyer's own review for this listing, once sold — drives whether Buyer Feedback shows the
  // review or a "rate this seller" prompt.
  const { data: myReview = null } = useReviewForListing(listing?._id, listing?.status === 'sold');

  const checkoutMutation = useCheckoutMutation();
  const confirmTransactionMutation = useConfirmTransactionMutation();
  const cancelTransactionMutation = useCancelTransactionMutation();
  const leaveReviewMutation = useLeaveReviewMutation();

  // Thumbnail taps drive the carousel programmatically; swiping drives activeIndex the other way
  // via the ScrollView's onMomentumScrollEnd below — both paths stay in sync either way.
  function goToMediaIndex(index: number) {
    setActiveIndex(index);
    heroScrollRef.current?.scrollTo({ x: index * screenWidth, animated: true });
  }

  async function handleShare() {
    if (!listing) return;
    try {
      await Share.share({ message: `Check out "${listing.title}" on Declut — ${formatCurrency(listing.price)}` });
    } catch {
      // User cancelled or the native share sheet failed — nothing actionable to surface.
    }
  }

  function handleBuyNow() {
    setPaymentStep('terms');
  }

  function handleConfirmItemFine() {
    setConfirmSheetOpen(true);
  }

  // Buyer's own "item is fine, release my money" action — distinct from confirmCode (that's the
  // seller entering a code the buyer read out to them in person). Same full-screen overlay used
  // while polling for Paystack's webhook confirmation, reused here for the same "waiting on a
  // backend confirmation" feel. On success: the review prompt opens right away while the listing
  // (now 'sold') refetches in the background, so the page is already showing the post-sale
  // content by the time the review sheet is dismissed.
  function handleConfirmPayment() {
    if (!listing || !myTransaction) {
      showErrorToast('Could not confirm', 'Please close this and try again in a moment.');
      return;
    }
    setConfirmSheetOpen(false);
    setConfirmingTransaction(true);
    // onSuccess invalidates this listing's detail query (now 'sold') — it refetches in the
    // background, so the page is already showing the post-sale content by the time the review
    // sheet is dismissed.
    confirmTransactionMutation.mutate(myTransaction._id, {
      onSuccess: () => {
        showSuccessToast('Item confirmed', 'Funds have been released to the seller.');
        setConfirmingTransaction(false);
        setReviewRating(0);
        setReviewComment('');
        setReviewSheetOpen(true);
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

  function handleMakePayment() {
    if (!listing || checkoutMutation.isPending) return;
    if (__DEV__) console.log(`[Checkout] handleMakePayment: POST /transactions — listing=${listing._id} callbackUrl=${PAYSTACK_CALLBACK_URL}`);
    checkoutMutation.mutate(
      { listingId: listing._id, callbackUrl: PAYSTACK_CALLBACK_URL },
      {
        onSuccess: ({ transactionId, paystackAuthorizationUrl }) => {
          if (__DEV__) console.log(`[Checkout] checkout() succeeded — transactionId=${transactionId} url=${paystackAuthorizationUrl}`);
          setCheckout({ transactionId, url: paystackAuthorizationUrl });
        },
        onError: (e) => {
          console.error('[Checkout] handleMakePayment failed', axios.isAxiosError(e) ? { status: e.response?.status, data: e.response?.data } : e);
          showErrorToast('Could not start checkout', extractErrorMessage(e));
        },
      }
    );
  }

  // Polls until escrow_active or attempts run out, showing the confirming overlay throughout.
  // Returns the transaction if confirmed, null otherwise — callers decide what that means (show
  // success vs. treat as unconfirmed) since the two call sites below want different fallback
  // behavior. Used both from the live WebView close path and the cold-launch deep-link resume.
  async function pollForPaymentConfirmation(transactionId: string) {
    if (__DEV__) console.log(`[Checkout] pollForPaymentConfirmation: transaction=${transactionId}`);
    setConfirmingPayment(true);
    try {
      const transaction = await getTransactionResult(transactionId);
      if (__DEV__) console.log(`[Checkout] pollForPaymentConfirmation: ${transaction ? 'CONFIRMED' : 'not confirmed'} — transaction=${transactionId}`);
      if (transaction) {
        // Payment confirmed outside of a mutation (this is a raw poll) — tell every screen that
        // could be showing this listing/transaction to refetch.
        queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all });
        if (transaction.listing?._id) queryClient.invalidateQueries({ queryKey: queryKeys.listings.detail(transaction.listing._id) });
        queryClient.invalidateQueries({ queryKey: queryKeys.listings.lists() });
      }
      return transaction;
    } finally {
      setConfirmingPayment(false);
    }
  }

  // Called whenever the checkout WebView is done, for ANY reason — a detected redirect to
  // PAYSTACK_CALLBACK_URL, or the user tapping the close button. These are deliberately no longer
  // treated differently: Paystack's own checkout page can show its own "payment successful"
  // screen and sit there before it auto-redirects, and a user who sees that often taps our close
  // button immediately rather than waiting — which used to get misread as "abandoned" and
  // cancelled a payment that had actually already gone through (or was about to be confirmed by
  // the webhook a few seconds later). Always ask the backend what actually happened instead of
  // guessing from how the WebView closed.
  async function handleCheckoutClosed() {
    const transactionId = checkout?.transactionId ?? null;
    setCheckout(null);
    if (!transactionId) return;

    const transaction = await pollForPaymentConfirmation(transactionId);
    if (transaction) {
      setPaymentStep('success');
      return;
    }

    // Genuinely never confirmed within the poll window — safe to treat as abandoned now.
    // Frees this buyer to retry checkout on this listing — otherwise the stuck pending_payment
    // transaction blocks a second attempt (see TransactionsService.create()'s existingPending
    // guard). Best-effort: the backend's hourly sweep is the fallback if this fails (network
    // drop, app killed before this resolves) — and the backend's cancel() endpoint itself refuses
    // to cancel anything already past pending_payment, so a webhook that lands a moment after this
    // call can't be clobbered by it.
    showWarningToast('Payment not completed', 'You can try again anytime.');
    cancelTransactionMutation.mutate(transactionId, {
      onSuccess: () => { if (__DEV__) console.log(`[Checkout] cancelled unconfirmed transaction=${transactionId}`); },
      onError: (e) => { if (__DEV__) console.warn(`[Checkout] cancelTransaction failed for transaction=${transactionId} (backend sweep is the fallback)`, e); },
    });
  }

  // Closing the "Transfer Received" sheet: the listing is now pending_sale, so refetch it (not
  // awaited — this screen's own UI reacts to `listing` updating whenever it resolves) and, since
  // the buyer just moved money through the app, nudge them to set up payouts too in case they ever
  // sell something themselves — same check-and-redirect addItemModal.tsx uses after a fresh
  // publish, just triggered by this money-moving moment instead.
  async function handlePaymentSuccessClose() {
    setPaymentStep('none');
    await reloadListing();
    try {
      const profile = await usersApi.getMyProfile();
      if (!profile.hasPayoutDetails) {
        router.replace('/(modals)/payoutDetailsModal');
      }
    } catch (e) {
      if (__DEV__) console.warn('[Checkout] could not check hasPayoutDetails after payment', e);
    }
  }

  // Resumes the confirm/poll/success flow when entered via the cold-launch deep-link path
  // (app/payment-callback.tsx redirects here with this param once it's resolved Paystack's
  // reference to a transaction) — the live-WebView path above already covers the case where this
  // screen never left memory. Waits for `listing` so PaymentSuccessSheet has amount to show, and
  // only runs once even if this screen re-renders.
  const resumedCheckoutRef = useRef(false);
  useEffect(() => {
    if (!resumeTransactionId) return;
    if (__DEV__) console.log(`[Checkout] resume effect fired — listingLoaded=${!!listing} resumeTransactionId=${resumeTransactionId} alreadyResumed=${resumedCheckoutRef.current}`);
    if (!listing || resumedCheckoutRef.current) return;
    resumedCheckoutRef.current = true;
    if (__DEV__) console.log(`[Checkout] resuming from cold-launch deep link — transaction=${resumeTransactionId}`);
    // No `checkout` state to clean up here (this screen was entered fresh via the deep link, not
    // a live WebView session) — so unlike handleCheckoutClosed, an unconfirmed result here just
    // stays pending rather than being cancelled; the buyer can check back or the app's own
    // resume/poll flow will pick it up again.
    pollForPaymentConfirmation(resumeTransactionId).then((transaction) => {
      if (transaction) {
        setPaymentStep('success');
      } else {
        showWarningToast('Still confirming', 'We could not confirm your payment yet — check back shortly.');
      }
    });
  }, [listing, resumeTransactionId]);

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

  return (
    <View style={styles.root}>
      <StatusBar style={statusBarStyle} animated />
      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={reloadListing} tintColor={colors.primary} colors={[colors.primary]} progressBackgroundColor={colors.white} />
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

          {listing.status !== 'active' ? (
            <SellerContactCard
              seller={listing.seller}
              address={listing.address ?? listing.locationLabel}
              coordinates={listing.location.coordinates}
              compact={listing.status === 'sold'}
            />
          ) : null}

          {listing.status === 'pending_sale' ? <EscrowHoldNote amount={myTransaction?.amount ?? listing.price} /> : null}

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

          <View style={styles.accordionGroup}>
            <InfoAccordion title="Safety Tips" items={SAFETY_TIPS} />
            <View style={styles.accordionGroupDivider} />
            <InfoAccordion title="Order Process" items={ORDER_PROCESS} />
          </View>
        </View>
      </Animated.ScrollView>

      <View style={styles.floatingHeaderWrap}>
        <Animated.View style={[styles.floatingHeaderBackground, floatingHeaderStyle]} />
        <View style={[styles.floatingHeaderRow, { paddingTop: insets.top + spacingY.sm }]}>
          <Pressable onPress={guard(() => router.back())} style={styles.floatingHeaderButton} hitSlop={8}>
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

      {!isOwnListing && listing.status !== 'paused' ? (
        <SafeAreaView edges={['bottom']} style={styles.footerSafeArea}>
          {listing.status === 'active' ? (
            <View style={styles.footerPill}>
              <Text style={styles.bottomBarPrice}>{formatCurrency(listing.price)}</Text>
              <Pressable onPress={guard(handleBuyNow)} style={styles.buyButton}>
                <Text style={styles.buyButtonLabel}>Buy Now</Text>
              </Pressable>
            </View>
          ) : listing.status === 'pending_sale' ? (
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
      ) : null}

      {paymentStep !== 'none' ? (
        <View style={StyleSheet.absoluteFill}>
          {paymentStep === 'terms' ? (
            <BeforeYouPaySheet onClose={() => setPaymentStep('none')} onContinue={() => setPaymentStep("summary")} />
          ) : paymentStep === "summary" ? (
            <PaySummarySheet
              listing={listing}
              paying={checkoutMutation.isPending}
              onClose={() => setPaymentStep('none')}
              onCancelPurchase={() => setPaymentStep('none')}
              onMakePayment={handleMakePayment}
            />
          ) : (
            <PaymentSuccessSheet
              amount={listing.price}
              onClose={handlePaymentSuccessClose}
            />
          )}
        </View>
      ) : null}

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

      {checkout ? (
        <PaystackCheckoutWebView
          url={checkout.url}
          onDone={handleCheckoutClosed}
        />
      ) : null}

      {confirmingPayment ? (
        <View style={styles.confirmingOverlay}>
          <ActivityIndicator color={colors.white} size="large" />
          <Text style={styles.confirmingText}>Confirming your payment…</Text>
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

function InfoAccordion({ title, items }: { title: string; items: AccordionEntry[] }) {
  const guard = useSingleTap();
  const [open, setOpen] = useState(false);

  function toggle() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((v) => !v);
  }

  return (
    <View>
      <Pressable onPress={guard(toggle)} style={styles.accordionHeader}>
        <Icon name="info-circle" variant="bold" size={verticalScale(24)} color={colors.rose} />
        <Text style={styles.accordionTitle}>{title}</Text>
        {open ? (
          <Icon name="arrow-up-2" variant="linear" size={verticalScale(20)} color={colors.gray400} />
        ) : (
          <Icon name="arrow-down-2" variant="linear" size={verticalScale(20)} color={colors.gray400} />
        )}
      </Pressable>

      {open ? (
        <View style={styles.accordionBody}>
          {items.map((item, index) => (
            <View key={index} style={styles.accordionRow}>
              <View style={styles.accordionRowIconWrap}>
                <Icon name={item.icon} variant="bold" size={verticalScale(18)} color={colors.primary} />
              </View>
              <View style={styles.accordionRowText}>
                <Text style={styles.accordionRowTitle}>{item.title}</Text>
                <Text style={styles.accordionRowBody}>{item.body}</Text>
              </View>
            </View>
          ))}
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

// Shown once a listing is no longer just browsable (status !== 'active') — pickup contact + location,
// matching the "unlocking the seller's details" step buyers land on after payment. Drops the call
// button/map in compact mode (status === 'sold') since there's no pickup left to arrange.
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

// Only shown while a transaction on this listing is actually holding funds (status === 'pending_sale').
function EscrowHoldNote({ amount }: { amount: number }) {
  const guard = useSingleTap();

  return (
    <View style={styles.escrowCard}>
      <View style={styles.escrowTitleRow}>
        <Icon name="shield-tick" variant="bold" size={verticalScale(18)} color={colors.warning700} />
        <Text style={styles.escrowTitle}>{formatCurrency(amount, 2)} Held In Escrow</Text>
      </View>
      <Text style={styles.escrowBody}>{ESCROW_NOTE_BODY}</Text>
      <Pressable
        onPress={guard(() => showWarningToast('Not available yet', "Extending the inspection window isn't available in the app yet."))}
        hitSlop={8}
      >
        <Text style={styles.escrowExtendLink}>Running Late? Extend by 24 hours (once)</Text>
      </Pressable>
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

interface PaystackCheckoutWebViewProps {
  url: string;
  /** Fired when checkout is done, for any reason — a detected redirect to PAYSTACK_CALLBACK_URL,
   *  or the user closing the WebView manually. Deliberately not distinguished anymore: whether
   *  the payment actually succeeded is resolved by polling the transaction afterward, not by how
   *  the WebView closed. */
  onDone: () => void;
}

// Renders the Paystack checkout page in-app instead of handing off to the system browser, so it
// reads as part of Declut rather than a separate app switch. PAYSTACK_CALLBACK_URL uses our own
// `declut://` scheme, which the WebView can't actually navigate to — onShouldStartLoadWithRequest
// intercepts that specific request and reports it back instead of letting the WebView try (and fail).
function PaystackCheckoutWebView({ url, onDone }: PaystackCheckoutWebViewProps) {
  const guard = useSingleTap();
  const insets = useSafeAreaInsets();
  const [pageLoading, setPageLoading] = useState(true);
  // onShouldStartLoadWithRequest doesn't fire reliably on Android for JS-driven redirects
  // (window.location.href = ...) — onNavigationStateChange is a redundant second check for the
  // same URL prefix so the callback is still caught there. Guards against firing onDone twice if
  // both hooks see the same navigation.
  const redirectFiredRef = useRef(false);

  useEffect(() => {
    if (__DEV__) console.log(`[PaystackCheckoutWebView] mounted — loading url=${url}`);
    return () => {
      if (__DEV__) console.log(`[PaystackCheckoutWebView] unmounted — redirectFired=${redirectFiredRef.current}`);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function maybeFireRedirect(navUrl: string, source: 'shouldStartLoad' | 'navigationStateChange') {
    console.log(`[PaystackCheckoutWebView] nav (${source})`, navUrl);
    if (redirectFiredRef.current) return;
    if (navUrl.startsWith(PAYSTACK_CALLBACK_URL)) {
      console.log(`[PaystackCheckoutWebView] callback URL matched via ${source} — closing`);
      redirectFiredRef.current = true;
      onDone();
    }
  }

  function handleShouldStartLoad(request: ShouldStartLoadRequest) {
    if (__DEV__) console.log('[PaystackCheckoutWebView] onShouldStartLoadWithRequest', request.url);
    if (request.url.startsWith(PAYSTACK_CALLBACK_URL)) {
      maybeFireRedirect(request.url, 'shouldStartLoad');
      return false;
    }
    return true;
  }

  function handleNavigationStateChange(navState: WebViewNavigation) {
    if (__DEV__) console.log(`[PaystackCheckoutWebView] onNavigationStateChange — url=${navState.url} loading=${navState.loading}`);
    maybeFireRedirect(navState.url, 'navigationStateChange');
  }

  return (
    <View style={styles.checkoutOverlay}>
      <View style={[styles.checkoutHeader, { paddingTop: insets.top + spacingY.sm }]}>
        <Pressable onPress={guard(() => { console.log('[PaystackCheckoutWebView] closed via X button'); onDone(); })} hitSlop={8} style={styles.checkoutCloseButton}>
          <Icon name="close-circle" variant="bold" size={verticalScale(24)} color={colors.gray500} />
        </Pressable>
        <Text style={styles.checkoutHeaderTitle}>Secure Checkout</Text>
        <View style={styles.checkoutHeaderSpacer} />
      </View>

      <ErrorBoundary
        fallbackRender={() => <CheckoutWebViewFallback onClose={onDone} />}
        onError={(err) => console.error('[PaystackCheckoutWebView] WebView failed to mount — likely a native module that needs a dev-client rebuild', err)}
      >
        <WebView
          source={{ uri: url }}
          style={styles.checkoutWebView}
          startInLoadingState
          onLoadStart={(e) => { if (__DEV__) console.log('[PaystackCheckoutWebView] onLoadStart', e.nativeEvent.url); }}
          onLoadEnd={(e) => {
            if (__DEV__) console.log('[PaystackCheckoutWebView] onLoadEnd', e.nativeEvent.url);
            setPageLoading(false);
          }}
          onError={(e) => console.error('[PaystackCheckoutWebView] onError', e.nativeEvent)}
          onHttpError={(e) => console.error('[PaystackCheckoutWebView] onHttpError', e.nativeEvent.statusCode, e.nativeEvent.url)}
          onShouldStartLoadWithRequest={handleShouldStartLoad}
          onNavigationStateChange={handleNavigationStateChange}
        />
      </ErrorBoundary>

      {pageLoading ? (
        <View style={styles.checkoutLoadingOverlay}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : null}
    </View>
  );
}

// react-native-webview is a native module — it can't render in a build that was never rebuilt
// with it included (e.g. Expo Go, or a dev client compiled before this dependency was added).
// That failure surfaces as a render-time throw from the native view manager, which a plain
// try/catch around handleMakePayment can't catch — only an error boundary around the WebView itself can.
function CheckoutWebViewFallback({ onClose }: { onClose: () => void }) {
  const guard = useSingleTap();

  return (
    <View style={styles.checkoutErrorWrap}>
      <Icon name="danger" variant="bold" size={verticalScale(48)} color={colors.danger} />
      <Text style={styles.checkoutErrorTitle}>Checkout isn't available on this build</Text>
      <Text style={styles.checkoutErrorBody}>
        In-app checkout needs a newer build of the app. Please update the app and try again.
      </Text>
      <Pressable onPress={guard(onClose)} style={styles.checkoutErrorButton}>
        <Text style={styles.checkoutErrorButtonLabel}>Close</Text>
      </Pressable>
    </View>
  );
}

interface BeforeYouPaySheetProps {
  onClose: () => void;
  onContinue: () => void;
}

// Gate before checkout — same content as the "Safety Tips" accordion, laid out as a numbered
// checklist instead.
function BeforeYouPaySheet({ onClose, onContinue }: BeforeYouPaySheetProps) {
  const guard = useSingleTap();

  return (
    <BottomSheetCard onBackdropPress={guard(onClose)}>
      <Text style={styles.paySheetTitle}>Before you pay</Text>
      <Text style={styles.paySheetSubtitle}>Four things to know — this protects both sides.</Text>

      <ScrollView style={styles.paySheetList} nestedScrollEnabled showsVerticalScrollIndicator>
        {SAFETY_TIPS.map((item, index) => (
          <View key={item.title} style={styles.paySheetRow}>
            <View style={styles.paySheetNumberBadge}>
              <Text style={styles.paySheetNumberText}>{index + 1}</Text>
            </View>
            <View style={styles.paySheetRowText}>
              <Text style={styles.paySheetRowTitle}>{item.title}</Text>
              <Text style={styles.paySheetRowBody}>{item.body}</Text>
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={styles.paySheetButtonGroup}>
        <Pressable onPress={guard(onContinue)} style={styles.paySheetContinueButton}>
          <Text style={styles.paySheetContinueLabel}>I understand - Continue to Payment</Text>
        </Pressable>

        <Pressable onPress={guard(onClose)} hitSlop={8} style={styles.paySheetCancel}>
          <Text style={styles.paySheetCancelLabel}>Cancel</Text>
        </Pressable>
      </View>
    </BottomSheetCard>
  );
}

interface PaySummarySheetProps {
  listing: Listing;
  paying: boolean;
  onClose: () => void;
  onCancelPurchase: () => void;
  onMakePayment: () => void;
}

// Step 2 of checkout — order summary + the actual "pay" trigger. Buttons positioned the same
// way as BeforeYouPaySheet's (full-width primary + a plain text link below it).
function PaySummarySheet({ listing, paying, onClose, onCancelPurchase, onMakePayment }: PaySummarySheetProps) {
  const guard = useSingleTap();
  // This is Paystack's own transaction fee (1.5% + ₦100, waived under ₦2,500, capped at ₦2,000)
  // — not Declut's commissionPercentage, which is a seller-side deduction from the payout, never
  // added to what the buyer pays (see SystemSettings in api/types.ts).
  const fee = calculatePaystackFee(listing.price);
  const total = listing.price + fee;

  return (
    <BottomSheetCard onBackdropPress={paying ? undefined : guard(onClose)}>
      <View style={styles.securePill}>
        <Icon name="shield-tick" variant="bold" size={verticalScale(16)} color={colors.success700} />
        <Text style={styles.securePillText}>100% secure</Text>
      </View>

      <Text style={styles.paySheetTitle}>Pay into Escrow</Text>
      <Text style={styles.paySheetSubtitle}>Declut holds your money. The seller is only paid after you confirm the item.</Text>

      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Item</Text>
          <Text style={styles.summaryValue} numberOfLines={1}>
            {listing.title}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Price</Text>
          <Text style={styles.summaryValue}>{formatCurrency(listing.price, 2)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Processing Fee</Text>
          <Text style={styles.summaryValue}>{formatCurrency(fee, 2)}</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryRow}>
          <Text style={styles.summaryTotalLabel}>Total</Text>
          <Text style={styles.summaryTotalValue}>{formatCurrency(total, 2)}</Text>
        </View>
      </View>

      <View style={styles.paySheetButtonGroup}>
        <Pressable
          onPress={paying ? undefined : guard(onMakePayment)}
          disabled={paying}
          style={[styles.paySheetContinueButton, paying && styles.paySheetContinueButtonLoading]}
        >
          {paying ? <ActivityIndicator color={colors.white} /> : <Text style={styles.paySheetContinueLabel}>Make Payment</Text>}
        </Pressable>

        <Pressable onPress={paying ? undefined : guard(onCancelPurchase)} disabled={paying} hitSlop={8} style={styles.paySheetCancel}>
          <Text style={styles.paySheetCancelLabel}>Cancel Purchase</Text>
        </Pressable>
      </View>
    </BottomSheetCard>
  );
}

interface PaymentSuccessSheetProps {
  amount: number;
  onClose: () => void;
}

// Landed on once polling confirms escrow_active — buyer's confirmationCode isn't shown here per
// the design (just the "unlocking" teaser); it's surfaced via toast on Close since there's no
// dedicated order/transaction screen yet to carry it forward to.
function PaymentSuccessSheet({ amount, onClose }: PaymentSuccessSheetProps) {
  const guard = useSingleTap();

  return (
    <BottomSheetCard onBackdropPress={guard(onClose)}>
      <View style={styles.successIconWrap}>
        <Icon name="tick-circle" variant="bold" size={verticalScale(72)} color={colors.success} />
      </View>
      <Text style={styles.successTitle}>Transfer Received - {formatCurrency(amount, 2)} in Escrow</Text>
      <Text style={styles.successSubtitle}>Unlocking the seller's details…</Text>
      <Pressable onPress={guard(onClose)} style={styles.successCloseButton}>
        <Text style={styles.successCloseLabel}>Close</Text>
      </Pressable>
    </BottomSheetCard>
  );
}

interface ConfirmPaySheetProps {
  amount: number;
  sellerName: string;
  onCancel: () => void;
  onConfirm: () => void;
}

// Gate in front of the pending_sale footer's "Item is Fine - Pay the Seller" button — an
// irreversible action (calls POST /transactions/:id/confirm-transaction, releasing escrow), so it
// gets its own explicit yes/no step rather than firing straight off the footer tap. Closes
// immediately on confirm — the full-screen confirmingOverlay (same one used after Paystack
// checkout) takes over from there while the request is in flight.
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
        <Bone width={verticalScale(110)} height={verticalScale(20)} style={styles.skeletonBlockGap} />
        <Bone width="100%" height={verticalScale(14)} style={styles.skeletonLineGap} />
        <Bone width="100%" height={verticalScale(14)} style={styles.skeletonLineGap} />
        <Bone width="60%" height={verticalScale(14)} style={styles.skeletonBlockGap} />
        <Bone width="50%" height={verticalScale(16)} style={styles.skeletonLineGap} />
        <Bone width="60%" height={verticalScale(16)} style={styles.skeletonBlockGap} />
        <Bone width="100%" height={verticalScale(64)} radius={radius.lg} style={styles.skeletonLineGap} />
        <Bone width="100%" height={verticalScale(64)} radius={radius.lg} />
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
  checkoutOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.white,
    zIndex: 20,
  },
  checkoutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacingX.lg,
    paddingBottom: spacingY.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
  },
  checkoutCloseButton: {
    width: verticalScale(32),
  },
  checkoutHeaderTitle: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.md,
    color: colors.ink,
  },
  checkoutHeaderSpacer: {
    width: verticalScale(32),
  },
  checkoutWebView: {
    flex: 1,
  },
  checkoutLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    top: verticalScale(56),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
  checkoutErrorWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacingX.xl,
    gap: spacingY.sm,
  },
  checkoutErrorTitle: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.lg,
    color: colors.ink,
    textAlign: 'center',
    marginTop: spacingY.sm,
  },
  checkoutErrorBody: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.md,
    color: colors.gray500,
    textAlign: 'center',
    marginBottom: spacingY.md,
  },
  checkoutErrorButton: {
    minHeight: verticalScale(52),
    borderRadius: radius.full,
    borderCurve: 'continuous',
    backgroundColor: colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacingX['3xl'],
  },
  checkoutErrorButtonLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.md,
    color: colors.gray700,
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
  shareButton: {
    left: undefined,
    right: spacingX.xl,
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
  escrowExtendLink: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.md,
    color: colors.warning700,
    textDecorationLine: 'underline',
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
  accordionGroup: {
    marginTop: spacingY.lg,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: colors.gray100,
    overflow: 'hidden',
  },
  accordionGroupDivider: {
    height: 1,
    backgroundColor: colors.gray100,
  },
  accordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingX.md,
    padding: spacingX.lg,
  },
  accordionIconWrap: {
    width: verticalScale(32),
    height: verticalScale(32),
    borderRadius: radius.full,
    borderCurve: 'continuous',
    backgroundColor: colors.dangerLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accordionTitle: {
    flex: 1,
    fontFamily: fontFamily.bold,
    fontSize: fontSize.md,
    color: colors.ink,
  },
  accordionBody: {
    paddingHorizontal: spacingX.lg,
    paddingBottom: spacingY.lg,
    borderTopWidth: 1,
    borderTopColor: colors.gray100,
    gap: spacingY.lg,
  },
  accordionRow: {
    flexDirection: 'row',
    gap: spacingX.md,
    paddingTop: spacingY.lg,
  },
  accordionRowIconWrap: {
    width: verticalScale(36),
    height: verticalScale(36),
    borderRadius: radius.full,
    borderCurve: 'continuous',
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accordionRowText: {
    flex: 1,
    gap: verticalScale(4),
  },
  accordionRowTitle: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.sm,
    color: colors.primary,
  },
  accordionRowBody: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm * 1.5,
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
  footerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingX.md,
    paddingHorizontal: spacingX.md,
    paddingVertical: spacingY.md,
    borderRadius: radius.full,
    borderCurve: 'continuous',
    backgroundColor: colors.gray50,
  },
  bottomBarPrice: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.xl,
    color: colors.ink,
  },
  buyButton: {
    flex: 1,
    minHeight: verticalScale(56),
    borderRadius: radius.full,
    borderCurve: 'continuous',
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacingX.xl,
  },
  buyButtonLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.lg,
    color: colors.white,
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
  paySheetTitle: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xl,
    color: colors.ink,
    textAlign: 'center',
  },
  paySheetSubtitle: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.gray500,
    textAlign: 'center',
    marginBottom: spacingY.lg,
  },
  paySheetList: {
    maxHeight: verticalScale(490),
  },
  paySheetRow: {
    flexDirection: 'row',
    gap: spacingX.md,
    paddingVertical: spacingY.md,
  },
  paySheetNumberBadge: {
    width: verticalScale(28),
    height: verticalScale(28),
    borderRadius: radius.full,
    borderCurve: 'continuous',
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paySheetNumberText: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.sm,
    color: colors.white,
  },
  paySheetRowText: {
    flex: 1,
    gap: verticalScale(4),
  },
  paySheetRowTitle: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.md,
    color: colors.ink,
  },
  paySheetRowBody: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm * 1.5,
    color: colors.gray500,
  },
  paySheetContinueButton: {
    minHeight: verticalScale(56),
    borderRadius: radius.full,
    borderCurve: 'continuous',
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacingX.xl,
  },
  paySheetContinueLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.lg,
    color: colors.white,
  },
  paySheetCancel: {
    alignSelf: 'center',
    paddingVertical: spacingY.md,
  },
  paySheetCancelLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.md,
    color: colors.gray500,
  },
  securePill: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingX.xs,
    backgroundColor: colors.success50,
    borderRadius: radius.full,
    borderCurve: 'continuous',
    paddingHorizontal: spacingX.md,
    paddingVertical: spacingY.xs,
    marginBottom: spacingY.md,
  },
  securePillText: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.sm,
    color: colors.success700,
  },
  summaryCard: {
    backgroundColor: colors.gray50,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: colors.gray100,
    padding: spacingX.lg,
    marginTop: spacingY.xl,
    marginBottom: spacingY.xl,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacingX.md,
    paddingVertical: spacingY.sm,
  },
  summaryLabel: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.gray500,
  },
  summaryValue: {
    flexShrink: 1,
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.sm,
    color: colors.ink,
    textAlign: 'right',
  },
  summaryDivider: {
    height: 1,
    backgroundColor: colors.gray200,
    marginVertical: spacingY.xs,
  },
  summaryTotalLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.md,
    color: colors.ink,
  },
  summaryTotalValue: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.lg,
    color: colors.primary,
  },
  paySheetButtonGroup: {
    paddingTop: spacingY.sm,
    paddingBottom: spacingY.md,
  },
  paySheetContinueButtonLoading: {
    opacity: 0.7,
  },
  successIconWrap: {
    alignSelf: 'center',
    marginTop: spacingY.xl,
    marginBottom: spacingY.xl,
  },
  successTitle: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xl,
    lineHeight: fontSize.xl * 1.3,
    color: colors.ink,
    textAlign: 'center',
    marginBottom: spacingY.sm,
  },
  successSubtitle: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.md,
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
