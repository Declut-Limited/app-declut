import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Icons from 'phosphor-react-native';
import { Input } from '@/components';
import { CONDITION_OPTIONS } from '@/constants/formOptions';
import { colors, fontFamily, fontSize, radius, spacingX, spacingY } from '@/constants/theme';
import { verticalScale } from '@/utils/styling';
import { useSingleTap } from '@/hooks/useSingleTap';

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
}: AddItemBasicInfoStepProps) {
  const conditionLabel = CONDITION_OPTIONS.find((option) => option.value === condition)?.label;

  return (
    <View>
      <Text style={styles.sectionTitle}>Basic Info</Text>
      <View style={styles.sectionGap}>
        <Input label="Item name" placeholder="e.g. Macbook Pro M1 2021" value={itemName} onChangeText={onItemNameChange} />
        <Input
          label="Item description"
          placeholder="Describe the item's features and condition"
          value={itemDescription}
          onChangeText={onItemDescriptionChange}
          multiline
          numberOfLines={4}
          style={styles.multilineInput}
        />
      </View>

      <Text style={styles.sectionTitle}>Category</Text>
      <View style={styles.sectionGap}>
        <PickerField label="Category" value={categoryLabel} placeholder="Select a category" onPress={onOpenCategorySheet} />
        <Input label="Item brand" placeholder="e.g. Apple" value={itemBrand} onChangeText={onItemBrandChange} />
      </View>

      <Text style={styles.sectionTitle}>Item Location</Text>
      <View style={styles.sectionGap}>
        <PickerField label="State" value={state} placeholder="Select a state" onPress={onOpenStateSheet} />
        <PickerField
          label="Area"
          value={area}
          placeholder="Select a state first"
          onPress={onOpenAreaSheet}
          disabled={!state}
        />
        <Input
          label="Address"
          placeholder="e.g. 3B Community Road"
          value={address}
          onChangeText={onAddressChange}
          customIcon={<Icons.MapTrifoldIcon size={verticalScale(20)} color={colors.gray400} />}
        />
      </View>

      <Text style={styles.sectionTitle}>Item Condition</Text>
      <View style={styles.sectionGap}>
        <PickerField
          label="Select condition"
          value={conditionLabel}
          placeholder="Select the item's condition"
          onPress={onOpenConditionSheet}
        />

        <Text style={styles.defectsLabel}>Does the item have any defect(s)</Text>
        <View style={styles.radioRow}>
          <RadioOption label="Yes" selected={hasDefects === true} onPress={() => onHasDefectsChange(true)} />
          <RadioOption label="No" selected={hasDefects === false} onPress={() => onHasDefectsChange(false)} />
        </View>

        {hasDefects ? (
          <Input
            label="Describe defects"
            placeholder="Describe the defect(s)"
            value={defectsDescription}
            onChangeText={onDefectsDescriptionChange}
            multiline
            numberOfLines={3}
            style={styles.multilineInputSmall}
          />
        ) : null}
      </View>
    </View>
  );
}

// Same box treatment as FormDropdown — just opens a bottom sheet instead of a native menu.
function PickerField({
  label,
  value,
  placeholder,
  onPress,
  disabled,
}: {
  label: string;
  value?: string;
  placeholder: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const guard = useSingleTap();

  return (
    <View>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Pressable
        onPress={guard(onPress)}
        disabled={disabled}
        style={[styles.pickerField, disabled && styles.pickerFieldDisabled]}
        accessibilityState={{ disabled }}
      >
        <Text style={value ? styles.pickerValue : styles.pickerPlaceholder}>{value || placeholder}</Text>
        <Icons.CaretDownIcon size={verticalScale(16)} color={disabled ? colors.gray300 : colors.gray400} />
      </Pressable>
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

const styles = StyleSheet.create({
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
  multilineInput: {
    height: verticalScale(90),
    textAlignVertical: 'top',
  },
  fieldLabel: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.gray700,
    marginBottom: spacingY.xs,
  },
  pickerField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: verticalScale(56),
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    backgroundColor: colors.gray100,
    borderWidth: 1,
    borderColor: colors.gray100,
    paddingHorizontal: spacingX.md,
  },
  pickerFieldDisabled: {
    backgroundColor: colors.gray50,
  },
  pickerPlaceholder: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.md,
    color: colors.gray400,
  },
  pickerValue: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.md,
    color: colors.gray900,
  },
  multilineInputSmall: {
    height: verticalScale(70),
    textAlignVertical: 'top',
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
