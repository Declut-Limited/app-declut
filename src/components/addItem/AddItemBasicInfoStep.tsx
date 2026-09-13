import React, { useState } from 'react';
import { ActivityIndicator, Keyboard, Pressable, StyleProp, StyleSheet, Text, TextInput, TextStyle, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import * as Icons from 'phosphor-react-native';
import { CONDITION_OPTIONS } from '@/constants/formOptions';
import { colors, fontFamily, fontSize, radius, spacingX, spacingY } from '@/constants/theme';
import { verticalScale } from '@/utils/styling';
import { useSingleTap } from '@/hooks/useSingleTap';
import type { CreateListingLocation } from '@/api/types';

const GOOGLE_PLACES_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY ?? '';

export interface AddItemBasicInfoStepErrors {
  itemName?: string;
  itemDescription?: string;
  category?: string;
  itemBrand?: string;
  state?: string;
  area?: string;
  address?: string;
  condition?: string;
  hasDefects?: string;
  defectsDescription?: string;
}

export interface AddItemBasicInfoStepProps {
  itemName: string;
  onItemNameChange: (value: string) => void;
  itemDescription: string;
  onItemDescriptionChange: (value: string) => void;
  categoryLabel?: string;
  onOpenCategorySheet: () => void;
  itemBrand: string;
  onItemBrandChange: (value: string) => void;
  state: string;
  onOpenStateSheet: () => void;
  area: string;
  onOpenAreaSheet: () => void;
  /** True while getAreaOptions(state) is being computed after a state is selected — see addItemModal.tsx. */
  areaLoading?: boolean;
  address: string;
  onAddressChange: (value: string) => void;
  /** Set when the address text was picked from a Google Places suggestion; cleared on free-typed edits. */
  onAddressLocationChange: (location: CreateListingLocation | null) => void;
  condition: string;
  onOpenConditionSheet: () => void;
  hasDefects: boolean | null;
  onHasDefectsChange: (value: boolean) => void;
  defectsDescription: string;
  onDefectsDescriptionChange: (value: string) => void;
  errors?: AddItemBasicInfoStepErrors;
}

// "Add Item" — step 1 of 3: Basic Info / Category / Item Location / Item Condition.
export function AddItemBasicInfoStep({
  itemName,
  onItemNameChange,
  itemDescription,
  onItemDescriptionChange,
  categoryLabel,
  onOpenCategorySheet,
  itemBrand,
  onItemBrandChange,
  state,
  onOpenStateSheet,
  area,
  onOpenAreaSheet,
  areaLoading,
  address,
  onAddressChange,
  onAddressLocationChange,
  condition,
  onOpenConditionSheet,
  hasDefects,
  onHasDefectsChange,
  defectsDescription,
  onDefectsDescriptionChange,
  errors = {},
}: AddItemBasicInfoStepProps) {
  const conditionLabel = CONDITION_OPTIONS.find((option) => option.value === condition)?.label;

  return (
    // Owns its own scroll (ScreenContainer renders this with scroll={false} for step 1) so the
    // focused input actually scrolls above the keyboard, not just gets padded away from it.
    <KeyboardAwareScrollView
      style={styles.flex}
      extraScrollHeight={spacingY.sm}
      // enableOnAndroid
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.sectionTitle}>Basic Info</Text>
      <View style={styles.sectionGap}>
        <LabeledInput
          label="Item name"
          placeholder="e.g. Macbook Pro M1 2021"
          value={itemName}
          onChangeText={onItemNameChange}
          error={errors.itemName}
        />
        <LabeledInput
          label="Item description"
          placeholder="Describe the item's features and condition"
          value={itemDescription}
          onChangeText={onItemDescriptionChange}
          multiline
          numberOfLines={4}
          style={styles.multilineInput}
          error={errors.itemDescription}
        />
      </View>

      <Text style={styles.sectionTitle}>Category</Text>
      <View style={styles.sectionGap}>
        <LabeledPicker
          label="Category"
          value={categoryLabel}
          placeholder="Select a category"
          onPress={onOpenCategorySheet}
          error={errors.category}
        />
        <LabeledInput
          label="Item brand"
          placeholder="e.g. Apple"
          value={itemBrand}
          onChangeText={onItemBrandChange}
          error={errors.itemBrand}
        />
      </View>

      <Text style={styles.sectionTitle}>Item Location</Text>
      <View style={styles.sectionGap}>
        <LabeledPicker label="State" value={state} placeholder="Select a state" onPress={onOpenStateSheet} error={errors.state} />
        <LabeledPicker
          label="Area"
          value={area}
          placeholder={areaLoading ? 'Loading areas…' : 'Select a state first'}
          onPress={onOpenAreaSheet}
          disabled={!state || areaLoading}
          loading={areaLoading}
          error={errors.area}
        />
        <LabeledAddressInput
          label="Address"
          placeholder="e.g. 3B Community Road"
          value={address}
          onChangeText={onAddressChange}
          onLocationChange={onAddressLocationChange}
          error={errors.address}
        />
      </View>

      <Text style={styles.sectionTitle}>Item Condition</Text>
      <View style={styles.sectionGap}>
        <LabeledPicker
          label="Select condition"
          value={conditionLabel}
          placeholder="Select the item's condition"
          onPress={onOpenConditionSheet}
          error={errors.condition}
        />

        <View>
          <Text style={styles.defectsLabel}>Does the item have any defect(s)</Text>
          <View style={styles.radioRow}>
            <RadioOption label="Yes" selected={hasDefects === true} onPress={() => onHasDefectsChange(true)} />
            <RadioOption label="No" selected={hasDefects === false} onPress={() => onHasDefectsChange(false)} />
          </View>
          {errors.hasDefects ? <Text style={styles.errorText}>{errors.hasDefects}</Text> : null}
        </View>

        {hasDefects ? (
          <LabeledInput
            label="Describe defects"
            placeholder="Describe the defect(s)"
            value={defectsDescription}
            onChangeText={onDefectsDescriptionChange}
            multiline
            numberOfLines={3}
            style={styles.multilineInputSmall}
            error={errors.defectsDescription}
          />
        ) : null}
      </View>
    </KeyboardAwareScrollView>
  );
}

