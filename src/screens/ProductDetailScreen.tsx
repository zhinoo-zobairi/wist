import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  Modal,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import { SafeAreaView } from "react-native-safe-area-context";

import { Icon } from "../components/Icon";
import { colors, fonts } from "../theme";
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

function ProductVideo({ height, url, width }: { height: number; url: string; width: number }) {
  const player = useVideoPlayer(url, (videoPlayer) => {
    videoPlayer.loop = true;
    videoPlayer.muted = true;
    videoPlayer.play();
  });

  return (
    <VideoView
      contentFit="cover"
      nativeControls
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
  const { width } = useWindowDimensions();
  const mediaWidth = Math.min(width, 480);
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
    <ScrollView showsVerticalScrollIndicator={false} style={styles.screen}>
      <View style={styles.topbar}>
        <Pressable accessibilityLabel="Back" onPress={onBack}>
          <Text style={styles.back}>← BACK</Text>
        </Pressable>
        <Text style={styles.wordmark}>WIST</Text>
      </View>

      <View>
        <ScrollView
          horizontal
          onMomentumScrollEnd={updateActiveMedia}
          pagingEnabled
          showsHorizontalScrollIndicator={false}
        >
          {media.map((entry, index) =>
            entry.type === "video" ? (
              <ProductVideo
                height={mediaHeight}
                key={`${entry.url}-${index}`}
                url={entry.url}
                width={mediaWidth}
              />
            ) : (
              <Image
                key={`${entry.url}-${index}`}
                resizeMode="cover"
                source={{ uri: entry.url }}
                style={{
                  backgroundColor: colors.line,
                  height: mediaHeight,
                  width: mediaWidth,
                }}
              />
            ),
          )}
        </ScrollView>
        <View style={styles.mediaCount}>
          <Text style={styles.mediaCountText}>
            {activeMediaIndex + 1} / {media.length}
          </Text>
        </View>
      </View>

      <View style={styles.body}>
        <Text style={styles.brand}>{brand.name.toUpperCase()}</Text>
        <Text style={styles.name}>{item.name}</Text>
        <View style={styles.priceRow}>
          <Text style={styles.price}>€ {item.currentPrice.toFixed(0)}</Text>
          {item.previousPrice !== null && item.previousPrice !== undefined ? (
            <Text style={styles.previous}>€ {item.previousPrice.toFixed(0)}</Text>
          ) : null}
        </View>

        <Pressable
          accessibilityState={{ selected: coveted, disabled: buyBusy || watchBusy }}
          disabled={buyBusy || watchBusy}
          onPress={onToggleCovet}
          style={[styles.covet, coveted && styles.coveted]}
        >
          <Icon color={coveted ? colors.card : colors.ink} filled={coveted} name="heart" size={19} />
          <Text style={[styles.covetText, coveted && styles.covetedText]}>
            {coveted ? "COVETED — WIST IS WATCHING" : "COVET THIS PIECE"}
          </Text>
        </Pressable>

        {coveted && !recovery && !confirmBuy && <Pressable accessibilityRole="button"
          disabled={buyBusy || watchBusy} onPress={() => setConfirmBuy(true)} style={styles.bought}>
          <Text style={styles.boughtText}>I bought this</Text>
        </Pressable>}
        <Modal animationType="slide" presentationStyle="pageSheet" visible={confirmBuy}
          onRequestClose={() => !buyBusy && setConfirmBuy(false)}>
          <SafeAreaView edges={["top", "bottom"]} style={styles.buySheet}>
          <Text style={styles.buyHelp}>Add to your wardrobe? You'll stop getting price alerts for it.</Text>
          <Pressable accessibilityRole="button" disabled={buyBusy || watchBusy} onPress={() => void addBoughtPiece()}>
            <Text style={styles.buyAction}>ADD TO WARDROBE</Text>
          </Pressable>
          <Pressable accessibilityRole="button" disabled={buyBusy} onPress={() => setConfirmBuy(false)}>
            <Text style={styles.buyAction}>CANCEL</Text>
          </Pressable>
          </SafeAreaView>
        </Modal>
        {buyBusy && <View style={styles.buyNotice}><ActivityIndicator color={colors.moss} />
          <Text style={styles.buyHelp}>{recovery === "refresh" ? "Refreshing…" : "Adding to wardrobe…"}</Text>
        </View>}
        {buyError && <Text accessibilityRole="alert" style={styles.buyHelp}>{buyError}</Text>}
        {recovery === "refresh" && <Pressable accessibilityRole="button" disabled={buyBusy} onPress={() => void refreshBoughtPiece()}>
          <Text style={styles.buyAction}>Refresh</Text>
        </Pressable>}
        {recovery === "owned" && <Text accessibilityRole="alert" style={styles.buyHelp}>This piece is in your wardrobe.</Text>}
        {recovery === "repeat" && coveted && <View style={styles.buyNotice}>
          <Text style={styles.buyHelp}>This piece is still in Coveted. Trying again can add a duplicate and repeat paid tagging.</Text>
          <Pressable accessibilityRole="button" disabled={buyBusy || watchBusy} onPress={() => void addBoughtPiece()}>
            <Text style={styles.buyAction}>Try again</Text>
          </Pressable>
        </View>}

        {item.variants && item.variants.length > 0 ? (
          <View style={styles.variants}>
            <Text style={styles.variantsTitle}>OBSERVED SIZES</Text>
            <View style={styles.variantGrid}>
              {item.variants.map((variant) => {
                const selected = selectedSizes.includes(variant.label);
                return (
                  <Pressable
                    accessibilityLabel={`Size ${variant.label}, ${variant.available ? "available" : "unavailable"}`}
                    accessibilityState={{ selected }}
                    disabled={!coveted || buyBusy || watchBusy}
                    key={variant.id}
                    onPress={() => onToggleSize(variant.label)}
                    style={[
                      styles.variant,
                      !variant.available && styles.variantUnavailable,
                      selected && styles.variantSelected,
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
                : "Faded sizes were unavailable at the last check."}
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

        <Pressable
          accessibilityRole="link"
          onPress={() => void Linking.openURL(item.url)}
          style={styles.official}
        >
          <Text style={styles.officialText}>VIEW ON {brand.name.toUpperCase()}</Text>
          <Icon color={colors.card} name="arrow" size={18} />
        </Pressable>
        <Text style={styles.note}>
          Product details and checkout remain authoritative on the brand’s official page.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.paper, flex: 1 },
  topbar: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 22, paddingVertical: 15 },
  back: { color: colors.ink, fontFamily: fonts.textSemibold, fontSize: 9, letterSpacing: 1.2 },
  wordmark: { color: colors.ink, fontFamily: fonts.textSemibold, fontSize: 14, letterSpacing: 4 },
  mediaCount: { backgroundColor: colors.card, bottom: 12, paddingHorizontal: 9, paddingVertical: 5, position: "absolute", right: 12 },
  mediaCountText: { color: colors.ink, fontFamily: fonts.textSemibold, fontSize: 9, letterSpacing: 0.8 },
  body: { paddingBottom: 48, paddingHorizontal: 22, paddingTop: 25 },
  brand: { color: colors.muted, fontFamily: fonts.textSemibold, fontSize: 9, letterSpacing: 1.5 },
  name: { color: colors.ink, fontFamily: fonts.display, fontSize: 37, lineHeight: 39, marginTop: 7 },
  priceRow: { alignItems: "baseline", flexDirection: "row", gap: 10, marginTop: 12 },
  price: { color: colors.ink, fontFamily: fonts.textSemibold, fontSize: 16 },
  previous: { color: colors.muted, fontFamily: fonts.text, fontSize: 12, textDecorationLine: "line-through" },
  covet: { alignItems: "center", borderColor: colors.ink, borderWidth: 1, flexDirection: "row", gap: 10, justifyContent: "center", marginTop: 24, paddingVertical: 15 },
  coveted: { backgroundColor: colors.ink, borderColor: colors.ink },
  covetText: { color: colors.ink, fontFamily: fonts.textSemibold, fontSize: 9, letterSpacing: 1.2 },
  covetedText: { color: colors.card },
  bought: { alignItems: "center", borderColor: colors.moss, borderWidth: 1, borderRadius: 999, marginTop: 12, paddingVertical: 15 },
  boughtText: { color: colors.moss, fontFamily: fonts.textSemibold, fontSize: 12 },
  buyNotice: { backgroundColor: colors.wash, borderRadius: 20, marginTop: 12, padding: 16 },
  buySheet: { backgroundColor: colors.paper, flex: 1, justifyContent: "center", padding: 24 },
  buyHelp: { color: colors.muted, fontFamily: fonts.text, fontSize: 12, lineHeight: 19, marginTop: 10 },
  buyAction: { color: colors.moss, fontFamily: fonts.textSemibold, fontSize: 12, paddingVertical: 12 },
  variants: { marginTop: 30 },
  variantsTitle: { color: colors.muted, fontFamily: fonts.textSemibold, fontSize: 8, letterSpacing: 1.2 },
  variantGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  variant: { alignItems: "center", borderColor: colors.ink, borderWidth: 1, justifyContent: "center", minHeight: 38, minWidth: 44, paddingHorizontal: 10 },
  variantUnavailable: { borderColor: colors.line },
  variantSelected: { backgroundColor: colors.wine, borderColor: colors.wine },
  variantLabel: { color: colors.ink, fontFamily: fonts.textMedium, fontSize: 11 },
  variantLabelUnavailable: { color: colors.muted, textDecorationLine: "line-through" },
  variantLabelSelected: { color: colors.card },
  variantNote: { color: colors.muted, fontFamily: fonts.text, fontSize: 9, marginTop: 9 },
  facts: { borderTopColor: colors.line, borderTopWidth: 1, marginTop: 30 },
  fact: { borderBottomColor: colors.line, borderBottomWidth: 1, flexDirection: "row", justifyContent: "space-between", paddingVertical: 14 },
  factLabel: { color: colors.muted, fontFamily: fonts.textSemibold, fontSize: 8, letterSpacing: 1.2 },
  factValue: { color: colors.ink, fontFamily: fonts.textMedium, fontSize: 11, maxWidth: "60%", textAlign: "right" },
  official: { alignItems: "center", backgroundColor: colors.ink, flexDirection: "row", justifyContent: "space-between", marginTop: 28, paddingHorizontal: 18, paddingVertical: 17 },
  officialText: { color: colors.card, fontFamily: fonts.textSemibold, fontSize: 9, letterSpacing: 1.3 },
  note: { color: colors.muted, fontFamily: fonts.text, fontSize: 10, lineHeight: 15, marginTop: 10 },
});
