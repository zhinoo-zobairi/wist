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
  selectionMode?: "single" | "multiple";
  selectedColor?: string;
  disabled?: boolean;
};

export function OccasionStylePicker<Value extends string>({
  maxSelections,
  onChange,
  options,
  selected,
  selectionMode = "multiple",
  selectedColor = colors.wine,
  disabled = false,
}: OccasionStylePickerProps<Value>) {
  const toggle = (value: Value) => {
    onChange(
      selectionMode === "single" ? [value] : selected.includes(value)
        ? selected.filter((candidate) => candidate !== value)
        : [...selected, value],
    );
  };

  return (
    <View style={styles.grid}>
      {options.map((option) => {
        const isSelected = selected.includes(option.id);
        const isDisabled =
          disabled || (selectionMode !== "single" && !isSelected &&
          maxSelections !== undefined &&
          selected.length >= maxSelections);
        return (
          <Pressable
            accessibilityRole={selectionMode === "single" ? "radio" : "checkbox"}
            aria-checked={isSelected}
            accessibilityState={{ checked: isSelected, disabled: isDisabled }}
            disabled={isDisabled}
            key={option.id}
            onPress={() => toggle(option.id)}
            style={({ pressed }) => [
              styles.chip,
              isSelected && { backgroundColor: selectedColor, borderColor: selectedColor },
              isDisabled && styles.chipDisabled,
              pressed && styles.pressed,
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
    borderRadius: radii.card,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  chipDisabled: { opacity: 0.35 },
  pressed: { opacity: 0.7 },
  label: {
    color: colors.ink,
    fontFamily: fonts.textMedium,
    fontSize: 12,
  },
  labelSelected: { color: colors.card },
});
