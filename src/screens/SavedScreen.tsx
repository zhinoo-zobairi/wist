import { useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { ActionLink } from "../components/ActionLink";
import { Button } from "../components/Button";
import { Icon } from "../components/Icon";
import { ScreenHeader } from "../components/ScreenHeader";
import { useWistStore } from "../store/useWistStore";
import { formatPrice } from "../money";
import { colors, radii, spacing, typography } from "../theme";
import type { Brand, Item } from "../types";

type Props = {
  brands: Brand[];
  items: Item[];
  onImportProduct: (productUrl: string) => Promise<void>;
  onOpenItem: (itemId: string) => void;
  onToggleCovet: (item: Item) => void;
};

const covetedOn = (value?: string) =>
  value ? new Intl.DateTimeFormat("en", { day: "numeric", month: "short" }).format(new Date(value)) : "Recently";

export function SavedScreen({
  brands,
  items: allItems,
  onImportProduct,
  onOpenItem,
  onToggleCovet,
}: Props) {
  const [productUrl, setProductUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const ids = useWistStore((state) => state.starredItemIds);
  const watchedSizesByItemId = useWistStore(
    (state) => state.watchedSizesByItemId,
  );
  const alerts = useWistStore((state) => state.alerts);
  const snapshots = useWistStore((state) => state.snapshots);
  useWistStore((state) => state.priceRevision);
  const brandsById = Object.fromEntries(brands.map((brand) => [brand.id, brand]));
  const items = allItems.filter((item) => ids.includes(item.id));

  const submitProduct = async () => {
    const url = productUrl.trim();
    if (!url || importing) return;
    setImportError("");
    setImporting(true);
    try {
      await onImportProduct(url);
      setProductUrl("");
    } catch (error) {
      setImportError(
        error instanceof Error ? error.message : "Could not add this product",
      );
    } finally {
      setImporting(false);
    }
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false} style={styles.screen}>
      <ScreenHeader
        kicker="YOUR PERSONAL INDEX"
        subtitle={`${items.length} ${items.length === 1 ? "piece" : "pieces"} remembered and watched.`}
        title="Coveted"
      />
      <View style={styles.importCard}>
        <Text style={styles.importLabel}>WATCH A PRODUCT</Text>
        <Text style={styles.importTitle}>Paste its shop link.</Text>
        <Text style={styles.importBody}>
          Wist understands Shopify stores such as Goelia, plus Bobbies,
          Sandro Germany, and Claudie Pierlot Germany product pages.
        </Text>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          onChangeText={setProductUrl}
          onSubmitEditing={() => void submitProduct()}
          placeholder="https://…"
          placeholderTextColor={colors.muted}
          returnKeyType="done"
          style={styles.urlInput}
          value={productUrl}
        />
        {importError ? <Text style={styles.importError}>{importError}</Text> : null}
        <View style={styles.importButton}>
          <Button
            busy={importing}
            disabled={!productUrl.trim()}
            label="Add to Coveted"
            onPress={() => void submitProduct()}
          />
        </View>
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
            const watchedSizes = watchedSizesByItemId[item.id] ?? [];
            return (
              <View key={item.id} style={styles.row}>
                <Text style={styles.index}>0{index + 1}</Text>
                <Pressable onPress={() => onOpenItem(item.id)} style={({ pressed }) => pressed && styles.pressed}>
                  <Image source={{ uri: item.imageUrl }} style={styles.image} />
                </Pressable>
                <View style={styles.body}>
                  <Text style={styles.brand}>{brand?.name}</Text>
                  <Pressable onPress={() => onOpenItem(item.id)} style={({ pressed }) => pressed && styles.pressed}>
                    <Text style={styles.name}>{item.name}</Text>
                  </Pressable>
                  <View style={styles.priceRow}>
                    <Text style={[styles.price, drop && styles.sale]}>{formatPrice(item.currentPrice, item.currency)}</Text>
                    {drop ? <Text style={styles.oldPrice}>{formatPrice(drop.oldPrice, item.currency)}</Text> : null}
                  </View>
                  <Text style={styles.since}>COVETED {covetedOn(snapshot?.capturedAt).toUpperCase()}</Text>
                  {watchedSizes.length > 0 ? (
                    <Text style={styles.sizes}>
                      ALERTS ON {watchedSizes.join(" · ")}
                    </Text>
                  ) : null}
                  <View style={styles.remove}>
                    <ActionLink label="Remove" onPress={() => onToggleCovet(item)} />
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.paper, flex: 1 },
  importCard: { backgroundColor: colors.card, borderColor: colors.line, borderRadius: radii.card, borderWidth: 1, marginBottom: 28, marginHorizontal: 14, padding: 18 },
  importLabel: { ...typography.kicker, color: colors.wine },
  importTitle: { ...typography.titleL, marginTop: 4 },
  importBody: { ...typography.caption, marginTop: 3 },
  urlInput: { ...typography.body, color: colors.ink, borderBottomColor: colors.ink, borderBottomWidth: 1, marginTop: 18, paddingHorizontal: 0, paddingVertical: 10 },
  importError: { ...typography.caption, color: colors.wine, marginTop: 8 },
  importButton: { marginTop: 14 },
  collection: { borderTopColor: colors.ink, borderTopWidth: 1, marginHorizontal: 14 },
  row: { borderBottomColor: colors.line, borderBottomWidth: 1, flexDirection: "row", minHeight: 200, paddingVertical: 14 },
  index: { ...typography.caption, paddingRight: 9, paddingTop: 3, width: 25 },
  image: { aspectRatio: 4 / 5, backgroundColor: colors.line, borderRadius: radii.card, width: 126 },
  body: { flex: 1, paddingLeft: 15, paddingVertical: 3 },
  brand: { ...typography.kicker, textTransform: "uppercase" },
  name: { ...typography.titleM, fontSize: 23, lineHeight: 25, marginTop: 5 },
  priceRow: { alignItems: "baseline", flexDirection: "row", gap: 8, marginTop: 8 },
  price: typography.price,
  sale: { color: colors.wine },
  oldPrice: { ...typography.caption, textDecorationLine: "line-through" },
  since: { ...typography.kicker, marginTop: 19 },
  sizes: { ...typography.kicker, color: colors.ink, marginTop: 6 },
  remove: { marginTop: 8 },
  empty: { alignItems: "center", borderTopColor: colors.line, borderTopWidth: 1, marginHorizontal: spacing.gutter, paddingHorizontal: 28, paddingTop: 100 },
  emptyTitle: { ...typography.titleL, marginTop: 15 },
  emptyBody: { ...typography.body, marginTop: 6, textAlign: "center" },
  pressed: { opacity: 0.85 },
});
