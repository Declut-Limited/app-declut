import React, { useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useVideoPlayer, VideoView } from 'expo-video';
import * as Icons from 'phosphor-react-native';
import { colors, fontFamily, fontSize, radius, spacingX, spacingY } from '@/constants/theme';
import { verticalScale } from '@/utils/styling';
import { useSingleTap } from '@/hooks/useSingleTap';
import { getFilePath } from '@/utils/helpers';

interface MediaItem {
  /** Real, playable source — the video file itself for a video item. */
  uri: string;
  /** Static image for the thumbnail circle — a generated frame for video items. */
  thumbnailUri: string;
  isVideo: boolean;
}

export interface AddItemPreviewStepProps {
  photos: (ImagePicker.ImagePickerAsset | undefined)[];
  video: ImagePicker.ImagePickerAsset | null;
  videoThumbnailUri: string | null;
  itemName: string;
  itemDescription: string;
  itemBrand: string;
  condition: string;
  area: string;
  state: string;
  hasDefects: boolean | null;
  defectsDescription: string;
}

// "Add Item" — Preview, shown after step 3. Review-only: no editing happens on this screen.
export function AddItemPreviewStep({
  photos,
  video,
  videoThumbnailUri,
  itemName,
  itemDescription,
  itemBrand,
  condition,
  area,
  state,
  hasDefects,
  defectsDescription,
}: AddItemPreviewStepProps) {
  const guard = useSingleTap();

  const mediaItems = useMemo<MediaItem[]>(() => {
    const items: MediaItem[] = photos
      .filter((asset): asset is ImagePicker.ImagePickerAsset => !!asset)
      .map((asset) => {
        const uri = getFilePath(asset) ?? '';
        return { uri, thumbnailUri: uri, isVideo: false };
      });
    if (video) {
      const uri = getFilePath(video) ?? '';
      items.push({ uri, thumbnailUri: videoThumbnailUri ?? uri, isVideo: true });
    }
    return items;
  }, [photos, video, videoThumbnailUri]);

  const [activeIndex, setActiveIndex] = useState(0);
  const activeMedia = mediaItems[activeIndex];
  const locationLabel = [area, state].filter(Boolean).join(', ');

  return (
    <View>
      <View style={styles.tipBanner}>
        <Text style={styles.tipText}>
          Before proceeding, kindly review all your provided information for accuracy and completeness. Double-check
          to ensure everything is correct. Your satisfaction is our priority!
        </Text>
      </View>

      <View style={styles.hero}>
        {activeMedia && !activeMedia.isVideo ? (
          <Image source={{ uri: activeMedia.uri }} style={styles.heroImage} resizeMode="cover" />
        ) : activeMedia ? (
          <PlayableHeroVideo uri={activeMedia.uri} />
        ) : (
          <View style={[styles.heroImage, styles.heroEmpty]} />
        )}

        {mediaItems.length > 0 ? (
          <View style={styles.thumbnailRow}>
            {mediaItems.map((item, index) => (
              <Pressable
                key={index}
                onPress={guard(() => setActiveIndex(index))}
                style={[styles.thumbnail, index === activeIndex && styles.thumbnailActive]}
              >
                <Image source={{ uri: item.thumbnailUri }} style={styles.thumbnailImage} resizeMode="cover" />
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
        {condition ? (
          <View style={styles.conditionPill}>
            <Text style={styles.conditionPillText}>{condition}</Text>
          </View>
        ) : null}

        <Text style={styles.title}>{itemName}</Text>

        {locationLabel ? (
          <View style={styles.locationRow}>
            <Icons.MapPinIcon size={verticalScale(16)} weight="fill" color={colors.danger} />
            <Text style={styles.locationText}>{locationLabel}</Text>
          </View>
        ) : null}

        <View style={styles.divider} />

        <Text style={styles.sectionTitle}>Description</Text>
        <Text style={styles.sectionBody}>{itemDescription}</Text>

        {itemBrand ? (
          <Text style={styles.labeledRow}>
            <Text style={styles.labeledRowLabel}>Brand: </Text>
            <Text style={styles.labeledRowValue}>{itemBrand}</Text>
          </Text>
        ) : null}

        {condition ? (
          <Text style={styles.labeledRow}>
            <Text style={styles.labeledRowLabel}>Item Condition: </Text>
            <Text style={styles.labeledRowValue}>{condition}</Text>
          </Text>
        ) : null}

        {hasDefects && defectsDescription ? (
          <>
            <Text style={[styles.sectionTitle, styles.defectsTitle]}>Defects</Text>
            <Text style={styles.sectionBody}>{defectsDescription}</Text>
          </>
        ) : null}
      </View>
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

const styles = StyleSheet.create({
  tipBanner: {
    marginHorizontal: -spacingX['2xl'],
    backgroundColor: colors.warningLight,
    paddingHorizontal: spacingX['2xl'],
    paddingVertical: spacingY.lg,
    marginBottom: spacingY.lg,
  },
  tipText: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    lineHeight: fontSize.md * 1.5,
    color: colors.ink,
  },
  hero: {
    marginHorizontal: -spacingX['2xl'],
    marginBottom: spacingY.xl,
  },
  heroImage: {
    width: '100%',
    aspectRatio: 1.7,
  },
  heroEmpty: {
    backgroundColor: colors.gray100,
  },
  thumbnailRow: {
    position: 'absolute',
    bottom: spacingY.lg,
    left: spacingX.lg,
    flexDirection: 'row',
    gap: spacingX.sm,
  },
  thumbnail: {
    width: verticalScale(64),
    height: verticalScale(64),
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
    gap: verticalScale(2),
  },
  conditionPill: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primaryLight,
    borderRadius: radius.full,
    borderCurve: 'continuous',
    paddingHorizontal: spacingX.md,
    paddingVertical: spacingY.xs,
    marginBottom: spacingY.sm,
  },
  conditionPillText: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.sm,
    color: colors.primary,
  },
  title: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize['2xl'],
    color: colors.ink,
    marginBottom: spacingY.sm,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingX.xs,
    marginBottom: spacingY.lg,
  },
  locationText: {
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
});
