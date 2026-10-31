import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { ActionLink } from "../components/ActionLink";
import { Button } from "../components/Button";
import { Icon } from "../components/Icon";
import { IndexStatus } from "../components/IndexStatus";
import { ProductPhoto } from "../components/ProductPhoto";
import { formatPrice } from "../money";
import { requestPriceDropPermission } from "../services/notifications";
import { useWistStore } from "../store/useWistStore";
import { colors, fonts, radii, typography } from "../theme";
import type { Brand, CatalogueStatus, Item } from "../types";

/** Screen 12 asks for three pieces; more can be coveted after onboarding. */
const COVET_GOAL = 3;
const PHOTOS_PER_HOUSE = 3;
/** Enough of the catalogue to choose from without an endless scroll. */
const MAX_PIECES_SHOWN = 12;

export function HousesStep({ brands, catalogueStatus, items, onChange, onReload, picked }: {
  brands: Brand[];
  catalogueStatus: CatalogueStatus;
  items: Item[];
  onChange: (brandIds: string[]) => void;
  onReload: () => void;
  picked: string[];
}) {
  if (catalogueStatus !== "ready") {
    return <IndexStatus detail="You can skip this and follow houses from Profile." onReload={onReload} status={catalogueStatus} />;
  }
  return (
    <View style={storeStyles.stack}>
      <Text style={storeStyles.count}>Following {picked.length}.</Text>
      {brands.map((brand) => {
        const following = picked.includes(brand.id);
        const photos = items.filter((item) => item.brandId === brand.id).slice(0, PHOTOS_PER_HOUSE);
        return (
          <View key={brand.id} style={storeStyles.house}>
            <View style={storeStyles.houseTop}>
              <Text style={storeStyles.houseName}>{brand.name}</Text>
              <Button
                color={colors.wine} compact label={following ? "Following" : "Follow"}
                onPress={() => onChange(following ? picked.filter((id) => id !== brand.id) : [...picked, brand.id])}
                selected={following} variant={following ? "primary" : "secondary"}
              />
            </View>
            <View style={storeStyles.housePhotos}>
              {photos.map((item) => (
                <ProductPhoto accessibilityLabel={item.name} compact key={item.id} style={storeStyles.housePhoto} uri={item.imageUrl} />
              ))}
            </View>
          </View>
        );
      })}
      <Text style={storeStyles.note}>Any Shopify shop can be added later by pasting a product link in Coveted.</Text>
    </View>
  );
}

export function CovetStep({ brands, catalogueStatus, coveted, houseIds, items, onReload, onToggleCovet, syncingIds }: {
  brands: Brand[];
  catalogueStatus: CatalogueStatus;
  coveted: string[];
  houseIds: string[];
  items: Item[];
  onReload: () => void;
  onToggleCovet: (item: Item) => void;
  syncingIds: string[];
}) {
  const watchedSizes = useWistStore((state) => state.watchedSizesByItemId);
  if (catalogueStatus !== "ready") {
    return <IndexStatus detail="You can skip this and covet pieces once WIST reaches the index." onReload={onReload} status={catalogueStatus} />;
  }
  // A reader who skipped the houses sees the whole catalogue.
  const visible = items
    .filter((item) => houseIds.length === 0 || houseIds.includes(item.brandId))
    .slice(0, MAX_PIECES_SHOWN);
  const chosen = visible.filter((item) => coveted.includes(item.id));
  return (
    <View style={storeStyles.stack}>
      <Text style={storeStyles.count}>{chosen.length} of {COVET_GOAL} chosen.</Text>
      <View style={storeStyles.grid}>
        {visible.map((item) => {
          const isCoveted = coveted.includes(item.id);
          const sizes = watchedSizes[item.id] ?? [];
          const disabled = syncingIds.includes(item.id) || (!isCoveted && chosen.length >= COVET_GOAL);
          const price = formatPrice(item.currentPrice, item.currency);
          return (
            <Pressable
              accessibilityLabel={`${item.name}, ${price}`}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isCoveted, disabled }}
              disabled={disabled}
              key={item.id}
              onPress={() => onToggleCovet(item)}
              style={({ pressed }) => [storeStyles.piece, disabled && !isCoveted && storeStyles.disabled, pressed && storeStyles.pressed]}
            >
              <View>
                <ProductPhoto style={storeStyles.piecePhoto} uri={item.imageUrl} />
                <View style={storeStyles.heart}><Icon color={colors.ink} filled={isCoveted} name="heart" size={20} /></View>
              </View>
              <Text numberOfLines={1} style={storeStyles.pieceBrand}>{brands.find((brand) => brand.id === item.brandId)?.name ?? ""}</Text>
              <Text numberOfLines={2} style={storeStyles.pieceName}>{item.name}</Text>
              {/* Default sizes picked at covet time are shown here, never silent (Decision 5). */}
              <Text style={storeStyles.piecePrice}>{price}{sizes.length > 0 ? ` · size ${sizes.join(", ")}` : ""}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function NotifyStep({ brands, onAnswered, sample }: {
  brands: Brand[];
  onAnswered: (allowed: boolean) => void;
  /** A coveted piece for the sample banner, when there is one. */
  sample: Item | null;
}) {
  const [asking, setAsking] = useState(false);
  const allow = async () => {
    setAsking(true);
    const allowed = await requestPriceDropPermission();
    setAsking(false);
    onAnswered(allowed);
  };
  const house = (sample && brands.find((brand) => brand.id === sample.brandId)?.name) ?? "WIST";
  return (
    <View style={storeStyles.stack}>
      <View accessibilityLabel="An example notification" accessible style={storeStyles.banner}>
        <Text style={storeStyles.bannerTitle}>{house}: a drop in your size</Text>
        <Text style={storeStyles.bannerBody}>
          {sample
            ? `${sample.name} is now below the ${formatPrice(sample.currentPrice, sample.currency)} you coveted it at.`
            : "A piece you coveted is now below the price you wanted it at."}
        </Text>
      </View>
      <Button busy={asking} color={colors.wine} label="Turn on notifications" onPress={() => void allow()} />
      <View style={storeStyles.centered}>
        <ActionLink color={colors.muted} label="Not now" onPress={() => onAnswered(false)} />
      </View>
    </View>
  );
}

const storeStyles = StyleSheet.create({
  stack: { gap: 16 },
  count: { ...typography.caption },
  house: { borderTopColor: colors.line, borderTopWidth: 1, gap: 10, paddingTop: 12 },
  houseTop: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  houseName: { ...typography.titleM },
  housePhotos: { flexDirection: "row", gap: 6 },
  housePhoto: { aspectRatio: 3 / 4, flexBasis: "31%" },
  note: { ...typography.caption },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  piece: { flexBasis: "47%", gap: 3 },
  piecePhoto: { aspectRatio: 3 / 4, borderRadius: radii.card },
  heart: { backgroundColor: colors.card, borderRadius: radii.pill, padding: 6, position: "absolute", right: 8, top: 8 },
  pieceBrand: { ...typography.kicker, marginTop: 6 },
  pieceName: { color: colors.ink, fontFamily: fonts.text, fontSize: 15, lineHeight: 19 },
  piecePrice: { ...typography.price, fontSize: 14 },
  disabled: { opacity: 0.35 },
  pressed: { opacity: 0.7 },
  banner: { backgroundColor: colors.card, borderColor: colors.line, borderRadius: 14, borderWidth: 1, gap: 4, padding: 14 },
  bannerTitle: { color: colors.ink, fontFamily: fonts.label, fontSize: 13 },
  bannerBody: { ...typography.caption, color: colors.ink },
  centered: { alignItems: "center" },
});