interface LabeledInputProps {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (value: string) => void;
  multiline?: boolean;
  numberOfLines?: number;
  style?: StyleProp<TextStyle>;
  trailingIcon?: React.ReactNode;
  error?: string;
}

// Label sits inside the field, above the value — not above-and-outside like the shared Input.
function LabeledInput({ label, placeholder, value, onChangeText, multiline, numberOfLines, style, trailingIcon, error }: LabeledInputProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View>
      <View
        style={[
          styles.fieldBox,
          focused && styles.fieldBoxFocused,
          multiline && styles.fieldBoxMultiline,
          error ? styles.fieldBoxError : null,
        ]}
      >
        <View style={styles.fieldTextColumn}>
          <Text style={styles.fieldLabel}>{label}</Text>
          <TextInput
            style={[styles.fieldValue, multiline && styles.multilineText, multiline && style]}
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor={colors.gray400}
            multiline={multiline}
            numberOfLines={numberOfLines}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
          />
        </View>
        {trailingIcon ? <View style={styles.fieldTrailingIcon}>{trailingIcon}</View> : null}
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

interface LabeledAddressInputProps {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (value: string) => void;
  onLocationChange: (location: CreateListingLocation | null) => void;
  error?: string;
}

// Same visual language as LabeledInput/LabeledPicker (label stacked above value, inside one
// bordered box) — the label lives inside `addressBox` alongside the autocomplete field itself,
// rather than the dropdown's own container, so it never gets pushed around as predictions expand
// the box downward. The pin icon rides inside GooglePlacesAutocomplete's own input row (via
// renderRightButton) instead of as an outer row sibling — an outer sibling would re-center
// vertically across the whole box every time the box grows to fit the dropdown.
//
// Selecting a suggestion is the only way `onLocationChange` gets a value — the listing's
// coordinates need to describe the exact same place as the address text, so a free-typed edit
// (which no longer matches any resolved place) clears it back to null rather than leaving a
// stale lat/lng attached to different text.
function LabeledAddressInput({ label, placeholder, value, onChangeText, onLocationChange, error }: LabeledAddressInputProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View>
      <View style={[styles.addressBox, focused && styles.fieldBoxFocused, error ? styles.fieldBoxError : null]}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <GooglePlacesAutocomplete
          placeholder={placeholder}
          query={{ key: GOOGLE_PLACES_API_KEY, language: 'en', components: 'country:ng' }}
          fetchDetails
          enablePoweredByContainer
          keyboardShouldPersistTaps="handled"
          disableScroll
          debounce={300}
          minLength={3}
          onPress={(data, detail) => {
            onChangeText(detail?.formatted_address ?? data.description);
            onLocationChange(detail?.geometry?.location ? { lat: detail.geometry.location.lat, lng: detail.geometry.location.lng } : null);
          }}
          onFail={(err) => console.warn('[GooglePlacesAutocomplete]', err)}
          textInputProps={{
            value,
            onChangeText: (text: string) => {
              onChangeText(text);
              onLocationChange(null);
            },
            placeholder,
            placeholderTextColor: colors.gray400,
            onFocus: () => setFocused(true),
            onBlur: () => setFocused(false),
          }}
          renderRightButton={() => (
            <View style={styles.addressTrailingIcon}>
              <Icons.MapTrifoldIcon size={verticalScale(20)} color={colors.gray400} />
            </View>
          )}
          styles={{
            container: styles.placesContainer,
            textInputContainer: styles.placesInputContainer,
            textInput: styles.placesTextInput,
            listView: styles.placesListView,
            row: styles.placesRow,
            description: styles.placesDescription,
            separator: styles.placesSeparator,
            poweredContainer: styles.placesPoweredContainer,
          }}
        />
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

interface LabeledPickerProps {
  label: string;
  value?: string;
  placeholder: string;
  onPress: () => void;
  disabled?: boolean;
  /** Shows a spinner in place of the chevron — for options computed/fetched after another field changes (e.g. Area after State). */
  loading?: boolean;
  error?: string;
}

function LabeledPicker({ label, value, placeholder, onPress, disabled, loading, error }: LabeledPickerProps) {
  const guard = useSingleTap();

  // A text field could still be focused when a picker is tapped — close the keyboard first so it
  // doesn't linger behind the sheet that's about to open.
  function handlePress() {
    if(Keyboard.isVisible()) {
      Keyboard.dismiss()
      setTimeout(() => {
        onPress();
      }, 100);
    } else {
      onPress();
    }
  }

  return (
    <View>
      <Pressable
        onPress={guard(handlePress)}
        disabled={disabled}
        style={[styles.fieldBox, disabled && styles.fieldBoxDisabled, error ? styles.fieldBoxError : null]}
        accessibilityState={{ disabled }}
      >
        <View style={styles.fieldTextColumn}>
          <Text style={styles.fieldLabel}>{label}</Text>
          <Text style={[styles.fieldValue, !value && styles.fieldValuePlaceholder]}>{value || placeholder}</Text>
        </View>
        {loading ? (
          <ActivityIndicator color={colors.gray400} />
        ) : (
          <Icons.CaretDownIcon size={verticalScale(16)} color={disabled ? colors.gray300 : colors.gray400} />
        )}
      </Pressable>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

function RadioOption({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const guard = useSingleTap();

  return (
    <Pressable onPress={guard(onPress)} style={styles.radioOption} accessibilityRole="radio" accessibilityState={{ selected }}>
      <View style={[styles.radioOuter, selected && styles.radioOuterSelected]}>{selected ? <View style={styles.radioInner} /> : null}</View>
      <Text style={styles.radioLabel}>{label}</Text>
    </Pressable>
  );
}

const FIELD_VALUE_FONT_SIZE = fontSize.md + verticalScale(1);

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  sectionTitle: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.md,
    color: colors.ink,
    marginBottom: spacingY.md,
  },
  sectionGap: {
    gap: spacingY.md,
    marginBottom: spacingY['2xl'],
  },
  fieldBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacingX.sm,
    minHeight: verticalScale(64),
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    backgroundColor: colors.gray50,
    borderWidth: 1,
    borderColor: colors.gray50,
    paddingHorizontal: spacingX.md,
    paddingVertical: spacingY.sm,
  },
  fieldBoxFocused: {
    borderColor: colors.primary,
  },
  fieldBoxError: {
    borderColor: colors.danger,
  },
  fieldBoxDisabled: {
    backgroundColor: colors.gray50,
    opacity: 0.6,
  },
  fieldBoxMultiline: {
    alignItems: 'flex-start',
  },
  fieldTextColumn: {
    flex: 1,
  },
  fieldLabel: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.gray400,
    marginBottom: verticalScale(2),
  },
  errorText: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
    color: colors.danger,
    marginTop: spacingY.xs,
  },
  fieldValue: {
    fontFamily: fontFamily.semibold,
    fontSize: FIELD_VALUE_FONT_SIZE,
    color: colors.gray600,
    padding: 0,
  },
  fieldValuePlaceholder: {
    fontFamily: fontFamily.medium,
    color: colors.gray400,
  },
  fieldTrailingIcon: {
    marginTop: verticalScale(2),
  },
  addressBox: {
    minHeight: verticalScale(64),
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    backgroundColor: colors.gray50,
    borderWidth: 1,
    borderColor: colors.gray50,
    paddingHorizontal: spacingX.md,
    paddingTop: spacingY.sm,
    paddingBottom: spacingY.sm,
    justifyContent: 'center',
  },
  addressTrailingIcon: {
    paddingLeft: spacingX.sm,
  },
  placesContainer: {
    flex: 0,
  },
  placesInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderTopWidth: 0,
    borderBottomWidth: 0,
    paddingHorizontal: 0,
  },
  placesTextInput: {
    flex: 1,
    height: verticalScale(24),
    fontFamily: fontFamily.semibold,
    fontSize: FIELD_VALUE_FONT_SIZE,
    color: colors.gray600,
    backgroundColor: 'transparent',
    marginTop: 0,
    marginBottom: 0,
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  placesListView: {
    backgroundColor: colors.gray50,
    marginTop: spacingY.sm,
  },
  placesRow: {
    paddingVertical: spacingY.sm,
    backgroundColor: colors.gray50,
  },
  placesDescription: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.gray700,
  },
  placesSeparator: {
    height: 1,
    backgroundColor: colors.gray200,
  },
  placesPoweredContainer: {
    justifyContent: 'flex-end',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.gray200,
    backgroundColor: colors.gray50,
    marginTop: spacingY.xs,
  },
  multilineText: {
    textAlignVertical: 'top',
  },
  multilineInput: {
    minHeight: verticalScale(80),
  },
  multilineInputSmall: {
    minHeight: verticalScale(50),
  },
  defectsLabel: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.gray900,
    marginBottom: spacingY.md,
  },
  radioRow: {
    flexDirection: 'row',
    gap: spacingX.xl,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingX.sm,
  },
  radioOuter: {
    width: verticalScale(22),
    height: verticalScale(22),
    borderRadius: radius.full,
    borderCurve: 'continuous',
    borderWidth: 2,
    borderColor: colors.gray300,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterSelected: {
    borderColor: colors.primary,
  },
  radioInner: {
    width: verticalScale(11),
    height: verticalScale(11),
    borderRadius: radius.full,
    borderCurve: 'continuous',
    backgroundColor: colors.primary,
  },
  radioLabel: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.md,
    color: colors.gray900,
  },
});
