import React from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Icons from 'phosphor-react-native';
import Icon from '@/components/Icon';
import { colors, fontFamily, fontSize, radius, spacingX, spacingY } from '@/constants/theme';
import { verticalScale } from '@/utils/styling';
import { useSingleTap } from '@/hooks/useSingleTap';
import type { CloudinaryMediaRef } from '@/api/types';

export const REQUIRED_PHOTO_COUNT = 3;

/** A picked photo/video slot, tracked through its Cloudinary upload. */
export interface MediaSlot {
  /** Local file URI — used for the on-screen preview regardless of upload status. */
  uri: string;
  status: 'uploading' | 'uploaded' | 'failed';
  /** Present once status === 'uploaded'. */
  uploaded?: CloudinaryMediaRef;
}

export interface AddItemMediaStepProps {
  photos: (MediaSlot | undefined)[];
  onPressPhotoSlot: () => void;
  onRemovePhoto: (index: number) => void;
  onRetryPhoto: (index: number) => void;
  video: MediaSlot | null;
  onPressVideoSlot: () => void;
  onRemoveVideo: () => void;
  onRetryVideo: () => void;
  videoThumbnailUri: string | null;
}

// "Add Item" — step 2 of 3: 3 photo slots + 1 video slot, plus a selling tip banner. Every slot
// uploads to Cloudinary as soon as it's picked (see addItemModal.tsx) — this component only
// renders whatever upload state it's handed, it doesn't own the upload itself.
export function AddItemMediaStep({
  photos,
  onPressPhotoSlot,
  onRemovePhoto,
  onRetryPhoto,
  video,
  onPressVideoSlot,
  onRemoveVideo,
  onRetryVideo,
  videoThumbnailUri,
}: AddItemMediaStepProps) {
  const guard = useSingleTap();

  return (
    <View>
      <Text style={styles.title}>Pick item's videos and images</Text>

      <View style={styles.photoRow}>
        {Array.from({ length: REQUIRED_PHOTO_COUNT }, (_, index) => {
          const slot = photos[index];
          return (
            <MediaSlotView
              key={index}
              slot={slot}
              slotStyle={styles.photoSlot}
              placeholderIcon={<Icon name="image" variant="linear" size={verticalScale(28)} color={colors.gray400} />}
              onPress={guard(slot?.status === 'failed' ? () => onRetryPhoto(index) : onPressPhotoSlot)}
              onRemove={guard(() => onRemovePhoto(index))}
            />
          );
        })}
      </View>

      <MediaSlotView
        slot={video}
        slotStyle={styles.videoSlot}
        placeholderIcon={<Icons.FilmStripIcon size={verticalScale(28)} color={colors.gray400} />}
        thumbnailUri={videoThumbnailUri ?? undefined}
        isVideo
        onPress={guard(video?.status === 'failed' ? onRetryVideo : onPressVideoSlot)}
        onRemove={guard(onRemoveVideo)}
      />

      <Text style={styles.helperText}>Tap to edit, drag to reorder</Text>
      <Text style={styles.requirementText}>3 photos and 1 video required</Text>

      <View style={styles.tipBanner}>
        <Text style={styles.tipText}>
          Highlight its condition and test its functionality. It helps buyers make informed decisions. Happy selling!
        </Text>
      </View>
    </View>
  );
}

interface MediaSlotViewProps {
  slot: MediaSlot | null | undefined;
  slotStyle: object;
  placeholderIcon: React.ReactNode;
  thumbnailUri?: string;
  isVideo?: boolean;
  onPress: () => void;
  onRemove: () => void;
}

function MediaSlotView({ slot, slotStyle, placeholderIcon, thumbnailUri, isVideo, onPress, onRemove }: MediaSlotViewProps) {
  if (!slot) {
    return (
      <Pressable onPress={onPress} style={[styles.mediaSlot, slotStyle]}>
        <PlaceholderGlyph icon={placeholderIcon} />
      </Pressable>
    );
  }

  // For a photo, the local file itself is the preview. For a video, only the generated thumbnail
  // is renderable as an <Image> — the raw video file isn't, so show a plain fallback until it's ready.
  const previewUri = isVideo ? thumbnailUri : slot.uri;

  return (
    <Pressable onPress={onPress} style={[styles.mediaSlot, slotStyle]}>
      {slot.status === 'failed' ? (
        <View style={[styles.slotImage, styles.failedOverlay]}>
          <Icons.WarningCircleIcon size={verticalScale(24)} weight="fill" color={colors.danger} />
          <Text style={styles.failedText}>Tap to retry</Text>
        </View>
      ) : (
        <>
          {previewUri ? (
            <Image source={{ uri: previewUri }} style={styles.slotImage} resizeMode="cover" />
          ) : (
            <View style={[styles.slotImage, styles.videoThumbnailFallback]} />
          )}
          {slot.status === 'uploading' ? (
            <View style={styles.uploadingOverlay}>
              <ActivityIndicator color={colors.white} />
            </View>
          ) : null}
          {isVideo && slot.status === 'uploaded' ? (
            <View style={styles.videoPlayBadge}>
              <Icons.PlayIcon size={verticalScale(16)} weight="fill" color={colors.white} />
            </View>
          ) : null}
        </>
      )}
      <Pressable onPress={onRemove} style={styles.removeButton} hitSlop={8}>
        <Icons.XCircleIcon size={verticalScale(24)} weight="fill" color={colors.ink} />
      </Pressable>
    </Pressable>
  );
}

function PlaceholderGlyph({ icon }: { icon: React.ReactNode }) {
  return (
    <View style={styles.placeholderWrap}>
      {icon}
      <View style={styles.addBadge}>
        <Icons.PlusIcon size={verticalScale(10)} color={colors.white} weight="bold" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xl,
    lineHeight: fontSize.xl * 1.3,
    color: colors.ink,
    marginBottom: spacingY.xl,
  },
  photoRow: {
    flexDirection: 'row',
    gap: spacingX.md,
    marginBottom: spacingY.md,
  },
  mediaSlot: {
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.gray300,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photoSlot: {
    flex: 1,
    aspectRatio: 1,
  },
  videoSlot: {
    width: '100%',
    aspectRatio: 3,
    marginBottom: spacingY.lg,
  },
  slotImage: {
    width: '100%',
    height: '100%',
  },
  videoThumbnailFallback: {
    backgroundColor: colors.gray100,
  },
  uploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(17, 24, 39, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  failedOverlay: {
    backgroundColor: colors.dangerLight,
    alignItems: 'center',
    justifyContent: 'center',
    gap: verticalScale(4),
  },
  failedText: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.xs,
    color: colors.danger,
  },
  placeholderWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBadge: {
    position: 'absolute',
    bottom: -4,
    right: -12,
    width: verticalScale(20),
    height: verticalScale(20),
    borderRadius: radius.full,
    borderCurve: 'continuous',
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.white,
  },
  removeButton: {
    position: 'absolute',
    top: spacingY.xs,
    right: spacingX.xs,
  },
  videoPlayBadge: {
    position: 'absolute',
    width: verticalScale(40),
    height: verticalScale(40),
    borderRadius: radius.full,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(17, 24, 39, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  helperText: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.gray400,
  },
  requirementText: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.gray500,
    marginBottom: spacingY.xl,
  },
  tipBanner: {
    backgroundColor: colors.warning25,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    padding: spacingX.lg,
  },
  tipText: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    lineHeight: fontSize.md * 1.5,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
