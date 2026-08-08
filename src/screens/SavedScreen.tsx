import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Icon } from "../components/Icon";
import { brandsById } from "../data/seed";
import { seedPriceSource } from "../services/SeedPriceSource";
import { useWistStore } from "../store/useWistStore";
import { colors, fonts } from "../theme";

type Props = { onTriggerDrop: () => void };

const covetedOn = (value?: string) =>
  value ? new Intl.DateTimeFormat("en", { day: "numeric", month: "short" }).format(new Date(value)) : "Recently";

export function SavedScreen({ onTriggerDrop }: Props) {
  const ids = useWistStore((state) => state.starredItemIds);
  const alerts = useWistStore((state) => state.alerts);
  const snapshots = useWistStore((state) => state.snapshots);
  const toggleCovet = useWistStore((state) => state.toggleStar);
  useWistStore((state) => state.priceRevision);
  const items = seedPriceSource.getAllItems().filter((item) => ids.includes(item.id));

  return (
    <ScrollView showsVerticalScrollIndicator={false} style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.kicker}>YOUR PERSONAL INDEX</Text>
        <Text style={styles.title}>Coveted</Text>
        <Text style={styles.subtitle}>{items.length} {items.length === 1 ? "piece" : "pieces"} remembered and watched.</Text>
      </View>
      {items.length === 0 ? (
        <View style={styles.empty}>
          <Icon color={colors.ring} name="heart" size={30} />
          <Text style={styles.emptyTitle}>Nothing coveted yet.</Text>
          <Text style={styles.emptyBody}>Pieces you choose in Discover will form your personal collection here.</Text>
        </View>
      ) : (
        <View style={styles.collection}>
          {items.map((item, index) => {
            const brand = brandsById[item.brandId];
            const drop = alerts.find((alert) => alert.itemId === item.id);
            const snapshot = snapshots.find((candidate) => candidate.itemId === item.id);
            return (
              <View key={item.id} style={styles.row}>
                <Text style={styles.index}>0{index + 1}</Text>
                <Image source={{ uri: item.imageUrl }} style={styles.image} />
                <View style={styles.body}>
                  <Text style={styles.brand}>{brand?.name}</Text>
                  <Text style={styles.name}>{item.name}</Text>
                  <View style={styles.priceRow}>
                    <Text style={[styles.price, drop && styles.sale]}>€ {item.currentPrice.toFixed(0)}</Text>
                    {drop ? <Text style={styles.oldPrice}>€ {drop.oldPrice.toFixed(0)}</Text> : null}
                  </View>
                  <Text style={styles.since}>COVETED {covetedOn(snapshot?.capturedAt).toUpperCase()}</Text>
                  <Pressable onPress={() => toggleCovet(item.id)} style={styles.remove}>
                    <Text style={styles.removeText}>REMOVE</Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
          <View style={styles.demo}>
            <View style={styles.demoCopy}>
              <Text style={styles.demoLabel}>DEMO THE INTELLIGENCE LOOP</Text>
              <Text style={styles.demoText}>Lower the first coveted piece by 30% and let Wist notice.</Text>
            </View>
            <Pressable accessibilityLabel="Trigger a price drop" onPress={onTriggerDrop} style={styles.demoButton}>
              <Icon color={colors.card} name="arrow" size={18} />
            </Pressable>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.paper, flex: 1 },
  header: { paddingBottom: 28, paddingHorizontal: 22, paddingTop: 12 },
  kicker: { color: colors.muted, fontFamily: fonts.textSemibold, fontSize: 8, letterSpacing: 1.8 },
  title: { color: colors.ink, fontFamily: fonts.display, fontSize: 45, lineHeight: 49, marginTop: 3 },
  subtitle: { color: colors.muted, fontFamily: fonts.text, fontSize: 12, marginTop: 5 },
  collection: { borderTopColor: colors.ink, borderTopWidth: 1, marginHorizontal: 14 },
  row: { borderBottomColor: colors.line, borderBottomWidth: 1, flexDirection: "row", minHeight: 200, paddingVertical: 14 },
  index: { color: colors.muted, fontFamily: fonts.text, fontSize: 8, paddingRight: 9, paddingTop: 3, width: 25 },
  image: { backgroundColor: colors.line, width: 126 },
  body: { flex: 1, paddingLeft: 15, paddingVertical: 3 },
  brand: { color: colors.muted, fontFamily: fonts.textSemibold, fontSize: 8, letterSpacing: 1.2, textTransform: "uppercase" },
  name: { color: colors.ink, fontFamily: fonts.display, fontSize: 23, lineHeight: 24, marginTop: 5 },
  priceRow: { alignItems: "baseline", flexDirection: "row", gap: 8, marginTop: 8 },
  price: { color: colors.ink, fontFamily: fonts.textSemibold, fontSize: 12 },
  sale: { color: colors.wine },
  oldPrice: { color: colors.muted, fontFamily: fonts.text, fontSize: 10, textDecorationLine: "line-through" },
  since: { color: colors.muted, fontFamily: fonts.textMedium, fontSize: 7.5, letterSpacing: 1, marginTop: 19 },
  remove: { marginTop: 12 },
  removeText: { color: colors.ink, fontFamily: fonts.textSemibold, fontSize: 8, letterSpacing: 1.2, textDecorationLine: "underline" },
  demo: { alignItems: "center", backgroundColor: colors.ink, flexDirection: "row", marginBottom: 30, marginTop: 20, padding: 18 },
  demoCopy: { flex: 1, paddingRight: 12 },
  demoLabel: { color: colors.card, fontFamily: fonts.textSemibold, fontSize: 8, letterSpacing: 1.3 },
  demoText: { color: "#BFB9B0", fontFamily: fonts.text, fontSize: 11, lineHeight: 16, marginTop: 5 },
  demoButton: { alignItems: "center", borderColor: colors.card, borderWidth: 1, height: 42, justifyContent: "center", width: 42 },
  empty: { alignItems: "center", borderTopColor: colors.line, borderTopWidth: 1, marginHorizontal: 22, paddingHorizontal: 28, paddingTop: 100 },
  emptyTitle: { color: colors.ink, fontFamily: fonts.display, fontSize: 28, marginTop: 15 },
  emptyBody: { color: colors.muted, fontFamily: fonts.text, fontSize: 12, lineHeight: 19, marginTop: 6, textAlign: "center" },
});
