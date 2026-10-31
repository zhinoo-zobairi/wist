import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Image,
  type LayoutChangeEvent,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { ActionLink } from "../components/ActionLink";
import { Button } from "../components/Button";
import { Icon } from "../components/Icon";
import { Wordmark } from "../components/Wordmark";
import { editorial, type EditorialImage } from "../data/editorialImages";
import { useLayout } from "../layout";
import { colors, fonts, radii, spacing, typography } from "../theme";

// react-native-web has no native animated module; it would only warn.
const NATIVE_DRIVER = Platform.OS !== "web";
const PAGES = 4;
// On wide windows each page is an open magazine: plates left, copy right.
const RIGHT_PAGE_SHARE = 0.44;

type Props = {
  onBegin: () => void;
  onSkip: () => void;
};

type Stage = { width: number; height: number };

type Motion = {
  index: number;
  scrollY: Animated.Value;
  stage: Stage;
  reduceMotion: boolean;
};

/** Three points on the scroll: the page before, this page centred, the page after. */
const range = ({ index, stage }: Motion) => [
  (index - 1) * stage.height,
  index * stage.height,
  (index + 1) * stage.height,
];

/**
 * A photograph that drifts as the reader scrolls. `speed` is the share of the
 * page height it travels between the page before and the page after; the back
 * plate moves slowly, the inset laid on top moves faster, which is what makes
 * the spread feel layered.
 */
function Plate({
  failed = false,
  fillHeight,
  image,
  motion,
  onError,
  speed,
  style,
  width,
}: {
  /** The photograph did not arrive: show the wash rectangle alone. */
  failed?: boolean;
  /** Crop to this height instead of the photograph's own proportion. */
  fillHeight?: number;
  image: EditorialImage;
  motion: Motion;
  onError: () => void;
  speed: number;
  style?: object;
  width: number;
}) {
  const inputRange = range(motion);
  const travel = motion.stage.height * speed;
  const translateY = motion.scrollY.interpolate({
    inputRange,
    outputRange: [travel, 0, -travel],
    extrapolate: "clamp",
  });
  const height = fillHeight ?? Math.round(width / image.aspect);
  return (
    <Animated.View
      style={[
        styles.plate,
        { width, height },
        style,
        { transform: motion.reduceMotion ? [] : [{ translateY }] },
      ]}
    >
      {failed ? null : (
        <Image
          accessibilityLabel={image.alt}
          onError={onError}
          resizeMode="cover"
          source={{ uri: image.url }}
          style={{ height, width }}
        />
      )}
    </Animated.View>
  );
}

