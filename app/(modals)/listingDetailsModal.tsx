import React, { useEffect, useState } from 'react';
import {
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
  View,
  ViewStyle,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useVideoPlayer, VideoView } from 'expo-video';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import * as Icons from 'phosphor-react-native';
import { Button, EmptyState } from '@/components';
import { colors, fontFamily, fontSize, radius, spacingX, spacingY } from '@/constants/theme';
import { verticalScale } from '@/utils/styling';
import { useSingleTap } from '@/hooks/useSingleTap';
import { listingsApi } from '@/api';
import type { Listing } from '@/api/types';
import { extractErrorMessage } from '@/api/client';
import { formatCurrency, formatDate } from '@/utils/helpers';
import { CONDITION_OPTIONS } from '@/constants/formOptions';
import { showWarningToast } from '@/lib/toast';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface MediaItem {
  uri: string;
  isVideo: boolean;
}

interface AccordionEntry {
  icon: React.ComponentType<{ size?: number; color?: string; weight?: 'regular' | 'bold' | 'fill' | 'duotone' | 'thin' | 'light' }>;
  title: string;
  body: string;
}

// Static copy, not backend-driven — matches the Figma export verbatim.
const SAFETY_TIPS: AccordionEntry[] = [
  {
    icon: Icons.LockIcon,
    title: 'How This Transaction Works',
    body:
      'We will never contact you first. Always interact only within Declut to stay protected. If this item fits your needs, tap "Show Interest" to proceed. Payments are held securely in escrow until you inspect and confirm the item. Once payment is successful, the seller’s details will be shared with you for pickup.',
  },
  {
    icon: Icons.MapPinIcon,
    title: 'Before You Proceed',
    body: "Please check the item's location and be sure you can access it easily. You'll be responsible for any delivery or transportation costs.",
  },
  {
    icon: Icons.MagnifyingGlassIcon,
    title: 'Inspection & Pickup',
    body: 'You are expected to inspect and pick up the item within 48 hours of payment. Only confirm the item if you are fully satisfied with its condition.',
  },
  {
    icon: Icons.WalletIcon,
    title: 'Refunds & Cancellations',
    body: 'If you decide not to proceed after payment (e.g., change of mind or logistics), a 10% service fee may apply. Refunds are processed once all conditions have been met.',
  },
];

const ORDER_PROCESS: AccordionEntry[] = [
  {
    icon: Icons.LockIcon,
    title: 'Make Payment',
    body: 'To express your interest in the item, please proceed by making the required payment.',
  },
  {
    icon: Icons.MapPinIcon,
    title: 'Details of the Item Owner/Seller',
    body: "Upon successful payment, you will promptly receive the details of the item's owner or seller. This step finalizes the transaction and is irreversible.",
  },
  {
    icon: Icons.MagnifyingGlassIcon,
    title: 'Inspection & Pickup',
    body: 'You are expected to inspect and pick up the item within 48 hours of payment. Only confirm the item if you are fully satisfied with its condition.',
  },
  {
    icon: Icons.WalletIcon,
    title: 'Refunds & Cancellations',
    body: 'If you decide not to proceed after payment (e.g., change of mind or logistics), a 10% service fee may apply. Refunds are processed once all conditions have been met.',
  },
];

