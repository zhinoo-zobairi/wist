import { FlatList, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Icon } from "../components/Icon";
import { seedBrands } from "../data/seed";
import { seedPriceSource } from "../services/SeedPriceSource";
import { useWistStore } from "../store/useWistStore";
import { colors, fonts } from "../theme";

type Props = { selectedBrandId: string; onSelectBrand: (brandId: string) => void };

export function BrowseScreen({ selectedBrandId, onSelectBrand }: Props) {
  const followed = useWistStore((state) => state.followedBrandIds);
  const coveted = useWistStore((state) => state.starredItemIds);
  const toggleFollow = useWistStore((state) => state.toggleFollow);
  const toggleCovet = useWistStore((state) => state.toggleStar);
  useWistStore((state) => state.priceRevision);
  const brand = seedBrands.find((candidate) => candidate.id === selectedBrandId) ?? seedBrands[0];
  const items = brand ? seedPriceSource.getItems(brand.id) : [];

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.kicker}>THE WIST INDEX</Text>
        <Text style={styles.title}>Discover</Text>
        <Pressable accessibilityLabel="Search pieces" style={styles.search}>
          <Icon color={colors.muted} name="search" size={19} />
          <Text style={styles.searchText}>Search across your brands</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.tabs} horizontal showsHorizontalScrollIndicator={false}>
        {seedBrands.map((item) => {
          const selected = item.id === brand?.id;
          return (
            <Pressable key={item.id} onPress={() => onSelectBrand(item.id)} style={styles.tab}>
              <Text style={[styles.tabText, selected && styles.tabSelected]}>{item.name}</Text>
              {selected ? <View style={styles.tabLine} /> : null}
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={styles.brandHead}>
        <View>
          <Text style={styles.brandLabel}>CURATED HOUSE</Text>
          <Text style={styles.brandName}>{brand?.name}</Text>
          <Text style={styles.count}>{items.length} pieces selected</Text>
        </View>
        {brand ? (
          <Pressable
            accessibilityState={{ selected: followed.includes(brand.id) }}
            onPress={() => toggleFollow(brand.id)}
            style={[styles.follow, followed.includes(brand.id) && styles.following]}
          >
            <Text style={[styles.followText, followed.includes(brand.id) && styles.followingText]}>
              {followed.includes(brand.id) ? "FOLLOWING" : "FOLLOW"}
            </Text>
          </Pressable>
        ) : null}
      </View>
      <FlatList
        contentContainerStyle={styles.list}
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => {
          const selected = coveted.includes(item.id);
          return (
            <View style={[styles.product, index % 2 === 1 && styles.reverse]}>
              <Image source={{ uri: item.imageUrl }} style={styles.image} />
              <View style={styles.productBody}>
                <Text style={styles.number}>0{index + 1}</Text>
                <View>
                  <Text style={styles.productName}>{item.name}</Text>
                  <Text style={styles.price}>€ {item.currentPrice.toFixed(0)}</Text>
                  <Pressable
                    accessibilityLabel={`${selected ? "Remove" : "Covet"} ${item.name}`}
                    accessibilityState={{ selected }}
                    onPress={() => toggleCovet(item.id)}
                    style={styles.covet}
                  >
                    <Icon color={colors.ink} filled={selected} name="heart" size={17} />
                    <Text style={[styles.covetText, selected && styles.covetedText]}>{selected ? "COVETED" : "COVET"}</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          );
        }}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.paper, flex: 1 },
  header: { paddingHorizontal: 22, paddingTop: 11 },
  kicker: { color: colors.muted, fontFamily: fonts.textSemibold, fontSize: 8, letterSpacing: 1.8 },
  title: { color: colors.ink, fontFamily: fonts.display, fontSize: 43, lineHeight: 48, marginTop: 2 },
  search: { alignItems: "center", borderBottomColor: colors.ink, borderBottomWidth: 1, flexDirection: "row", gap: 10, marginTop: 16, paddingBottom: 11 },
  searchText: { color: colors.muted, fontFamily: fonts.text, fontSize: 13 },
  tabs: { gap: 22, paddingHorizontal: 22, paddingVertical: 20 },
  tab: { paddingBottom: 7 },
  tabText: { color: colors.muted, fontFamily: fonts.textMedium, fontSize: 11 },
  tabSelected: { color: colors.ink },
  tabLine: { backgroundColor: colors.ink, bottom: 0, height: 1, left: 0, position: "absolute", right: 0 },
  brandHead: { alignItems: "flex-end", borderTopColor: colors.line, borderTopWidth: 1, flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 22, paddingVertical: 19 },
  brandLabel: { color: colors.muted, fontFamily: fonts.textSemibold, fontSize: 8, letterSpacing: 1.4 },
  brandName: { color: colors.ink, fontFamily: fonts.display, fontSize: 28, marginTop: 3 },
  count: { color: colors.muted, fontFamily: fonts.text, fontSize: 10 },
  follow: { backgroundColor: colors.ink, minWidth: 92, paddingHorizontal: 14, paddingVertical: 11 },
  following: { backgroundColor: "transparent", borderColor: colors.ink, borderWidth: 1 },
  followText: { color: colors.card, fontFamily: fonts.textSemibold, fontSize: 8, letterSpacing: 1.2, textAlign: "center" },
  followingText: { color: colors.ink },
  list: { paddingBottom: 30, paddingHorizontal: 14 },
  product: { flexDirection: "row", marginBottom: 14, minHeight: 226 },
  reverse: { flexDirection: "row-reverse" },
  image: { backgroundColor: colors.line, width: "61%" },
  productBody: { justifyContent: "space-between", padding: 14, width: "39%" },
  number: { color: colors.muted, fontFamily: fonts.text, fontSize: 9 },
  productName: { color: colors.ink, fontFamily: fonts.display, fontSize: 20, lineHeight: 21 },
  price: { color: colors.ink, fontFamily: fonts.textMedium, fontSize: 11, marginTop: 7 },
  covet: { alignItems: "center", borderTopColor: colors.line, borderTopWidth: 1, flexDirection: "row", gap: 6, marginTop: 17, paddingTop: 9 },
  covetText: { color: colors.ink, fontFamily: fonts.textSemibold, fontSize: 8, letterSpacing: 1.2 },
  covetedText: { color: colors.wine },
});
