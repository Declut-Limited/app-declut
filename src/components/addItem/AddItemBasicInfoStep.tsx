import React, { useState } from 'react';
import { Pressable, StyleProp, StyleSheet, Text, TextInput, TextStyle, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import * as Icons from 'phosphor-react-native';
import { CONDITION_OPTIONS } from '@/constants/formOptions';
import { colors, fontFamily, fontSize, radius, spacingX, spacingY } from '@/constants/theme';
import { verticalScale } from '@/utils/styling';
import { useSingleTap } from '@/hooks/useSingleTap';

export interface AddItemBasicInfoStepErrors {
  itemName?: string;
  itemDescription?: string;
  category?: string;
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
  address: string;
  onAddressChange: (value: string) => void;
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
  address,
  onAddressChange,
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
        <LabeledInput label="Item brand" placeholder="e.g. Apple" value={itemBrand} onChangeText={onItemBrandChange} />
      </View>

      <Text style={styles.sectionTitle}>Item Location</Text>
      <View style={styles.sectionGap}>
        <LabeledPicker label="State" value={state} placeholder="Select a state" onPress={onOpenStateSheet} error={errors.state} />
        <LabeledPicker
          label="Area"
          value={area}
          placeholder="Select a state first"
          onPress={onOpenAreaSheet}
          disabled={!state}
          error={errors.area}
        />
        <LabeledInput
          label="Address"
          placeholder="e.g. 3B Community Road"
          value={address}
          onChangeText={onAddressChange}
          trailingIcon={<Icons.MapTrifoldIcon size={verticalScale(20)} color={colors.gray400} />}
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

interface LabeledPickerProps {
  label: string;
  value?: string;
  placeholder: string;
  onPress: () => void;
  disabled?: boolean;
  error?: string;
}

function LabeledPicker({ label, value, placeholder, onPress, disabled, error }: LabeledPickerProps) {
  const guard = useSingleTap();

  return (
    <View>
      <Pressable
        onPress={guard(onPress)}
        disabled={disabled}
        style={[styles.fieldBox, disabled && styles.fieldBoxDisabled, error ? styles.fieldBoxError : null]}
        accessibilityState={{ disabled }}
      >
        <View style={styles.fieldTextColumn}>
          <Text style={styles.fieldLabel}>{label}</Text>
          <Text style={[styles.fieldValue, !value && styles.fieldValuePlaceholder]}>{value || placeholder}</Text>
        </View>
        <Icons.CaretDownIcon size={verticalScale(16)} color={disabled ? colors.gray300 : colors.gray400} />
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
