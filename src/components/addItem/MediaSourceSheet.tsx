import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Icons from 'phosphor-react-native';
import { BottomSheetCard } from '@/components';
import Icon from '@/components/Icon';
import { colors, fontFamily, fontSize, radius, spacingX, spacingY } from '@/constants/theme';
import { verticalScale } from '@/utils/styling';
import { useSingleTap } from '@/hooks/useSingleTap';

interface MediaSourceSheetProps {
  mode: 'photo' | 'video';
  onSelectCamera: () => void;
  onSelectLibrary: () => void;
  onClose: () => void;
}

// Triggered by tapping a photo slot or the video slot in AddItemMediaStep — copy/icons switch on `mode`.
export function MediaSourceSheet({ mode, onSelectCamera, onSelectLibrary, onClose }: MediaSourceSheetProps) {
  const guard = useSingleTap();
  const isVideo = mode === 'video';

  return (
    <BottomSheetCard onBackdropPress={onClose}>
      <View style={styles.header}>
        <Text style={styles.title}>How would you like to add your {isVideo ? 'video' : 'photos'}?</Text>
        <Pressable onPress={guard(onClose)} style={styles.closeButton} hitSlop={8}>
          <Icons.XIcon size={verticalScale(16)} color={colors.gray700} weight="bold" />
        </Pressable>
      </View>

      <SourceOption
        title={isVideo ? 'Record a Video' : 'Take a Photo'}
        subtitle={isVideo ? 'Use your camera to record a new video.' : 'Use your camera to capture a new photo.'}
        icon={
          <Icon name={isVideo ? 'video' : 'camera'} variant="bold" size={verticalScale(20)} color={colors.gray500} />
        }
        onPress={onSelectCamera}
      />
      <SourceOption
        title="Choose from Gallery"
        subtitle={isVideo ? 'Select an existing video from your device.' : 'Select an existing photo from your device.'}
        icon={<Icon name="gallery" variant="bold" size={verticalScale(20)} color={colors.gray500} />}
        onPress={onSelectLibrary}
      />
    </BottomSheetCard>
  );
}

function SourceOption({
  title,
  subtitle,
  icon,
  onPress,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  onPress: () => void;
}) {
  const guard = useSingleTap();

  return (
    <Pressable onPress={guard(onPress)} style={styles.option}>
      <View style={styles.optionText}>
        <Text style={styles.optionTitle}>{title}</Text>
        <Text style={styles.optionSubtitle}>{subtitle}</Text>
      </View>
      {icon}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: spacingY.xl,
  },
  title: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xl,
    color: colors.ink,
    textAlign: 'center',
  },
  closeButton: {
    position: 'absolute',
    right: 0,
    top: -verticalScale(4),
    width: verticalScale(36),
    height: verticalScale(36),
    borderRadius: radius.full,
    borderCurve: 'continuous',
    backgroundColor: colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacingX.md,
    backgroundColor: colors.gray50,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    paddingHorizontal: spacingX.lg,
    paddingVertical: spacingY.lg,
    marginBottom: spacingY.md,
  },
  optionText: {
    flex: 1,
    gap: verticalScale(4),
  },
  optionTitle: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.lg,
    color: colors.gray700,
  },
  optionSubtitle: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: colors.gray400,
  },
});
