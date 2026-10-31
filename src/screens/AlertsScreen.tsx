import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Button } from "../components/Button";
import { Icon } from "../components/Icon";
import { IndexStatus } from "../components/IndexStatus";
import { ProductPhoto } from "../components/ProductPhoto";
import { ScreenHeader } from "../components/ScreenHeader";
import { describableAlerts } from "../describableAlerts";
import { pageStyle, useLayout } from "../layout";
import { useWistStore } from "../store/useWistStore";
import { formatPrice } from "../money";
import { colors, radii, spacing, typography } from "../theme";
import type { Brand, CatalogueStatus, Item } from "../types";

type Props = {
  brands: Brand[];
  catalogueStatus: CatalogueStatus;
  items: Item[];
  onReload: () => void;
  onViewItem: (itemId: string) => void;
};
const relativeTime = (value: string) => {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60_000));
  if (minutes < 1) return "JUST NOW";
  if (minutes < 60) return `${minutes} MIN AGO`;
  return `${Math.floor(minutes / 60)} HR AGO`;
};

export function AlertsScreen({ brands, catalogueStatus, items, onReload, onViewItem }: Props) {
  const layout = useLayout();
  const { wide } = layout;
  const alerts = useWistStore((state) => state.alerts);
  const covetedIds = useWistStore((state) => state.starredItemIds);
  const markRead = useWistStore((state) => state.markAlertRead);
  // Hero and history read the same list as the unread dot in App.tsx.
  const [heroEntry, ...earlier] = describableAlerts(alerts, items, brands);
  const hero = heroEntry?.alert;
  const heroItem = heroEntry?.item;
  const heroBrand = heroEntry?.brand;

  return (
    <ScrollView contentContainerStyle={pageStyle(layout)} showsVerticalScrollIndicator={false} style={styles.screen}>
      <ScreenHeader kicker="SIGNALS FOR YOU" subtitle="Meaningful changes in the pieces you covet." title="Alerts" />
      {!heroEntry && alerts.length > 0 && catalogueStatus !== "ready" ? (
        <View style={[styles.empty, wide && styles.emptyWide]}>
          <IndexStatus
            detail={`${covetedIds.length} ${covetedIds.length === 1 ? "piece" : "pieces"} coveted. Reconnect to see their signals.`}
            onReload={onReload}
            status={catalogueStatus}
          />
        </View>
      ) : !hero || !heroItem || !heroBrand ? (
        <View style={[styles.empty, wide && styles.emptyWide]}>
          <Icon color={colors.moss} name="bell" size={28} />
          <Text style={styles.emptyTitle}>The room is quiet.</Text>
          <Text style={styles.emptyBody}>WIST is observing your pieces. A price movement will appear here when it deserves your attention.</Text>
        </View>
      ) : (
        <View style={wide && styles.columns}>
          <View style={[styles.hero, wide && styles.heroWide]}>
            <View style={styles.heroTop}>
              <Text style={styles.live}>●  NEW SIGNAL</Text>
              <Text style={styles.time}>{relativeTime(hero.createdAt)}</Text>
            </View>
            <ProductPhoto style={styles.heroImage} uri={heroItem.imageUrl} />
            <View style={styles.heroCopy}>
              <Text style={styles.brand}>{heroBrand.name}</Text>
              <Text style={styles.heroName}>{heroItem.name}</Text>
              <Text style={styles.reason}>A piece you chose is now at its lowest observed price.</Text>
              <View style={styles.prices}>
                <View><Text style={styles.priceLabel}>NOW</Text><Text style={styles.newPrice}>{formatPrice(hero.newPrice, heroItem.currency)}</Text></View>
                <View><Text style={styles.priceLabel}>WAS</Text><Text style={styles.wasPrice}>{formatPrice(hero.oldPrice, heroItem.currency)}</Text></View>
                <View style={styles.off}><Text style={styles.offText}>−{hero.pctOff}%</Text></View>
              </View>
              <View style={styles.viewButton}>
                <Button
                  color={colors.card}
                  icon="arrow"
                  label="View piece"
                  labelColor={colors.wine}
                  onPress={() => { markRead(hero.id); onViewItem(hero.itemId); }}
                />
              </View>
            </View>
          </View>
          {earlier.length > 0 ? (
            <View style={[styles.history, wide && styles.historyWide]}>
              <Text style={styles.historyTitle}>Earlier signals</Text>
              {earlier.map(({ alert, brand, item }) => {
                return (
                  <Pressable
                    key={alert.id}
                    onPress={() => { markRead(alert.id); onViewItem(alert.itemId); }}
                    style={({ pressed }) => [styles.historyRow, pressed && styles.pressed]}
                  >
                    <ProductPhoto compact style={styles.thumb} uri={item.imageUrl} />
                    <View style={styles.historyBody}>
                      <Text style={styles.historyBrand}>{brand.name}</Text>
                      <Text style={styles.historyName}>{item.name}</Text>
                      <Text style={styles.historyPrice}>{formatPrice(alert.oldPrice, item.currency)} → {formatPrice(alert.newPrice, item.currency)} · −{alert.pctOff}%</Text>
                    </View>
                    <Icon color={colors.ink} name="arrow" size={17} />
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.paper, flex: 1 },
  empty: { alignItems: "center", borderTopColor: colors.line, borderTopWidth: 1, marginHorizontal: spacing.gutter, paddingHorizontal: 25, paddingTop: 105 },
  emptyTitle: { ...typography.titleL, marginTop: 16 },
  emptyBody: { ...typography.body, marginTop: 6, textAlign: "center" },
  emptyWide: { alignSelf: "center", maxWidth: 520, width: "100%" },
  columns: { alignItems: "flex-start", flexDirection: "row", gap: 48, paddingHorizontal: spacing.gutter },
  heroWide: { flex: 6, marginHorizontal: 0, maxWidth: "50%" },
  historyWide: { flex: 6, paddingHorizontal: 0, paddingVertical: 0 },
  hero: { backgroundColor: colors.wine, borderRadius: radii.card, marginHorizontal: spacing.gutter, padding: 8 },
  heroTop: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 8, paddingVertical: 8 },
  live: { ...typography.label, color: colors.card },
  time: { ...typography.label, color: colors.onWineMuted },
  heroImage: { aspectRatio: 4 / 5, width: "100%" },
  heroCopy: { padding: 14 },
  brand: { ...typography.kicker, color: colors.onWineMuted, textTransform: "uppercase" },
  heroName: { ...typography.titleL, color: colors.card, fontSize: 31, lineHeight: 33, marginTop: 4 },
  reason: { ...typography.body, color: colors.onWineSoft, marginTop: 7 },
  prices: { alignItems: "center", borderBottomColor: colors.onWineLine, borderTopColor: colors.onWineLine, borderTopWidth: 1, borderBottomWidth: 1, flexDirection: "row", gap: 29, marginTop: 16, paddingVertical: 13 },
  priceLabel: { ...typography.kicker, color: colors.onWineMuted },
  newPrice: { ...typography.price, color: colors.card, fontSize: 21, marginTop: 2 },
  wasPrice: { ...typography.body, color: colors.onWineMuted, fontSize: 15, marginTop: 4, textDecorationLine: "line-through" },
  off: { backgroundColor: colors.card, marginLeft: "auto", paddingHorizontal: 9, paddingVertical: 6 },
  offText: { ...typography.price, color: colors.wine },
  viewButton: { marginTop: 16 },
  history: { paddingHorizontal: spacing.gutter, paddingVertical: 30 },
  historyTitle: { ...typography.titleL, marginBottom: 11 },
  historyRow: { alignItems: "center", borderTopColor: colors.line, borderTopWidth: 1, flexDirection: "row", gap: 12, paddingVertical: 13 },
  thumb: { borderRadius: radii.card, height: 75, width: 60 },
  historyBody: { flex: 1 },
  historyBrand: { ...typography.kicker, textTransform: "uppercase" },
  historyName: { ...typography.titleS, marginTop: 2 },
  historyPrice: { ...typography.price, color: colors.wine, marginTop: 4 },
  pressed: { opacity: 0.85 },
});
