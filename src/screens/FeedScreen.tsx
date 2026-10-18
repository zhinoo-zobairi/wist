import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { ActionLink } from "../components/ActionLink";
import { Icon } from "../components/Icon";
import { Wordmark } from "../components/Wordmark";
import { useWistStore } from "../store/useWistStore";
import { formatPrice } from "../money";
import { colors, radii, spacing, typography } from "../theme";
import type { Brand, Item } from "../types";

type Props = {
  onBrowseBrand: (brandId: string) => void;
  onOpenAlerts: () => void;
  onOpenBrowse: () => void;
  onOpenItem: (itemId: string) => void;
  onToggleCovet: (item: Item) => void;
  brands: Brand[];
  items: Item[];
};

export function FeedScreen({ brands, items, onBrowseBrand, onOpenAlerts, onOpenBrowse, onOpenItem, onToggleCovet }: Props) {
  const followedBrandIds = useWistStore((state) => state.followedBrandIds);
  const covetedIds = useWistStore((state) => state.starredItemIds);
  const alerts = useWistStore((state) => state.alerts);
  useWistStore((state) => state.priceRevision);

  const followedBrands = brands.filter((brand) => followedBrandIds.includes(brand.id));
  const brandsById = Object.fromEntries(brands.map((brand) => [brand.id, brand]));
  const allItems = items;
  const latestAlert = alerts[0];
  const alertItem = latestAlert ? allItems.find((item) => item.id === latestAlert.itemId) : undefined;
  const edit = allItems.filter((item) => followedBrandIds.includes(item.brandId)).slice(0, 4);

  return (
    <ScrollView showsVerticalScrollIndicator={false} style={styles.screen}>
      <View style={styles.header}>
        <Wordmark />
        <Pressable
          accessibilityLabel="Open alerts"
          hitSlop={12}
          onPress={onOpenAlerts}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <View>
            <Icon color={colors.ink} name="bell" size={22} />
            {alerts.some((alert) => !alert.read) ? <View style={styles.badge} /> : null}
          </View>
        </Pressable>
      </View>

      <View style={styles.intro}>
        <Text style={styles.kicker}>YOUR PERSONAL EDIT · TODAY</Text>
        <Text style={styles.title}>Pieces worth{`\n`}your attention.</Text>
        <Text style={styles.dek}>Selected from the houses you follow, with signals that matter.</Text>
      </View>

      {latestAlert && alertItem ? (
        <Pressable
          accessibilityRole="button"
          onPress={onOpenAlerts}
          style={({ pressed }) => [styles.signal, pressed && styles.pressed]}
        >
          <Image source={{ uri: alertItem.imageUrl }} style={styles.signalImage} />
          <View style={styles.signalBody}>
            <Text style={styles.signalKicker}>A COVETED PIECE JUST DROPPED</Text>
            <Text style={styles.signalName}>{alertItem.name}</Text>
            <View style={styles.priceRow}>
              <Text style={styles.signalPrice}>{formatPrice(latestAlert.newPrice, alertItem.currency)}</Text>
              <Text style={styles.oldPrice}>{formatPrice(latestAlert.oldPrice, alertItem.currency)}</Text>
              <Text style={styles.percent}>−{latestAlert.pctOff}%</Text>
            </View>
            <Text style={styles.signalLink}>VIEW THE SIGNAL  →</Text>
          </View>
        </Pressable>
      ) : (
        <View style={styles.quietSignal}>
          <Text style={styles.quietKicker}>WIST IS WATCHING</Text>
          <Text style={styles.quietTitle}>No meaningful changes yet.</Text>
          <Text style={styles.quietBody}>When a coveted piece drops in price, it will interrupt the quiet here.</Text>
        </View>
      )}

      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>From your houses</Text>
        <ActionLink label="Discover all" onPress={onOpenBrowse} />
      </View>
      <ScrollView contentContainerStyle={styles.houses} horizontal showsHorizontalScrollIndicator={false}>
        {followedBrands.map((brand, index) => (
          <Pressable
            key={brand.id}
            onPress={() => onBrowseBrand(brand.id)}
            style={({ pressed }) => [styles.house, pressed && styles.pressed]}
          >
            <Text style={styles.houseIndex}>0{index + 1}</Text>
            <Text numberOfLines={2} style={styles.houseName}>{brand.name}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>The edit</Text>
        <Text style={styles.sectionNote}>FOR YOU</Text>
      </View>
      <View style={styles.editGrid}>
        {edit.length === 0 ? (
          <View style={styles.catalogueEmpty}>
            <Text style={styles.quietTitle}>Live catalogue unavailable.</Text>
            <Text style={styles.quietBody}>Start the catalogue service, then refresh Wist.</Text>
          </View>
        ) : null}
        {edit.map((item, index) => {
          const coveted = covetedIds.includes(item.id);
          const brand = brandsById[item.brandId];
          return (
            <View key={item.id} style={[styles.editItem, index % 2 === 1 && styles.editItemLower]}>
              <View>
                <Pressable onPress={() => onOpenItem(item.id)} style={({ pressed }) => pressed && styles.pressed}>
                  <Image source={{ uri: item.imageUrl }} style={styles.editImage} />
                </Pressable>
                <Pressable
                  accessibilityLabel={`${coveted ? "Remove" : "Covet"} ${item.name}`}
                  accessibilityState={{ selected: coveted }}
                  onPress={() => onToggleCovet(item)}
                  style={({ pressed }) => [
                    styles.covetButton,
                    coveted && styles.covetButtonSelected,
                    pressed && styles.pressed,
                  ]}
                >
                  <Icon color={colors.ink} filled={coveted} name="heart" size={20} />
                </Pressable>
              </View>
              <Text style={styles.itemBrand}>{brand?.name}</Text>
              <Pressable onPress={() => onOpenItem(item.id)} style={({ pressed }) => pressed && styles.pressed}>
                <Text numberOfLines={2} style={styles.itemName}>{item.name}</Text>
              </Pressable>
              <Text style={styles.itemPrice}>{formatPrice(item.currentPrice, item.currency)}</Text>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.paper, flex: 1 },
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", paddingHorizontal: spacing.gutter, paddingTop: 10 },
  badge: { backgroundColor: colors.wine, borderColor: colors.paper, borderRadius: 5, borderWidth: 2, height: 9, position: "absolute", right: -3, top: -3, width: 9 },
  intro: { paddingBottom: 28, paddingHorizontal: spacing.gutter, paddingTop: 35 },
  kicker: typography.kicker,
  title: { ...typography.titleXL, marginTop: 10 },
  dek: { ...typography.body, marginTop: 13, maxWidth: 300 },
  signal: { backgroundColor: colors.wine, borderRadius: radii.card, flexDirection: "row", marginBottom: 38, marginHorizontal: 14, minHeight: 190, overflow: "hidden" },
  signalImage: { backgroundColor: colors.line, width: "40%" },
  signalBody: { flex: 1, justifyContent: "center", padding: 18 },
  signalKicker: { ...typography.kicker, color: colors.onWineSoft },
  signalName: { ...typography.titleM, color: colors.card, fontSize: 24, lineHeight: 26, marginTop: 8 },
  priceRow: { alignItems: "baseline", flexDirection: "row", gap: 8, marginTop: 9 },
  signalPrice: { ...typography.price, color: colors.card, fontSize: 16 },
  oldPrice: { ...typography.caption, color: colors.onWineMuted, textDecorationLine: "line-through" },
  percent: { ...typography.label, backgroundColor: colors.card, borderRadius: radii.card, color: colors.wine, paddingHorizontal: 6, paddingVertical: 2 },
  signalLink: { ...typography.label, color: colors.card, marginTop: 20 },
  quietSignal: { borderBottomColor: colors.line, borderTopColor: colors.line, borderTopWidth: 1, borderBottomWidth: 1, marginBottom: 38, marginHorizontal: spacing.gutter, paddingVertical: 22 },
  quietKicker: { ...typography.kicker, color: colors.moss },
  quietTitle: { ...typography.titleL, marginTop: 5 },
  quietBody: { ...typography.body, marginTop: 4, maxWidth: 300 },
  sectionHead: { alignItems: "baseline", flexDirection: "row", justifyContent: "space-between", paddingHorizontal: spacing.gutter },
  sectionTitle: typography.titleL,
  sectionNote: typography.kicker,
  houses: { gap: 10, paddingBottom: 40, paddingHorizontal: spacing.gutter, paddingTop: 14 },
  house: { borderColor: colors.line, borderTopWidth: 1, height: 94, justifyContent: "space-between", paddingTop: 9, width: 112 },
  houseIndex: typography.caption,
  houseName: typography.titleS,
  editGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, paddingBottom: 40, paddingHorizontal: 14, paddingTop: 16 },
  catalogueEmpty: { borderTopColor: colors.line, borderTopWidth: 1, marginHorizontal: 8, paddingVertical: 24, width: "100%" },
  editItem: { marginBottom: 24, width: "48%" },
  editItemLower: { marginTop: 38 },
  editImage: { aspectRatio: 3 / 4, backgroundColor: colors.line, borderRadius: radii.card, width: "100%" },
  covetButton: { alignItems: "center", backgroundColor: colors.card, borderRadius: radii.card, bottom: 0, height: 42, justifyContent: "center", position: "absolute", right: 0, width: 42 },
  covetButtonSelected: { backgroundColor: colors.wash },
  itemBrand: { ...typography.kicker, marginTop: 9, textTransform: "uppercase" },
  itemName: { ...typography.titleS, marginTop: 3 },
  itemPrice: { ...typography.price, marginTop: 5 },
  pressed: { opacity: 0.85 },
});
