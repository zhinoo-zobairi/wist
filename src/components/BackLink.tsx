import { Pressable, StyleSheet, Text } from "react-native";

import { Icon } from "./Icon";
import { colors, typography } from "../theme";

export function BackLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityLabel={`Back to ${label.toLowerCase()}`}
      accessibilityRole="button"
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [styles.link, pressed && styles.pressed]}
    >
      <Icon color={colors.ink} name="chevron" size={16} />
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  link: { alignItems: "center", alignSelf: "flex-start", flexDirection: "row", gap: 2, paddingVertical: 4 },
  label: { ...typography.label, textTransform: "uppercase" },
  pressed: { opacity: 0.7 },
});
