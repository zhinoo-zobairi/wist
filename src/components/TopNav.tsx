import { Pressable, StyleSheet, Text, View } from "react-native";

import { Wordmark } from "./Wordmark";
import { CONTENT_MAX_WIDTH } from "../layout";
import { colors, radii, spacing, typography } from "../theme";
import type { TabId } from "./BottomTabBar";

type Props = {
  activeTab: TabId;
  hasUnreadAlerts?: boolean;
  onChange: (tab: TabId) => void;
};

const links: Array<{ id: TabId; label: string }> = [
  { id: "feed", label: "Home" },
  { id: "browse", label: "Discover" },
  { id: "saved", label: "Coveted" },
  { id: "alerts", label: "Alerts" },
  { id: "profile", label: "Profile" },
];

/** Wide-window navigation: wordmark left, the five sections right. */
export function TopNav({ activeTab, hasUnreadAlerts, onChange }: Props) {
  return (
    <View style={styles.bar}>
      <View style={styles.inner}>
        <Pressable accessibilityLabel="Home" onPress={() => onChange("feed")} style={({ pressed }) => pressed && styles.pressed}>
          <Wordmark />
        </Pressable>
        <View style={styles.links}>
          {links.map((link) => {
            const active = link.id === activeTab;
            return (
              <Pressable
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                hitSlop={8}
                key={link.id}
                onPress={() => onChange(link.id)}
                style={({ pressed }) => [styles.link, pressed && styles.pressed]}
              >
                <Text style={[styles.label, active && styles.labelActive]}>{link.label}</Text>
                {link.id === "alerts" && hasUnreadAlerts ? <View style={styles.badge} /> : null}
                {active ? <View style={styles.underline} /> : null}
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { backgroundColor: colors.paper, borderBottomColor: colors.line, borderBottomWidth: 1 },
  inner: {
    alignItems: "center",
    alignSelf: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    maxWidth: CONTENT_MAX_WIDTH,
    minHeight: 64,
    paddingHorizontal: spacing.gutterWide,
    width: "100%",
  },
  links: { alignItems: "center", flexDirection: "row", gap: 28 },
  link: { paddingVertical: 22 },
  label: { ...typography.label, color: colors.muted, textTransform: "uppercase" },
  labelActive: { color: colors.ink },
  underline: { backgroundColor: colors.ink, bottom: 16, height: 1, left: 0, position: "absolute", right: 0 },
  badge: {
    backgroundColor: colors.wine,
    borderRadius: radii.pill,
    height: 6,
    position: "absolute",
    right: -9,
    top: 20,
    width: 6,
  },
  pressed: { opacity: 0.7 },
});
