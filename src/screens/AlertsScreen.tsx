import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Button } from "../components/Button";
import { Icon } from "../components/Icon";
import { ScreenHeader } from "../components/ScreenHeader";
import { useWistStore } from "../store/useWistStore";
import { colors, radii, spacing, typography } from "../theme";
import type { Brand, Item } from "../types";

type Props = {
  brands: Brand[];
  items: Item[];
  onViewItem: (itemId: string) => void;
};
const relativeTime = (value: string) => {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60_000));
  if (minutes < 1) return "JUST NOW";
  if (minutes < 60) return `${minutes} MIN AGO`;
  return `${Math.floor(minutes / 60)} HR AGO`;
};

export function AlertsScreen({ brands, items, onViewItem }: Props) {
  const alerts = useWistStore((state) => state.alerts);
  const markRead = useWistStore((state) => state.markAlertRead);
  const brandsById = Object.fromEntries(brands.map((brand) => [brand.id, brand]));
  const itemsById = Object.fromEntries(items.map((item) => [item.id, item]));
  const hero = alerts[0];
  const heroItem = hero ? itemsById[hero.itemId] : undefined;
  const heroBrand = heroItem ? brandsById[heroItem.brandId] : undefined;

  return (
    <ScrollView showsVerticalScrollIndicator={false} style={styles.screen}>
      <ScreenHeader kicker="SIGNALS FOR YOU" subtitle="Meaningful changes in the pieces you covet." title="Alerts" />
      {!hero || !heroItem || !heroBrand ? (
        <View style={styles.empty}>
          <Icon color={colors.moss} name="bell" size={28} />
          <Text style={styles.emptyTitle}>The room is quiet.</Text>
          <Text style={styles.emptyBody}>WIST is observing your pieces. A price movement will appear here when it deserves your attention.</Text>
        </View>
      ) : (
        <>
          <View style={styles.hero}>
            <View style={styles.heroTop}>
              <Text style={styles.live}>●  NEW SIGNAL</Text>
              <Text style={styles.time}>{relativeTime(hero.createdAt)}</Text>
            </View>
            <Image source={{ uri: heroItem.imageUrl }} style={styles.heroImage} />
            <View style={styles.heroCopy}>
              <Text style={styles.brand}>{heroBrand.name}</Text>
              <Text style={styles.heroName}>{heroItem.name}</Text>
              <Text style={styles.reason}>A piece you chose is now at its lowest observed price.</Text>
              <View style={styles.prices}>
                <View><Text style={styles.priceLabel}>NOW</Text><Text style={styles.newPrice}>€ {hero.newPrice.toFixed(0)}</Text></View>
                <View><Text style={styles.priceLabel}>WAS</Text><Text style={styles.wasPrice}>€ {hero.oldPrice.toFixed(0)}</Text></View>
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
          {alerts.length > 1 ? (
            <View style={styles.history}>
              <Text style={styles.historyTitle}>Earlier signals</Text>
              {alerts.slice(1).map((alert) => {
                const item = itemsById[alert.itemId];
                const brand = item ? brandsById[item.brandId] : undefined;
                if (!item || !brand) return null;
                return (
                  <Pressable
                    key={alert.id}
                    onPress={() => { markRead(alert.id); onViewItem(alert.itemId); }}
                    style={({ pressed }) => [styles.historyRow, pressed && styles.pressed]}
                  >
                    <Image source={{ uri: item.imageUrl }} style={styles.thumb} />
                    <View style={styles.historyBody}>
                      <Text style={styles.historyBrand}>{brand.name}</Text>
                      <Text style={styles.historyName}>{item.name}</Text>
                      <Text style={styles.historyPrice}>€ {alert.oldPrice.toFixed(0)} → € {alert.newPrice.toFixed(0)} · −{alert.pctOff}%</Text>
                    </View>
                    <Icon color={colors.ink} name="arrow" size={17} />
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.paper, flex: 1 },
  empty: { alignItems: "center", borderTopColor: colors.line, borderTopWidth: 1, marginHorizontal: spacing.gutter, paddingHorizontal: 25, paddingTop: 105 },
  emptyTitle: { ...typography.titleL, marginTop: 16 },
  emptyBody: { ...typography.body, marginTop: 6, textAlign: "center" },
  hero: { backgroundColor: colors.wine, borderRadius: radii.card, marginHorizontal: 14, padding: 8 },
  heroTop: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 8, paddingVertical: 8 },
  live: { ...typography.label, color: colors.card },
  time: { ...typography.label, color: colors.onWineMuted },
  heroImage: { aspectRatio: 5 / 4, backgroundColor: colors.line, width: "100%" },
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
  thumb: { borderRadius: radii.card, height: 75, width: 58 },
  historyBody: { flex: 1 },
  historyBrand: { ...typography.kicker, textTransform: "uppercase" },
  historyName: { ...typography.titleS, marginTop: 2 },
  historyPrice: { ...typography.price, color: colors.wine, marginTop: 4 },
  pressed: { opacity: 0.85 },
});
