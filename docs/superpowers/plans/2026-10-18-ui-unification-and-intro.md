# UI Unification and Scrollytelling Intro Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One editorial visual language across every screen, four UI bugs fixed, and a four-panel scroll-driven intro before the profile questions, working on iOS and web.

**Architecture:** `src/theme.ts` gains a named type scale and the tint colours; five small primitives (`Wordmark`, `Button`, `BackLink`, `ActionLink`, `ScreenHeader`) in `src/components/` replace inline buttons, links and headers. Every screen is migrated onto them. `IntroScreen` is a phase inside `OnboardingScreen`, driven by a built-in `Animated.ScrollView`. `searchItems` in `src/catalogueSearch.ts` powers a real Discover filter. `App.tsx` passes the live catalogue to Alerts and Profile.

**Tech Stack:** Expo SDK 57, React Native 0.86, react-native-web 0.21, TypeScript, vitest. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-18-ui-unification-and-intro-design.md` (owner-approved 2026-10-18, decisions 1–13).

---

## Conventions (read once)

- Run all commands from the repo root `/Users/zhinoo.zobairi/Code/WIST`.
- Full checks: `npm run typecheck && npm test`. Typecheck covers both the app and the catalogue service. Tests never render screens, so a screen-only task can only break typecheck.
- Commit subjects: `type(scope): description`, lowercase, imperative, no trailing period, **no AI attribution trailers**. Do not push.
- Mobile imports have no file suffix (`../theme`, not `../theme.js`).
- Screens keep their `StyleSheet.create` block. Replace numbers with tokens by spreading: `kicker: { ...typography.kicker, color: colors.wine }`.
- "Gutter" means `spacing.gutter` (22), the horizontal padding every screen uses.
- Never leave a hardcoded hex colour in a screen. If a colour is missing from the theme, stop and add it to the theme first.
- Every `Pressable` that is not a primitive gets pressed feedback: `style={({ pressed }) => [styles.x, pressed && styles.pressed]}` with `pressed: { opacity: 0.85 }` for images and rows, `0.7` for text.
- When several tasks run in parallel, **agents do not commit**. The coordinator commits each slice after review. Agents run `npx tsc --noEmit` and report only errors in the files they own; errors in other files belong to a sibling task still in progress.

## Parallelisation map

```
Wave 1 (coordinator):     Task 1 primitives ─┬─ Task 2 search helper
                                             │
Wave 2 (5 agents, disjoint files):           ▼
  A  Task 3  App.tsx + AlertsScreen + ProfileScreen
  B  Task 4  IntroScreen + OnboardingScreen
  C  Task 5  FeedScreen + BottomTabBar + OccasionStylePicker + GarmentPhoto
     Task 6  BrowseScreen (search UI)
  D  Task 7  ProductDetailScreen + SavedScreen
  E  Task 8  WardrobeScreen + GarmentEditScreen + OutfitSuggestionsScreen
Wave 3 (coordinator):     Task 9  web + iOS walkthrough, commits, ticket
```

---

### Task 1: Theme type scale and shared primitives

**Files:**
- Modify: `src/theme.ts`
- Modify: `src/components/Icon.tsx`
- Create: `src/components/Wordmark.tsx`
- Create: `src/components/Button.tsx`
- Create: `src/components/BackLink.tsx`
- Create: `src/components/ActionLink.tsx`
- Create: `src/components/ScreenHeader.tsx`

- [ ] **Step 1: Replace `src/theme.ts`**

```ts
export const colors = {
  paper: "#F4F1EB",
  card: "#FFFFFF",
  ink: "#181715",
  muted: "#77736C",
  line: "#DCD7CE",
  wine: "#A52A37",
  ring: "#B6A88C",
  moss: "#4E5748",
  wash: "#E9E4DC",
  // Text and rules on a wine block.
  onWineMuted: "#E7BEC3",
  onWineSoft: "#F2DADD",
  onWineLine: "#C86570",
  // Text on a moss block.
  onMossMuted: "#C9D0C4",
  onMossSoft: "#D8DDD4",
} as const;

export const fonts = {
  display: "CormorantGaramond_600SemiBold",
  displayItalic: "CormorantGaramond_600SemiBold_Italic",
  text: "Inter_400Regular",
  textMedium: "Inter_500Medium",
  textSemibold: "Inter_600SemiBold",
} as const;

export const radii = {
  card: 3,
  pill: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 14,
  lg: 20,
  xl: 28,
  gutter: 22,
} as const;

