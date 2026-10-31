import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";

import { ActionLink } from "../components/ActionLink";
import { Icon } from "../components/Icon";
import { IndexStatus } from "../components/IndexStatus";
import { ProductPhoto } from "../components/ProductPhoto";
import { Wordmark } from "../components/Wordmark";
import { describableAlerts } from "../describableAlerts";
import { pageStyle, useLayout } from "../layout";
import { useWistStore } from "../store/useWistStore";
import { formatPrice } from "../money";
import { colors, radii, spacing, typography } from "../theme";
import type { Brand, CatalogueStatus, Item } from "../types";

type Props = {
  onBrowseBrand: (brandId: string) => void;
  onOpenAlerts: () => void;
  onOpenBrowse: () => void;
  onOpenItem: (itemId: string) => void;
  onReload: () => void;
  onToggleCovet: (item: Item) => void;
  brands: Brand[];
  catalogueStatus: CatalogueStatus;
  /** Unread drops the Alerts screen can show; the bell's dot follows it. */
  hasUnreadAlerts: boolean;
  items: Item[];
};

export function FeedScreen({ brands, catalogueStatus, hasUnreadAlerts, items, onBrowseBrand, onOpenAlerts, onOpenBrowse, onOpenItem, onReload, onToggleCovet }: Props) {
  const followedBrandIds = useWistStore((state) => state.followedBrandIds);
  const covetedIds = useWistStore((state) => state.starredItemIds);
  const alerts = useWistStore((state) => state.alerts);
  useWistStore((state) => state.priceRevision);
  const layout = useLayout();
  const { wide } = layout;

  const followedBrands = brands.filter((brand) => followedBrandIds.includes(brand.id));
  const brandsById = Object.fromEntries(brands.map((brand) => [brand.id, brand]));
  // The same list as the Alerts hero and the unread dot, so Home never names another drop.
  const drop = describableAlerts(alerts, items, brands)[0];
  const edit = items.filter((item) => followedBrandIds.includes(item.brandId)).slice(0, 8);

  return (
    <ScrollView
      contentContainerStyle={pageStyle(layout)}
      refreshControl={<RefreshControl onRefresh={onReload} refreshing={catalogueStatus === "loading" && items.length > 0} tintColor={colors.wine} />}
      showsVerticalScrollIndicator={false}
      style={styles.screen}
    >
      {wide ? null : (
        <View style={styles.header}>
          <Wordmark />
          <Pressable
            accessibilityLabel={hasUnreadAlerts ? "Alerts, new price drop" : "Open alerts"}
            hitSlop={12}
            onPress={onOpenAlerts}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <View>
              <Icon color={colors.ink} name="bell" size={22} />
              {hasUnreadAlerts ? <View style={styles.badge} /> : null}
            </View>
          </Pressable>
        </View>
      )}

      <View style={wide ? styles.heroWide : undefined}>
        <View style={[styles.intro, wide && styles.introWide]}>
          <Text style={styles.kicker}>YOUR PERSONAL EDIT · TODAY</Text>
          <Text style={styles.title}>Pieces worth{`\n`}your attention.</Text>
          <Text style={styles.dek}>Selected from the houses you follow, with signals that matter.</Text>
          {/* Compact folds the quiet block into one line; wide keeps it as the right column. */}
          {!drop && !wide ? <Text style={styles.quietLine}>WIST IS WATCHING · NO CHANGES YET</Text> : null}
        </View>

        {drop ? (
          <Pressable
            accessibilityRole="button"
            onPress={onOpenAlerts}
            style={({ pressed }) => [styles.signal, wide && styles.signalWide, pressed && styles.pressed]}
          >
            <ProductPhoto style={styles.signalImage} uri={drop.item.imageUrl} />
            <View style={styles.signalBody}>
              <Text style={styles.signalKicker}>A COVETED PIECE JUST DROPPED</Text>
              <Text style={styles.signalName}>{drop.item.name}</Text>
              <View style={styles.priceRow}>
                <Text style={styles.signalPrice}>{formatPrice(drop.alert.newPrice, drop.item.currency)}</Text>
                <Text style={styles.oldPrice}>{formatPrice(drop.alert.oldPrice, drop.item.currency)}</Text>
                <Text style={styles.percent}>−{drop.alert.pctOff}%</Text>
              </View>
              <Text style={styles.signalLink}>VIEW THE SIGNAL  →</Text>
            </View>
          </Pressable>
        ) : wide ? (
          <View style={[styles.quietSignal, styles.quietSignalWide]}>
            <Text style={styles.quietKicker}>WIST IS WATCHING</Text>
            <Text style={styles.quietTitle}>No meaningful changes yet.</Text>
            <Text style={styles.quietBody}>When a coveted piece drops in price, it will interrupt the quiet here.</Text>
          </View>
        ) : null}
      </View>

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
      </View>
      <View style={[styles.editGrid, wide && styles.editGridWide]}>
        {edit.length === 0 ? (
          <View style={styles.catalogueEmpty}>
            {catalogueStatus !== "ready" ? (
              <IndexStatus onReload={onReload} status={catalogueStatus} />
            ) : (
              <>
                <Text style={styles.emptyTitle}>You follow no houses yet.</Text>
                <Text style={styles.emptyBody}>Follow a house in Discover and its pieces will gather here.</Text>
              </>
            )}
          </View>
        ) : null}
        {edit.map((item, index) => {
          const coveted = covetedIds.includes(item.id);
          const brand = brandsById[item.brandId];
          return (
            <View key={item.id} style={[styles.editItem, wide ? styles.editItemWide : index % 2 === 1 && styles.editItemLower]}>
              <View>
                <Pressable onPress={() => onOpenItem(item.id)} style={({ pressed }) => pressed && styles.pressed}>
                  <ProductPhoto style={styles.editImage} uri={item.imageUrl} />
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
  // Wide: intro left (7), signal or quiet block right (5), aligned to the top.
  heroWide: { alignItems: "flex-start", flexDirection: "row", gap: spacing.gutterWide, paddingBottom: 38, paddingHorizontal: spacing.gutter, paddingTop: 35 },
  intro: { paddingBottom: 28, paddingHorizontal: spacing.gutter, paddingTop: 20 },
  introWide: { flex: 7, paddingBottom: 0, paddingHorizontal: 0, paddingTop: 0 },
  kicker: typography.kicker,
  title: { ...typography.titleXL, marginTop: 10 },
  dek: { ...typography.body, marginTop: 13, maxWidth: 300 },
  quietLine: { ...typography.kicker, color: colors.moss, marginTop: 16 },
  signal: { backgroundColor: colors.wine, borderRadius: radii.card, flexDirection: "row", marginBottom: 38, marginHorizontal: spacing.gutter, minHeight: 190, overflow: "hidden" },
  signalWide: { flex: 5, marginBottom: 0, marginHorizontal: 0 },
  signalImage: { width: "40%" },
  signalBody: { flex: 1, justifyContent: "center", padding: 18 },
  signalKicker: { ...typography.kicker, color: colors.onWineSoft },
  signalName: { ...typography.titleM, color: colors.card, fontSize: 24, lineHeight: 26, marginTop: 8 },
  priceRow: { alignItems: "baseline", flexDirection: "row", gap: 8, marginTop: 9 },
  signalPrice: { ...typography.price, color: colors.card, fontSize: 16 },
  oldPrice: { ...typography.caption, color: colors.onWineMuted, textDecorationLine: "line-through" },
  percent: { ...typography.label, backgroundColor: colors.card, borderRadius: radii.card, color: colors.wine, paddingHorizontal: 6, paddingVertical: 2 },
  signalLink: { ...typography.label, color: colors.card, marginTop: 20 },
  quietSignal: { borderBottomColor: colors.line, borderTopColor: colors.line, borderTopWidth: 1, borderBottomWidth: 1, marginBottom: 38, marginHorizontal: spacing.gutter, paddingVertical: 22 },
  quietSignalWide: { flex: 5, marginBottom: 0, marginHorizontal: 0 },
  quietKicker: { ...typography.kicker, color: colors.moss },
  quietTitle: { ...typography.titleL, marginTop: 5 },
  quietBody: { ...typography.body, marginTop: 4, maxWidth: 300 },
  sectionHead: { alignItems: "baseline", flexDirection: "row", justifyContent: "space-between", paddingHorizontal: spacing.gutter },
  sectionTitle: typography.titleL,
  houses: { gap: 10, paddingBottom: 24, paddingHorizontal: spacing.gutter, paddingTop: 14 },
  house: { borderColor: colors.line, borderTopWidth: 1, height: 94, justifyContent: "space-between", paddingTop: 9, width: 112 },
  houseIndex: typography.caption,
  houseName: typography.titleS,
  editGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, paddingBottom: 40, paddingHorizontal: spacing.gutter, paddingTop: 16 },
  catalogueEmpty: { borderTopColor: colors.line, borderTopWidth: 1, paddingVertical: 24, width: "100%" },
  emptyTitle: { ...typography.titleL, textAlign: "center" },
  emptyBody: { ...typography.body, marginTop: 7, textAlign: "center" },
  // Wide: four columns of 23 %, the 2.66 % gaps come from space-between.
  editGridWide: { columnGap: 24, justifyContent: "flex-start", paddingHorizontal: spacing.gutter, rowGap: 36 },
  editItem: { marginBottom: 24, width: "48%" },
  editItemLower: { marginTop: 38 },
  editItemWide: { marginBottom: 0, width: "22.6%" },
  editImage: { aspectRatio: 4 / 5, borderRadius: radii.card, width: "100%" },
  covetButton: { alignItems: "center", backgroundColor: colors.card, borderRadius: radii.card, bottom: 8, height: 42, justifyContent: "center", position: "absolute", right: 8, width: 42 },
  covetButtonSelected: { backgroundColor: colors.wash },
  itemBrand: { ...typography.kicker, marginTop: 9, textTransform: "uppercase" },
  itemName: { ...typography.titleS, marginTop: 3 },
  itemPrice: { ...typography.price, marginTop: 5 },
  pressed: { opacity: 0.85 },
});
