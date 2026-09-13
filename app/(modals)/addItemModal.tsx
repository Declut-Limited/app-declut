import React, { useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { BottomSheetCard, ConfirmModal, PermissionModal, ScreenContainer, ScreenHeader } from '@/components';
import Icon from '@/components/Icon';
import { AddItemBasicInfoStep } from '@/components/addItem/AddItemBasicInfoStep';
import type { AddItemBasicInfoStepErrors } from '@/components/addItem/AddItemBasicInfoStep';
import { OptionPickerSheet } from '@/components/addItem/OptionPickerSheet';
import { MediaSourceSheet } from '@/components/addItem/MediaSourceSheet';
import { AddItemMediaStep, REQUIRED_PHOTO_COUNT } from '@/components/addItem/AddItemMediaStep';
import type { MediaSlot } from '@/components/addItem/AddItemMediaStep';
import { AddItemPriceStep } from '@/components/addItem/AddItemPriceStep';
import { AddItemPreviewStep } from '@/components/addItem/AddItemPreviewStep';
import { CONDITION_OPTIONS, NIGERIAN_STATE_OPTIONS, getAreaOptions } from '@/constants/formOptions';
import type { DropdownOption } from '@/constants/formOptions';
import { colors, fontFamily, fontSize, radius, spacingX, spacingY } from '@/constants/theme';
import { verticalScale } from '@/utils/styling';
import { useSingleTap } from '@/hooks/useSingleTap';
import { useAuth } from '@/contexts/AuthContext';
import { showErrorToast, showWarningToast } from '@/lib/toast';
import { validateLength, validateOptionalMaxLength, validatePrice, validateRequired } from '@/lib/validators';
import { mediaApi } from '@/api';
import { extractErrorMessage } from '@/api/client';
import { useCategories } from '@/hooks/queries/useCategories';
import { useCreateListingMutation } from '@/hooks/queries/useListings';
import type { CreateListingLocation, CreateListingPayload, ListingCondition, UploadSignature } from '@/api/types';

const TOTAL_STEPS = 3;
const PREVIEW_STEP = TOTAL_STEPS + 1;

// "Add Item" — steps 1-3 of 3, then a Preview screen beyond the numbered steps.
export default function AddItemModal() {
  const guard = useSingleTap();
  const { user } = useAuth();
  const [step, setStep] = useState(1);

  // Step 1 — Basic Info
  const [itemName, setItemName] = useState('');
  const [itemDescription, setItemDescription] = useState('');
  const [category, setCategory] = useState('');
  const {
    categories,
    loading: categoriesLoading,
    loadingMore: categoriesLoadingMore,
    error: categoriesError,
    hasMore: categoriesHasMore,
    loadMore: loadMoreCategories,
  } = useCategories();
  const [itemBrand, setItemBrand] = useState('');
  const [state, setState] = useState('');
  const [area, setArea] = useState('');
  // getAreaOptions is synchronous (a local country-state-city lookup, no network call), but for a
  // state with a lot of cities it's heavy enough to block the JS thread for a beat right as the
  // picker/sheet would otherwise open — deferring it a tick lets the loading state actually paint
  // first instead of the UI just looking stuck.
  const [areaOptions, setAreaOptions] = useState<DropdownOption[]>([]);
  const [areaOptionsLoading, setAreaOptionsLoading] = useState(false);
  const [address, setAddress] = useState('');
  const [addressLocation, setAddressLocation] = useState<CreateListingLocation | null>(null);
  const [condition, setCondition] = useState('');
  const [activeSheet, setActiveSheet] = useState<'category' | 'condition' | 'state' | 'area' | 'mediaSource' | null>(null);
  // Drives MediaSourceSheet's mode and which pick* handler its options call.
  const [mediaSourceTarget, setMediaSourceTarget] = useState<'photo' | 'video'>('photo');
  // Only set for the hard-denied case — see promptOpenSettings below.
  const [settingsPrompt, setSettingsPrompt] = useState<{ target: string; message: string } | null>(null);
  const [hasDefects, setHasDefects] = useState<boolean | null>(null);
  const [defectsDescription, setDefectsDescription] = useState('');
  const [basicInfoErrors, setBasicInfoErrors] = useState<AddItemBasicInfoStepErrors>({});

  // Step 2 — Media. Each slot uploads to Cloudinary the moment it's picked — `photos`/`video`
  // always reflect upload state (uploading/uploaded/failed), not just local file selection.
  const [photos, setPhotos] = useState<(MediaSlot | undefined)[]>([]);
  const [video, setVideo] = useState<MediaSlot | null>(null);
  const [videoThumbnailUri, setVideoThumbnailUri] = useState<string | null>(null);
  // Bumped whenever a slot is cleared/replaced — an upload that completes for a stale generation
  // is an orphan and gets deleted from Cloudinary instead of being applied.
  const photoUploadGeneration = useRef<Record<number, number>>({});
  const videoUploadGeneration = useRef(0);
  // Gates the actual removePhoto/removeVideo behind a centered confirm modal (not a bottom sheet —
  // this is a plain yes/no, same pattern as ConfirmModal's other uses like logout).
  const [removeTarget, setRemoveTarget] = useState<{ type: 'photo'; index: number } | { type: 'video' } | null>(null);

  // Step 3 — Price
  const [price, setPrice] = useState('');
  const [priceError, setPriceError] = useState<string | undefined>(undefined);

  // Publish
  const createListingMutation = useCreateListingMutation();
  const publishing = createListingMutation.isPending;
  const [publishSuccess, setPublishSuccess] = useState(false);

  const photoCount = photos.filter(Boolean).length;
  const uploadedPhotoCount = photos.filter((p) => p?.status === 'uploaded').length;
  const mediaComplete = uploadedPhotoCount >= REQUIRED_PHOTO_COUNT && video?.status === 'uploaded';

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

  function setPhotoSlot(index: number, slot: MediaSlot | undefined) {
    setPhotos((prev) => {
      const next = [...prev];
      next[index] = slot;
      return next;
    });
  }

  // Shared by the camera (one fresh signature) and library (one signature pulled from a bulk
  // batch) paths — a stale generation (slot cleared/replaced mid-upload) deletes the orphan
  // instead of applying it, so a leftover Cloudinary asset never silently outlives its slot.
  async function uploadPhotoAt(index: number, uri: string, signaturePromise: Promise<UploadSignature>) {
    const generation = (photoUploadGeneration.current[index] = (photoUploadGeneration.current[index] ?? 0) + 1);
    try {
      const signature = await signaturePromise;
      const uploaded = await mediaApi.uploadToCloudinary(uri, signature, 'image');
      if (photoUploadGeneration.current[index] !== generation) {
        mediaApi.deleteImage(uploaded.publicId).catch(() => {});
        return;
      }
      setPhotoSlot(index, { uri, status: 'uploaded', uploaded });
    } catch {
      if (photoUploadGeneration.current[index] !== generation) return;
      setPhotoSlot(index, { uri, status: 'failed' });
      showErrorToast('Upload failed', 'That photo could not be uploaded — try again.');
    }
  }

  function retryPhotoUpload(index: number) {
    const slot = photos[index];
    if (!slot) return;
    setPhotoSlot(index, { uri: slot.uri, status: 'uploading' });
    uploadPhotoAt(index, slot.uri, mediaApi.getUploadSignature());
  }

  // Single capture — fills the next empty slot; sheet is dismissed first.
  async function pickPhotoFromCamera() {
    setActiveSheet(null);
    if (photoCount >= REQUIRED_PHOTO_COUNT) return;
    if (!(await ensureCameraAccess('Allow camera access to take a photo.'))) return;

    try {
      const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 });
      if (result.canceled || !result.assets[0]) return;
      const uri = result.assets[0].uri;
      const emptyIndex = photos.findIndex((p) => !p);
      const slotIndex = emptyIndex === -1 ? photos.length : emptyIndex;
      setPhotoSlot(slotIndex, { uri, status: 'uploading' });
      uploadPhotoAt(slotIndex, uri, mediaApi.getUploadSignature());
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
      const filledSlotIndexes: number[] = [];
      let pickedIndex = 0;
      for (let slot = 0; slot < REQUIRED_PHOTO_COUNT && pickedIndex < picked.length; slot++) {
        if (!next[slot]) {
          next[slot] = { uri: picked[pickedIndex].uri, status: 'uploading' };
          filledSlotIndexes.push(slot);
          pickedIndex++;
        }
      }
      setPhotos(next);

      // One bulk signature call for every newly-filled slot, instead of one call per slot.
      const signatures = mediaApi.getBulkUploadSignatures(filledSlotIndexes.length);
      filledSlotIndexes.forEach((slotIndex, i) => {
        uploadPhotoAt(
          slotIndex,
          next[slotIndex]!.uri,
          signatures.then((list) => list[i])
        );
      });
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

  async function uploadVideo(uri: string) {
    const generation = ++videoUploadGeneration.current;
    setVideo({ uri, status: 'uploading' });
    generateVideoThumbnail(uri);
    try {
      const signature = await mediaApi.getUploadSignature();
      const uploaded = await mediaApi.uploadToCloudinary(uri, signature, 'video');
      if (videoUploadGeneration.current !== generation) {
        mediaApi.deleteImage(uploaded.publicId).catch(() => {});
        return;
      }
      setVideo({ uri, status: 'uploaded', uploaded });
    } catch {
      if (videoUploadGeneration.current !== generation) return;
      setVideo({ uri, status: 'failed' });
      showErrorToast('Upload failed', 'That video could not be uploaded — try again.');
    }
  }

  function retryVideoUpload() {
    if (!video) return;
    uploadVideo(video.uri);
  }

  // The OS's own prompt covers microphone access once recording starts — no separate JS-level check exists.
  async function pickVideoFromCamera() {
    setActiveSheet(null);
    if (!(await ensureCameraAccess('Allow camera access to record a video.'))) return;

    try {
      const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['videos'], quality: 1 });
      if (result.canceled || !result.assets[0]) return;
      uploadVideo(result.assets[0].uri);
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
      uploadVideo(result.assets[0].uri);
    } catch {
      showErrorToast('Something went wrong', 'That video could not be added — try a different one.');
    }
  }

  async function removePhoto(index: number) {
    const slot = photos[index];
    if (!slot) return;
    photoUploadGeneration.current[index] = (photoUploadGeneration.current[index] ?? 0) + 1; // invalidate any in-flight upload
    setPhotoSlot(index, undefined);
    if (slot.uploaded) {
      try {
        await mediaApi.deleteImage(slot.uploaded.publicId);
      } catch {
        // Best-effort — the listing is never submitted with this asset either way.
      }
    }
  }

  async function removeVideo() {
    const slot = video;
    if (!slot) return;
    videoUploadGeneration.current++; // invalidate any in-flight upload
    setVideo(null);
    setVideoThumbnailUri(null);
    if (slot.uploaded) {
      try {
        await mediaApi.deleteImage(slot.uploaded.publicId);
      } catch {
        // Best-effort — the listing is never submitted with this asset either way.
      }
    }
  }

  function confirmRemovePhoto(index: number) {
    if (!photos[index]) return;
    setRemoveTarget({ type: 'photo', index });
  }

  function confirmRemoveVideo() {
    if (!video) return;
    setRemoveTarget({ type: 'video' });
  }

  function handleConfirmRemoveMedia() {
    if (!removeTarget) return;
    if (removeTarget.type === 'photo') removePhoto(removeTarget.index);
    else removeVideo();
    setRemoveTarget(null);
  }

  const categoryLabel = categories.find((c) => c.id === category)?.title;

  function clearBasicInfoError(field: keyof AddItemBasicInfoStepErrors) {
    setBasicInfoErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
  }

  // Item brand is the one optional field in this step — everything else needs a value before Next.
  function validateBasicInfo(): boolean {
    const errors: AddItemBasicInfoStepErrors = {
      itemName: validateLength(itemName, 'Item name', 3, 120),
      itemDescription: validateLength(itemDescription, 'Item description', 10, 2000),
      category: validateRequired(category, 'Category'),
      itemBrand: validateOptionalMaxLength(itemBrand, 'Brand', 60),
      state: validateRequired(state, 'State'),
      area: validateRequired(area, 'Area'),
      // The listing's coordinates come from the selected place, not device GPS — a free-typed
      // address with no matching suggestion tapped has no coordinates to publish with.
      address: validateLength(address, 'Address', 3, 100) ?? (addressLocation ? undefined : 'Please select an address from the suggestions.'),
      condition: validateRequired(condition, 'Item condition'),
      hasDefects: hasDefects === null ? 'Select whether the item has any defects.' : undefined,
      defectsDescription: hasDefects ? validateRequired(defectsDescription, 'Defect description') : undefined,
    };
    setBasicInfoErrors(errors);
    return !Object.values(errors).some(Boolean);
  }

  function handlePrevious() {
    if (step > 1) setStep(step - 1);
  }

  function handleBack() {
    if (step > 1) handlePrevious();
    else router.back();
  }

  function handleNext() {
    if (step === 1) {
      if (!validateBasicInfo()) return;
      setStep(2);
      return;
    }
    if (step === 2) {
      if (mediaComplete) setStep(3);
      return;
    }
    if (step === 3) {
      const error = validatePrice(price);
      if (error) {
        setPriceError(error);
        return;
      }
      setStep(PREVIEW_STEP);
    }
  }

  function handleSelectState(value: string) {
    setState(value);
    setArea(''); // areas are state-dependent — clear a now-invalid selection
    setActiveSheet(null);
    clearBasicInfoError('state');

    // Deferred a tick so the Area field's loading spinner actually paints before the (synchronous
    // but sometimes heavy) lookup runs — see areaOptionsLoading's declaration above.
    setAreaOptionsLoading(true);
    setTimeout(() => {
      setAreaOptions(getAreaOptions(value));
      setAreaOptionsLoading(false);
    }, 0);
  }

  function handlePublish() {
    if (!mediaComplete || publishing || !addressLocation) return;
    const uploadedPhotos = photos.filter((p): p is MediaSlot & { uploaded: NonNullable<MediaSlot['uploaded']> } => !!p?.uploaded);

    const payload: CreateListingPayload = {
      title: itemName.trim(),
      description: itemDescription.trim(),
      categoryId: category,
      price: Number(price),
      brand: itemBrand.trim() || undefined,
      state,
      area,
      address: address.trim(),
      location: addressLocation,
      condition: condition as ListingCondition,
      hasDefect: !!hasDefects,
      defectDescription: hasDefects ? defectsDescription.trim() : undefined,
      images: uploadedPhotos.map((p, index) => ({
        publicId: p.uploaded.publicId,
        url: p.uploaded.url,
        secureUrl: p.uploaded.secureUrl,
        sortOrder: index,
        isPrimary: index === 0,
      })),
      video: video?.uploaded
        ? { publicId: video.uploaded.publicId, url: video.uploaded.url, secureUrl: video.uploaded.secureUrl }
        : undefined,
    };

    createListingMutation.mutate(payload, {
      onSuccess: () => setPublishSuccess(true),
      onError: (e) => showErrorToast('Could not publish listing', extractErrorMessage(e)),
    });
  }

  // Before landing back home, make sure the seller actually has somewhere for payouts to go —
  // skip straight home if they already do, otherwise hand off to its own full-screen modal
  // (replacing this one in the stack, same pattern filterByModal uses for its own handoff).
  function handleSuccessClose() {
    if (user?.hasPayoutDetails) {
      router.dismissTo('/(tabs)/home');
    } else {
      router.replace('/(modals)/payoutDetailsModal');
    }
  }

  const nextDisabled = step === 2 && !mediaComplete;
  const isPreview = step === PREVIEW_STEP;

  return (
    <View style={styles.flex}>
      <ScreenContainer
        background={colors.white}
        // Step 1 owns its own KeyboardAwareScrollView — avoid nesting it inside this ScrollView too.
        scroll={step !== 1}
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
              <Pressable
                onPress={guard(handlePublish)}
                disabled={publishing}
                style={[styles.footerButton, styles.publishButton, publishing && styles.publishButtonLoading]}
              >
                {publishing ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.publishLabel}>Publish Item</Text>
                )}
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
            onItemNameChange={(value) => {
              setItemName(value);
              clearBasicInfoError('itemName');
            }}
            itemDescription={itemDescription}
            onItemDescriptionChange={(value) => {
              setItemDescription(value);
              clearBasicInfoError('itemDescription');
            }}
            categoryLabel={categoryLabel}
            onOpenCategorySheet={() => setActiveSheet('category')}
            itemBrand={itemBrand}
            onItemBrandChange={(value) => {
              setItemBrand(value);
              clearBasicInfoError('itemBrand');
            }}
            state={state}
            onOpenStateSheet={() => setActiveSheet('state')}
            area={area}
            onOpenAreaSheet={() => setActiveSheet('area')}
            areaLoading={areaOptionsLoading}
            address={address}
            onAddressChange={(value) => {
              setAddress(value);
              clearBasicInfoError('address');
            }}
            onAddressLocationChange={setAddressLocation}
            condition={condition}
            onOpenConditionSheet={() => setActiveSheet('condition')}
            hasDefects={hasDefects}
            onHasDefectsChange={(value) => {
              setHasDefects(value);
              clearBasicInfoError('hasDefects');
            }}
            defectsDescription={defectsDescription}
            onDefectsDescriptionChange={(value) => {
              setDefectsDescription(value);
              clearBasicInfoError('defectsDescription');
            }}
            errors={basicInfoErrors}
          />
        ) : step === 2 ? (
          <AddItemMediaStep
            photos={photos}
            onPressPhotoSlot={() => {
              setMediaSourceTarget('photo');
              setActiveSheet('mediaSource');
            }}
            onRemovePhoto={confirmRemovePhoto}
            onRetryPhoto={retryPhotoUpload}
            video={video}
            onPressVideoSlot={() => {
              setMediaSourceTarget('video');
              setActiveSheet('mediaSource');
            }}
            onRemoveVideo={confirmRemoveVideo}
            onRetryVideo={retryVideoUpload}
            videoThumbnailUri={videoThumbnailUri}
          />
        ) : step === 3 ? (
          <AddItemPriceStep
            price={price}
            onPriceChange={(value) => {
              setPrice(value);
              if (priceError) setPriceError(undefined);
            }}
            error={priceError}
          />
        ) : (
          <AddItemPreviewStep
            photos={photos}
            video={video}
            videoThumbnailUri={videoThumbnailUri}
            itemName={itemName}
            itemDescription={itemDescription}
            itemBrand={itemBrand}
            condition={conditionLabel(condition)}
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
                clearBasicInfoError('category');
              }}
              onClose={() => setActiveSheet(null)}
              loading={categoriesLoading}
              error={categoriesError}
              hasMore={categoriesHasMore}
              loadingMore={categoriesLoadingMore}
              onLoadMore={loadMoreCategories}
            />
          ) : activeSheet === 'condition' ? (
            <OptionPickerSheet
              title="Select item condition"
              options={CONDITION_OPTIONS}
              value={condition}
              onSelect={(value) => {
                setCondition(value);
                setActiveSheet(null);
                clearBasicInfoError('condition');
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
              options={areaOptions}
              value={area}
              onSelect={(value) => {
                setArea(value);
                setActiveSheet(null);
                clearBasicInfoError('area');
              }}
              onClose={() => setActiveSheet(null)}
              loading={areaOptionsLoading}
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

      {publishSuccess ? (
        <View style={StyleSheet.absoluteFill}>
          <PublishSuccessSheet onClose={guard(handleSuccessClose)} />
        </View>
      ) : null}

      {removeTarget ? (
        <View style={StyleSheet.absoluteFill}>
          <ConfirmModal
            title={removeTarget.type === 'video' ? 'Remove video?' : 'Remove photo?'}
            message={`This ${removeTarget.type === 'video' ? 'video' : 'photo'} will be removed from your listing.`}
            confirmLabel="Remove"
            onConfirm={guard(handleConfirmRemoveMedia)}
            onCancel={guard(() => setRemoveTarget(null))}
          />
        </View>
      ) : null}
    </View>
  );
}

function conditionLabel(value: string): string {
  return CONDITION_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

// Shown once createListing() actually succeeds, in place of the old toast+immediate-back — the
// user gets a clear confirmation beat before landing back wherever they came from.
function PublishSuccessSheet({ onClose }: { onClose: () => void }) {
  const guard = useSingleTap();

  return (
    <BottomSheetCard onBackdropPress={guard(onClose)}>
      <View style={styles.successIconWrap}>
        <Icon name="tick-circle" variant="bold" size={verticalScale(72)} color={colors.success} />
      </View>
      <Text style={styles.successTitle}>Success</Text>
      <Text style={styles.successSubtitle}>
        Congratulations! Your products are now live and available for potential buyers to explore. Best of luck with
        your sales!
      </Text>
      <Pressable onPress={guard(onClose)} style={styles.successCloseButton}>
        <Text style={styles.successCloseLabel}>Close</Text>
      </Pressable>
    </BottomSheetCard>
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
    // paddingBottom: spacingY.md,
    paddingBottom: spacingY.sm,
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
  publishButtonLoading: {
    opacity: 0.7,
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
  successIconWrap: {
    alignSelf: 'center',
    marginTop: spacingY.xl,
    marginBottom: spacingY.xl,
  },
  successTitle: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xl,
    color: colors.ink,
    textAlign: 'center',
    marginBottom: spacingY.sm,
  },
  successSubtitle: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.md,
    lineHeight: fontSize.md * 1.4,
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
