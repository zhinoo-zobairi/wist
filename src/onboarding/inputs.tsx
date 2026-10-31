import { Image, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

import { ActionLink } from "../components/ActionLink";
import { colors, fonts, radii, typography } from "../theme";
import { PALETTE_OPTIONS, TASTE_AXIS_OPTIONS, type ChoiceOption, type Palette, type ShopsFor, type TasteAnswer } from "../types";
import { onboardingPhoto } from "./photos";

/** A licensed photograph, or its label on a plain frame until the photographs arrive. */
export function PhotoFrame({ fallback, photoKey, position = 0, shopsFor, style }: {
  fallback: string;
  photoKey: string;
  position?: number;
  shopsFor: ShopsFor | null;
  style?: StyleProp<ViewStyle>;
}) {
  const photo = onboardingPhoto(photoKey, shopsFor, position);
  return (
    <View style={[inputStyles.frame, style]}>
      {photo ? (
        <>
          <Image accessibilityLabel={photo.alt} resizeMode="cover" source={photo.source} style={StyleSheet.absoluteFill} />
          <Text style={inputStyles.credit}>{photo.credit.toUpperCase()}</Text>
        </>
      ) : (
        <Text accessibilityElementsHidden importantForAccessibility="no" style={inputStyles.fallback}>{fallback}</Text>
      )}
    </View>
  );
}

/** Photo cards in a grid, or rows: one choice when max is 1, else up to max. */
export function PhotoChoice<Id extends string>({
  columns = 2, layout = "grid", max, onChange, options, photoPrefix, selected, shopsFor,
}: {
  columns?: 2 | 3;
  layout?: "grid" | "rows";
  max?: number;
  onChange: (selected: Id[]) => void;
  options: readonly ChoiceOption<Id>[];
  /** Photograph slots are `${photoPrefix}.${id}`; rows without it show text only. */
  photoPrefix?: string;
  selected: Id[];
  shopsFor: ShopsFor | null;
}) {
  const single = max === 1;
  const toggle = (id: Id) => {
    if (single) return onChange([id]);
    onChange(selected.includes(id) ? selected.filter((candidate) => candidate !== id) : [...selected, id]);
  };
  return (
    <View style={layout === "grid" ? inputStyles.grid : inputStyles.rows}>
      {options.map((option, position) => {
        const isSelected = selected.includes(option.id);
        const isDisabled = !single && !isSelected && max !== undefined && selected.length >= max;
        return (
          <Pressable
            accessibilityHint={option.detail}
            accessibilityLabel={option.label}
            accessibilityRole={single ? "radio" : "checkbox"}
            accessibilityState={{ checked: isSelected, disabled: isDisabled }}
            disabled={isDisabled}
            key={option.id}
            onPress={() => toggle(option.id)}
            style={({ pressed }) => [
              layout === "grid" ? [inputStyles.card, { flexBasis: columns === 3 ? "30%" : "47%" }] : inputStyles.row,
              isSelected && inputStyles.selected,
              isDisabled && inputStyles.disabled,
              pressed && inputStyles.pressed,
            ]}
          >
            {photoPrefix ? (
              <PhotoFrame
                fallback={layout === "grid" ? option.label : ""}
                photoKey={`${photoPrefix}.${option.id}`}
                position={position}
                shopsFor={shopsFor}
                style={layout === "grid" ? inputStyles.cardPhoto : inputStyles.rowPhoto}
              />
            ) : null}
            <View style={inputStyles.copy}>
              <Text style={[inputStyles.label, isSelected && inputStyles.labelSelected]}>{option.label}</Text>
              {option.detail ? <Text style={inputStyles.detail}>{option.detail}</Text> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

/** The six palettes as swatch sets, up to max. */
export function SwatchChoice({ max, onChange, selected }: {
  max: number;
  onChange: (selected: Palette[]) => void;
  selected: Palette[];
}) {
  return (
    <View style={inputStyles.grid}>
      {PALETTE_OPTIONS.map((palette) => {
        const isSelected = selected.includes(palette.id);
        const isDisabled = !isSelected && selected.length >= max;
        return (
          <Pressable
            accessibilityLabel={palette.label}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: isSelected, disabled: isDisabled }}
            disabled={isDisabled}
            key={palette.id}
            onPress={() => onChange(isSelected ? selected.filter((id) => id !== palette.id) : [...selected, palette.id])}
            style={({ pressed }) => [inputStyles.swatchCard, isSelected && inputStyles.selected, isDisabled && inputStyles.disabled, pressed && inputStyles.pressed]}
          >
            <View style={inputStyles.swatches}>
              {palette.swatches.map((hex) => <View key={hex} style={[inputStyles.swatch, { backgroundColor: hex }]} />)}
            </View>
            <Text style={[inputStyles.swatchLabel, isSelected && inputStyles.labelSelected]}>{palette.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** One this-or-that round: two photographs, then Both or Neither. Any tap answers. */
export function ThisOrThatRound({ axis, onAnswer, round, shopsFor }: {
  axis: (typeof TASTE_AXIS_OPTIONS)[number];
  onAnswer: (answer: TasteAnswer) => void;
  round: number;
  shopsFor: ShopsFor | null;
}) {
  return (
    <View>
      <View style={inputStyles.pair}>
        {axis.poles.map((pole, position) => (
          <Pressable
            accessibilityHint={pole.detail}
            accessibilityLabel={pole.label}
            accessibilityRole="button"
            key={pole.id}
            onPress={() => onAnswer(pole.id)}
            style={({ pressed }) => [inputStyles.pole, pressed && inputStyles.pressed]}
          >
            <PhotoFrame fallback={pole.label} photoKey={`taste.${axis.id}.${pole.id}`} position={round + position} shopsFor={shopsFor} style={inputStyles.polePhoto} />
            <Text style={inputStyles.label}>{pole.label}</Text>
            {pole.detail ? <Text style={inputStyles.detail}>{pole.detail}</Text> : null}
          </Pressable>
        ))}
      </View>
      <View style={inputStyles.eitherRow}>
        <ActionLink label="Both, equally" onPress={() => onAnswer("both")} />
        <ActionLink color={colors.muted} label="Neither" onPress={() => onAnswer("neither")} />
      </View>
    </View>
  );
}

const inputStyles = StyleSheet.create({
  frame: { alignItems: "center", backgroundColor: colors.wash, borderRadius: radii.card, justifyContent: "center", overflow: "hidden" },
  fallback: { ...typography.titleS, color: colors.muted, paddingHorizontal: 10, textAlign: "center" },
  credit: {
    ...typography.kicker, backgroundColor: "rgba(244,241,235,0.92)", borderRadius: radii.card, bottom: 8, left: 8,
    paddingHorizontal: 7, paddingVertical: 3, position: "absolute",
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  rows: { gap: 8 },
  card: { backgroundColor: colors.card, borderColor: colors.line, borderRadius: radii.card, borderWidth: 1, flexGrow: 1, overflow: "hidden" },
  row: {
    alignItems: "center", backgroundColor: colors.card, borderColor: colors.line, borderRadius: radii.card,
    borderWidth: 1, flexDirection: "row", minHeight: 56, overflow: "hidden",
  },
  cardPhoto: { aspectRatio: 3 / 4, borderRadius: 0 },
  rowPhoto: { borderRadius: 0, height: 72, width: 56 },
  copy: { flex: 1, gap: 2, paddingHorizontal: 12, paddingVertical: 10 },
  selected: { borderColor: colors.wine, borderWidth: 2 },
  disabled: { opacity: 0.35 },
  pressed: { opacity: 0.7 },
  label: { color: colors.ink, fontFamily: fonts.display, fontSize: 18 },
  labelSelected: { color: colors.wine },
  detail: { ...typography.caption },
  swatchCard: { backgroundColor: colors.card, borderColor: colors.line, borderRadius: radii.card, borderWidth: 1, flexBasis: "30%", flexGrow: 1, gap: 8, padding: 10 },
  swatches: { flexDirection: "row", height: 36 },
  swatch: { borderColor: colors.line, borderWidth: StyleSheet.hairlineWidth, flex: 1 },
  swatchLabel: { color: colors.ink, fontFamily: fonts.label, fontSize: 12 },
  pair: { flexDirection: "row", gap: 10 },
  pole: { flex: 1, gap: 4 },
  polePhoto: { aspectRatio: 3 / 4 },
  eitherRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 16 },
});