export default function ListingDetailsModal() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const guard = useSingleTap();
  const insets = useSafeAreaInsets();

  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

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

  async function handleShare() {
    if (!listing) return;
    try {
      await Share.share({ message: `Check out "${listing.title}" on Declut — ${formatCurrency(listing.price)}` });
    } catch {
      // User cancelled or the native share sheet failed — nothing actionable to surface.
    }
  }

  function handleBuyNow() {
    showWarningToast('Coming soon', "Checkout isn't built yet.");
  }

  if (loading) {
    return (
      <View style={styles.root}>
        <StatusBar style="light" />
        <ListingDetailsSkeleton />
        <Pressable
          onPress={guard(() => router.back())}
          style={[styles.overlayButton, { top: insets.top + spacingY.sm }]}
          hitSlop={8}
        >
          <Icons.ArrowLeftIcon size={verticalScale(20)} color={colors.gray900} />
        </Pressable>
      </View>
    );
  }

  if (error || !listing) {
    return (
      <SafeAreaView style={styles.centerFlex} edges={['top', 'bottom']}>
        <Pressable onPress={guard(() => router.back())} style={[styles.overlayButton, styles.plainBackButton]} hitSlop={8}>
          <Icons.ArrowLeftIcon size={verticalScale(20)} color={colors.gray900} />
        </Pressable>
        <EmptyState icon={Icons.WarningCircleIcon} message={error ?? 'Listing not found.'} />
      </SafeAreaView>
    );
  }

  const mediaItems: MediaItem[] = [
    ...listing.images.map((img) => ({ uri: img.secureUrl, isVideo: false })),
    ...(listing.video ? [{ uri: listing.video.secureUrl, isVideo: true }] : []),
  ];
  const activeMedia = mediaItems[activeIndex];
  const conditionLabel = CONDITION_OPTIONS.find((option) => option.value === listing.condition)?.label ?? listing.condition;

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.hero}>
          {activeMedia && !activeMedia.isVideo ? (
            <Image source={{ uri: activeMedia.uri }} style={styles.heroImage} resizeMode="cover" />
          ) : activeMedia ? (
            <PlayableHeroVideo uri={activeMedia.uri} />
          ) : (
            <View style={[styles.heroImage, styles.heroEmpty]} />
          )}

          <Pressable
            onPress={guard(() => router.back())}
            style={[styles.overlayButton, { top: insets.top + spacingY.sm }]}
            hitSlop={8}
          >
            <Icons.ArrowLeftIcon size={verticalScale(20)} color={colors.gray900} />
          </Pressable>
          <Pressable
            onPress={guard(handleShare)}
            style={[styles.overlayButton, styles.shareButton, { top: insets.top + spacingY.sm }]}
            hitSlop={8}
          >
            <Icons.ShareIcon size={verticalScale(20)} color={colors.gray900} />
          </Pressable>

          {mediaItems.length > 1 ? (
            <View style={styles.thumbnailRow}>
              {mediaItems.map((item, index) => (
                <Pressable
                  key={index}
                  onPress={guard(() => setActiveIndex(index))}
                  style={[styles.thumbnail, index === activeIndex && styles.thumbnailActive]}
                >
                  <Image source={{ uri: item.uri }} style={styles.thumbnailImage} resizeMode="cover" />
                  {item.isVideo ? (
                    <View style={styles.thumbnailPlayOverlay}>
                      <Icons.PlayIcon size={verticalScale(16)} weight="fill" color={colors.white} />
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
              <Icons.MapPinIcon size={verticalScale(16)} weight="fill" color={colors.danger} />
              <Text style={styles.metaText} numberOfLines={1}>
                {listing.locationLabel}
              </Text>
            </View>
            {listing.seller?.trustScore !== undefined ? (
              <View style={styles.metaItem}>
                <Icons.StarIcon size={verticalScale(16)} weight="fill" color={colors.primary} />
                <Text style={styles.metaText}>{listing.seller.trustScore.toFixed(1)}</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>Description</Text>
          <Text style={styles.sectionBody}>{listing.description}</Text>

          {listing.brand ? (
            <Text style={styles.labeledRow}>
              <Text style={styles.labeledRowLabel}>Brand: </Text>
              <Text style={styles.labeledRowValue}>{listing.brand}</Text>
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
            <InfoAccordion title="Order Process" items={ORDER_PROCESS} />
          </View>
        </View>
      </ScrollView>

      <SafeAreaView edges={['bottom']} style={styles.bottomBar}>
        <Text style={styles.bottomBarPrice}>{formatCurrency(listing.price, 2)}</Text>
        <View style={styles.buyButton}>
          <Button label="Buy Now" onPress={guard(handleBuyNow)} />
        </View>
      </SafeAreaView>
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
    <View style={styles.accordion}>
      <Pressable onPress={guard(toggle)} style={styles.accordionHeader}>
        <View style={styles.accordionIconWrap}>
          <Icons.WarningIcon size={verticalScale(16)} weight="fill" color={colors.warning} />
        </View>
        <Text style={styles.accordionTitle}>{title}</Text>
        {open ? (
          <Icons.CaretUpIcon size={verticalScale(18)} color={colors.gray400} />
        ) : (
          <Icons.CaretDownIcon size={verticalScale(18)} color={colors.gray400} />
        )}
      </Pressable>

      {open ? (
        <View style={styles.accordionBody}>
          {items.map((item, index) => (
            <View key={index} style={styles.accordionRow}>
              <View style={styles.accordionRowIconWrap}>
                <item.icon size={verticalScale(18)} weight="bold" color={colors.primary} />
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
    paddingHorizontal: spacingX['2xl'],
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
    color: colors.warning,
  },
  title: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize['2xl'],
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
    gap: spacingY.md,
  },
  accordion: {
    backgroundColor: colors.cardBackground,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: colors.gray100,
    overflow: 'hidden',
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
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingX.lg,
    paddingHorizontal: spacingX['2xl'],
    paddingTop: spacingY.md,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.gray100,
  },
  bottomBarPrice: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xl,
    color: colors.ink,
  },
  buyButton: {
    flex: 1,
  },
});
