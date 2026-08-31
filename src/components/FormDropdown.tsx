import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Dropdown } from 'react-native-element-dropdown';
import * as Icons from 'phosphor-react-native';
import { colors, fontFamily, fontSize, radius, spacingX, spacingY } from '@/constants/theme';
import { verticalScale } from '@/utils/styling';
import type { DropdownOption } from '@/constants/formOptions';
import type { FormDropdownProps } from '@/utils/types';

/** Same gray-filled, label-above-box look as Input, for the Category/State/Area pickers. */
export function FormDropdown({ label, placeholder, data, value, onChange, error }: FormDropdownProps) {
  return (
    <View style={styles.wrapper}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Dropdown
        style={[styles.dropdown, error ? styles.dropdownError : null]}
        containerStyle={styles.menu}
        placeholderStyle={styles.placeholder}
        selectedTextStyle={styles.selectedText}
        itemTextStyle={styles.itemText}
        itemContainerStyle={styles.itemContainer}
        activeColor={colors.primaryLight}
        data={data}
        labelField="label"
        valueField="value"
        placeholder={placeholder}
        value={value}
        onChange={(item: DropdownOption) => onChange(item.value)}
        renderRightIcon={() => <Icons.CaretDownIcon size={verticalScale(16)} color={colors.gray400} />}
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
  },
  label: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.gray700,
    marginBottom: spacingY.xs,
  },
  dropdown: {
    minHeight: verticalScale(56),
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    backgroundColor: colors.gray100,
    borderWidth: 1,
    borderColor: colors.gray100,
    paddingHorizontal: spacingX.md,
  },
  dropdownError: {
    borderColor: colors.danger,
  },
  menu: {
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  placeholder: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.md,
    color: colors.gray400,
  },
  selectedText: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.md,
    color: colors.gray900,
  },
  itemText: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.md,
    color: colors.gray900,
  },
  itemContainer: {
    paddingHorizontal: spacingX.md,
  },
  errorText: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
    color: colors.danger,
    marginTop: spacingY.xs,
  },
});
