import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
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
import { colors, fonts, spacing, typography } from "../theme";

// react-native-web has no native animated module; it would only warn.
const NATIVE_DRIVER = Platform.OS !== "web";
const PANEL_COUNT = 4;

type Props = {
  onBegin: () => void;
  onSkip: () => void;
};

function Panel({
  children,
  dark = false,
  height,
  index,
  reduceMotion,
  scrollY,
}: {
  children: ReactNode;
  dark?: boolean;
  height: number;
  index: number;
  reduceMotion: boolean;
  scrollY: Animated.Value;
}) {
  // Fully visible when the panel is centred, faded and shifted one panel away.
  const inputRange = [(index - 1) * height, index * height, (index + 1) * height];
  const opacity = scrollY.interpolate({ inputRange, outputRange: [0, 1, 0], extrapolate: "clamp" });
  const translateY = scrollY.interpolate({ inputRange, outputRange: [36, 0, -36], extrapolate: "clamp" });
  return (
    <View style={[styles.panel, { height }, dark && styles.panelDark]}>
      <Animated.View style={[styles.panelBody, { opacity, transform: reduceMotion ? [] : [{ translateY }] }]}>
        {children}
      </Animated.View>
    </View>
  );
}

export function IntroScreen({ onBegin, onSkip }: Props) {
  const [height, setHeight] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
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

  const onLayout = (event: LayoutChangeEvent) => setHeight(Math.round(event.nativeEvent.layout.height));

  const safeHeight = Math.max(height, 1);
  const hintOpacity = scrollY.interpolate({
    inputRange: [(PANEL_COUNT - 2) * safeHeight, (PANEL_COUNT - 1) * safeHeight],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });
  const hintTranslate = hint.interpolate({ inputRange: [0, 1], outputRange: [0, 8], extrapolate: "clamp" });
  const panelProps = { height, reduceMotion, scrollY };

  return (
    <View style={styles.screen}>
      <View style={styles.topline}>
        <Wordmark />
        <ActionLink color={colors.muted} label="Skip" onPress={onSkip} />
      </View>
      <View onLayout={onLayout} style={styles.stage}>
        {height > 0 ? (
          <Animated.ScrollView
            accessibilityLabel="Introduction"
            bounces={false}
            onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: NATIVE_DRIVER })}
            pagingEnabled
            scrollEventThrottle={16}
            showsVerticalScrollIndicator={false}
          >
            <Panel index={0} {...panelProps}>
              <Text style={styles.kicker}>WIST · /WIːST/</Text>
              <Text accessibilityRole="header" style={styles.display}>Wist.</Text>
              <Text style={styles.body}>From Kurdish. To want something deeply, and to wait for it.</Text>
            </Panel>
            <Panel index={1} {...panelProps}>
              <Icon color={colors.wine} filled name="heart" size={34} />
              <Text accessibilityRole="header" style={[styles.display, styles.afterIcon]}>You covet a piece.</Text>
              <Text style={styles.body}>Not a wishlist. A short list of things you truly want, in the sizes you wear.</Text>
            </Panel>
            <Panel index={2} {...panelProps}>
              <Text style={styles.kicker}>EVERY DAY, WITHOUT NOISE</Text>
              <Text accessibilityRole="header" style={styles.display}>Wist watches its price, quietly.</Text>
              <Text style={styles.body}>No feed to scroll, nothing to check. It only speaks when something changes.</Text>
            </Panel>
            <Panel dark index={3} {...panelProps}>
              <Text style={[styles.kicker, styles.onWineKicker]}>A COVETED PIECE JUST DROPPED</Text>
              <Text accessibilityRole="header" style={[styles.display, styles.onWine]}>When it drops, you know first.</Text>
              <View style={styles.priceRow}>
                <Text style={styles.oldPrice}>€ 550</Text>
                <Text style={styles.newPrice}>€ 385</Text>
              </View>
              <View style={styles.begin}>
                <Button color={colors.card} label="Begin" labelColor={colors.wine} onPress={onBegin} />
              </View>
            </Panel>
          </Animated.ScrollView>
        ) : null}
        <Animated.View
          pointerEvents="none"
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
  stage: { flex: 1 },
  panel: { justifyContent: "center", paddingHorizontal: spacing.gutter + 6 },
  panelDark: { backgroundColor: colors.wine },
  panelBody: { maxWidth: 360 },
  kicker: { ...typography.kicker, color: colors.wine, marginBottom: 14 },
  onWineKicker: { color: colors.onWineMuted },
  display: { color: colors.ink, fontFamily: fonts.display, fontSize: 48, lineHeight: 50 },
  afterIcon: { marginTop: 18 },
  onWine: { color: colors.card },
  body: { ...typography.body, fontSize: 15, lineHeight: 23, marginTop: 16 },
  priceRow: { alignItems: "baseline", flexDirection: "row", gap: 14, marginTop: 22 },
  oldPrice: { color: colors.onWineMuted, fontFamily: fonts.display, fontSize: 28, textDecorationLine: "line-through" },
  newPrice: { color: colors.card, fontFamily: fonts.display, fontSize: 40 },
  begin: { alignSelf: "stretch", marginTop: 34 },
  hint: { alignItems: "center", bottom: 18, left: 0, position: "absolute", right: 0 },
});
