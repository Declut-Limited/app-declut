import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { ScreenContainer, ScreenHeader } from '@/components';
import { AddItemBasicInfoStep } from '@/components/addItem/AddItemBasicInfoStep';
import { AddItemMediaStep, REQUIRED_PHOTO_COUNT } from '@/components/addItem/AddItemMediaStep';
import { AddItemPriceStep } from '@/components/addItem/AddItemPriceStep';
import { AddItemPreviewStep } from '@/components/addItem/AddItemPreviewStep';
import { colors, fontFamily, fontSize, radius, spacingX, spacingY } from '@/constants/theme';
import { verticalScale } from '@/utils/styling';
import { useSingleTap } from '@/hooks/useSingleTap';
import { showWarningToast } from '@/lib/toast';

const TOTAL_STEPS = 3;
const PREVIEW_STEP = TOTAL_STEPS + 1;

// "Add Item" — steps 1-3 of 3, then a Preview screen beyond the numbered steps. Preview's own
// content isn't designed yet — only the navigation into it (from step 3's Next) was specified.
export default function AddItemModal() {
  const guard = useSingleTap();
  const [step, setStep] = useState(1);

  // Step 1 — Basic Info
  const [itemName, setItemName] = useState('');
  const [itemDescription, setItemDescription] = useState('');
  const [category, setCategory] = useState('');
  const [itemBrand, setItemBrand] = useState('');
  const [state, setState] = useState('');
  const [area, setArea] = useState('');
  const [address, setAddress] = useState('');
  const [condition, setCondition] = useState('');
  const [hasDefects, setHasDefects] = useState<boolean | null>(null);
  const [defectsDescription, setDefectsDescription] = useState('');

  // Step 2 — Media
  const [photos, setPhotos] = useState<(ImagePicker.ImagePickerAsset | undefined)[]>([]);
  const [video, setVideo] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [videoThumbnailUri, setVideoThumbnailUri] = useState<string | null>(null);

  // Step 3 — Price
  const [price, setPrice] = useState('');

  const photoCount = photos.filter(Boolean).length;
  const mediaComplete = photoCount >= REQUIRED_PHOTO_COUNT && video !== null;

  function handlePrevious() {
    if (step > 1) setStep(step - 1);
  }

  function handleBack() {
    if (step > 1) handlePrevious();
    else router.back();
  }

  function handleNext() {
    if (step === 1) {
      setStep(2);
      return;
    }
    if (step === 2) {
      if (mediaComplete) setStep(3);
      return;
    }
    if (step === 3) {
      setStep(PREVIEW_STEP);
    }
  }

  function handlePublish() {
    // Real submission (image upload + POST /listings) comes once the backend contract is provided.
    showWarningToast('Coming soon', "Publishing isn't wired up yet.");
  }

  const nextDisabled = step === 2 && !mediaComplete;
  const isPreview = step === PREVIEW_STEP;

  return (
    <ScreenContainer
      background={colors.white}
      header={
        <ScreenHeader
          title={isPreview ? 'Preview' : 'Add Item'}
          onBack={handleBack}
          rightElement={
            isPreview ? undefined : (
              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>
                  {step}
                </Text>
                <Text style={styles.stepBadgeText}>
                  of
                </Text>
                <Text style={styles.stepBadgeText}>
                  {TOTAL_STEPS}
                </Text>
              </View>
            )
          }
        />
      }
      footer={
        isPreview ? (
          <View style={styles.footer}>
            <Pressable onPress={guard(handlePublish)} style={[styles.footerButton, styles.publishButton]}>
              <Text style={styles.publishLabel}>Publish Item</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.footer}>
            <Pressable
              onPress={guard(handlePrevious)}
              disabled={step === 1}
              style={[styles.footerButton, styles.previousButton]}
              accessibilityState={{ disabled: step === 1 }}
            >
              <Text style={[styles.previousLabel, step === 1 && styles.footerLabelDisabled]}>Previous</Text>
            </Pressable>
            <Pressable
              onPress={guard(handleNext)}
              disabled={nextDisabled}
              style={[styles.footerButton, styles.nextButton, nextDisabled && styles.nextButtonDisabled]}
              accessibilityState={{ disabled: nextDisabled }}
            >
              <Text style={[styles.nextLabel, nextDisabled && styles.footerLabelDisabled]}>
                {step === 3 ? 'Preview Item' : 'Next'}
              </Text>
            </Pressable>
          </View>
        )
      }
    >
      {step === 1 ? (
        <AddItemBasicInfoStep
          itemName={itemName}
          onItemNameChange={setItemName}
          itemDescription={itemDescription}
          onItemDescriptionChange={setItemDescription}
          category={category}
          onCategoryChange={setCategory}
          itemBrand={itemBrand}
          onItemBrandChange={setItemBrand}
          state={state}
          onStateChange={setState}
          area={area}
          onAreaChange={setArea}
          address={address}
          onAddressChange={setAddress}
          condition={condition}
          onConditionChange={setCondition}
          hasDefects={hasDefects}
          onHasDefectsChange={setHasDefects}
          defectsDescription={defectsDescription}
          onDefectsDescriptionChange={setDefectsDescription}
        />
      ) : step === 2 ? (
        <AddItemMediaStep
          photos={photos}
          onPhotosChange={setPhotos}
          video={video}
          onVideoChange={setVideo}
          videoThumbnailUri={videoThumbnailUri}
          onVideoThumbnailUriChange={setVideoThumbnailUri}
        />
      ) : step === 3 ? (
        <AddItemPriceStep price={price} onPriceChange={setPrice} />
      ) : (
        <AddItemPreviewStep
          photos={photos}
          video={video}
          videoThumbnailUri={videoThumbnailUri}
          itemName={itemName}
          itemDescription={itemDescription}
          itemBrand={itemBrand}
          condition={condition}
          area={area}
          state={state}
          hasDefects={hasDefects}
          defectsDescription={defectsDescription}
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  stepBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.gray100,
    borderRadius: radius.full,
    borderCurve: 'continuous',
    paddingHorizontal: spacingX.md,
    paddingVertical: verticalScale(4),
  },
  stepBadgeText: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.sm,
    color: colors.gray700,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingX.md,
    paddingBottom: spacingY.md,
  },
  footerButton: {
    minHeight: verticalScale(56),
    borderRadius: radius.full,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacingX.xl,
  },
  previousButton: {
    backgroundColor: colors.gray100,
  },
  nextButton: {
    flex: 1,
    backgroundColor: colors.primary,
  },
  publishButton: {
    flex: 1,
    backgroundColor: colors.primary,
  },
  publishLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.lg,
    color: colors.white,
  },
  nextButtonDisabled: {
    backgroundColor: colors.gray100,
  },
  previousLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.lg,
    color: colors.gray900,
  },
  nextLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.lg,
    color: colors.white,
  },
  footerLabelDisabled: {
    color: colors.gray400,
  },
});
