import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  LayoutAnimation,
  Platform,
  Pressable,
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
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useVideoPlayer, VideoView } from 'expo-video';
import * as WebBrowser from 'expo-web-browser';
import Animated, {
  Easing,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { BottomSheetCard, EmptyState } from '@/components';
import Icon from '@/components/Icon';
import * as Icons from 'phosphor-react-native';
import { colors, fontFamily, fontSize, radius, spacingX, spacingY } from '@/constants/theme';
import { verticalScale } from '@/utils/styling';
import { useSingleTap } from '@/hooks/useSingleTap';
import { listingsApi, transactionsApi } from '@/api';
import type { Listing } from '@/api/types';
import { extractErrorMessage } from '@/api/client';
import { formatCurrency, formatDate } from '@/utils/helpers';
import { CONDITION_OPTIONS } from '@/constants/formOptions';
import { showErrorToast, showSuccessToast, showWarningToast } from '@/lib/toast';

const PAYSTACK_CALLBACK_URL = 'declut://payment-callback';
const PAYMENT_POLL_INTERVAL_MS = 2000;
const PAYMENT_POLL_MAX_ATTEMPTS = 10;

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Polls until the transaction reaches escrow_active (payment confirmed) or attempts run out. */
async function getTransactionResult(transactionId: string) {
  for (let attempt = 0; attempt < PAYMENT_POLL_MAX_ATTEMPTS; attempt++) {
    await wait(PAYMENT_POLL_INTERVAL_MS);
    try {
      const transaction = await transactionsApi.getTransaction(transactionId);
      if (transaction.status === 'escrow_active') return transaction;
    } catch {
      // Transient failure — keep polling until attempts run out.
    }
  }
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
  const { id } = useLocalSearchParams<{ id: string }>();
  const guard = useSingleTap();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const heroScrollRef = useRef<ScrollView>(null);

  // Drives the floating back/share header's background fade-in — transparent over the hero,
  // solid once scrolled roughly past it.
  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });
  const floatingHeaderStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [HERO_HEIGHT * 0.6, HERO_HEIGHT], [0, 1], 'clamp'),
  }));

  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [paymentStep, setPaymentStep] = useState<'none' | 'terms' | "summary" | 'success'>('none');
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    listingsApi
      .getListing(id)
      .then((data) => {
        console.log('[listingDetailsModal] fetched listing', data);
        if (!cancelled) setListing(data);
      })
      .catch((e) => {
        if (!cancelled) setError(extractErrorMessage(e, 'Could not load this listing.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Registers a view 5s after the listing actually loads — the backend owns de-duping (one
  // counted view per viewer/listing per hour), so this just needs to fire once; no toast either
  // way, a view registration is never something the buyer needs to see confirmed or fail.
  useEffect(() => {
    if (!listing) return;
    const timer = setTimeout(() => {
      listingsApi.registerListingView(listing._id).catch(() => {});
    }, 5000);
    return () => clearTimeout(timer);
  }, [listing]);

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

  async function handleMakePayment() {
    if (!listing || paying) return;
    setPaying(true);
    try {
      const { transactionId, paystackAuthorizationUrl } = await transactionsApi.checkout({
        listingId: listing._id,
        callbackUrl: PAYSTACK_CALLBACK_URL,
      });

      const result = await WebBrowser.openAuthSessionAsync(paystackAuthorizationUrl, PAYSTACK_CALLBACK_URL);
      if (result.type !== 'success') {
        showWarningToast('Payment not completed', 'You can try again anytime.');
        return;
      }

    } catch (e) {
      showErrorToast('Could not start checkout', extractErrorMessage(e));
    } finally {
      setPaying(false);
    }
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

  return (
    <View style={styles.root}>
      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
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
                  <Image key={index} source={{ uri: item.uri }} style={[styles.heroImage, { width: screenWidth }]} resizeMode="cover" />
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
                  <Image source={{ uri: item.uri }} style={styles.thumbnailImage} resizeMode="cover" />
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
              <Icon name="location" variant="bold" size={verticalScale(16)} color={colors.danger} />
              <Text style={styles.metaText} numberOfLines={1}>
                {listing.locationLabel}
              </Text>
            </View>
            {listing.seller?.trustScore !== undefined ? (
              <View style={styles.metaItem}>
                <Icon name="star" variant="bold" size={verticalScale(16)} color={colors.primary} />
                <Text style={styles.metaText}>{listing.seller.trustScore.toFixed(1)}</Text>
              </View>
            ) : null}
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

      <SafeAreaView edges={['bottom']} style={styles.footerSafeArea}>
        <View style={styles.footerPill}>
          <Text style={styles.bottomBarPrice}>{formatCurrency(listing.price)}</Text>
          <Pressable onPress={guard(handleBuyNow)} style={styles.buyButton}>
            <Text style={styles.buyButtonLabel}>Buy Now</Text>
          </Pressable>
        </View>
      </SafeAreaView>

      {paymentStep !== 'none' ? (
        <View style={StyleSheet.absoluteFill}>
          {paymentStep === 'terms' ? (
            <BeforeYouPaySheet onClose={() => setPaymentStep('none')} onContinue={() => setPaymentStep("summary")} />
          ) : paymentStep === "summary" ? (
            <PaySummarySheet
              listing={listing}
              paying={paying}
              onClose={() => setPaymentStep('none')}
              onCancelPurchase={() => setPaymentStep('none')}
              onMakePayment={handleMakePayment}
            />
          ) : (
            <PaymentSuccessSheet
              amount={listing.price}
              onClose={() => {
                setPaymentStep('none');
              }}
            />
          )}
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

// Matches admin settings' buyerServiceFeePercentage (1.5%) — display-only for now; that field
// isn't wired into checkout/payout logic server-side yet, per the Postman collection's own note.
const PAY_FEE_PERCENT = 1.5;

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
  const fee = listing.price * (PAY_FEE_PERCENT / 100);
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
          <Text style={styles.summaryLabel}>Escrow Protection Fee ({PAY_FEE_PERCENT}%)</Text>
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

const HERO_HEIGHT = verticalScale(360);

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
    shadowRadius: 6,a
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
});
