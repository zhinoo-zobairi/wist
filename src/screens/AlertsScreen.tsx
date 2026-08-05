import { FlatList, Image, Pressable, StyleSheet, Text, View } from "react-native";

import { brandsById, itemsById } from "../data/seed";
import { useCovetStore } from "../store/useCovetStore";
import { colors, fonts } from "../theme";

type Props = {
  onViewItem: (itemId: string) => void;
};

const relativeTime = (value: string) => {
  const elapsed = Date.now() - new Date(value).getTime();
  const minutes = Math.max(0, Math.floor(elapsed / 60_000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return `${Math.floor(hours / 24)} days ago`;
};

export function AlertsScreen({ onViewItem }: Props) {
  const alerts = useCovetStore((state) => state.alerts);
  const markAlertRead = useCovetStore((state) => state.markAlertRead);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Your drops</Text>
        <Text style={styles.subtitle}>Things you love, now on sale.</Text>
      </View>
      <FlatList
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No drops yet</Text>
            <Text style={styles.emptyBody}>
              Star a piece, then use the price drop action to test the signal.
            </Text>
          </View>
        }
        contentContainerStyle={alerts.length === 0 && styles.emptyList}
        data={alerts}
        keyExtractor={(alert) => alert.id}
        renderItem={({ item: alert }) => {
          const product = itemsById[alert.itemId];
          const brand = product ? brandsById[product.brandId] : undefined;
          if (!product || !brand) return null;

          return (
            <View style={[styles.alert, !alert.read && styles.unread]}>
              <Image
                accessibilityLabel={product.name}
                source={{ uri: product.imageUrl }}
                style={styles.thumbnail}
              />
              <View style={styles.alertBody}>
                <Text style={styles.brand}>{brand.name}</Text>
                <Text numberOfLines={1} style={styles.productName}>
                  {product.name}
                </Text>
                <Text style={styles.drop}>
                  € {alert.oldPrice.toFixed(0)} → € {alert.newPrice.toFixed(0)} ·{" "}
                  {alert.pctOff}% off
                </Text>
                <Text style={styles.time}>{relativeTime(alert.createdAt)}</Text>
              </View>
              <Pressable
                accessibilityLabel={`View ${product.name}`}
                accessibilityRole="button"
                onPress={() => {
                  markAlertRead(alert.id);
                  onViewItem(alert.itemId);
                }}
                style={styles.viewButton}
              >
                <Text style={styles.viewText}>View</Text>
              </Pressable>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.paper,
    flex: 1,
  },
  header: {
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    paddingBottom: 16,
    paddingHorizontal: 22,
    paddingTop: 8,
  },
  title: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 32,
  },
  subtitle: {
    color: colors.muted,
    fontFamily: fonts.text,
    fontSize: 12.5,
    marginTop: 2,
  },
  empty: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 48,
  },
  emptyList: { flexGrow: 1 },
  emptyTitle: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 25,
  },
  emptyBody: {
    color: colors.muted,
    fontFamily: fonts.text,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 6,
    textAlign: "center",
  },
  alert: {
    alignItems: "center",
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 13,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  unread: { backgroundColor: "#FFFDFA" },
  thumbnail: {
    backgroundColor: colors.line,
    borderRadius: 12,
    height: 72,
    width: 58,
  },
  alertBody: { flex: 1, minWidth: 0 },
  brand: {
    color: colors.muted,
    fontFamily: fonts.textMedium,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  productName: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 18,
    lineHeight: 21,
    marginTop: 1,
  },
  drop: {
    color: colors.wine,
    fontFamily: fonts.textSemibold,
    fontSize: 12,
    marginTop: 5,
  },
  time: {
    color: colors.muted,
    fontFamily: fonts.text,
    fontSize: 10.5,
    marginTop: 4,
  },
  viewButton: {
    backgroundColor: colors.ink,
    borderRadius: 999,
    paddingHorizontal: 15,
    paddingVertical: 8,
  },
  viewText: {
    color: colors.card,
    fontFamily: fonts.textSemibold,
    fontSize: 11,
  },
});
