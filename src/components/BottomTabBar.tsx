import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, View } from "react-native";

import { colors } from "../theme";

export type TabId = "feed" | "browse" | "alerts" | "saved" | "profile";

type Props = {
  activeTab: TabId;
  hasUnreadAlerts?: boolean;
  onChange: (tab: TabId) => void;
};

const tabs: Array<{
  id: TabId;
  icon: keyof typeof Ionicons.glyphMap;
  activeIcon: keyof typeof Ionicons.glyphMap;
  label: string;
}> = [
  { id: "feed", icon: "home-outline", activeIcon: "home", label: "Home" },
  {
    id: "browse",
    icon: "search-outline",
    activeIcon: "search",
    label: "Browse",
  },
  {
    id: "alerts",
    icon: "notifications-outline",
    activeIcon: "notifications",
    label: "Alerts",
  },
  {
    id: "saved",
    icon: "bookmark-outline",
    activeIcon: "bookmark",
    label: "Saved",
  },
  {
    id: "profile",
    icon: "person-outline",
    activeIcon: "person",
    label: "Profile",
  },
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
              <Ionicons
                color={active ? colors.ink : colors.muted}
                name={active ? tab.activeIcon : tab.icon}
                size={24}
              />
              {tab.id === "alerts" && hasUnreadAlerts ? (
                <View style={styles.badge} />
              ) : null}
            </View>
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
    minHeight: 62,
    paddingBottom: 4,
    paddingHorizontal: 14,
    paddingTop: 8,
  },
  tab: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    minHeight: 44,
  },
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
