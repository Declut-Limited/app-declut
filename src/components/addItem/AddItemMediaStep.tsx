import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Icons from 'phosphor-react-native';
import Icon from '@/components/Icon';
import { colors, fontFamily, fontSize, radius, spacingX, spacingY } from '@/constants/theme';
import { verticalScale } from '@/utils/styling';
import { useSingleTap } from '@/hooks/useSingleTap';
import { getFilePath } from '@/utils/helpers';

export const REQUIRED_PHOTO_COUNT = 3;

export interface AddItemMediaStepProps {
  photos: (ImagePicker.ImagePickerAsset | undefined)[];
  onPhotosChange: (photos: (ImagePicker.ImagePickerAsset | undefined)[]) => void;
  onPressPhotoSlot: () => void;
  video: ImagePicker.ImagePickerAsset | null;
  onVideoChange: (video: ImagePicker.ImagePickerAsset | null) => void;
  onPressVideoSlot: () => void;
  videoThumbnailUri: string | null;
  onVideoThumbnailUriChange: (uri: string | null) => void;
}

// "Add Item" — step 2 of 3: 3 photo slots + 1 video slot, plus a selling tip banner.
// Drag-to-reorder isn't wired up yet — the screenshot only shows the copy, not the interaction.
export function AddItemMediaStep({
  photos,
  onPhotosChange,
  onPressPhotoSlot,
  video,
  onVideoChange,
  onPressVideoSlot,
  videoThumbnailUri,
  onVideoThumbnailUriChange,
}: AddItemMediaStepProps) {
  const guard = useSingleTap();

  function removePhoto(slotIndex: number) {
    const next = [...photos];
    next[slotIndex] = undefined;
    onPhotosChange(next);
  }

  function removeVideo() {
    onVideoChange(null);
    onVideoThumbnailUriChange(null);
  }

  return (
    <View>
      <Text style={styles.title}>Pick item's videos and images</Text>

      <View style={styles.photoRow}>
        {Array.from({ length: REQUIRED_PHOTO_COUNT }, (_, index) => {
          const asset = photos[index];
          return (
            <Pressable key={index} onPress={guard(onPressPhotoSlot)} style={[styles.mediaSlot, styles.photoSlot]}>
              {asset ? (
                <>
                  <Image source={{ uri: getFilePath(asset) ?? undefined }} style={styles.slotImage} resizeMode="cover" />
                  <Pressable onPress={guard(() => removePhoto(index))} style={styles.removeButton} hitSlop={8}>
                    <Icons.XCircleIcon size={verticalScale(24)} weight="fill" color={colors.ink} />
                  </Pressable>
                </>
              ) : (
                <PlaceholderGlyph icon={<Icon name="image" variant="linear" size={verticalScale(28)} color={colors.gray400} />} />
              )}
            </Pressable>
          );
        })}
      </View>

      <Pressable onPress={guard(onPressVideoSlot)} style={[styles.mediaSlot, styles.videoSlot]}>
        {video ? (
          <>
            {videoThumbnailUri ? (
              <Image source={{ uri: videoThumbnailUri }} style={styles.slotImage} resizeMode="cover" />
            ) : (
              <View style={[styles.slotImage, styles.videoThumbnailFallback]} />
            )}
            <View style={styles.videoPlayBadge}>
              <Icons.PlayIcon size={verticalScale(16)} weight="fill" color={colors.white} />
            </View>
            <Pressable onPress={guard(removeVideo)} style={styles.removeButton} hitSlop={8}>
              <Icons.XCircleIcon size={verticalScale(24)} weight="fill" color={colors.ink} />
            </Pressable>
          </>
        ) : (
          <PlaceholderGlyph icon={<Icons.FilmStripIcon size={verticalScale(28)} color={colors.gray400} />} />
        )}
      </Pressable>

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
  videoThumbnailFallback: {
    backgroundColor: colors.gray100,
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
