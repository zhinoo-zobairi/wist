import { Pressable, StyleSheet, Text } from "react-native";

import { colors, typography } from "../theme";

type Props = {
  label: string;
  onPress: () => void;
  color?: string;
  disabled?: boolean;
  accessibilityLabel?: string;
};

export function ActionLink({ label, onPress, color = colors.ink, disabled = false, accessibilityLabel }: Props) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [styles.link, disabled && styles.disabled, pressed && styles.pressed]}
    >
      <Text style={[styles.label, { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  link: { alignSelf: "flex-start", paddingVertical: 6 },
  label: { ...typography.label, textTransform: "uppercase" },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.7 },
});
