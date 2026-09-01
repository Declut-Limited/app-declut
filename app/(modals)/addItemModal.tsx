import React, { useCallback, useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { PermissionModal, ScreenContainer, ScreenHeader } from '@/components';
import { AddItemBasicInfoStep } from '@/components/addItem/AddItemBasicInfoStep';
import { OptionPickerSheet } from '@/components/addItem/OptionPickerSheet';
import { MediaSourceSheet } from '@/components/addItem/MediaSourceSheet';
import { AddItemMediaStep, REQUIRED_PHOTO_COUNT } from '@/components/addItem/AddItemMediaStep';
import { AddItemPriceStep } from '@/components/addItem/AddItemPriceStep';
import { AddItemPreviewStep } from '@/components/addItem/AddItemPreviewStep';
import { CONDITION_OPTIONS, NIGERIAN_STATE_OPTIONS, getAreaOptions } from '@/constants/formOptions';
import { colors, fontFamily, fontSize, radius, spacingX, spacingY } from '@/constants/theme';
import { verticalScale } from '@/utils/styling';
import { useSingleTap } from '@/hooks/useSingleTap';
import { showErrorToast, showWarningToast } from '@/lib/toast';
import { categoriesApi } from '@/api';
import { extractErrorMessage } from '@/api/client';
import type { Category } from '@/api/types';

const TOTAL_STEPS = 3;
const PREVIEW_STEP = TOTAL_STEPS + 1;
const CATEGORY_PAGE_LIMIT = 20;

// "Add Item" — steps 1-3 of 3, then a Preview screen beyond the numbered steps. Preview's own
// content isn't designed yet — only the navigation into it (from step 3's Next) was specified.
export default function AddItemModal() {
  const guard = useSingleTap();
  const [step, setStep] = useState(1);

  // Step 1 — Basic Info
  const [itemName, setItemName] = useState('');
  const [itemDescription, setItemDescription] = useState('');
  const [category, setCategory] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesPage, setCategoriesPage] = useState(1);
  const [categoriesHasMore, setCategoriesHasMore] = useState(true);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoriesLoadingMore, setCategoriesLoadingMore] = useState(false);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const [itemBrand, setItemBrand] = useState('');
  const [state, setState] = useState('');
  const [area, setArea] = useState('');
  const [address, setAddress] = useState('');
  const [condition, setCondition] = useState('');
  const [activeSheet, setActiveSheet] = useState<'category' | 'condition' | 'state' | 'area' | 'mediaSource' | null>(null);
  // Drives MediaSourceSheet's mode and which pick* handler its options call.
  const [mediaSourceTarget, setMediaSourceTarget] = useState<'photo' | 'video'>('photo');
  // Only set for the hard-denied case — see promptOpenSettings below.
  const [settingsPrompt, setSettingsPrompt] = useState<{ target: string; message: string } | null>(null);
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

  // Hard-denied permissions never re-show the OS dialog, so this is the one case that still gets the custom PermissionModal card.
  function promptOpenSettings(target: string, message: string) {
    setSettingsPrompt({ target, message });
  }

  // Goes straight to the OS's own permission dialog — shared by the photo and video camera flows.
  async function ensureCameraAccess(deniedMessage: string): Promise<boolean> {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      if (permission.canAskAgain) {
        showWarningToast('Permission needed', deniedMessage);
      } else {
        promptOpenSettings('your camera', 'Camera access is turned off. Enable it in Settings to take photos and videos for your listing.');
      }
      return false;
    }
    return true;
  }

  async function ensureLibraryAccess(): Promise<boolean> {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      if (permission.canAskAgain) {
        showWarningToast('Permission needed', 'Allow photo library access to upload media.');
      } else {
        promptOpenSettings('your gallery', 'Photo library access is turned off. Enable it in Settings to upload images and videos to Declut.');
      }
      return false;
    }
    return true;
  }

  // Single capture — fills the next empty slot; sheet is dismissed first.
  async function pickPhotoFromCamera() {
    setActiveSheet(null);
    if (photoCount >= REQUIRED_PHOTO_COUNT) return;
    if (!(await ensureCameraAccess('Allow camera access to take a photo.'))) return;

    try {
      const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 });
      if (result.canceled || !result.assets[0]) return;
      const emptyIndex = photos.findIndex((p) => !p);
      const next = [...photos];
      next[emptyIndex === -1 ? photos.length : emptyIndex] = result.assets[0];
      setPhotos(next);
    } catch {
      showErrorToast('Something went wrong', 'That photo could not be added — try again.');
    }
  }

  async function pickPhotosFromLibrary() {
    setActiveSheet(null);
    const remaining = REQUIRED_PHOTO_COUNT - photoCount;
    if (remaining <= 0) return;
    if (!(await ensureLibraryAccess())) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: remaining,
        quality: 1,
      });
      if (result.canceled || result.assets.length === 0) return;

      // Hard cap regardless of what the OS actually returns — never fill more than the 3 required slots.
      const picked = result.assets.slice(0, remaining);
      const next = [...photos];
      let pickedIndex = 0;
      for (let slot = 0; slot < REQUIRED_PHOTO_COUNT && pickedIndex < picked.length; slot++) {
        if (!next[slot]) {
          next[slot] = picked[pickedIndex];
          pickedIndex++;
        }
      }
      setPhotos(next);
    } catch {
      showErrorToast('Something went wrong', 'Those images could not be added — try different ones.');
    }
  }

  async function generateVideoThumbnail(uri: string) {
    try {
      const thumbnail = await VideoThumbnails.getThumbnailAsync(uri, { time: 0 });
      setVideoThumbnailUri(thumbnail.uri);
    } catch {
      setVideoThumbnailUri(null);
    }
  }

  // The OS's own prompt covers microphone access once recording starts — no separate JS-level check exists.
  async function pickVideoFromCamera() {
    setActiveSheet(null);
    if (!(await ensureCameraAccess('Allow camera access to record a video.'))) return;

    try {
      const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['videos'], quality: 1 });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      setVideo(asset);
      await generateVideoThumbnail(asset.uri);
    } catch {
      showErrorToast('Something went wrong', 'That video could not be added — try again.');
    }
  }

  async function pickVideoFromLibrary() {
    setActiveSheet(null);
    if (!(await ensureLibraryAccess())) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], quality: 1 });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      setVideo(asset);
      await generateVideoThumbnail(asset.uri);
    } catch {
      showErrorToast('Something went wrong', 'That video could not be added — try a different one.');
    }
  }

  // Fetched once for the whole modal (not re-fetched every time the sheet opens/closes) — mirrors
  // filterByModal's Categories pagination.
  const loadCategories = useCallback(async (page: number) => {
    if (page === 1) setCategoriesLoading(true);
    else setCategoriesLoadingMore(true);

    try {
      const data = await categoriesApi.getAllCategories({ page, limit: CATEGORY_PAGE_LIMIT });
      setCategories((prev) => (page === 1 ? data.results : [...prev, ...data.results]));
      setCategoriesPage(page);
      setCategoriesHasMore(data.hasMore ?? page * CATEGORY_PAGE_LIMIT < data.total);
      setCategoriesError(null);
    } catch (e) {
      setCategoriesError(extractErrorMessage(e, 'Could not load categories.'));
    } finally {
      setCategoriesLoading(false);
      setCategoriesLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    loadCategories(1);
  }, [loadCategories]);

  const categoryLabel = categories.find((c) => c.id === category)?.title;

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

  function handleSelectState(value: string) {
    setState(value);
    setArea(''); // areas are state-dependent — clear a now-invalid selection
    setActiveSheet(null);
  }

  function handlePublish() {
    // Real submission (image upload + POST /listings) comes once the backend contract is provided.
    showWarningToast('Coming soon', "Publishing isn't wired up yet.");
  }

  const nextDisabled = step === 2 && !mediaComplete;
  const isPreview = step === PREVIEW_STEP;

  return (
    <View style={styles.flex}>
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
            categoryLabel={categoryLabel}
            onOpenCategorySheet={() => setActiveSheet('category')}
            itemBrand={itemBrand}
            onItemBrandChange={setItemBrand}
            state={state}
            onOpenStateSheet={() => setActiveSheet('state')}
            area={area}
            onOpenAreaSheet={() => setActiveSheet('area')}
            address={address}
            onAddressChange={setAddress}
            condition={condition}
            onOpenConditionSheet={() => setActiveSheet('condition')}
            hasDefects={hasDefects}
            onHasDefectsChange={setHasDefects}
            defectsDescription={defectsDescription}
            onDefectsDescriptionChange={setDefectsDescription}
          />
        ) : step === 2 ? (
          <AddItemMediaStep
            photos={photos}
            onPhotosChange={setPhotos}
            onPressPhotoSlot={() => {
              setMediaSourceTarget('photo');
              setActiveSheet('mediaSource');
            }}
            video={video}
            onVideoChange={setVideo}
            onPressVideoSlot={() => {
              setMediaSourceTarget('video');
              setActiveSheet('mediaSource');
            }}
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

      {activeSheet ? (
        <View style={StyleSheet.absoluteFill}>
          {activeSheet === 'mediaSource' ? (
            <MediaSourceSheet
              mode={mediaSourceTarget}
              onSelectCamera={mediaSourceTarget === 'video' ? pickVideoFromCamera : pickPhotoFromCamera}
              onSelectLibrary={mediaSourceTarget === 'video' ? pickVideoFromLibrary : pickPhotosFromLibrary}
              onClose={() => setActiveSheet(null)}
            />
          ) : activeSheet === 'category' ? (
            <OptionPickerSheet
              title="Select category"
              options={categories.map((c) => ({ label: c.title, value: c.id }))}
              value={category}
              onSelect={(value) => {
                setCategory(value);
                setActiveSheet(null);
              }}
              onClose={() => setActiveSheet(null)}
              loading={categoriesLoading}
              error={categoriesError}
              hasMore={categoriesHasMore}
              loadingMore={categoriesLoadingMore}
              onLoadMore={() => loadCategories(categoriesPage + 1)}
            />
          ) : activeSheet === 'condition' ? (
            <OptionPickerSheet
              title="Select item condition"
              options={CONDITION_OPTIONS}
              value={condition}
              onSelect={(value) => {
                setCondition(value);
                setActiveSheet(null);
              }}
              onClose={() => setActiveSheet(null)}
            />
          ) : activeSheet === 'state' ? (
            <OptionPickerSheet
              title="Select state"
              options={NIGERIAN_STATE_OPTIONS}
              value={state}
              onSelect={handleSelectState}
              onClose={() => setActiveSheet(null)}
            />
          ) : (
            <OptionPickerSheet
              title="Select area"
              options={getAreaOptions(state)}
              value={area}
              onSelect={(value) => {
                setArea(value);
                setActiveSheet(null);
              }}
              onClose={() => setActiveSheet(null)}
            />
          )}
        </View>
      ) : null}

      {settingsPrompt ? (
        <View style={StyleSheet.absoluteFill}>
          <PermissionModal
            target={settingsPrompt.target}
            message={settingsPrompt.message}
            onAllow={() => {
              setSettingsPrompt(null);
              Linking.openSettings();
            }}
            onDismiss={() => setSettingsPrompt(null)}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
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
