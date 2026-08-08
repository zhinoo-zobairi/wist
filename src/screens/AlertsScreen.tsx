import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Icon } from "../components/Icon";
import { brandsById, itemsById } from "../data/seed";
import { useWistStore } from "../store/useWistStore";
import { colors, fonts } from "../theme";

type Props = { onViewItem: (itemId: string) => void };
const relativeTime = (value: string) => {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60_000));
  if (minutes < 1) return "JUST NOW";
  if (minutes < 60) return `${minutes} MIN AGO`;
  return `${Math.floor(minutes / 60)} HR AGO`;
};

export function AlertsScreen({ onViewItem }: Props) {
  const alerts = useWistStore((state) => state.alerts);
  const markRead = useWistStore((state) => state.markAlertRead);
  const hero = alerts[0];
  const heroItem = hero ? itemsById[hero.itemId] : undefined;
  const heroBrand = heroItem ? brandsById[heroItem.brandId] : undefined;

  return (
    <ScrollView showsVerticalScrollIndicator={false} style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.kicker}>SIGNALS FOR YOU</Text>
        <Text style={styles.title}>Alerts</Text>
        <Text style={styles.subtitle}>Meaningful changes in the pieces you covet.</Text>
      </View>
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
              <Pressable
                onPress={() => { markRead(hero.id); onViewItem(hero.itemId); }}
                style={styles.viewButton}
              >
                <Text style={styles.viewText}>VIEW PIECE</Text><Icon color={colors.card} name="arrow" size={17} />
              </Pressable>
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
                  <Pressable key={alert.id} onPress={() => { markRead(alert.id); onViewItem(alert.itemId); }} style={styles.historyRow}>
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
  header: { paddingBottom: 25, paddingHorizontal: 22, paddingTop: 12 },
  kicker: { color: colors.muted, fontFamily: fonts.textSemibold, fontSize: 8, letterSpacing: 1.8 },
  title: { color: colors.ink, fontFamily: fonts.display, fontSize: 45, lineHeight: 48, marginTop: 3 },
  subtitle: { color: colors.muted, fontFamily: fonts.text, fontSize: 12, marginTop: 5 },
  empty: { alignItems: "center", borderTopColor: colors.line, borderTopWidth: 1, marginHorizontal: 22, paddingHorizontal: 25, paddingTop: 105 },
  emptyTitle: { color: colors.ink, fontFamily: fonts.display, fontSize: 29, marginTop: 16 },
  emptyBody: { color: colors.muted, fontFamily: fonts.text, fontSize: 12, lineHeight: 19, marginTop: 6, textAlign: "center" },
  hero: { backgroundColor: colors.wine, marginHorizontal: 14, padding: 8 },
  heroTop: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 8, paddingVertical: 8 },
  live: { color: colors.card, fontFamily: fonts.textSemibold, fontSize: 8, letterSpacing: 1.4 },
  time: { color: "#E7BEC3", fontFamily: fonts.textMedium, fontSize: 8, letterSpacing: 1 },
  heroImage: { aspectRatio: 5 / 4, backgroundColor: colors.line, width: "100%" },
  heroCopy: { padding: 14 },
  brand: { color: "#E7BEC3", fontFamily: fonts.textSemibold, fontSize: 8, letterSpacing: 1.5, textTransform: "uppercase" },
  heroName: { color: colors.card, fontFamily: fonts.display, fontSize: 31, lineHeight: 32, marginTop: 4 },
  reason: { color: "#F2DADD", fontFamily: fonts.text, fontSize: 11, lineHeight: 17, marginTop: 7 },
  prices: { alignItems: "center", borderBottomColor: "#C86570", borderTopColor: "#C86570", borderTopWidth: 1, borderBottomWidth: 1, flexDirection: "row", gap: 29, marginTop: 16, paddingVertical: 13 },
  priceLabel: { color: "#E7BEC3", fontFamily: fonts.textSemibold, fontSize: 7, letterSpacing: 1.2 },
  newPrice: { color: colors.card, fontFamily: fonts.textSemibold, fontSize: 21, marginTop: 2 },
  wasPrice: { color: "#E7BEC3", fontFamily: fonts.text, fontSize: 15, marginTop: 4, textDecorationLine: "line-through" },
  off: { backgroundColor: colors.card, marginLeft: "auto", paddingHorizontal: 9, paddingVertical: 6 },
  offText: { color: colors.wine, fontFamily: fonts.textSemibold, fontSize: 12 },
  viewButton: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginTop: 14, paddingVertical: 7 },
  viewText: { color: colors.card, fontFamily: fonts.textSemibold, fontSize: 9, letterSpacing: 1.5 },
  history: { paddingHorizontal: 22, paddingVertical: 30 },
  historyTitle: { color: colors.ink, fontFamily: fonts.display, fontSize: 27, marginBottom: 11 },
  historyRow: { alignItems: "center", borderTopColor: colors.line, borderTopWidth: 1, flexDirection: "row", gap: 12, paddingVertical: 13 },
  thumb: { height: 75, width: 58 },
  historyBody: { flex: 1 },
  historyBrand: { color: colors.muted, fontFamily: fonts.textSemibold, fontSize: 7, letterSpacing: 1.2, textTransform: "uppercase" },
  historyName: { color: colors.ink, fontFamily: fonts.display, fontSize: 18, marginTop: 2 },
  historyPrice: { color: colors.wine, fontFamily: fonts.textMedium, fontSize: 10, marginTop: 4 },
});
