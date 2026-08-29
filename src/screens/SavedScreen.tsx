import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { Icon } from "../components/Icon";
import { useWistStore } from "../store/useWistStore";
import { colors, fonts } from "../theme";
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
      <View style={styles.header}>
        <Text style={styles.kicker}>YOUR PERSONAL INDEX</Text>
        <Text style={styles.title}>Coveted</Text>
        <Text style={styles.subtitle}>{items.length} {items.length === 1 ? "piece" : "pieces"} remembered and watched.</Text>
      </View>
      <View style={styles.importCard}>
        <Text style={styles.importLabel}>WATCH A PRODUCT</Text>
        <Text style={styles.importTitle}>Paste its shop link.</Text>
        <Text style={styles.importBody}>
          Wist understands Shopify stores such as Goelia, plus Bobbies and
          Sandro Germany product pages.
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
        <Pressable
          disabled={!productUrl.trim() || importing}
          onPress={() => void submitProduct()}
          style={({ pressed }) => [
            styles.importButton,
            (!productUrl.trim() || importing) && styles.importButtonDisabled,
            pressed && styles.importButtonPressed,
          ]}
        >
          {importing ? (
            <ActivityIndicator color={colors.card} size="small" />
          ) : (
            <Text style={styles.importButtonText}>ADD TO COVETED</Text>
          )}
        </Pressable>
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
                <Pressable onPress={() => onOpenItem(item.id)}>
                  <Image source={{ uri: item.imageUrl }} style={styles.image} />
                </Pressable>
                <View style={styles.body}>
                  <Text style={styles.brand}>{brand?.name}</Text>
                  <Pressable onPress={() => onOpenItem(item.id)}>
                    <Text style={styles.name}>{item.name}</Text>
                  </Pressable>
                  <View style={styles.priceRow}>
                    <Text style={[styles.price, drop && styles.sale]}>€ {item.currentPrice.toFixed(0)}</Text>
                    {drop ? <Text style={styles.oldPrice}>€ {drop.oldPrice.toFixed(0)}</Text> : null}
                  </View>
                  <Text style={styles.since}>COVETED {covetedOn(snapshot?.capturedAt).toUpperCase()}</Text>
                  <Pressable onPress={() => onToggleCovet(item)} style={styles.remove}>
                    <Text style={styles.removeText}>REMOVE</Text>
                  </Pressable>
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
  header: { paddingBottom: 28, paddingHorizontal: 22, paddingTop: 12 },
  kicker: { color: colors.muted, fontFamily: fonts.textSemibold, fontSize: 8, letterSpacing: 1.8 },
  title: { color: colors.ink, fontFamily: fonts.display, fontSize: 45, lineHeight: 49, marginTop: 3 },
  subtitle: { color: colors.muted, fontFamily: fonts.text, fontSize: 12, marginTop: 5 },
  importCard: { backgroundColor: colors.card, borderColor: colors.line, borderRadius: 20, borderWidth: 1, marginBottom: 28, marginHorizontal: 14, padding: 18 },
  importLabel: { color: colors.wine, fontFamily: fonts.textSemibold, fontSize: 8, letterSpacing: 1.5 },
  importTitle: { color: colors.ink, fontFamily: fonts.display, fontSize: 27, marginTop: 4 },
  importBody: { color: colors.muted, fontFamily: fonts.text, fontSize: 11, lineHeight: 17, marginTop: 3 },
  urlInput: { borderBottomColor: colors.ink, borderBottomWidth: 1, color: colors.ink, fontFamily: fonts.text, fontSize: 12, marginTop: 18, paddingHorizontal: 0, paddingVertical: 10 },
  importError: { color: colors.wine, fontFamily: fonts.text, fontSize: 10, lineHeight: 15, marginTop: 8 },
  importButton: { alignItems: "center", backgroundColor: colors.ink, borderRadius: 999, height: 42, justifyContent: "center", marginTop: 14 },
  importButtonDisabled: { opacity: 0.35 },
  importButtonPressed: { opacity: 0.75 },
  importButtonText: { color: colors.card, fontFamily: fonts.textSemibold, fontSize: 9, letterSpacing: 1.3 },
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
  empty: { alignItems: "center", borderTopColor: colors.line, borderTopWidth: 1, marginHorizontal: 22, paddingHorizontal: 28, paddingTop: 100 },
  emptyTitle: { color: colors.ink, fontFamily: fonts.display, fontSize: 28, marginTop: 15 },
  emptyBody: { color: colors.muted, fontFamily: fonts.text, fontSize: 12, lineHeight: 19, marginTop: 6, textAlign: "center" },
});
