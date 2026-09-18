import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  LayoutAnimation,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
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
import { WebView } from 'react-native-webview';
import type { ShouldStartLoadRequest, WebViewNavigation } from 'react-native-webview/lib/WebViewTypes';
import { ErrorBoundary } from 'react-error-boundary';
import axios from 'axios';
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
import { listingsApi, transactionsApi } from '@/api';
import { queryKeys } from '@/api/queryKeys';
import { useListingDetail } from '@/hooks/queries/useListings';
import { useCancelTransactionMutation, useCheckoutMutation } from '@/hooks/queries/useTransactions';
import { useListingSubscription } from '@/hooks/realtime/useListingSubscription';
import { calculatePaystackFee } from '@/lib/paystackFees';
import type { Listing } from '@/api/types';
import { extractErrorMessage } from '@/api/client';
import { formatCurrency, formatDate, getListingShareMessage } from '@/utils/helpers';
import { CONDITION_OPTIONS } from '@/constants/formOptions';
import { showErrorToast, showWarningToast } from '@/lib/toast';

const PAYSTACK_CALLBACK_URL = 'declut://payment-callback';
const PAYMENT_POLL_INTERVAL_MS = 10000;
const PAYMENT_POLL_MAX_ATTEMPTS = 10;

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

interface ListingNotFoundStateProps {
  message: string;
  onGoBack: () => void;
  onBrowseListings: () => void;
}

