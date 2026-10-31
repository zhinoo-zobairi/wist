import { useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { searchItems } from "../catalogueSearch";
import { ActionLink } from "../components/ActionLink";
import { Button } from "../components/Button";
import { Icon } from "../components/Icon";
import { IndexStatus } from "../components/IndexStatus";
import { ProductPhoto } from "../components/ProductPhoto";
import { ScreenHeader } from "../components/ScreenHeader";
import { pageStyle, useLayout } from "../layout";
import { useWistStore } from "../store/useWistStore";
import { formatPrice } from "../money";
import { colors, fonts, radii, spacing, typography } from "../theme";
import type { Brand, CatalogueStatus, Item } from "../types";

type Props = {
  brands: Brand[];
  catalogueStatus: CatalogueStatus;
  items: Item[];
  selectedBrandId: string;
  onReload: () => void;
  onSelectBrand: (brandId: string) => void;
  onOpenItem: (itemId: string) => void;
  onToggleCovet: (item: Item) => void;
};

export function BrowseScreen({ brands, catalogueStatus, items: allItems, selectedBrandId, onReload, onSelectBrand, onOpenItem, onToggleCovet }: Props) {
  const followed = useWistStore((state) => state.followedBrandIds);
  const coveted = useWistStore((state) => state.starredItemIds);
  const toggleFollow = useWistStore((state) => state.toggleFollow);
  useWistStore((state) => state.priceRevision);
  const layout = useLayout();
  const { wide } = layout;
  const numColumns = wide ? 3 : 1;
  const [query, setQuery] = useState("");
  const searching = query.trim().length > 0;
  const brand = brands.find((candidate) => candidate.id === selectedBrandId) ?? brands[0];
  const brandsById = Object.fromEntries(brands.map((entry) => [entry.id, entry]));
  const items = searching
    ? searchItems(allItems, brands, query)
    : brand ? allItems.filter((item) => item.brandId === brand.id) : [];

  return (
    <View style={styles.screen}>
      <View style={pageStyle(layout)}>
        <ScreenHeader kicker="THE WIST INDEX" title="Discover" />
        <View style={wide ? styles.controlsWide : undefined}>
          <View style={[styles.search, wide && styles.searchWide]}>
            <Icon color={colors.muted} name="search" size={19} />
            <TextInput
              accessibilityLabel="Search pieces"
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={setQuery}
              placeholder="Search across your brands"
              placeholderTextColor={colors.muted}
              returnKeyType="search"
              style={styles.searchInput}
              value={query}
            />
            {searching ? <ActionLink color={colors.muted} label="Clear" onPress={() => setQuery("")} /> : null}
          </View>
          {searching ? null : (
            <ScrollView
              contentContainerStyle={[styles.tabs, wide && styles.tabsWide]}
              horizontal
              showsHorizontalScrollIndicator={false}
              style={wide ? styles.tabsScrollWide : undefined}
            >
              {brands.map((item) => {
                const selected = item.id === brand?.id;
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => onSelectBrand(item.id)}
                    style={({ pressed }) => [styles.tab, pressed && styles.pressed]}
                  >
                    <Text style={[styles.tabText, selected && styles.tabSelected]}>{item.name}</Text>
                    {selected ? <View style={styles.tabLine} /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </View>
        {searching ? (
          <View style={styles.resultsHead}>
            <Text style={styles.count}>
              {items.length} {items.length === 1 ? "piece matches" : "pieces match"} “{query.trim()}”
            </Text>
          </View>
        ) : (
          <View style={[styles.brandHead, wide && styles.brandHeadWide]}>
            <View>
              <Text style={styles.brandLabel}>CURATED HOUSE</Text>
              <Text style={styles.brandName}>{brand?.name}</Text>
              <Text style={styles.count}>{items.length} pieces selected</Text>
            </View>
            {brand ? (
              <Button
                compact
                label={followed.includes(brand.id) ? "Following" : "Follow"}
                onPress={() => toggleFollow(brand.id)}
                variant={followed.includes(brand.id) ? "secondary" : "primary"}
              />
            ) : null}
          </View>
        )}
      </View>
      <FlatList
        columnWrapperStyle={wide ? styles.columnsWide : undefined}
        contentContainerStyle={[styles.list, pageStyle(layout), wide && styles.listWide]}
        data={items}
        key={numColumns}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        numColumns={numColumns}
        onRefresh={onReload}
        refreshing={catalogueStatus === "loading" && allItems.length > 0}
        ListEmptyComponent={
          <View style={styles.empty}>
            {!searching && catalogueStatus !== "ready" ? (
              <IndexStatus onReload={onReload} status={catalogueStatus} />
            ) : (
              <>
                <Text style={styles.emptyTitle}>{searching ? "Nothing matches." : "No pieces here yet."}</Text>
                <Text style={styles.emptyBody}>
                  {searching ? "Try a shorter word, or the brand name." : "This house has no pieces in the index yet."}
                </Text>
              </>
            )}
          </View>
        }
        renderItem={({ item, index }) => {
          const selected = coveted.includes(item.id);
          const covet = (
            <Pressable
              accessibilityLabel={`${selected ? "Remove" : "Covet"} ${item.name}`}
              accessibilityState={{ selected }}
              onPress={() => onToggleCovet(item)}
              style={({ pressed }) => [styles.covet, pressed && styles.pressed]}
            >
              <Icon color={colors.ink} filled={selected} name="heart" size={17} />
              <Text style={[styles.covetText, selected && styles.covetedText]}>{selected ? "COVETED" : "COVET"}</Text>
            </Pressable>
          );
          if (wide) {
            return (
              <View style={styles.cardWide}>
                <Pressable onPress={() => onOpenItem(item.id)} style={({ pressed }) => pressed && styles.pressed}>
                  <ProductPhoto style={styles.image} uri={item.imageUrl} />
                </Pressable>
                <Text style={styles.cardBrandWide}>{brandsById[item.brandId]?.name}</Text>
                <Pressable onPress={() => onOpenItem(item.id)} style={({ pressed }) => pressed && styles.pressed}>
                  <Text style={styles.productName}>{item.name}</Text>
                </Pressable>
                <Text style={styles.price}>{formatPrice(item.currentPrice, item.currency)}</Text>
                {covet}
              </View>
            );
          }
          return (
            <View style={[styles.product, index % 2 === 1 && styles.reverse]}>
              <Pressable
                onPress={() => onOpenItem(item.id)}
                style={({ pressed }) => [styles.imageLink, pressed && styles.pressed]}
              >
                <ProductPhoto style={styles.image} uri={item.imageUrl} />
              </Pressable>
              <View style={styles.productBody}>
                <Text style={styles.number}>
                  {searching ? brandsById[item.brandId]?.name.toUpperCase() : `0${index + 1}`}
                </Text>
                <View>
                  <Pressable onPress={() => onOpenItem(item.id)} style={({ pressed }) => pressed && styles.pressed}>
                    <Text style={styles.productName}>{item.name}</Text>
                  </Pressable>
                  <Text style={styles.price}>{formatPrice(item.currentPrice, item.currency)}</Text>
                  {covet}
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
  // Wide: the search field and the brand tabs share one row.
  controlsWide: { alignItems: "flex-end", flexDirection: "row", gap: spacing.gutterWide, paddingHorizontal: spacing.gutter },
  search: { alignItems: "center", borderBottomColor: colors.ink, borderBottomWidth: 1, flexDirection: "row", gap: 10, marginHorizontal: spacing.gutter, paddingBottom: 6 },
  searchWide: { flex: 1, marginHorizontal: 0 },
  searchInput: { ...typography.body, color: colors.ink, flex: 1, paddingVertical: 8 },
  resultsHead: { paddingHorizontal: spacing.gutter, paddingVertical: 19 },
  tabs: { gap: 22, paddingHorizontal: spacing.gutter, paddingVertical: 20 },
  tabsWide: { paddingHorizontal: 0, paddingVertical: 0 },
  tabsScrollWide: { flexGrow: 0, flexShrink: 1 },
  tab: { paddingBottom: 7 },
  tabText: { ...typography.label, color: colors.muted, fontFamily: fonts.label, fontSize: 11, letterSpacing: 0.3 },
  tabSelected: { color: colors.ink },
  tabLine: { backgroundColor: colors.ink, bottom: 0, height: 1, left: 0, position: "absolute", right: 0 },
  brandHead: { alignItems: "flex-end", borderTopColor: colors.line, borderTopWidth: 1, flexDirection: "row", justifyContent: "space-between", paddingHorizontal: spacing.gutter, paddingVertical: 19 },
  brandHeadWide: { marginTop: spacing.lg },
  brandLabel: typography.kicker,
  brandName: { ...typography.titleL, marginTop: 3 },
  count: typography.caption,
  list: { paddingBottom: 30, paddingHorizontal: spacing.gutter },
  // Wide: three columns of cards; maxWidth keeps a short last row on the grid.
  listWide: { paddingHorizontal: spacing.gutterWide },
  columnsWide: { gap: 24, marginBottom: 36 },
  cardWide: { flex: 1, maxWidth: "32%" },
  cardBrandWide: { ...typography.kicker, marginTop: 12, textTransform: "uppercase" },
  empty: { borderTopColor: colors.line, borderTopWidth: 1, paddingTop: 50 },
  emptyTitle: { ...typography.titleL, textAlign: "center" },
  emptyBody: { ...typography.body, marginTop: 7, textAlign: "center" },
  product: { flexDirection: "row", marginBottom: 14, minHeight: 226 },
  reverse: { flexDirection: "row-reverse" },
  image: { aspectRatio: 4 / 5, borderRadius: radii.card, width: "100%" },
  imageLink: { width: "61%" },
  productBody: { justifyContent: "space-between", padding: 14, width: "39%" },
  number: typography.kicker,
  productName: typography.titleM,
  price: { ...typography.price, marginTop: 7 },
  covet: { alignItems: "center", borderTopColor: colors.line, borderTopWidth: 1, flexDirection: "row", gap: 6, marginTop: 17, paddingTop: 9 },
  covetText: typography.label,
  covetedText: { color: colors.wine },
  pressed: { opacity: 0.85 },
});