// Named text styles. Screens spread these and may override colour:
//   kicker: { ...typography.kicker, color: colors.wine }
// Nothing in the app sits below 10 px.
export const typography = {
  wordmark: { fontFamily: fonts.display, fontSize: 22, letterSpacing: 4, color: colors.ink },
  kicker: { fontFamily: fonts.textSemibold, fontSize: 10, letterSpacing: 1.6, color: colors.muted },
  label: { fontFamily: fonts.textSemibold, fontSize: 10, letterSpacing: 1.2, color: colors.ink },
  caption: { fontFamily: fonts.text, fontSize: 11, lineHeight: 16, color: colors.muted },
  body: { fontFamily: fonts.text, fontSize: 13, lineHeight: 20, color: colors.muted },
  price: { fontFamily: fonts.textSemibold, fontSize: 13, color: colors.ink },
  titleXL: { fontFamily: fonts.display, fontSize: 44, lineHeight: 46, color: colors.ink },
  titleL: { fontFamily: fonts.display, fontSize: 28, lineHeight: 32, color: colors.ink },
  titleM: { fontFamily: fonts.display, fontSize: 20, lineHeight: 22, color: colors.ink },
  titleS: { fontFamily: fonts.display, fontSize: 18, lineHeight: 20, color: colors.ink },
} as const;
```

- [ ] **Step 2: Add the chevron to `src/components/Icon.tsx`**

Add `| "chevron"` to `IconName` and this entry to `paths`:

```tsx
    chevron: <Path d="M15 6l-6 6 6 6" />,
```

- [ ] **Step 3: Create `src/components/Wordmark.tsx`**

```tsx
import { StyleSheet, Text } from "react-native";

import { typography } from "../theme";

export function Wordmark({ color }: { color?: string }) {
  return (
    <Text accessibilityRole="header" style={[styles.wordmark, color ? { color } : null]}>
      WIST
    </Text>
  );
}

const styles = StyleSheet.create({
  wordmark: typography.wordmark,
});
```

- [ ] **Step 4: Create `src/components/Button.tsx`**

```tsx
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { Icon, type IconName } from "./Icon";
import { colors, radii, typography } from "../theme";

type Props = {
  label: string;
  onPress: () => void;
  /** primary = filled with `color`; secondary = 1 px outline in `color`. */
  variant?: "primary" | "secondary";
  /** Fill (primary) or outline and label (secondary). Defaults to ink. */
  color?: string;
  /** Overrides the label colour: card on primary, `color` on secondary. */
  labelColor?: string;
  busy?: boolean;
  disabled?: boolean;
  icon?: IconName;
  iconFilled?: boolean;
  /** 38 px tall, for inline actions such as FOLLOW. */
  compact?: boolean;
  accessibilityLabel?: string;
};

export function Button({
  label,
  onPress,
  variant = "primary",
  color = colors.ink,
  labelColor,
  busy = false,
  disabled = false,
  icon,
  iconFilled = false,
  compact = false,
  accessibilityLabel,
}: Props) {
  const primary = variant === "primary";
  const textColor = labelColor ?? (primary ? colors.card : color);
  const inactive = disabled || busy;

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ busy, disabled: inactive }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        compact ? styles.compact : styles.regular,
        primary ? { backgroundColor: color, borderColor: color } : { borderColor: color },
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={textColor} size="small" />
      ) : (
        <View style={styles.row}>
          <Text style={[styles.label, { color: textColor }]}>{label}</Text>
          {icon ? <Icon color={textColor} filled={iconFilled} name={icon} size={16} /> : null}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    borderRadius: radii.card,
    borderWidth: 1,
    justifyContent: "center",
  },
  regular: { minHeight: 50, paddingHorizontal: 18 },
  compact: { minHeight: 38, paddingHorizontal: 14 },
  row: { alignItems: "center", flexDirection: "row", gap: 8 },
  label: { ...typography.label, textTransform: "uppercase" },
  disabled: { opacity: 0.35 },
  pressed: { opacity: 0.7 },
});
```

- [ ] **Step 5: Create `src/components/BackLink.tsx`**

```tsx
import { Pressable, StyleSheet, Text } from "react-native";

import { Icon } from "./Icon";
import { colors, typography } from "../theme";

export function BackLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityLabel={`Back to ${label.toLowerCase()}`}
      accessibilityRole="button"
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [styles.link, pressed && styles.pressed]}
    >
      <Icon color={colors.ink} name="chevron" size={16} />
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  link: { alignItems: "center", alignSelf: "flex-start", flexDirection: "row", gap: 2, paddingVertical: 4 },
  label: { ...typography.label, textTransform: "uppercase" },
  pressed: { opacity: 0.7 },
});
```

- [ ] **Step 6: Create `src/components/ActionLink.tsx`**

```tsx
import { Pressable, StyleSheet, Text } from "react-native";

import { colors, typography } from "../theme";

type Props = {
  label: string;
  onPress: () => void;
  color?: string;
  disabled?: boolean;
  accessibilityLabel?: string;
};

export function ActionLink({ label, onPress, color = colors.ink, disabled = false, accessibilityLabel }: Props) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [styles.link, disabled && styles.disabled, pressed && styles.pressed]}
    >
      <Text style={[styles.label, { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  link: { alignSelf: "flex-start", paddingVertical: 6 },
  label: { ...typography.label, textTransform: "uppercase" },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.7 },
});
```

- [ ] **Step 7: Create `src/components/ScreenHeader.tsx`**

```tsx
import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { spacing, typography } from "../theme";

type Props = {
  kicker?: string;
  title: string;
  subtitle?: string;
  /** Rendered top-right, aligned with the kicker: an ActionLink or Button. */
  right?: ReactNode;
};