// Dedicated full-screen state for a confirmed 404 (listing deleted, or paused and viewed by
// someone other than its owner — see the Postman collection's note on GET /listings/:id) — a step
// up from the plain EmptyState used for every other kind of load failure (network/500), since a
// dead link deserves an actual recovery path, not just an icon and a sentence. `message` is always
// the backend's own error text verbatim (via extractErrorMessage), never rewritten here.
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
  const { refreshUser } = useAuth();
  const guard = useSingleTap();
  // Realtime coverage for a listing this device doesn't own — an owner's own listings already
  // arrive automatically in their personal room (see src/lib/socket.ts), so this is skipped there.
  useListingSubscription(id, !isOwnListing);
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
  // In-app checkout — the Paystack page renders inside a WebView instead of handing off to the
  // system browser, so it reads as part of the app rather than a separate app switch.
  const [checkout, setCheckout] = useState<{ transactionId: string; url: string } | null>(null);
  const [confirmingPayment, setConfirmingPayment] = useState(false);
  // Captured once payment is confirmed (checkout close or cold-launch resume) so the redirect to
  // purchasedListingDetailsModal below can hand it the exact transaction, instead of that screen
  // having to re-derive it via the best-effort "first page of my purchases" lookup.
  const confirmedTransactionIdRef = useRef<string | null>(null);

  const {
    data: listing,
    isLoading: isInitialLoading,
    error: listingQueryError,
    refetch: reloadListing,
  } = useListingDetail(id);
  const error = listingQueryError ? extractErrorMessage(listingQueryError, 'Could not load this listing.') : null;
  const isNotFound = axios.isAxiosError(listingQueryError) && listingQueryError.response?.status === 404;

  // Deliberate reloads (pull-to-refresh, focus-return, post-payment) show the same full-page
  // skeleton as the initial fetch — but useListingDetail's own refetchInterval (see useListings.ts)
  // also flips React Query's isFetching every ~10s while this listing is pending_sale, and that's a
  // silent background poll, not something that should re-trigger the skeleton/RefreshControl spinner
  // every time it ticks. Tracked separately from isFetching so only explicit reloads count.
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

  // Refetches on first focus, and again every time this screen regains focus — after paying,
  // confirming inspection/completion, or reporting a problem/requesting a refund on
  // submitReportModal, all of which only ever report back by popping to here.
  useFocusEffect(
    useCallback(() => {
      reloadListingWithSkeleton();
    }, [reloadListingWithSkeleton])
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

  const checkoutMutation = useCheckoutMutation();
  const cancelTransactionMutation = useCancelTransactionMutation();

  // Thumbnail taps drive the carousel programmatically; swiping drives activeIndex the other way
  // via the ScrollView's onMomentumScrollEnd below — both paths stay in sync either way.
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

  function handleBuyNow() {
    setPaymentStep('terms');
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
          // showErrorToast('Could not start checkout', extractErrorMessage(e));
          showErrorToast(extractErrorMessage(e));
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
      confirmedTransactionIdRef.current = transaction._id;
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

  // Closing the "Transfer Received" sheet: the buyer just moved money through the app, so nudge
  // them to set up payouts too in case they ever sell something themselves (same check-and-redirect
  // addItemModal.tsx uses after a fresh publish, just triggered by this money-moving moment
  // instead) — that path still lands on Home same as it always has, unrelated to this listing.
  // Otherwise, hand off to purchasedListingDetailsModal (which owns all the post-purchase UI:
  // escrow hold, confirm/report, review) and clear this screen from history, so back from there
  // returns to wherever this screen was opened from, not to a "Buy Now" page for an item already
  // bought.
  async function handlePaymentSuccessClose() {
    setPaymentStep('none');
    if (!listing) return;
    try {
      // Refreshes AuthContext's user (totalAmountInEscrow just went up) — also doubles as the
      // hasPayoutDetails check below, so no separate GET /users/me is needed for that.
      const profile = await refreshUser();
      if (!profile.hasPayoutDetails) {
        router.replace('/(modals)/payoutDetailsModal');
        return;
      }
    } catch (e) {
      if (__DEV__) console.warn('[Checkout] could not check hasPayoutDetails after payment', e);
    }
    router.replace({
      pathname: '/(modals)/purchasedListingDetailsModal',
      params: { id: listing._id, transactionId: confirmedTransactionIdRef.current ?? undefined },
    });
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
        confirmedTransactionIdRef.current = transaction._id;
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

  if (isNotFound) {
    return (
      <ListingNotFoundState
        message={error ?? 'This listing could not be found.'}
        onGoBack={() => router.back()}
        onBrowseListings={() => router.replace('/(tabs)/home')}
      />
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

      {/* pending_sale/sold have no footer here — that's purchasedListingDetailsModal's own
          buyer-facing UI now (escrow hold, confirm/report, review). A non-owner viewing a listing
          in either of those statuses just sees "Find Your Next Deal", same as before. */}
      {!isOwnListing ? (
        <SafeAreaView edges={['bottom']} style={styles.footerSafeArea}>
          {listing.status === 'active' ? (
            <View style={styles.footerPill}>
              <Text style={styles.bottomBarPrice}>{formatCurrency(listing.price)}</Text>
              <Pressable onPress={guard(handleBuyNow)} style={styles.buyButton}>
                <Text style={styles.buyButtonLabel}>Buy Now</Text>
              </Pressable>
            </View>
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

interface PaystackCheckoutWebViewProps {
  url: string;
  /** Fired when checkout is done, for any reason — a detected redirect to PAYSTACK_CALLBACK_URL,
   *  or the user closing the WebView manually. Deliberately not distinguished anymore: whether
   *  the payment actually succeeded is resolved by polling the transaction afterward, not by how
   *  the WebView closed. */
  onDone: () => void;
}

// Renders the Paystack checkout page in-app instead of handing off to the system browser, so it reads as part of Declut rather than a separate app switch. PAYSTACK_CALLBACK_URL uses our own `declut://` scheme, which the WebView can't actually navigate to — onShouldStartLoadWithRequest intercepts that specific request and reports it back instead of letting the WebView try (and fail).
function PaystackCheckoutWebView({ url, onDone }: PaystackCheckoutWebViewProps) {
  const guard = useSingleTap();
  const insets = useSafeAreaInsets();
  const [pageLoading, setPageLoading] = useState(true);
  // onShouldStartLoadWithRequest doesn't fire reliably on Android for JS-driven redirects (window.location.href = ...) — onNavigationStateChange is a redundant second check for the same URL prefix so the callback is still caught there. Guards against firing onDone twice if both hooks see the same navigation.
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

// Step 2 of checkout — order summary + the actual "pay" trigger. Buttons positioned the same way as BeforeYouPaySheet's (full-width primary + a plain text link below it).
function PaySummarySheet({ listing, paying, onClose, onCancelPurchase, onMakePayment }: PaySummarySheetProps) {
  const guard = useSingleTap();
  // This is Paystack's own transaction fee (1.5% + ₦100, waived under ₦2,500, capped at ₦2,000) — not Declut's commissionPercentage, which is a seller-side deduction from the payout, never added to what the buyer pays (see SystemSettings in api/types.ts).
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

// Landed on once polling confirms escrow_active — buyer's confirmationCode isn't shown here per the design (just the "unlocking" teaser); it's surfaced via toast on Close since there's no dedicated order/transaction screen yet to carry it forward to.
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
    fontSize: fontSize.md,
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
});