/** Copy that fades and rises into place as its page arrives. */
function Copy({ motion, children, style }: { motion: Motion; children: ReactNode; style?: object }) {
  const inputRange = range(motion);
  const opacity = motion.scrollY.interpolate({ inputRange, outputRange: [0, 1, 0], extrapolate: "clamp" });
  const translateY = motion.scrollY.interpolate({ inputRange, outputRange: [28, 0, -28], extrapolate: "clamp" });
  return (
    <Animated.View style={[style, { opacity, transform: motion.reduceMotion ? [] : [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
}

function Credit({ image, light = false }: { image: EditorialImage; light?: boolean }) {
  const host = image.sourceUrl.replace(/^https?:\/\/(www\.)?/, "").replace(/\/.*$/, "");
  return (
    <Text style={[styles.credit, light && styles.creditLight]}>
      PHOTOGRAPHY · {image.brand.toUpperCase()} · {host.toUpperCase()}
    </Text>
  );
}

function Folio({ index, light = false }: { index: number; light?: boolean }) {
  return (
    <Text style={[styles.folio, light && styles.creditLight]}>
      {String(index + 1).padStart(2, "0")} / {String(PAGES).padStart(2, "0")}
    </Text>
  );
}

const FEATURES = [
  { title: "Price drops, in your size", body: "Covet a piece, pick the sizes you wear, and Wist checks the shop for you." },
  { title: "Alerts that speak once", body: "A drop is announced when it is a new low, and never twice." },
  { title: "Your wardrobe, by photo", body: "Photograph what you own and it is read, named and tagged for you." },
  { title: "Dressed for today", body: "Outfits composed from your own pieces, for the occasion and the weather." },
];

export function IntroScreen({ onBegin, onSkip }: Props) {
  const { wide } = useLayout();
  const [stage, setStage] = useState<Stage>({ width: 0, height: 0 });
  const [reduceMotion, setReduceMotion] = useState(false);
  // The plates are hotlinked from brand CDNs. One that fails keeps its wash rectangle and loses its credit line.
  const [failed, setFailed] = useState<Record<string, boolean>>({});
  const markFailed = (image: EditorialImage) => setFailed((prev) => ({ ...prev, [image.url]: true }));
  const scrollY = useRef(new Animated.Value(0)).current;
  const hint = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let active = true;
    Promise.resolve()
      .then(() => AccessibilityInfo.isReduceMotionEnabled())
      .then((enabled) => { if (active) setReduceMotion(enabled); })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (reduceMotion) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(hint, { duration: 900, easing: Easing.inOut(Easing.quad), toValue: 1, useNativeDriver: NATIVE_DRIVER }),
        Animated.timing(hint, { duration: 900, easing: Easing.inOut(Easing.quad), toValue: 0, useNativeDriver: NATIVE_DRIVER }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [hint, reduceMotion]);

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    // The height stays unrounded: pagingEnabled snaps by the ScrollView's frame, so a rounded page height would let the next page bleed through.
    setStage({ width: Math.round(width), height });
  };

  const ready = stage.width > 0 && stage.height > 0;
  const safeHeight = Math.max(stage.height, 1);
  const hintOpacity = scrollY.interpolate({
    inputRange: [(PAGES - 2) * safeHeight, (PAGES - 1) * safeHeight],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });
  const hintTranslate = hint.interpolate({ inputRange: [0, 1], outputRange: [0, 8], extrapolate: "clamp" });

  const motionFor = (index: number): Motion => ({ index, scrollY, stage, reduceMotion });
  const { width, height } = stage;
  // The plates live on the left page on wide windows, on the whole page on compact.
  const plateArea = wide ? width - Math.round(width * RIGHT_PAGE_SHARE) : width;
  const page = { width, height };
  const platesStyle = wide ? styles.leftPage : StyleSheet.absoluteFill;
  const copyStyle = (compact: object) => (wide ? styles.copyWide : compact);
  // The copy sits on the right page on wide windows; on compact it is anchored to the page edges, so its wrapper must fill the page.
  const copyPageStyle = wide ? styles.rightPage : StyleSheet.absoluteFill;

  return (
    <View style={styles.screen}>
      <View style={[styles.topline, wide && styles.toplineWide]}>
        <Wordmark />
        <ActionLink color={colors.muted} label="Skip" onPress={onSkip} />
      </View>
      <View onLayout={onLayout} style={styles.stage}>
        {ready ? (
          <Animated.ScrollView
            accessibilityLabel="Introduction"
            bounces={false}
            onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: NATIVE_DRIVER })}
            pagingEnabled
            scrollEventThrottle={16}
            showsVerticalScrollIndicator={false}
          >
            {/* 01 · Cover: a full-bleed plate with a smaller print laid over it. */}
            <View style={[styles.page, page, wide && styles.pageWide]}>
              <View style={platesStyle}>
                <Plate
                  failed={failed[editorial.cover.url]}
                  fillHeight={Math.round(height * 1.24)}
                  image={editorial.cover}
                  motion={motionFor(0)}
                  onError={() => markFailed(editorial.cover)}
                  speed={0.12}
                  style={[styles.coverPlate, { top: -Math.round(height * 0.12) }]}
                  width={plateArea}
                />
                <Plate
                  failed={failed[editorial.coverInset.url]}
                  image={editorial.coverInset}
                  motion={motionFor(0)}
                  onError={() => markFailed(editorial.coverInset)}
                  speed={0.3}
                  style={[styles.print, { right: spacing.gutter, top: height * 0.08 }]}
                  width={Math.round(plateArea * 0.42)}
                />
              </View>
              <View style={copyPageStyle}>
                <Copy motion={motionFor(0)} style={copyStyle(styles.coverCopy)}>
                  <Text style={styles.kicker}>N° 01 · THE QUIET WAY TO WANT</Text>
                  <Text accessibilityRole="header" style={styles.masthead}>Wist.</Text>
                  <Text style={styles.body}>From Kurdish: to want something deeply, and to wait for it.</Text>
                  {failed[editorial.cover.url] ? null : <Credit image={editorial.cover} />}
                </Copy>
                <Folio index={0} />
              </View>
            </View>

            {/* 02 · Covet: two prints overlapping, headline below. */}
            <View style={[styles.page, page, wide && styles.pageWide]}>
              <View style={platesStyle}>
                <Plate
                  failed={failed[editorial.covet.url]}
                  image={editorial.covet}
                  motion={motionFor(1)}
                  onError={() => markFailed(editorial.covet)}
                  speed={0.14}
                  style={{ left: 0, top: 0 }}
                  width={Math.round(plateArea * 0.7)}
                />
                <Plate
                  failed={failed[editorial.covetInset.url]}
                  image={editorial.covetInset}
                  motion={motionFor(1)}
                  onError={() => markFailed(editorial.covetInset)}
                  speed={0.32}
                  style={[styles.print, { right: spacing.gutter, top: height * 0.24 }]}
                  width={Math.round(plateArea * 0.46)}
                />
              </View>
              <View style={copyPageStyle}>
                <Copy motion={motionFor(1)} style={copyStyle(styles.lowerCopy)}>
                  <View style={styles.heartRow}>
                    <Icon color={colors.wine} filled name="heart" size={22} />
                    <Text style={styles.kicker}>A SHORT LIST, NOT A WISHLIST</Text>
                  </View>
                  <Text accessibilityRole="header" style={styles.headline}>You covet a piece.</Text>
                  <Text style={styles.body}>Only the things you truly want, in the sizes you actually wear.</Text>
                  {failed[editorial.covet.url] ? null : <Credit image={editorial.covet} />}
                </Copy>
                <Folio index={1} />
              </View>
            </View>

            {/* 03 · Watch: one plate with a price card drifting over it. */}
            <View style={[styles.page, page, wide && styles.pageWide]}>
              <View style={platesStyle}>
                <Plate
                  failed={failed[editorial.watch.url]}
                  image={editorial.watch}
                  motion={motionFor(2)}
                  onError={() => markFailed(editorial.watch)}
                  speed={0.12}
                  style={{ right: 0, top: 0 }}
                  width={Math.round(plateArea * 0.72)}
                />
                <Copy motion={motionFor(2)} style={[styles.priceCard, { left: spacing.gutter, top: height * 0.3 }]}>
                  <Text style={styles.priceKicker}>OBSERVED TODAY</Text>
                  <View style={styles.priceRow}>
                    <Text style={styles.priceOld}>€ 550</Text>
                    <Text style={styles.priceNew}>€ 385</Text>
                  </View>
                  <Text style={styles.priceOff}>−30% · A NEW LOW</Text>
                </Copy>
              </View>
              <View style={copyPageStyle}>
                <Copy motion={motionFor(2)} style={copyStyle(styles.lowerCopy)}>
                  <Text style={styles.kicker}>EVERY DAY, WITHOUT NOISE</Text>
                  <Text accessibilityRole="header" style={styles.headline}>Wist watches its price, quietly.</Text>
                  <Text style={styles.body}>No feed to scroll, nothing to check. It only speaks when something changes.</Text>
                  {failed[editorial.watch.url] ? null : <Credit image={editorial.watch} />}
                </Copy>
                <Folio index={2} />
              </View>
            </View>

            {/* 04 · Hero: what the agent does, on wine, with a print tucked in the corner. */}
            <View style={[styles.page, styles.pageWine, page, wide && styles.pageWide]}>
              <View style={[platesStyle, wide && styles.leftPageWine]}>
                <Plate
                  failed={failed[editorial.hero.url]}
                  image={editorial.hero}
                  motion={motionFor(3)}
                  onError={() => markFailed(editorial.hero)}
                  speed={0.26}
                  style={[styles.print, styles.printTilted, wide ? { left: spacing.gutterWide, top: height * 0.12 } : { right: -8, top: -12 }]}
                  width={Math.round(plateArea * (wide ? 0.62 : 0.4))}
                />
              </View>
              <View style={copyPageStyle}>
                <Copy motion={motionFor(3)} style={copyStyle(styles.heroCopy)}>
                  <Text style={[styles.kicker, styles.onWineMuted]}>WHAT WIST DOES FOR YOU</Text>
                  <Text accessibilityRole="header" style={[styles.headline, styles.onWine]}>When it drops, you know first.</Text>
                  <View style={styles.features}>
                    {FEATURES.map((feature, index) => (
                      <View key={feature.title} style={styles.feature}>
                        <Text style={[styles.featureIndex, styles.onWineMuted]}>{String(index + 1).padStart(2, "0")}</Text>
                        <View style={styles.featureCopy}>
                          <Text style={[styles.featureTitle, styles.onWine]}>{feature.title}</Text>
                          <Text style={[styles.featureBody, styles.onWineSoft]}>{feature.body}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                  <View style={styles.begin}>
                    <Button color={colors.card} label="Begin" labelColor={colors.wine} onPress={onBegin} />
                  </View>
                  {failed[editorial.hero.url] ? null : <Credit image={editorial.hero} light />}
                </Copy>
                <Folio index={3} light />
              </View>
            </View>
          </Animated.ScrollView>
        ) : null}
        <Animated.View
          style={[styles.hint, { opacity: hintOpacity, transform: [{ translateY: hintTranslate }, { rotate: "-90deg" }] }]}
        >
          <Icon color={colors.muted} name="chevron" size={20} />
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.paper, flex: 1 },
  topline: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: spacing.gutter,
    paddingVertical: 14,
  },
  toplineWide: { paddingHorizontal: spacing.gutterWide },
  stage: { flex: 1 },
  page: { overflow: "hidden", position: "relative" },
  pageWide: { flexDirection: "row" },
  pageWine: { backgroundColor: colors.wine },
  // Wide: the open magazine. Plates on the left page, copy on the right, a fold between.
  leftPage: {
    borderRightColor: colors.line,
    borderRightWidth: 1,
    flex: 1,
    overflow: "hidden",
    position: "relative",
  },
  leftPageWine: { borderRightColor: colors.onWineLine },
  rightPage: {
    justifyContent: "center",
    paddingHorizontal: 56,
    position: "relative",
    width: `${RIGHT_PAGE_SHARE * 100}%`,
  },
  copyWide: { maxWidth: 440 },
  plate: { backgroundColor: colors.wash, overflow: "hidden", position: "absolute" },
  coverPlate: { left: 0 },
  // A print laid on the spread: a paper mat around it and a soft shadow.
  print: {
    borderColor: colors.paper,
    borderWidth: 6,
    boxShadow: "0 14px 22px rgba(24, 23, 21, 0.22)",
  },
  printTilted: { transform: [{ rotate: "4deg" }] },
  coverCopy: {
    backgroundColor: colors.paper,
    bottom: 56,
    left: 0,
    maxWidth: "86%",
    paddingHorizontal: spacing.gutter,
    paddingVertical: 18,
    position: "absolute",
  },
  lowerCopy: {
    backgroundColor: colors.paper,
    bottom: 56,
    left: 0,
    maxWidth: "90%",
    paddingHorizontal: spacing.gutter,
    paddingTop: 16,
    position: "absolute",
  },
  heroCopy: { bottom: 56, left: 0, paddingHorizontal: spacing.gutter, position: "absolute", right: 0 },
  kicker: { ...typography.kicker, color: colors.wine },
  masthead: { color: colors.ink, fontFamily: fonts.display, fontSize: 84, lineHeight: 84, marginTop: 6 },
  headline: { color: colors.ink, fontFamily: fonts.display, fontSize: 42, lineHeight: 44, marginTop: 10 },
  body: { ...typography.body, color: colors.ink, marginTop: 12 },
  heartRow: { alignItems: "center", flexDirection: "row", gap: 10 },
  credit: { ...typography.label, color: colors.muted, marginTop: 14 },
  creditLight: { color: colors.onWineMuted },
  folio: { ...typography.label, bottom: 18, color: colors.muted, position: "absolute", right: spacing.gutter },
  priceCard: {
    backgroundColor: colors.card,
    borderRadius: radii.card,
    boxShadow: "0 12px 20px rgba(24, 23, 21, 0.18)",
    padding: 16,
    position: "absolute",
  },
  priceKicker: { ...typography.kicker },
  priceRow: { alignItems: "baseline", flexDirection: "row", gap: 10, marginTop: 6 },
  priceOld: { color: colors.muted, fontFamily: fonts.display, fontSize: 22, textDecorationLine: "line-through" },
  priceNew: { color: colors.wine, fontFamily: fonts.display, fontSize: 34 },
  priceOff: { ...typography.label, color: colors.wine, marginTop: 6 },
  onWine: { color: colors.card },
  onWineMuted: { color: colors.onWineMuted },
  onWineSoft: { color: colors.onWineSoft },
  features: { gap: 14, marginTop: 22 },
  feature: { flexDirection: "row", gap: 12 },
  featureIndex: { ...typography.label, paddingTop: 4, width: 22 },
  featureCopy: { flex: 1 },
  featureTitle: { fontFamily: fonts.display, fontSize: 22, lineHeight: 24 },
  featureBody: { ...typography.caption, marginTop: 2 },
  begin: { marginTop: 26 },
  hint: { alignItems: "center", bottom: 18, left: 0, pointerEvents: "none", position: "absolute", right: 0 },
});
