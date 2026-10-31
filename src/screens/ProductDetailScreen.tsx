import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Modal,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import { SafeAreaView } from "react-native-safe-area-context";

import { ActionLink } from "../components/ActionLink";
import { BackLink } from "../components/BackLink";
import { Button } from "../components/Button";
import { ProductPhoto } from "../components/ProductPhoto";
import { Wordmark } from "../components/Wordmark";
import { pageStyle, useLayout } from "../layout";
import { formatPrice } from "../money";
import { colors, fonts, radii, spacing, typography } from "../theme";
import type { Brand, Item } from "../types";
import type { AddGarmentFromItemResult } from "../services/catalogueClient";
import { useWistStore } from "../store/useWistStore";
import { purchaseErrorMessage, purchaseRecoveryAfterError, purchaseRefreshErrorMessage } from "../wardrobeMessages";

type Props = {
  brand: Brand;
  coveted: boolean;
  item: Item;
  onBack: () => void;
  onToggleCovet: () => void;
  selectedSizes: string[];
  onToggleSize: (label: string) => void;
  onBought: (result: AddGarmentFromItemResult) => void;
  watchBusy?: boolean;
};

const observedOn = (value?: string) =>
  value
    ? new Intl.DateTimeFormat("en", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "Unknown";

function ProductVideo({ active, height, url, width }: { active: boolean; height: number; url: string; width: number }) {
  const player = useVideoPlayer(url, (videoPlayer) => {
    videoPlayer.loop = true;
    videoPlayer.muted = true;
  });
  // Plays only while its gallery page is the one on screen.
  useEffect(() => {
    if (active) player.play();
    else player.pause();
  }, [active, player]);

  return (
    <VideoView
      contentFit="cover"
      nativeControls={false}
      player={player}
      playsInline
      style={{ backgroundColor: colors.ink, height, width }}
    />
  );
}

export function ProductDetailScreen({
  brand,
  coveted,
  item,
  onBack,
  onToggleCovet,
  selectedSizes,
  onToggleSize,
  onBought,
  watchBusy = false,
}: Props) {
  const layout = useLayout();
  const { wide, width } = layout;
  const [mediaColumnWidth, setMediaColumnWidth] = useState(0);
  const mediaWidth = wide ? mediaColumnWidth : Math.min(width, 480);
  const mediaHeight = mediaWidth * 1.25;
  const media =
    item.media && item.media.length > 0
      ? item.media
      : [{ type: "image" as const, url: item.imageUrl }];
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);
  const [confirmBuy, setConfirmBuy] = useState(false);
  const [buyBusy, setBuyBusy] = useState(false);
  const [buyError, setBuyError] = useState<string | null>(null);
  const [recovery, setRecovery] = useState<"refresh" | "repeat" | "owned" | null>(null);
  const pending = useRef(false);
  const alive = useRef(true);
  const buy = useWistStore((state) => state.addGarmentFromItem);
  const refreshPurchase = useWistStore((state) => state.refreshPurchaseState);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const addBoughtPiece = async () => {
    if (pending.current || watchBusy || recovery === "refresh" || recovery === "owned") return;
    pending.current = true;
    setBuyBusy(true); setBuyError(null); setConfirmBuy(false);
    try {
      const result = await buy(item.id);
      if (alive.current) onBought(result);
    } catch (caught) {
      if (alive.current) {
        setBuyError(purchaseErrorMessage(caught));
        setRecovery(purchaseRecoveryAfterError(caught));
      }
    } finally {
      pending.current = false;
      if (alive.current) setBuyBusy(false);
    }
  };

  const refreshBoughtPiece = async () => {
    if (pending.current) return;
    pending.current = true;
    setBuyBusy(true); setBuyError(null);
    try {
      await refreshPurchase();
      if (alive.current) {
        setRecovery(useWistStore.getState().starredItemIds.includes(item.id) ? "repeat" : "owned");
      }
    } catch (caught) {
      if (alive.current) { setBuyError(purchaseRefreshErrorMessage(caught)); setRecovery("refresh"); }
    } finally {
      pending.current = false;
      if (alive.current) setBuyBusy(false);
    }
  };
  const updateActiveMedia = (
    event: NativeSyntheticEvent<NativeScrollEvent>,
  ) => {
    setActiveMediaIndex(
      Math.round(event.nativeEvent.contentOffset.x / mediaWidth),
    );
  };

  return (
    <ScrollView contentContainerStyle={pageStyle(layout)} showsVerticalScrollIndicator={false} style={styles.screen}>
      <View style={styles.topbar}>
        <BackLink label="Back" onPress={onBack} />
        {wide ? null : <Wordmark />}
      </View>

      <View style={wide && styles.columns}>
        <View onLayout={(event) => setMediaColumnWidth(event.nativeEvent.layout.width)} style={wide && styles.mediaColumn}>
          {/* The wide column is measured first: until then there is no page width to lay out. */}
          {mediaWidth > 0 ? (
            <>
              <FlatList
                data={media}
                getItemLayout={(_, index) => ({ index, length: mediaWidth, offset: mediaWidth * index })}
                horizontal
                initialNumToRender={1}
                keyExtractor={(entry, index) => `${entry.url}-${index}`}
                onMomentumScrollEnd={updateActiveMedia}
                pagingEnabled
                renderItem={({ index, item: entry }) =>
                  entry.type === "video" ? (
                    <ProductVideo
                      active={index === activeMediaIndex}
                      height={mediaHeight}
                      url={entry.url}
                      width={mediaWidth}
                    />
                  ) : (
                    <ProductPhoto style={{ height: mediaHeight, width: mediaWidth }} uri={entry.url} />
                  )
                }
                showsHorizontalScrollIndicator={false}
                windowSize={3}
              />
              {media.length > 1 ? (
                <View style={styles.mediaCount}>
                  <Text style={styles.mediaCountText}>{activeMediaIndex + 1} / {media.length}</Text>
                </View>
              ) : null}
            </>
          ) : null}
        </View>

        <View style={[styles.body, wide && styles.bodyWide]}>
          <Text style={styles.brand}>{brand.name.toUpperCase()}</Text>
          <Text style={styles.name}>{item.name}</Text>
          <View style={styles.priceRow}>
            <Text style={styles.price}>{formatPrice(item.currentPrice, item.currency)}</Text>
            {item.previousPrice !== null && item.previousPrice !== undefined && item.previousPrice !== item.currentPrice ? (
              <Text style={styles.previous}>{formatPrice(item.previousPrice, item.currency)}</Text>
            ) : null}
          </View>

          <View style={styles.covet}>
            <Button
              disabled={buyBusy || watchBusy}
              icon="heart"
              iconFilled={coveted}
              label={coveted ? "Coveted — Wist is watching" : "Covet this piece"}
              onPress={onToggleCovet}
              selected={coveted}
              variant={coveted ? "primary" : "secondary"}
            />
          </View>

          {coveted && !recovery && !confirmBuy && (
            <View style={styles.bought}>
              <Button
                color={colors.moss}
                disabled={buyBusy || watchBusy}
                label="I bought this"
                onPress={() => setConfirmBuy(true)}
                variant="secondary"
              />
            </View>
          )}
          <Modal animationType="slide" presentationStyle="pageSheet" visible={confirmBuy}
            onRequestClose={() => !buyBusy && setConfirmBuy(false)}>
            <SafeAreaView edges={["top", "bottom"]} style={styles.buySheet}>
            <Text style={styles.buyHelp}>Add to your wardrobe? You'll stop getting price alerts for it.</Text>
            <View style={styles.buyActions}>
              <Button
                color={colors.moss}
                disabled={buyBusy || watchBusy}
                label="Add to wardrobe"
                onPress={() => void addBoughtPiece()}
              />
              <Button
                color={colors.moss}
                disabled={buyBusy}
                label="Cancel"
                onPress={() => setConfirmBuy(false)}
                variant="secondary"
              />
            </View>
            </SafeAreaView>
          </Modal>
          {buyBusy && <View style={styles.buyNotice}><ActivityIndicator color={colors.moss} />
            <Text style={styles.buyHelp}>{recovery === "refresh" ? "Refreshing…" : "Adding to wardrobe…"}</Text>
          </View>}
          {buyError && <Text accessibilityRole="alert" style={styles.buyHelp}>{buyError}</Text>}
          {recovery === "refresh" && (
            <ActionLink color={colors.moss} disabled={buyBusy} label="Refresh" onPress={() => void refreshBoughtPiece()} />
          )}
          {recovery === "owned" && <Text accessibilityRole="alert" style={styles.buyHelp}>This piece is in your wardrobe.</Text>}
          {recovery === "repeat" && coveted && <View style={[styles.buyNotice, styles.buyNoticeLinks]}>
            <Text style={styles.buyHelp}>This piece is still in Coveted. Trying again can add a duplicate and repeat paid tagging.</Text>
            <ActionLink color={colors.moss} disabled={buyBusy || watchBusy} label="Try again" onPress={() => void addBoughtPiece()} />
          </View>}

          {item.variants && item.variants.length > 0 ? (
            <View style={styles.variants}>
              <Text style={styles.variantsTitle}>OBSERVED SIZES</Text>
              <View style={styles.variantGrid}>
                {item.variants.map((variant) => {
                  const selected = selectedSizes.includes(variant.label);
                  const disabled = !coveted || buyBusy || watchBusy;
                  return (
                    <Pressable
                      accessibilityLabel={`Size ${variant.label}, ${variant.available ? "available" : "unavailable"}`}
                      accessibilityRole="button"
                      accessibilityState={{ disabled, selected }}
                      disabled={disabled}
                      key={variant.id}
                      onPress={() => onToggleSize(variant.label)}
                      style={({ pressed }) => [
                        styles.variant,
                        !variant.available && styles.variantUnavailable,
                        selected && styles.variantSelected,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text
                        style={[
                          styles.variantLabel,
                          !variant.available && styles.variantLabelUnavailable,
                          selected && styles.variantLabelSelected,
                        ]}
                      >
                        {variant.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={styles.variantNote}>
                {coveted
                  ? "Tap the sizes you want. WIST only alerts you when a drop lands in a chosen size — pick sold-out ones too."
                  : "Covet this piece to pick the sizes WIST should alert you on. Faded sizes were unavailable at the last check."}
              </Text>
            </View>
          ) : null}

          <View style={styles.facts}>
            <View style={styles.fact}>
              <Text style={styles.factLabel}>AVAILABILITY</Text>
              <Text style={styles.factValue}>{item.available ? "In stock" : "Unavailable"}</Text>
            </View>
            <View style={styles.fact}>
              <Text style={styles.factLabel}>PRODUCT ID</Text>
              <Text style={styles.factValue}>{item.sourceProductId ?? item.id}</Text>
            </View>
            <View style={styles.fact}>
              <Text style={styles.factLabel}>LAST CHECKED</Text>
              <Text style={styles.factValue}>{observedOn(item.observedAt)}</Text>
            </View>
          </View>

          <View style={styles.official}>
            <Button icon="arrow" label={`View on ${brand.name}`} onPress={() => {
              Linking.openURL(item.url).catch(() => setBuyError("Could not open the brand page."));
            }} />
          </View>
          <Text style={styles.note}>
            Product details and checkout remain authoritative on the brand’s official page.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.paper, flex: 1 },
  topbar: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", paddingHorizontal: spacing.gutter, paddingVertical: 15 },
  mediaCount: { backgroundColor: colors.card, borderRadius: radii.card, bottom: 12, paddingHorizontal: 9, paddingVertical: 5, position: "absolute", right: 12 },
  mediaCountText: typography.label,
  body: { paddingBottom: 48, paddingHorizontal: spacing.gutter, paddingTop: 25 },
  columns: { alignItems: "flex-start", flexDirection: "row", gap: 48, paddingHorizontal: spacing.gutter },
  mediaColumn: { flex: 7 },
  bodyWide: { flex: 5, paddingHorizontal: 0, paddingTop: 0 },
  brand: typography.kicker,
  name: { ...typography.titleXL, fontSize: 37, lineHeight: 39, marginTop: 7 },
  priceRow: { alignItems: "baseline", flexDirection: "row", gap: 10, marginTop: 12 },
  price: { ...typography.price, fontSize: 16 },
  previous: { ...typography.caption, textDecorationLine: "line-through" },
  covet: { marginTop: 24 },
  bought: { marginTop: 10 },
  buyNotice: { backgroundColor: colors.wash, borderRadius: radii.card, marginTop: 12, padding: 16 },
  // "Try again" hugs its label, so a tap beside it never repeats the purchase.
  buyNoticeLinks: { alignItems: "flex-start" },
  buySheet: { backgroundColor: colors.paper, flex: 1, justifyContent: "center", padding: 24 },
  buyActions: { gap: 10, marginTop: 20 },
  buyHelp: { ...typography.body, marginTop: 10 },
  variants: { marginTop: 30 },
  variantsTitle: typography.kicker,
  variantGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  variant: { alignItems: "center", borderColor: colors.ink, borderRadius: radii.card, borderWidth: 1, justifyContent: "center", minHeight: 38, minWidth: 44, paddingHorizontal: 10 },
  variantUnavailable: { borderColor: colors.line },
  variantSelected: { backgroundColor: colors.wine, borderColor: colors.wine },
  variantLabel: { color: colors.ink, fontFamily: fonts.label, fontSize: 11 },
  variantLabelUnavailable: { color: colors.muted, textDecorationLine: "line-through" },
  variantLabelSelected: { color: colors.card },
  variantNote: { ...typography.caption, marginTop: 9 },
  facts: { borderTopColor: colors.line, borderTopWidth: 1, marginTop: 30 },
  fact: { borderBottomColor: colors.line, borderBottomWidth: 1, flexDirection: "row", justifyContent: "space-between", paddingVertical: 14 },
  factLabel: typography.kicker,
  factValue: { ...typography.price, fontSize: 15, maxWidth: "60%", textAlign: "right" },
  official: { marginTop: 28 },
  note: { ...typography.caption, marginTop: 10 },
  pressed: { opacity: 0.85 },
});
