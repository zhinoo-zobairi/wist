import {
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { BrandAvatar } from "../components/BrandAvatar";
import { Icon } from "../components/Icon";
import { brandsById, seedBrands } from "../data/seed";
import { seedPriceSource } from "../services/SeedPriceSource";
import { useCovetStore } from "../store/useCovetStore";
import { colors, fonts, radii } from "../theme";
import type { Item } from "../types";

const formatPrice = (price: number) => `€ ${price.toFixed(0)}`;

function FeedCard({ item }: { item: Item }) {
  const brand = brandsById[item.brandId];
  const followedBrandIds = useCovetStore((state) => state.followedBrandIds);
  const starredItemIds = useCovetStore((state) => state.starredItemIds);
  const toggleFollow = useCovetStore((state) => state.toggleFollow);
  const toggleStar = useCovetStore((state) => state.toggleStar);
  const alerts = useCovetStore((state) => state.alerts);
  const latestDrop = alerts.find((alert) => alert.itemId === item.id);

  if (!brand) return null;

  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <BrandAvatar brand={brand} size="small" />
        <Text style={styles.brandName}>{brand.name}</Text>
        <Pressable
          accessibilityLabel={`Unfollow ${brand.name}`}
          accessibilityRole="button"
          accessibilityState={{ selected: true }}
          onPress={() => toggleFollow(brand.id)}
          style={styles.followPill}
        >
          <Text style={styles.followText}>
            {followedBrandIds.includes(brand.id) ? "Following" : "Follow"}
          </Text>
        </Pressable>
      </View>

      <View style={styles.imageWrap}>
        <Image
          accessibilityLabel={item.name}
          source={{ uri: item.imageUrl }}
          style={styles.itemImage}
        />
        {latestDrop ? (
          <View style={styles.dropTag}>
            <Text style={styles.dropTagText}>
              ▾ {latestDrop.pctOff}% · Price dropped
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.actions}>
        <Pressable
          accessibilityLabel={`${starredItemIds.includes(item.id) ? "Unstar" : "Star"} ${item.name}`}
          accessibilityRole="button"
          accessibilityState={{ selected: starredItemIds.includes(item.id) }}
          hitSlop={10}
          onPress={() => toggleStar(item.id)}
        >
          <Icon
            color={colors.ink}
            filled={starredItemIds.includes(item.id)}
            name="star"
            size={25}
          />
        </Pressable>
        <Icon color={colors.ink} name="share" size={24} />
        <View style={styles.actionSpacer} />
        <Icon color={colors.ink} name="bookmark" size={24} />
      </View>

      <View style={styles.meta}>
        <Text style={styles.itemName}>{item.name}</Text>
        <View style={styles.priceRow}>
          <Text style={[styles.price, latestDrop && styles.salePrice]}>
            {formatPrice(item.currentPrice)}
          </Text>
          {latestDrop ? (
            <Text style={styles.oldPrice}>{formatPrice(latestDrop.oldPrice)}</Text>
          ) : null}
        </View>
        <Text style={styles.caption}>
          {latestDrop
            ? "A piece you were watching just reached its lowest price yet."
            : "Star this piece and Covet will tell you the moment its price drops."}
        </Text>
      </View>
    </View>
  );
}

type FeedScreenProps = {
  onBrowseBrand: (brandId: string) => void;
  onOpenAlerts: () => void;
  onOpenBrowse: () => void;
};

export function FeedScreen({
  onBrowseBrand,
  onOpenAlerts,
  onOpenBrowse,
}: FeedScreenProps) {
  const followedBrandIds = useCovetStore((state) => state.followedBrandIds);
  useCovetStore((state) => state.priceRevision);
  const hasUnreadAlerts = useCovetStore((state) =>
    state.alerts.some((alert) => !alert.read),
  );
  const followedBrands = seedBrands.filter((brand) =>
    followedBrandIds.includes(brand.id),
  );
  const feedItems = seedPriceSource.getAllItems().filter((item) =>
    followedBrandIds.includes(item.brandId),
  );

  return (
    <FlatList
      ListEmptyComponent={
        <View style={styles.emptyFeed}>
          <Text style={styles.emptyTitle}>Your feed is quiet</Text>
          <Text style={styles.emptyBody}>Browse brands to follow them again.</Text>
        </View>
      }
      ListHeaderComponent={
        <>
          <View style={styles.appBar}>
            <Text style={styles.wordmark}>Covet</Text>
            <View style={styles.appBarIcons}>
              <Pressable
                accessibilityLabel="Browse brands"
                accessibilityRole="button"
                hitSlop={10}
                onPress={onOpenBrowse}
              >
                <Icon color={colors.ink} name="search" size={23} />
              </Pressable>
              <Pressable
                accessibilityLabel="Open price-drop alerts"
                accessibilityRole="button"
                hitSlop={10}
                onPress={onOpenAlerts}
              >
                <View>
                  <Icon color={colors.ink} name="bell" size={23} />
                  {hasUnreadAlerts ? <View style={styles.alertBadge} /> : null}
                </View>
              </Pressable>
            </View>
          </View>
          <ScrollView
            contentContainerStyle={styles.stories}
            horizontal
            showsHorizontalScrollIndicator={false}
          >
            {followedBrands.map((brand) => (
              <Pressable
                accessibilityLabel={`Browse ${brand.name}`}
                accessibilityRole="button"
                key={brand.id}
                onPress={() => onBrowseBrand(brand.id)}
                style={styles.story}
              >
                <BrandAvatar brand={brand} />
                <Text numberOfLines={1} style={styles.storyName}>
                  {brand.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </>
      }
      data={feedItems}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <FeedCard item={item} />}
      showsVerticalScrollIndicator={false}
      style={styles.list}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    backgroundColor: colors.paper,
    flex: 1,
  },
  appBar: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingBottom: 14,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  wordmark: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 31,
    letterSpacing: 1,
  },
  appBarIcons: {
    flexDirection: "row",
    gap: 16,
  },
  alertBadge: {
    backgroundColor: colors.wine,
    borderColor: colors.paper,
    borderRadius: 5,
    borderWidth: 2,
    height: 10,
    position: "absolute",
    right: -4,
    top: -3,
    width: 10,
  },
  stories: {
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    gap: 18,
    paddingBottom: 17,
    paddingHorizontal: 20,
    paddingTop: 6,
  },
  story: {
    alignItems: "center",
    gap: 7,
    width: 66,
  },
  storyName: {
    color: colors.ink,
    fontFamily: fonts.text,
    fontSize: 11,
    textAlign: "center",
  },
  card: {
    backgroundColor: colors.card,
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
  },
  cardHead: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  brandName: {
    color: colors.ink,
    flex: 1,
    fontFamily: fonts.textSemibold,
    fontSize: 14,
    letterSpacing: 0.2,
  },
  followPill: {
    borderColor: colors.wine,
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  followText: {
    color: colors.wine,
    fontFamily: fonts.textSemibold,
    fontSize: 12,
  },
  imageWrap: { marginHorizontal: 14 },
  itemImage: {
    aspectRatio: 4 / 5,
    backgroundColor: colors.line,
    borderRadius: radii.card,
    width: "100%",
  },
  dropTag: {
    backgroundColor: colors.wine,
    borderRadius: radii.pill,
    left: 12,
    paddingHorizontal: 11,
    paddingVertical: 6,
    position: "absolute",
    top: 12,
  },
  dropTagText: {
    color: colors.card,
    fontFamily: fonts.textSemibold,
    fontSize: 11,
    letterSpacing: 0.3,
  },
  actions: {
    alignItems: "center",
    flexDirection: "row",
    gap: 18,
    paddingBottom: 6,
    paddingHorizontal: 18,
    paddingTop: 14,
  },
  actionSpacer: {
    flex: 1,
  },
  meta: {
    paddingBottom: 18,
    paddingHorizontal: 18,
  },
  itemName: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 21,
    letterSpacing: 0.2,
  },
  price: {
    color: colors.ink,
    fontFamily: fonts.textSemibold,
    fontSize: 15,
    marginTop: 3,
  },
  priceRow: { alignItems: "baseline", flexDirection: "row", gap: 10 },
  salePrice: { color: colors.wine },
  oldPrice: {
    color: colors.muted,
    fontFamily: fonts.text,
    fontSize: 13,
    textDecorationLine: "line-through",
  },
  caption: {
    color: colors.muted,
    fontFamily: fonts.text,
    fontSize: 12.5,
    lineHeight: 19,
    marginTop: 6,
  },
  emptyFeed: {
    alignItems: "center",
    paddingHorizontal: 30,
    paddingVertical: 70,
  },
  emptyTitle: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 24,
  },
  emptyBody: {
    color: colors.muted,
    fontFamily: fonts.text,
    fontSize: 13,
    marginTop: 5,
  },
});
