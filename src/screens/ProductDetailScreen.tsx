import { useState } from "react";
import {
  Image,
  Linking,
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

import { Icon } from "../components/Icon";
import { colors, fonts } from "../theme";
import type { Brand, Item } from "../types";

type Props = {
  brand: Brand;
  coveted: boolean;
  item: Item;
  onBack: () => void;
  onToggleCovet: () => void;
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
}: Props) {
  const { width } = useWindowDimensions();
  const mediaWidth = Math.min(width, 480);
  const mediaHeight = mediaWidth * 1.25;
  const media =
    item.media && item.media.length > 0
      ? item.media
      : [{ type: "image" as const, url: item.imageUrl }];
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);
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
          accessibilityState={{ selected: coveted }}
          onPress={onToggleCovet}
          style={[styles.covet, coveted && styles.coveted]}
        >
          <Icon color={coveted ? colors.card : colors.ink} filled={coveted} name="heart" size={19} />
          <Text style={[styles.covetText, coveted && styles.covetedText]}>
            {coveted ? "COVETED — WIST IS WATCHING" : "COVET THIS PIECE"}
          </Text>
        </Pressable>

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
  facts: { borderTopColor: colors.line, borderTopWidth: 1, marginTop: 30 },
  fact: { borderBottomColor: colors.line, borderBottomWidth: 1, flexDirection: "row", justifyContent: "space-between", paddingVertical: 14 },
  factLabel: { color: colors.muted, fontFamily: fonts.textSemibold, fontSize: 8, letterSpacing: 1.2 },
  factValue: { color: colors.ink, fontFamily: fonts.textMedium, fontSize: 11, maxWidth: "60%", textAlign: "right" },
  official: { alignItems: "center", backgroundColor: colors.ink, flexDirection: "row", justifyContent: "space-between", marginTop: 28, paddingHorizontal: 18, paddingVertical: 17 },
  officialText: { color: colors.card, fontFamily: fonts.textSemibold, fontSize: 9, letterSpacing: 1.3 },
  note: { color: colors.muted, fontFamily: fonts.text, fontSize: 10, lineHeight: 15, marginTop: 10 },
});
