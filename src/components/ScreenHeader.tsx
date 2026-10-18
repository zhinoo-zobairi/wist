import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { spacing, typography } from "../theme";

type Props = {
  kicker?: string;
  title: string;
  subtitle?: string;
  /** Rendered top-right, aligned with the kicker: an ActionLink or Button. */
  right?: ReactNode;
};

export function ScreenHeader({ kicker, title, subtitle, right }: Props) {
  return (
    <View style={styles.header}>
      <View style={styles.copy}>
        {kicker ? <Text style={styles.kicker}>{kicker}</Text> : null}
        <Text accessibilityRole="header" style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingBottom: 24,
    paddingHorizontal: spacing.gutter,
    paddingTop: 12,
  },
  copy: { flex: 1 },
  kicker: typography.kicker,
  title: { ...typography.titleXL, marginTop: 4 },
  subtitle: { ...typography.body, marginTop: 6 },
  right: { paddingLeft: 12, paddingTop: 2 },
});
