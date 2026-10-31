import { useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { ActionLink } from "../components/ActionLink";
import { Button } from "../components/Button";
import { Icon } from "../components/Icon";
import { IndexStatus } from "../components/IndexStatus";
import { ProductPhoto } from "../components/ProductPhoto";
import { ScreenHeader } from "../components/ScreenHeader";
import { pageStyle, useLayout } from "../layout";
import { useWistStore } from "../store/useWistStore";
import { formatPrice } from "../money";
import { colors, radii, spacing, typography } from "../theme";
import type { Brand, CatalogueStatus, Item } from "../types";

type Props = {
  brands: Brand[];
  catalogueStatus: CatalogueStatus;
  items: Item[];
  /** Rejects when the piece was not added; otherwise resolves whether the list could be refreshed. */
  onImportProduct: (productUrl: string) => Promise<boolean>;
  onOpenItem: (itemId: string) => void;
  onReload: () => void;
  onToggleCovet: (item: Item) => void;
};

const covetedOn = (value?: string) =>
  value ? new Intl.DateTimeFormat("en", { day: "numeric", month: "short" }).format(new Date(value)) : "Recently";

export function SavedScreen({
  brands,
  catalogueStatus,
  items: allItems,
  onImportProduct,
  onOpenItem,
  onReload,
  onToggleCovet,
}: Props) {
  const layout = useLayout();
  const { wide } = layout;
  const [productUrl, setProductUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const [importNotice, setImportNotice] = useState("");
  // The one piece whose Remove waits for a second tap; opening another closes it.
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const ids = useWistStore((state) => state.starredItemIds);
  const watchedSizesByItemId = useWistStore(
    (state) => state.watchedSizesByItemId,
  );
  const alerts = useWistStore((state) => state.alerts);
  const snapshots = useWistStore((state) => state.snapshots);
  useWistStore((state) => state.priceRevision);
  const brandsById = Object.fromEntries(brands.map((brand) => [brand.id, brand]));
  const items = allItems.filter((item) => ids.includes(item.id));
  // Without the index the device still knows what it covets, so count the ids.
  const covetedCount = catalogueStatus === "ready" ? items.length : ids.length;

  const submitProduct = async () => {
    const url = productUrl.trim();
    if (!url || importing) return;
    setImportError("");
    setImportNotice("");
    setImporting(true);
    try {
      // Resolving means the server holds the watch: the import is done.
      const refreshed = await onImportProduct(url);
      setProductUrl("");
      if (!refreshed) setImportNotice("Added. WIST could not refresh the list yet.");
    } catch (error) {
      setImportError(
        error instanceof Error ? error.message : "Could not add this product",
      );
    } finally {
      setImporting(false);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={pageStyle(layout)}
      // The first tap on ADD TO COVETED adds, rather than only closing the keyboard.
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl onRefresh={onReload} refreshing={catalogueStatus === "loading" && allItems.length > 0} tintColor={colors.wine} />}
      showsVerticalScrollIndicator={false}
      style={styles.screen}
    >
      <ScreenHeader
        kicker="YOUR PERSONAL INDEX"
        subtitle={`${covetedCount} ${covetedCount === 1 ? "piece" : "pieces"} remembered and watched.`}
        title="Coveted"
      />
      <View style={wide && styles.columns}>
        <View style={[styles.importCard, wide && styles.importCardWide]}>
          <Text style={styles.importLabel}>WATCH A PRODUCT</Text>
          <Text style={styles.importTitle}>Paste its shop link.</Text>
          <Text style={styles.importBody}>
            Wist understands Shopify stores such as Goelia, plus Bobbies,
            Sandro Germany, and Claudie Pierlot Germany product pages.
          </Text>
          <TextInput
            accessibilityLabel="Shop link"
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
            keyboardType="url"
            onChangeText={setProductUrl}
            onSubmitEditing={() => void submitProduct()}
            placeholder="https://…"
            placeholderTextColor={colors.muted}
            returnKeyType="go"
            style={styles.urlInput}
            textContentType="URL"
            value={productUrl}
          />
          {importError ? <Text style={styles.importError}>{importError}</Text>
            : importNotice ? <Text style={styles.importNotice}>{importNotice}</Text> : null}
          <View style={styles.importButton}>
            <Button
              busy={importing}
              disabled={!productUrl.trim()}
              label="Add to Coveted"
              onPress={() => void submitProduct()}
            />
          </View>
        </View>
        {items.length === 0 && catalogueStatus !== "ready" ? (
          <View style={[styles.empty, wide && styles.emptyWide]}>
            <IndexStatus
              detail={`${ids.length} ${ids.length === 1 ? "piece" : "pieces"} coveted. Reconnect to see them.`}
              onReload={onReload}
              status={catalogueStatus}
            />
          </View>
        ) : items.length === 0 ? (
          <View style={[styles.empty, wide && styles.emptyWide]}>
            <Icon color={colors.ring} name="heart" size={30} />
            <Text style={styles.emptyTitle}>Nothing coveted yet.</Text>
            <Text style={styles.emptyBody}>Pieces you choose in Discover will form your personal collection here.</Text>
          </View>
        ) : (
          <View style={[styles.collection, wide && styles.collectionWide]}>
            {items.map((item, index) => {
              const brand = brandsById[item.brandId];
              const drop = alerts.find((alert) => alert.itemId === item.id);
              const snapshot = snapshots.find((candidate) => candidate.itemId === item.id);
              const watchedSizes = watchedSizesByItemId[item.id] ?? [];
              return (
                <View key={item.id} style={styles.entry}>
                  <View style={styles.row}>
                    <Text style={styles.index}>0{index + 1}</Text>
                    <Pressable onPress={() => onOpenItem(item.id)} style={({ pressed }) => pressed && styles.pressed}>
                      <ProductPhoto style={[styles.image, wide && styles.imageWide]} uri={item.imageUrl} />
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
                        <ActionLink label="Remove" onPress={() => setConfirmRemoveId(confirmRemoveId === item.id ? null : item.id)} />
                      </View>
                    </View>
                  </View>
                  {confirmRemoveId === item.id ? (
                    <View style={styles.confirm}>
                      <Text style={styles.help}>Stop watching this piece? Its sizes are forgotten too.</Text>
                      <ActionLink color={colors.wine} label="Remove" onPress={() => { setConfirmRemoveId(null); onToggleCovet(item); }} />
                      <ActionLink label="Keep" onPress={() => setConfirmRemoveId(null)} />
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.paper, flex: 1 },
  importCard: { backgroundColor: colors.card, borderColor: colors.line, borderRadius: radii.card, borderWidth: 1, marginBottom: 28, marginHorizontal: spacing.gutter, padding: 18 },
  importLabel: { ...typography.kicker, color: colors.wine },
  importTitle: { ...typography.titleL, marginTop: 4 },
  importBody: { ...typography.caption, marginTop: 3 },
  urlInput: { ...typography.body, color: colors.ink, borderBottomColor: colors.ink, borderBottomWidth: 1, marginTop: 18, paddingHorizontal: 0, paddingVertical: 10 },
  importError: { ...typography.caption, color: colors.wine, marginTop: 8 },
  importNotice: { ...typography.caption, marginTop: 8 },
  importButton: { marginTop: 14 },
  columns: { alignItems: "flex-start", flexDirection: "row", gap: 48, paddingHorizontal: spacing.gutter },
  importCardWide: { flex: 5, marginBottom: 0, marginHorizontal: 0 },
  collection: { borderTopColor: colors.ink, borderTopWidth: 1, marginHorizontal: spacing.gutter },
  collectionWide: { flex: 7, marginHorizontal: 0 },
  entry: { borderBottomColor: colors.line, borderBottomWidth: 1 },
  row: { flexDirection: "row", minHeight: 200, paddingVertical: 14 },
  index: { ...typography.caption, paddingRight: 9, paddingTop: 3, width: 25 },
  image: { aspectRatio: 4 / 5, borderRadius: radii.card, width: 126 },
  imageWide: { width: 160 },
  body: { flex: 1, paddingLeft: 15, paddingVertical: 3 },
  brand: { ...typography.kicker, textTransform: "uppercase" },
  name: { ...typography.titleM, fontSize: 23, lineHeight: 25, marginTop: 5 },
  priceRow: { alignItems: "baseline", flexDirection: "row", gap: 8, marginTop: 8 },
  price: typography.price,
  sale: { color: colors.wine },
  oldPrice: { ...typography.caption, textDecorationLine: "line-through" },
  since: { ...typography.kicker, marginTop: 19 },
  sizes: { ...typography.kicker, color: colors.ink, marginTop: 6 },
  remove: { alignSelf: "flex-start", marginTop: 8 },
  // The GarmentEdit confirm box; its links hug their label.
  confirm: { alignItems: "flex-start", backgroundColor: colors.wash, borderRadius: radii.card, gap: 6, marginBottom: 14, padding: 16 },
  help: { ...typography.body, marginVertical: 8 },
  empty: { alignItems: "center", borderTopColor: colors.line, borderTopWidth: 1, marginHorizontal: spacing.gutter, paddingHorizontal: 28, paddingTop: 100 },
  emptyWide: { flex: 7, marginHorizontal: 0 },
  emptyTitle: { ...typography.titleL, marginTop: 15 },
  emptyBody: { ...typography.body, marginTop: 6, textAlign: "center" },
  pressed: { opacity: 0.85 },
});
