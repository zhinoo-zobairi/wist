import { Ionicons } from "@expo/vector-icons";
import { FlatList, Image, Pressable, StyleSheet, Text, View } from "react-native";

import { brandsById } from "../data/seed";
import { seedPriceSource } from "../services/SeedPriceSource";
import { useCovetStore } from "../store/useCovetStore";
import { colors, fonts, radii } from "../theme";

type Props = { onTriggerDrop: () => void };

export function SavedScreen({ onTriggerDrop }: Props) {
  const starredItemIds = useCovetStore((state) => state.starredItemIds);
  const alerts = useCovetStore((state) => state.alerts);
  useCovetStore((state) => state.priceRevision);
  const toggleStar = useCovetStore((state) => state.toggleStar);
  const items = seedPriceSource
    .getAllItems()
    .filter((item) => starredItemIds.includes(item.id));

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Saved</Text>
          <Text style={styles.subtitle}>Your watched pieces.</Text>
        </View>
        <Pressable
          accessibilityLabel="Trigger a seed price drop"
          accessibilityRole="button"
          accessibilityState={{ disabled: items.length === 0 }}
          disabled={items.length === 0}
          onPress={onTriggerDrop}
          style={[styles.dropButton, items.length === 0 && styles.dropButtonDisabled]}
        >
          <Ionicons color={colors.card} name="trending-down" size={15} />
          <Text style={styles.dropButtonText}>Trigger seed drop</Text>
        </Pressable>
      </View>
      <FlatList
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons color={colors.ring} name="star-outline" size={28} />
            <Text style={styles.emptyTitle}>Your watchlist is quiet</Text>
            <Text style={styles.emptyBody}>
              Star a piece in Feed or Browse to watch its price.
            </Text>
          </View>
        }
        columnWrapperStyle={items.length > 0 ? styles.row : undefined}
        contentContainerStyle={[styles.grid, items.length === 0 && styles.emptyGrid]}
        data={items}
        keyExtractor={(item) => item.id}
        numColumns={2}
        renderItem={({ item }) => {
          const latestDrop = alerts.find((alert) => alert.itemId === item.id);
          return (
            <View style={styles.item}>
              <View>
                <Image
                  accessibilityLabel={item.name}
                  source={{ uri: item.imageUrl }}
                  style={styles.image}
                />
                <Pressable
                  accessibilityLabel={`Unstar ${item.name}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: true }}
                  onPress={() => toggleStar(item.id)}
                  style={styles.starButton}
                >
                  <Ionicons color={colors.wine} name="star" size={20} />
                </Pressable>
              </View>
              <Text style={styles.brand}>{brandsById[item.brandId]?.name}</Text>
              <Text numberOfLines={1} style={styles.itemName}>
                {item.name}
              </Text>
              <View style={styles.priceRow}>
                <Text style={[styles.price, latestDrop && styles.salePrice]}>
                  € {item.currentPrice.toFixed(0)}
                </Text>
                {latestDrop ? (
                  <Text style={styles.oldPrice}>
                    € {latestDrop.oldPrice.toFixed(0)}
                  </Text>
                ) : null}
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.paper, flex: 1 },
  header: {
    alignItems: "center",
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    paddingBottom: 14,
    paddingHorizontal: 20,
    paddingTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  title: { color: colors.ink, fontFamily: fonts.display, fontSize: 32 },
  subtitle: {
    color: colors.muted,
    fontFamily: fonts.text,
    fontSize: 12.5,
    marginTop: 2,
  },
  dropButton: {
    alignItems: "center",
    backgroundColor: colors.wine,
    borderRadius: radii.pill,
    flexDirection: "row",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  dropButtonDisabled: { opacity: 0.35 },
  dropButtonText: {
    color: colors.card,
    fontFamily: fonts.textSemibold,
    fontSize: 10,
  },
  grid: { padding: 14 },
  emptyGrid: { flexGrow: 1 },
  row: { gap: 10 },
  item: { flex: 1, marginBottom: 18, maxWidth: "50%" },
  image: {
    aspectRatio: 4 / 5,
    backgroundColor: colors.line,
    borderRadius: radii.card,
    width: "100%",
  },
  starButton: {
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: radii.pill,
    height: 36,
    justifyContent: "center",
    position: "absolute",
    right: 9,
    top: 9,
    width: 36,
  },
  brand: {
    color: colors.muted,
    fontFamily: fonts.textSemibold,
    fontSize: 9,
    letterSpacing: 1,
    marginTop: 8,
    textTransform: "uppercase",
  },
  itemName: { color: colors.ink, fontFamily: fonts.display, fontSize: 17 },
  price: {
    color: colors.ink,
    fontFamily: fonts.textMedium,
    fontSize: 12,
    marginTop: 2,
  },
  priceRow: {
    alignItems: "baseline",
    flexDirection: "row",
    gap: 7,
  },
  salePrice: { color: colors.wine },
  oldPrice: {
    color: colors.muted,
    fontFamily: fonts.text,
    fontSize: 10,
    textDecorationLine: "line-through",
  },
  empty: { alignItems: "center", flex: 1, justifyContent: "center" },
  emptyTitle: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 23,
    marginTop: 10,
  },
  emptyBody: {
    color: colors.muted,
    fontFamily: fonts.text,
    fontSize: 13,
    marginTop: 4,
    textAlign: "center",
  },
});