export function ScreenHeader({ kicker, title, subtitle, right }: Props) {
  return (
    <View style={styles.header}>
      <View style={styles.copy}>
        {kicker ? <Text style={styles.kicker}>{kicker}</Text> : null}
        <Text accessibilityRole="header" style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingBottom: 24,
    paddingHorizontal: spacing.gutter,
    paddingTop: 12,
  },
  copy: { flex: 1 },
  kicker: typography.kicker,
  title: { ...typography.titleXL, marginTop: 4 },
  subtitle: { ...typography.body, marginTop: 6 },
  right: { paddingLeft: 12, paddingTop: 2 },
});
```

- [ ] **Step 8: Typecheck**

Run: `npm run typecheck`
Expected: no output (clean).

- [ ] **Step 9: Commit**

```bash
git add src/theme.ts src/components/Icon.tsx src/components/Wordmark.tsx src/components/Button.tsx src/components/BackLink.tsx src/components/ActionLink.tsx src/components/ScreenHeader.tsx
git commit -m "feat(app): add shared ui primitives and a type scale"
```

---

### Task 2: Catalogue search helper

**Files:**
- Create: `src/catalogueSearch.ts`
- Test: `src/catalogueSearch.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";

import { searchItems } from "./catalogueSearch";
import type { Brand, Item } from "./types";

const brands: Brand[] = [
  { id: "sezane", name: "Sézane", monogram: "S", curated: true },
  { id: "sandro", name: "Sandro", monogram: "S", curated: true },
];

const item = (id: string, brandId: string, name: string): Item => ({
  id, brandId, name, imageUrl: "", currentPrice: 1, currency: "EUR", url: "",
});

const items = [
  item("coat", "sezane", "Johnson Wool Coat"),
  item("skirt", "sezane", "Naëlle Silk Skirt"),
  item("bag", "sandro", "Tangoso Leather Bag"),
];

