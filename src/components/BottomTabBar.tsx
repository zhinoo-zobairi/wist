import { Pressable, StyleSheet, Text, View } from "react-native";

import { Icon, type IconName } from "./Icon";
import { colors } from "../theme";

export type TabId = "feed" | "browse" | "alerts" | "saved" | "profile";

type Props = {
  activeTab: TabId;
  hasUnreadAlerts?: boolean;
  onChange: (tab: TabId) => void;
};

const tabs: Array<{
  id: TabId;
  icon: IconName;
  label: string;
}> = [
  { id: "feed", icon: "home", label: "Home" },
  { id: "browse", icon: "search", label: "Discover" },
  { id: "saved", icon: "heart", label: "Coveted" },
  { id: "alerts", icon: "bell", label: "Alerts" },
  { id: "profile", icon: "user", label: "Profile" },
];

export function BottomTabBar({ activeTab, hasUnreadAlerts, onChange }: Props) {
  return (
    <View style={styles.bar}>
      {tabs.map((tab) => {
        const active = activeTab === tab.id;

        return (
          <Pressable
            accessibilityLabel={tab.label}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            hitSlop={8}
            key={tab.id}
            onPress={() => onChange(tab.id)}
            style={styles.tab}
          >
            <View>
              <Icon
                color={active ? colors.ink : colors.muted}
                name={tab.icon}
                size={21}
              />
              {tab.id === "alerts" && hasUnreadAlerts ? (
                <View style={styles.badge} />
              ) : null}
            </View>
            <Text style={[styles.label, active && styles.activeLabel]}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    alignItems: "center",
    backgroundColor: colors.card,
    borderTopColor: colors.line,
    borderTopWidth: 1,
    flexDirection: "row",
    minHeight: 68,
    paddingBottom: 5,
    paddingHorizontal: 8,
    paddingTop: 7,
  },
  tab: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    minHeight: 44,
  },
  label: {
    color: colors.muted,
    fontFamily: "Inter_500Medium",
    fontSize: 9,
    marginTop: 3,
  },
  activeLabel: { color: colors.ink },
  badge: {
    backgroundColor: colors.wine,
    borderColor: colors.card,
    borderRadius: 5,
    borderWidth: 2,
    height: 10,
    position: "absolute",
    right: -4,
    top: -3,
    width: 10,
  },
});
