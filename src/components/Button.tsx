import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { Icon, type IconName } from "./Icon";
import { colors, radii, typography } from "../theme";

type Props = {
  label: string;
  onPress: () => void;
  /** primary = filled with `color`; secondary = 1 px outline in `color`. */
  variant?: "primary" | "secondary";
  /** Fill (primary) or outline and label (secondary). Defaults to ink. */
  color?: string;
  /** Overrides the label colour: card on primary, `color` on secondary. */
  labelColor?: string;
  busy?: boolean;
  disabled?: boolean;
  /** Announced as the selected state, e.g. a covet toggle. */
  selected?: boolean;
  icon?: IconName;
  iconFilled?: boolean;
  /** 38 px tall, for inline actions such as FOLLOW. */
  compact?: boolean;
  accessibilityLabel?: string;
};

export function Button({
  label,
  onPress,
  variant = "primary",
  color = colors.ink,
  labelColor,
  busy = false,
  disabled = false,
  selected,
  icon,
  iconFilled = false,
  compact = false,
  accessibilityLabel,
}: Props) {
  const primary = variant === "primary";
  const textColor = labelColor ?? (primary ? colors.card : color);
  const inactive = disabled || busy;

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ busy, disabled: inactive, selected }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        compact ? styles.compact : styles.regular,
        primary ? { backgroundColor: color, borderColor: color } : { borderColor: color },
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={textColor} size="small" />
      ) : (
        <View style={styles.row}>
          <Text style={[styles.label, { color: textColor }]}>{label}</Text>
          {icon ? <Icon color={textColor} filled={iconFilled} name={icon} size={16} /> : null}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    borderRadius: radii.card,
    borderWidth: 1,
    justifyContent: "center",
  },
  regular: { minHeight: 50, paddingHorizontal: 18 },
  compact: { minHeight: 38, paddingHorizontal: 14 },
  row: { alignItems: "center", flexDirection: "row", gap: 8 },
  label: { ...typography.label, textTransform: "uppercase" },
  disabled: { opacity: 0.35 },
  pressed: { opacity: 0.7 },
});
