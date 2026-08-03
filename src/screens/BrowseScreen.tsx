import {
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { seedBrands } from "../data/seed";
import { seedPriceSource } from "../services/SeedPriceSource";
import { useCovetStore } from "../store/useCovetStore";
import { colors, fonts, radii } from "../theme";

type Props = {
  selectedBrandId: string;
  onSelectBrand: (brandId: string) => void;
};

export function BrowseScreen({ selectedBrandId, onSelectBrand }: Props) {
  const followedBrandIds = useCovetStore((state) => state.followedBrandIds);
  useCovetStore((state) => state.priceRevision);
  const starredItemIds = useCovetStore((state) => state.starredItemIds);
  const toggleFollow = useCovetStore((state) => state.toggleFollow);
  const toggleStar = useCovetStore((state) => state.toggleStar);
  const selectedBrand =
    seedBrands.find((brand) => brand.id === selectedBrandId) ?? seedBrands[0];
  const items = selectedBrand ? seedPriceSource.getItems(selectedBrand.id) : [];

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>CURATED BRANDS</Text>
        <Text style={styles.title}>Browse</Text>
      </View>
      <ScrollView
        contentContainerStyle={styles.brandTabs}
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        {seedBrands.map((brand) => {
          const selected = brand.id === selectedBrand?.id;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected }}
              key={brand.id}
              onPress={() => onSelectBrand(brand.id)}
              style={[styles.brandTab, selected && styles.brandTabSelected]}
            >
              <Text
                style={[styles.brandTabText, selected && styles.brandTabTextSelected]}
              >
                {brand.name}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={styles.brandHeading}>
        <View>
          <Text style={styles.brandTitle}>{selectedBrand?.name}</Text>
          <Text style={styles.itemCount}>{items.length} pieces</Text>
        </View>
        {selectedBrand ? (
          <Pressable
            accessibilityLabel={`${followedBrandIds.includes(selectedBrand.id) ? "Unfollow" : "Follow"} ${selectedBrand.name}`}
            accessibilityRole="button"
            accessibilityState={{ selected: followedBrandIds.includes(selectedBrand.id) }}
            onPress={() => toggleFollow(selectedBrand.id)}
            style={[
              styles.followButton,
              followedBrandIds.includes(selectedBrand.id) && styles.followingButton,
            ]}
          >
            <Text
              style={[
                styles.followButtonText,
                followedBrandIds.includes(selectedBrand.id) && styles.followingButtonText,
              ]}
            >
              {followedBrandIds.includes(selectedBrand.id) ? "Following" : "Follow"}
            </Text>
          </Pressable>
        ) : null}
      </View>
      <FlatList
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.grid}
        data={items}
        keyExtractor={(item) => item.id}
        numColumns={2}
        renderItem={({ item }) => (
          <View style={styles.gridItem}>
            <View>
              <Image
                accessibilityLabel={item.name}
                source={{ uri: item.imageUrl }}
                style={styles.image}
              />
              <Pressable
                accessibilityLabel={`${starredItemIds.includes(item.id) ? "Unstar" : "Star"} ${item.name}`}
                accessibilityRole="button"
                accessibilityState={{ selected: starredItemIds.includes(item.id) }}
                onPress={() => toggleStar(item.id)}
                style={styles.starButton}
              >
                <Ionicons
                  color={starredItemIds.includes(item.id) ? colors.wine : colors.ink}
                  name={starredItemIds.includes(item.id) ? "star" : "star-outline"}
                  size={20}
                />
              </Pressable>
            </View>
            <Text numberOfLines={1} style={styles.itemName}>
              {item.name}
            </Text>
            <Text style={styles.price}>€ {item.currentPrice.toFixed(0)}</Text>
          </View>
        )}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.paper,
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  eyebrow: {
    color: colors.muted,
    fontFamily: fonts.textSemibold,
    fontSize: 10,
    letterSpacing: 1.5,
  },
  title: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 34,
  },
  brandTabs: {
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  brandTab: {
    backgroundColor: colors.card,
    borderColor: colors.line,
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  brandTabSelected: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  brandTabText: {
    color: colors.ink,
    fontFamily: fonts.textMedium,
    fontSize: 12,
  },
  brandTabTextSelected: {
    color: colors.card,
  },
  brandHeading: {
    alignItems: "center",
    borderTopColor: colors.line,
    borderTopWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 13,
  },
  brandTitle: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 24,
  },
  itemCount: {
    color: colors.muted,
    fontFamily: fonts.text,
    fontSize: 11,
  },
  followButton: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  followingButton: {
    backgroundColor: "transparent",
    borderColor: colors.wine,
  },
  followButtonText: {
    color: colors.card,
    fontFamily: fonts.textSemibold,
    fontSize: 12,
  },
  followingButtonText: {
    color: colors.wine,
  },
  grid: {
    paddingBottom: 24,
    paddingHorizontal: 14,
  },
  row: {
    gap: 10,
  },
  gridItem: {
    flex: 1,
    marginBottom: 18,
    maxWidth: "50%",
  },
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
  itemName: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 17,
    marginTop: 8,
  },
  price: {
    color: colors.ink,
    fontFamily: fonts.textMedium,
    fontSize: 12,
    marginTop: 2,
  },
});
