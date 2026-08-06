import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Icon } from "../components/Icon";
import { brandsById, seedBrands } from "../data/seed";
import { seedPriceSource } from "../services/SeedPriceSource";
import { useCovetStore } from "../store/useCovetStore";
import { colors, fonts } from "../theme";

type Props = {
  onBrowseBrand: (brandId: string) => void;
  onOpenAlerts: () => void;
  onOpenBrowse: () => void;
};

export function FeedScreen({ onBrowseBrand, onOpenAlerts, onOpenBrowse }: Props) {
  const followedBrandIds = useCovetStore((state) => state.followedBrandIds);
  const covetedIds = useCovetStore((state) => state.starredItemIds);
  const toggleCovet = useCovetStore((state) => state.toggleStar);
  const alerts = useCovetStore((state) => state.alerts);
  useCovetStore((state) => state.priceRevision);

  const followedBrands = seedBrands.filter((brand) => followedBrandIds.includes(brand.id));
  const allItems = seedPriceSource.getAllItems();
  const latestAlert = alerts[0];
  const alertItem = latestAlert ? allItems.find((item) => item.id === latestAlert.itemId) : undefined;
  const edit = allItems.filter((item) => followedBrandIds.includes(item.brandId)).slice(0, 4);

  return (
    <ScrollView showsVerticalScrollIndicator={false} style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.wordmark}>COVET</Text>
        <Pressable accessibilityLabel="Open alerts" hitSlop={12} onPress={onOpenAlerts}>
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
        <Pressable accessibilityRole="button" onPress={onOpenAlerts} style={styles.signal}>
          <Image source={{ uri: alertItem.imageUrl }} style={styles.signalImage} />
          <View style={styles.signalBody}>
            <Text style={styles.signalKicker}>A COVETED PIECE JUST DROPPED</Text>
            <Text style={styles.signalName}>{alertItem.name}</Text>
            <View style={styles.priceRow}>
              <Text style={styles.signalPrice}>€ {latestAlert.newPrice.toFixed(0)}</Text>
              <Text style={styles.oldPrice}>€ {latestAlert.oldPrice.toFixed(0)}</Text>
              <Text style={styles.percent}>−{latestAlert.pctOff}%</Text>
            </View>
            <Text style={styles.signalLink}>VIEW THE SIGNAL  →</Text>
          </View>
        </Pressable>
      ) : (
        <View style={styles.quietSignal}>
          <Text style={styles.quietKicker}>COVET IS WATCHING</Text>
          <Text style={styles.quietTitle}>No meaningful changes yet.</Text>
          <Text style={styles.quietBody}>When a coveted piece drops in price, it will interrupt the quiet here.</Text>
        </View>
      )}

      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>From your houses</Text>
        <Pressable onPress={onOpenBrowse}><Text style={styles.textLink}>DISCOVER ALL</Text></Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.houses} horizontal showsHorizontalScrollIndicator={false}>
        {followedBrands.map((brand, index) => (
          <Pressable key={brand.id} onPress={() => onBrowseBrand(brand.id)} style={styles.house}>
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
        {edit.map((item, index) => {
          const coveted = covetedIds.includes(item.id);
          const brand = brandsById[item.brandId];
          return (
            <View key={item.id} style={[styles.editItem, index % 2 === 1 && styles.editItemLower]}>
              <View>
                <Image source={{ uri: item.imageUrl }} style={styles.editImage} />
                <Pressable
                  accessibilityLabel={`${coveted ? "Remove" : "Covet"} ${item.name}`}
                  accessibilityState={{ selected: coveted }}
                  onPress={() => toggleCovet(item.id)}
                  style={styles.covetButton}
                >
                  <Icon color={colors.ink} filled={coveted} name="heart" size={20} />
                </Pressable>
              </View>
              <Text style={styles.itemBrand}>{brand?.name}</Text>
              <Text numberOfLines={2} style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemPrice}>€ {item.currentPrice.toFixed(0)}</Text>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.paper, flex: 1 },
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 22, paddingTop: 10 },
  wordmark: { color: colors.ink, fontFamily: fonts.textSemibold, fontSize: 17, letterSpacing: 5 },
  badge: { backgroundColor: colors.wine, borderColor: colors.paper, borderRadius: 5, borderWidth: 2, height: 9, position: "absolute", right: -3, top: -3, width: 9 },
  intro: { paddingBottom: 28, paddingHorizontal: 22, paddingTop: 35 },
  kicker: { color: colors.muted, fontFamily: fonts.textSemibold, fontSize: 9, letterSpacing: 1.8 },
  title: { color: colors.ink, fontFamily: fonts.display, fontSize: 45, lineHeight: 44, marginTop: 10 },
  dek: { color: colors.muted, fontFamily: fonts.text, fontSize: 13, lineHeight: 20, marginTop: 13, maxWidth: 300 },
  signal: { backgroundColor: colors.wine, flexDirection: "row", marginBottom: 38, marginHorizontal: 14, minHeight: 190 },
  signalImage: { backgroundColor: colors.line, width: "40%" },
  signalBody: { flex: 1, justifyContent: "center", padding: 18 },
  signalKicker: { color: "#F5DDE0", fontFamily: fonts.textSemibold, fontSize: 8, letterSpacing: 1.4, lineHeight: 12 },
  signalName: { color: colors.card, fontFamily: fonts.display, fontSize: 24, lineHeight: 25, marginTop: 8 },
  priceRow: { alignItems: "baseline", flexDirection: "row", gap: 8, marginTop: 9 },
  signalPrice: { color: colors.card, fontFamily: fonts.textSemibold, fontSize: 16 },
  oldPrice: { color: "#E6B9BE", fontFamily: fonts.text, fontSize: 11, textDecorationLine: "line-through" },
  percent: { backgroundColor: colors.card, color: colors.wine, fontFamily: fonts.textSemibold, fontSize: 9, paddingHorizontal: 5, paddingVertical: 2 },
  signalLink: { color: colors.card, fontFamily: fonts.textSemibold, fontSize: 8, letterSpacing: 1.2, marginTop: 20 },
  quietSignal: { borderBottomColor: colors.line, borderTopColor: colors.line, borderTopWidth: 1, borderBottomWidth: 1, marginBottom: 38, marginHorizontal: 22, paddingVertical: 22 },
  quietKicker: { color: colors.moss, fontFamily: fonts.textSemibold, fontSize: 9, letterSpacing: 1.5 },
  quietTitle: { color: colors.ink, fontFamily: fonts.display, fontSize: 24, marginTop: 5 },
  quietBody: { color: colors.muted, fontFamily: fonts.text, fontSize: 12, lineHeight: 18, marginTop: 4, maxWidth: 300 },
  sectionHead: { alignItems: "baseline", flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 22 },
  sectionTitle: { color: colors.ink, fontFamily: fonts.display, fontSize: 28 },
  textLink: { color: colors.ink, fontFamily: fonts.textSemibold, fontSize: 8, letterSpacing: 1.2 },
  sectionNote: { color: colors.muted, fontFamily: fonts.textSemibold, fontSize: 8, letterSpacing: 1.2 },
  houses: { gap: 10, paddingBottom: 40, paddingHorizontal: 22, paddingTop: 14 },
  house: { borderColor: colors.line, borderTopWidth: 1, height: 94, justifyContent: "space-between", paddingTop: 9, width: 112 },
  houseIndex: { color: colors.muted, fontFamily: fonts.text, fontSize: 9 },
  houseName: { color: colors.ink, fontFamily: fonts.display, fontSize: 18, lineHeight: 19 },
  editGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, paddingBottom: 40, paddingHorizontal: 14, paddingTop: 16 },
  editItem: { marginBottom: 24, width: "48%" },
  editItemLower: { marginTop: 38 },
  editImage: { aspectRatio: 3 / 4, backgroundColor: colors.line, width: "100%" },
  covetButton: { alignItems: "center", backgroundColor: colors.card, bottom: 0, height: 42, justifyContent: "center", position: "absolute", right: 0, width: 42 },
  itemBrand: { color: colors.muted, fontFamily: fonts.textSemibold, fontSize: 8, letterSpacing: 1.2, marginTop: 9, textTransform: "uppercase" },
  itemName: { color: colors.ink, fontFamily: fonts.display, fontSize: 18, lineHeight: 19, marginTop: 3 },
  itemPrice: { color: colors.ink, fontFamily: fonts.textMedium, fontSize: 11, marginTop: 5 },
});