describe("searchItems", () => {
  it("returns every item for an empty or blank query", () => {
    expect(searchItems(items, brands, "")).toBe(items);
    expect(searchItems(items, brands, "   ")).toBe(items);
  });

  it("matches the item name ignoring case", () => {
    expect(searchItems(items, brands, "WOOL").map((entry) => entry.id)).toEqual(["coat"]);
  });

  it("matches ignoring diacritics in both directions", () => {
    expect(searchItems(items, brands, "naelle").map((entry) => entry.id)).toEqual(["skirt"]);
    expect(searchItems(items, brands, "sézane").map((entry) => entry.id)).toEqual(["coat", "skirt"]);
  });

  it("matches the brand name", () => {
    expect(searchItems(items, brands, "sandro").map((entry) => entry.id)).toEqual(["bag"]);
  });

  it("requires every term to match", () => {
    expect(searchItems(items, brands, "sezane silk").map((entry) => entry.id)).toEqual(["skirt"]);
    expect(searchItems(items, brands, "sezane leather")).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/catalogueSearch.test.ts`
Expected: FAIL, cannot find module `./catalogueSearch`.

- [ ] **Step 3: Create `src/catalogueSearch.ts`**

```ts
import type { Brand, Item } from "./types";

// "Sézane" and "sezane" must meet: decompose accents (NFD) and drop the marks.
const normalize = (value: string) =>
  value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Items whose name or brand name contains every whitespace-separated term. */
export function searchItems(items: Item[], brands: Brand[], query: string): Item[] {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return items;
  const brandNames = new Map(brands.map((brand) => [brand.id, normalize(brand.name)]));
  return items.filter((item) => {
    const haystack = `${normalize(item.name)} ${brandNames.get(item.brandId) ?? ""}`;
    return terms.every((term) => haystack.includes(term));
  });
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run src/catalogueSearch.test.ts`
Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add src/catalogueSearch.ts src/catalogueSearch.test.ts
git commit -m "feat(app): add a diacritic-insensitive catalogue search helper"
```

---

### Task 3: Live catalogue for Alerts and Profile, loading wordmark

**Files:**
- Modify: `App.tsx`
- Modify: `src/screens/AlertsScreen.tsx`
- Modify: `src/screens/ProfileScreen.tsx`

- [ ] **Step 1: `App.tsx` — pass the catalogue and show the wordmark while loading**

Add the import:

```tsx
import { Wordmark } from "./src/components/Wordmark";
```

Replace the loading branch:

```tsx
  if (profileGate === "loading") {
    return (
      <View style={styles.loading}>
        <Wordmark />
        <ActivityIndicator color={colors.wine} style={styles.loadingSpinner} />
      </View>
    );
  }
```

Add to `styles`: `loadingSpinner: { marginTop: 18 },`.

In `renderScreen`, pass the live catalogue:

```tsx
      case "alerts":
        return <AlertsScreen brands={brands} items={items} onViewItem={viewAlertItem} />;
```

and

```tsx
        return <ProfileScreen brands={brands} onOpenWardrobe={() => setProfileView({ screen: "wardrobe" })} />;
```

- [ ] **Step 2: `AlertsScreen.tsx` — props instead of seed data, then restyle**

Remove `import { brandsById, itemsById } from "../data/seed";`. Add imports for `Button`, `ScreenHeader`, `spacing`, `typography` and the `Brand`/`Item` types. New props and lookups:

```tsx
type Props = {
  brands: Brand[];
  items: Item[];
  onViewItem: (itemId: string) => void;
};

export function AlertsScreen({ brands, items, onViewItem }: Props) {
  const alerts = useWistStore((state) => state.alerts);
  const markRead = useWistStore((state) => state.markAlertRead);
  const brandsById = Object.fromEntries(brands.map((brand) => [brand.id, brand]));
  const itemsById = Object.fromEntries(items.map((item) => [item.id, item]));
  const hero = alerts[0];
  const heroItem = hero ? itemsById[hero.itemId] : undefined;
  const heroBrand = heroItem ? brandsById[heroItem.brandId] : undefined;
```

Header becomes `<ScreenHeader kicker="SIGNALS FOR YOU" subtitle="Meaningful changes in the pieces you covet." title="Alerts" />`.

The hero "VIEW PIECE" row becomes a button on the wine block:

```tsx
              <View style={styles.viewButton}>
                <Button
                  color={colors.card}
                  icon="arrow"
                  label="View piece"
                  labelColor={colors.wine}
                  onPress={() => { markRead(hero.id); onViewItem(hero.itemId); }}
                />
              </View>
```

Earlier rows get pressed feedback: `style={({ pressed }) => [styles.historyRow, pressed && styles.pressed]}`.

Style mapping (replace the numbers; keep the layout):

| Style | New value |
|---|---|
| `empty`, `emptyTitle`, `emptyBody` | `emptyTitle: { ...typography.titleL, marginTop: 16 }`, `emptyBody: { ...typography.body, marginTop: 6, textAlign: "center" }` |
| `hero` | add `borderRadius: radii.card` |
| `live` | `{ ...typography.label, color: colors.card }` |
| `time` | `{ ...typography.label, color: colors.onWineMuted }` |
| `brand` | `{ ...typography.kicker, color: colors.onWineMuted, textTransform: "uppercase" }` |
| `heroName` | `{ ...typography.titleL, color: colors.card, fontSize: 31, lineHeight: 33, marginTop: 4 }` |
| `reason` | `{ ...typography.body, color: colors.onWineSoft, marginTop: 7 }` |
| `prices` | borders `colors.onWineLine` |
| `priceLabel` | `{ ...typography.kicker, color: colors.onWineMuted }` |
| `newPrice` | `{ ...typography.price, color: colors.card, fontSize: 21, marginTop: 2 }` |
| `wasPrice` | `{ ...typography.body, color: colors.onWineMuted, fontSize: 15, marginTop: 4, textDecorationLine: "line-through" }` |
| `offText` | `{ ...typography.price, color: colors.wine }` |
| `viewButton` | `{ marginTop: 16 }` (remove `viewText`) |
| `historyTitle` | `{ ...typography.titleL, marginBottom: 11 }` |
| `historyBrand` | `{ ...typography.kicker, textTransform: "uppercase" }` |
| `historyName` | `{ ...typography.titleS, marginTop: 2 }` |
| `historyPrice` | `{ ...typography.price, color: colors.wine, marginTop: 4 }` |
| `thumb` | add `borderRadius: radii.card` |
| new `pressed` | `{ opacity: 0.85 }` |
| `header`, `kicker`, `title`, `subtitle` | delete (ScreenHeader) |

- [ ] **Step 3: `ProfileScreen.tsx` — live brands, primitives**

Remove `import { seedBrands } from "../data/seed";`. Props:

```tsx
export function ProfileScreen({ brands, onOpenWardrobe }: { brands: Brand[]; onOpenWardrobe: () => void }) {
```

Replace `seedBrands.map(` with `brands.map(`. Import `Brand` from `../types`.

Replace the header `View` with `<ScreenHeader kicker="YOUR TASTE, IN PROGRESS" subtitle="The preferences Wist uses to shape your edit." title="Profile" />`.

The wardrobe row's `OPEN`, each `TasteRow`'s `EDIT`, and the per-brand `FOLLOW`/`FOLLOWING` text become `ActionLink`s (`color={colors.moss}` for OPEN, `colors.wine` for EDIT and for FOLLOW when not followed, `colors.muted` for FOLLOWING). The rows themselves stay `Pressable`s with pressed feedback.

Modal: `CANCEL` is an `ActionLink color={colors.wine}`; the save button becomes

```tsx
          <View style={screenStyles.saveButton}>
            <Button busy={saving} color={colors.wine} label="Save changes" onPress={() => void saveEditor()} />
          </View>
```

with `saveButton: { marginHorizontal: 24, marginVertical: 16 }`.

Style mapping: `sectionLabel`, `tasteLabel` → `{ ...typography.kicker, ... }`; `tasteValue`, `brand` → `typography.titleM`; `index` → `{ ...typography.caption, width: 25 }`; `monogram` add `borderRadius: radii.card`; `monogramText` → `typography.titleS`; `note` add `borderRadius: radii.card`; `noteLabel` → `{ ...typography.kicker, color: colors.onMossMuted }`; `noteTitle` → `{ ...typography.titleL, color: colors.card, marginTop: 7 }`; `noteBody` → `{ ...typography.body, color: colors.onMossSoft, marginTop: 6 }`; `modalKicker` → `typography.kicker`; `modalTitle` → `{ ...typography.titleXL, fontSize: 39, lineHeight: 42, marginTop: 20 }`; `modalSubtitle` → `{ ...typography.body, marginTop: 8 }`. Delete `header`, `kicker`, `title`, `subtitle`, `action`, `edit`, `follow`, `modalAction`, `saveText`. Keep `modalActionSpacer` width 58 so the kicker stays centred.

- [ ] **Step 4: Typecheck and commit**

Run: `npm run typecheck` → clean.

```bash
git add App.tsx src/screens/AlertsScreen.tsx src/screens/ProfileScreen.tsx
git commit -m "fix(app): resolve alerts and followed houses from the live catalogue"
```

---

### Task 4: Scrollytelling intro

**Files:**
- Create: `src/screens/IntroScreen.tsx`
- Modify: `src/screens/OnboardingScreen.tsx`

- [ ] **Step 1: Create `src/screens/IntroScreen.tsx`**

```tsx
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
  const hintTranslate = hint.interpolate({ inputRange: [0, 1], outputRange: [0, 8] });
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
```

- [ ] **Step 2: `OnboardingScreen.tsx` — add the intro phase and the primitives**

Imports: add `ActionLink`, `Button`, `Wordmark`, `IntroScreen`, and `spacing`, `typography` from the theme; drop `radii` if no longer used (the progress dots still use `radii.pill`, so keep it).

```tsx
  const [step, setStep] = useState<"intro" | "occasions" | "styles">("intro");
```

Right after the hooks and before `continueOnboarding`:

```tsx
  if (step === "intro") {
    return <IntroScreen onBegin={() => setStep("occasions")} onSkip={markProfileSkipped} />;
  }
```

Topline becomes:

```tsx
      <View style={screenStyles.topline}>
        <Wordmark />
        <ActionLink color={colors.muted} label="Skip" onPress={markProfileSkipped} />
      </View>
```

The continue `Pressable` becomes:

```tsx
        <View style={screenStyles.continueButton}>
          <Button
            color={colors.wine}
            label={isOccasionStep ? "Continue" : "Save my profile"}
            onPress={() => void continueOnboarding()}
          />
        </View>
```

Style mapping: `content: { flexGrow: 1, paddingHorizontal: spacing.gutter + 2, paddingVertical: 22 }`; `kicker: { ...typography.kicker, color: colors.wine }`; `title: { ...typography.titleXL, marginTop: 12 }`; `subtitle: { ...typography.body, marginTop: 12 }`; `continueButton: { marginTop: 20 }`. Delete `wordmark`, `skip`, `continueText`.

- [ ] **Step 3: Typecheck and commit**

Run: `npm run typecheck` → clean.

```bash
git add src/screens/IntroScreen.tsx src/screens/OnboardingScreen.tsx
git commit -m "feat(app): add a scrollytelling intro before the profile questions"
```

---

### Task 5: Feed, tab bar, pickers, photo frame

**Files:**
- Modify: `src/screens/FeedScreen.tsx`
- Modify: `src/components/BottomTabBar.tsx`
- Modify: `src/components/OccasionStylePicker.tsx`
- Modify: `src/components/GarmentPhoto.tsx`

- [ ] **Step 1: `FeedScreen.tsx`**

Replace the `<Text style={styles.wordmark}>WIST</Text>` with `<Wordmark />`. "DISCOVER ALL" becomes `<ActionLink label="Discover all" onPress={onOpenBrowse} />`. The bell, signal block, house tiles, image taps and covet buttons get pressed feedback (`styles.pressed`, opacity 0.85).

Style mapping:

| Style | New value |
|---|---|
| `kicker` | `typography.kicker` |
| `title` | `{ ...typography.titleXL, marginTop: 10 }` |
| `dek` | `{ ...typography.body, marginTop: 13, maxWidth: 300 }` |
| `signal` | add `borderRadius: radii.card, overflow: "hidden"` |
| `signalKicker` | `{ ...typography.kicker, color: colors.onWineSoft }` |
| `signalName` | `{ ...typography.titleM, color: colors.card, fontSize: 24, lineHeight: 26, marginTop: 8 }` |
| `signalPrice` | `{ ...typography.price, color: colors.card, fontSize: 16 }` |
| `oldPrice` | `{ ...typography.caption, color: colors.onWineMuted, textDecorationLine: "line-through" }` |
| `percent` | `{ ...typography.label, backgroundColor: colors.card, borderRadius: radii.card, color: colors.wine, paddingHorizontal: 6, paddingVertical: 2 }` |
| `signalLink` | `{ ...typography.label, color: colors.card, marginTop: 20 }` |
| `quietKicker` | `{ ...typography.kicker, color: colors.moss }` |
| `quietTitle` | `{ ...typography.titleL, marginTop: 5 }` |
| `quietBody` | `{ ...typography.body, marginTop: 4, maxWidth: 300 }` |
| `sectionTitle` | `typography.titleL` |
| `sectionNote` | `typography.kicker` |
| `houseIndex` | `typography.caption` |
| `houseName` | `typography.titleS` |
| `editImage` | add `borderRadius: radii.card` |
| `covetButton` | add `borderRadius: radii.card` |
| `itemBrand` | `{ ...typography.kicker, marginTop: 9, textTransform: "uppercase" }` |
| `itemName` | `{ ...typography.titleS, marginTop: 3 }` |
| `itemPrice` | `{ ...typography.price, marginTop: 5 }` |
| delete | `wordmark`, `textLink` |
| new `pressed` | `{ opacity: 0.85 }` |

- [ ] **Step 2: `BottomTabBar.tsx`**

`label: { ...typography.label, color: colors.muted, fontFamily: fonts.textMedium, letterSpacing: 0.4, marginTop: 3 }` (10 px). Import `typography` and `fonts`. Tab `Pressable` gets `pressed && styles.pressed` with `pressed: { opacity: 0.7 }`.

- [ ] **Step 3: `OccasionStylePicker.tsx`**

`chip: { borderColor: colors.ring, borderRadius: radii.card, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 11 }`; `label: { fontFamily: fonts.textMedium, fontSize: 12, color: colors.ink }` stays; add pressed feedback (`opacity: 0.7`).

- [ ] **Step 4: `GarmentPhoto.tsx`**

`frame.borderRadius: radii.card`; `placeholder: typography.caption`. Import `radii`, `typography`.

- [ ] **Step 5: Typecheck and commit**

```bash
git add src/screens/FeedScreen.tsx src/components/BottomTabBar.tsx src/components/OccasionStylePicker.tsx src/components/GarmentPhoto.tsx
git commit -m "refactor(app): move feed, tab bar and pickers onto the shared type scale"
```

---

### Task 6: Discover with a real search

**Files:**
- Modify: `src/screens/BrowseScreen.tsx`

- [ ] **Step 1: Search state and results**

Imports: `useState`, `TextInput` from react-native; `ActionLink`, `Button`, `Icon`, `ScreenHeader`; `searchItems`; `radii`, `spacing`, `typography`.

```tsx
  const [query, setQuery] = useState("");
  const searching = query.trim().length > 0;
  const brand = brands.find((candidate) => candidate.id === selectedBrandId) ?? brands[0];
  const brandsById = Object.fromEntries(brands.map((entry) => [entry.id, entry]));
  const items = searching
    ? searchItems(allItems, brands, query)
    : brand ? allItems.filter((item) => item.brandId === brand.id) : [];
```

Header:

```tsx
      <ScreenHeader kicker="THE WIST INDEX" title="Discover" />
      <View style={styles.search}>
        <Icon color={colors.muted} name="search" size={19} />
        <TextInput
          accessibilityLabel="Search pieces"
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={setQuery}
          placeholder="Search across your brands"
          placeholderTextColor={colors.muted}
          returnKeyType="search"
          style={styles.searchInput}
          value={query}
        />
        {searching ? <ActionLink color={colors.muted} label="Clear" onPress={() => setQuery("")} /> : null}
      </View>
```

Brand tabs and brand head render only when `!searching`. When searching, render instead:

```tsx
      {searching ? (
        <View style={styles.resultsHead}>
          <Text style={styles.count}>
            {items.length} {items.length === 1 ? "piece matches" : "pieces match"} “{query.trim()}”
          </Text>
        </View>
      ) : null}
```

Follow becomes `<Button compact label={followed.includes(brand.id) ? "Following" : "Follow"} onPress={() => toggleFollow(brand.id)} variant={followed.includes(brand.id) ? "secondary" : "primary"} />`.

In `renderItem`, the number line shows the brand while searching:

```tsx
                <Text style={styles.number}>
                  {searching ? brandsById[item.brandId]?.name.toUpperCase() : `0${index + 1}`}
                </Text>
```

Empty state copy while searching: title "Nothing matches." body "Try a shorter word, or the brand name."

Style mapping: `search: { alignItems: "center", borderBottomColor: colors.ink, borderBottomWidth: 1, flexDirection: "row", gap: 10, marginHorizontal: spacing.gutter, paddingBottom: 6 }`; `searchInput: { ...typography.body, color: colors.ink, flex: 1, paddingVertical: 8 }`; `resultsHead: { paddingHorizontal: spacing.gutter, paddingVertical: 19 }`; `tabText: { ...typography.label, color: colors.muted, fontFamily: fonts.textMedium, fontSize: 11, letterSpacing: 0.3 }`; `brandLabel: typography.kicker`; `brandName: { ...typography.titleL, marginTop: 3 }`; `count: typography.caption`; `emptyTitle: { ...typography.titleL, textAlign: "center" }`; `emptyBody: { ...typography.body, marginTop: 7, textAlign: "center" }`; `number: typography.kicker`; `productName: typography.titleM`; `price: { ...typography.price, marginTop: 7 }`; `covetText: typography.label`; `image` add `borderRadius: radii.card`. Delete `header`, `kicker`, `title`, `searchText`, `follow`, `following`, `followText`, `followingText`. Image and covet pressables get `pressed` feedback.

- [ ] **Step 2: Typecheck and commit**

```bash
git add src/screens/BrowseScreen.tsx
git commit -m "feat(app): search across the loaded catalogue from discover"
```

---

### Task 7: Product detail and Coveted

**Files:**
- Modify: `src/screens/ProductDetailScreen.tsx`
- Modify: `src/screens/SavedScreen.tsx`

- [ ] **Step 1: `ProductDetailScreen.tsx`**

Topbar: `<BackLink label="Back" onPress={onBack} />` and `<Wordmark />`.

Media counter only for several entries:

```tsx
        {media.length > 1 ? (
          <View style={styles.mediaCount}>
            <Text style={styles.mediaCountText}>{activeMediaIndex + 1} / {media.length}</Text>
          </View>
        ) : null}
```

Covet:

```tsx
        <View style={styles.covet}>
          <Button
            disabled={buyBusy || watchBusy}
            icon="heart"
            iconFilled={coveted}
            label={coveted ? "Coveted — Wist is watching" : "Covet this piece"}
            onPress={onToggleCovet}
            variant={coveted ? "primary" : "secondary"}
          />
        </View>
```

"I bought this": `<View style={styles.bought}><Button color={colors.moss} disabled={buyBusy || watchBusy} label="I bought this" onPress={() => setConfirmBuy(true)} variant="secondary" /></View>`.

Buy sheet: two stacked `Button`s (`color={colors.moss}` primary "Add to wardrobe", secondary "Cancel") inside a `View style={styles.buyActions}` with `gap: 10, marginTop: 20`. "Refresh" and "Try again" become `ActionLink color={colors.moss}`.

Official link: `<View style={styles.official}><Button icon="arrow" label={`View on ${brand.name}`} onPress={() => void Linking.openURL(item.url)} /></View>`.

Style mapping: `back` delete; `wordmark` delete; `mediaCount` add `borderRadius: radii.card`; `mediaCountText: typography.label`; `brand: typography.kicker`; `name: { ...typography.titleXL, fontSize: 37, lineHeight: 39, marginTop: 7 }`; `price: { ...typography.price, fontSize: 16 }`; `previous: { ...typography.caption, textDecorationLine: "line-through" }`; `covet: { marginTop: 24 }`; `bought: { marginTop: 10 }`; `buyNotice` radius `radii.card`; `buyHelp: { ...typography.body, marginTop: 10 }`; `variantsTitle: typography.kicker`; `variant` add `borderRadius: radii.card`; `variantLabel` keep 11 px; `variantNote: { ...typography.caption, marginTop: 9 }`; `factLabel: typography.kicker`; `factValue: { ...typography.price, fontFamily: fonts.textMedium, maxWidth: "60%", textAlign: "right" }`; `official: { marginTop: 28 }`; `note: { ...typography.caption, marginTop: 10 }`. Delete `coveted`, `covetText`, `covetedText`, `boughtText`, `buyAction`, `officialText`. The media `ScrollView` images keep their inline style.

- [ ] **Step 2: `SavedScreen.tsx`**

Header: `<ScreenHeader kicker="YOUR PERSONAL INDEX" subtitle={`${items.length} ${items.length === 1 ? "piece" : "pieces"} remembered and watched.`} title="Coveted" />`.

Import button: `<View style={styles.importButton}><Button busy={importing} disabled={!productUrl.trim()} label="Add to Coveted" onPress={() => void submitProduct()} /></View>` with `importButton: { marginTop: 14 }`. "REMOVE" → `<ActionLink label="Remove" onPress={() => onToggleCovet(item)} />` (drop the underline).

Style mapping: `importCard` → `borderRadius: radii.card`; `importLabel: { ...typography.kicker, color: colors.wine }`; `importTitle: { ...typography.titleL, marginTop: 4 }`; `importBody: { ...typography.caption, marginTop: 3 }`; `urlInput: { ...typography.body, color: colors.ink, borderBottomColor: colors.ink, borderBottomWidth: 1, marginTop: 18, paddingHorizontal: 0, paddingVertical: 10 }`; `importError: { ...typography.caption, color: colors.wine, marginTop: 8 }`; `index: { ...typography.caption, paddingRight: 9, paddingTop: 3, width: 25 }`; `image` add `borderRadius: radii.card`; `brand: { ...typography.kicker, textTransform: "uppercase" }`; `name: { ...typography.titleM, fontSize: 23, lineHeight: 25, marginTop: 5 }`; `price: typography.price`; `oldPrice: { ...typography.caption, textDecorationLine: "line-through" }`; `since: { ...typography.kicker, marginTop: 19 }`; `sizes: { ...typography.kicker, color: colors.ink, marginTop: 6 }`; `remove: { marginTop: 8 }`; `emptyTitle: { ...typography.titleL, marginTop: 15 }`; `emptyBody: { ...typography.body, marginTop: 6, textAlign: "center" }`. Delete `header`, `kicker`, `title`, `subtitle`, `importButtonDisabled`, `importButtonPressed`, `importButtonText`, `removeText`. Image and name pressables get `pressed`.

- [ ] **Step 3: Typecheck and commit**

```bash
git add src/screens/ProductDetailScreen.tsx src/screens/SavedScreen.tsx
git commit -m "refactor(app): unify the product and coveted screens on the shared primitives"
```

---

### Task 8: Wardrobe, garment editor, Dress me

**Files:**
- Modify: `src/screens/WardrobeScreen.tsx`
- Modify: `src/screens/GarmentEditScreen.tsx`
- Modify: `src/screens/OutfitSuggestionsScreen.tsx`

- [ ] **Step 1: `WardrobeScreen.tsx`**

Topline: `<BackLink label="Profile" onPress={onBack} />` and `<ActionLink color={colors.moss} disabled={!!busy || status === "loading"} label="+ Add" onPress={() => setChooser(!chooser)} />`.

Heading: `<ScreenHeader subtitle={`${wardrobe.length} pieces you own.`} title="Your wardrobe" />` followed by `<View style={styles.dressMe}><Button color={colors.moss} disabled={!!busy} label="Dress me" onPress={onDressMe} /></View>` with `dressMe: { marginHorizontal: spacing.gutter, marginBottom: 20 }`.

Chooser choices and "RETRY · REFRESH WARDROBE" become `ActionLink`s (`color={colors.moss}`; the chooser ones use `colors.ink`). Chooser box: `borderRadius: radii.card, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card`. Tag chip: `borderRadius: radii.card`, `tagText: { ...typography.caption, color: colors.moss }`. `name: { ...typography.titleM, marginTop: 9 }`; `subtitle: typography.body`; `empty: { ...typography.body, fontSize: 14, lineHeight: 22, paddingVertical: 40 }`. Delete `action`, `title`, `dressMeText`, `choice`, `heading`. Card pressable gets `pressed`.

- [ ] **Step 2: `GarmentEditScreen.tsx`**

Topline: `<BackLink label={backLabel} onPress={onBack} />` and `<ActionLink color={colors.moss} disabled={!!busy || uncertain} label="Save" onPress={save} />`.

Title: `<Text style={styles.title}>Garment details</Text>` with `title: { ...typography.titleXL, fontSize: 38, lineHeight: 40, marginBottom: 20 }`. Every `styles.choice` link becomes an `ActionLink color={colors.moss}`. The save `Pressable` becomes `<View style={styles.save}><Button color={colors.moss} disabled={!!busy || uncertain} label="Save changes" onPress={save} /></View>` with `save: { marginTop: 26 }`.

Styles: `help: typography.body` plus `marginVertical: 8`; `label: { ...typography.kicker, marginTop: 25, marginBottom: 12 }`; `input: { borderColor: colors.ring, borderRadius: radii.card, borderWidth: 1, color: colors.ink, fontFamily: fonts.text, fontSize: 14, padding: 14 }`; `confirm: { backgroundColor: colors.wash, borderRadius: radii.card, padding: 16 }`. Delete `action`, `saveText`, `choice`, `disabled`.

- [ ] **Step 3: `OutfitSuggestionsScreen.tsx`**

Topline: `<BackLink label="Wardrobe" onPress={onBack} />`. Title `typography.titleXL` (fontSize 40, lineHeight 42). "RETRY" and "MORE IDEAS" become `<Button color={colors.moss} … />` (`busy`/`disabled` as today: `disabled={busy || waiting}` and label "Preparing ideas…" while waiting). The card action becomes `<Button color={colors.moss} disabled={disabled} label={action.text} onPress={action.onPress} variant="secondary" accessibilityLabel={action.accessibilityLabel} />` inside `View style={styles.secondary}` with `secondary: { marginTop: 20 }`.

Styles: `card.borderRadius: radii.card`; `cardLabel: { ...typography.kicker, marginBottom: 16 }`; `forTodayLabel: { ...typography.kicker, color: colors.moss }`; `forTodayReason: { ...typography.body, color: colors.ink, marginTop: 4 }`; `garmentName: { ...typography.caption, color: colors.ink, marginTop: 7 }`; `label: { ...typography.kicker, marginTop: 28, marginBottom: 14 }`; `subtitle: { ...typography.body, marginTop: 4 }`; `help: { ...typography.body, marginTop: 16, textAlign: "center" }`; `footnote: { ...typography.caption, marginTop: 16, textAlign: "center" }`; `button: { marginTop: 24 }`. Delete `action`, `buttonText`, `secondaryText`, `disabled`, `error` becomes `{ ...typography.body, color: colors.ink, fontSize: 14, lineHeight: 21 }`. Garment pressables get `pressed`.

- [ ] **Step 4: Typecheck and commit**

```bash
git add src/screens/WardrobeScreen.tsx src/screens/GarmentEditScreen.tsx src/screens/OutfitSuggestionsScreen.tsx
git commit -m "refactor(app): unify the wardrobe screens on the editorial language"
```

---

### Task 9: Walkthrough on web and iOS, ticket

- [ ] **Step 1: Full checks**

Run: `npm run typecheck && npm test` → clean, 604 tests pass (599 + 5).

- [ ] **Step 2: Web walkthrough**

Run `npm run web` (Metro on `http://localhost:8081`). In Chrome, at 390 px and at 1280 px wide: the intro pages and fades, SKIP and BEGIN work, both questions, Feed, Discover search (type "coat", clear), a product, Coveted, Alerts, Profile, Wardrobe, a garment, Dress me. No console errors other than the catalogue being unreachable if the service is off.

- [ ] **Step 3: iOS walkthrough**

Run `npm run ios`. Same walk. Check the intro snaps per panel, the wine panel fills the stage, the tab bar clears the home indicator, the garment editor keyboard does not cover the save button.

- [ ] **Step 4: Ticket**

Create a GitHub issue "[U1] UI: unify the editorial language and add a scrollytelling intro" with an "In plain words" section first, then Goal, Decisions (from the spec), Design summary, Acceptance criteria, Commit list. Close it when done.
