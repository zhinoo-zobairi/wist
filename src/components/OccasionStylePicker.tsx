import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, fonts, radii } from "../theme";

type PickerOption<Value extends string> = {
  id: Value;
  label: string;
};

type OccasionStylePickerProps<Value extends string> = {
  maxSelections?: number;
  onChange: (selected: Value[]) => void;
  options: readonly PickerOption<Value>[];
  selected: Value[];
};

export function OccasionStylePicker<Value extends string>({
  maxSelections,
  onChange,
  options,
  selected,
}: OccasionStylePickerProps<Value>) {
  const toggle = (value: Value) => {
    onChange(
      selected.includes(value)
        ? selected.filter((candidate) => candidate !== value)
        : [...selected, value],
    );
  };

  return (
    <View style={styles.grid}>
      {options.map((option) => {
        const isSelected = selected.includes(option.id);
        const isDisabled =
          !isSelected &&
          maxSelections !== undefined &&
          selected.length >= maxSelections;
        return (
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: isSelected, disabled: isDisabled }}
            disabled={isDisabled}
            key={option.id}
            onPress={() => toggle(option.id)}
            style={[
              styles.chip,
              isSelected && styles.chipSelected,
              isDisabled && styles.chipDisabled,
            ]}
          >
            <Text style={[styles.label, isSelected && styles.labelSelected]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  chip: {
    borderColor: colors.ring,
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  chipDisabled: { opacity: 0.35 },
  chipSelected: { backgroundColor: colors.wine, borderColor: colors.wine },
  label: {
    color: colors.ink,
    fontFamily: fonts.textMedium,
    fontSize: 12,
  },
  labelSelected: { color: colors.card },
});
