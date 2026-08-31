import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Icons from 'phosphor-react-native';
import { FormDropdown, Input } from '@/components';
import { CATEGORY_OPTIONS, CONDITION_OPTIONS, NIGERIAN_STATE_OPTIONS, getAreaOptions } from '@/constants/formOptions';
import { colors, fontFamily, fontSize, radius, spacingX, spacingY } from '@/constants/theme';
import { verticalScale } from '@/utils/styling';
import { useSingleTap } from '@/hooks/useSingleTap';

export interface AddItemBasicInfoStepProps {
  itemName: string;
  onItemNameChange: (value: string) => void;
  itemDescription: string;
  onItemDescriptionChange: (value: string) => void;
  category: string;
  onCategoryChange: (value: string) => void;
  itemBrand: string;
  onItemBrandChange: (value: string) => void;
  state: string;
  onStateChange: (value: string) => void;
  area: string;
  onAreaChange: (value: string) => void;
  address: string;
  onAddressChange: (value: string) => void;
  condition: string;
  onConditionChange: (value: string) => void;
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
  category,
  onCategoryChange,
  itemBrand,
  onItemBrandChange,
  state,
  onStateChange,
  area,
  onAreaChange,
  address,
  onAddressChange,
  condition,
  onConditionChange,
  hasDefects,
  onHasDefectsChange,
  defectsDescription,
  onDefectsDescriptionChange,
}: AddItemBasicInfoStepProps) {
  function handleStateChange(value: string) {
    onStateChange(value);
    onAreaChange(''); // areas are state-dependent — clear a now-invalid selection
  }

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
        <FormDropdown label="Category" placeholder="Select a category" data={CATEGORY_OPTIONS} value={category} onChange={onCategoryChange} />
        <Input label="Item brand" placeholder="e.g. Apple" value={itemBrand} onChangeText={onItemBrandChange} />
      </View>

      <Text style={styles.sectionTitle}>Item Location</Text>
      <View style={styles.sectionGap}>
        <FormDropdown label="State" placeholder="Select a state" data={NIGERIAN_STATE_OPTIONS} value={state} onChange={handleStateChange} />
        <FormDropdown label="Area" placeholder="Select an area" data={getAreaOptions(state)} value={area} onChange={onAreaChange} />
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
        <FormDropdown
          label="Select condition"
          placeholder="Select the item's condition"
          data={CONDITION_OPTIONS}
          value={condition}
          onChange={onConditionChange}
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
