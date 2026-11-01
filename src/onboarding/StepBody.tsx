import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { OccasionStylePicker } from "../components/OccasionStylePicker";
import { alertPriceText, labelOf } from "../onboardingCopy";
import { colors, fonts, typography } from "../theme";
import {
  DROP_THRESHOLD_OPTIONS, FIT_ROW_OPTIONS, GAP_OPTIONS, HELP_WITH_OPTIONS, NEVER_COLOUR_OPTIONS, OCCASION_OPTIONS,
  PRINT_OPTIONS, SHOPS_FOR_OPTIONS, SIGNATURE_OPTIONS, STYLE_OPTIONS, TASTE_AXIS_OPTIONS, WORK_DRESS_CODE_OPTIONS,
  type Item, type Occasion, type OnboardingAnswers, type ShopsFor, type SizeKind, type StyleDetails,
} from "../types";
import { PhotoChoice, PhotoFrame, SwatchChoice } from "./inputs";
import type { StepId } from "./steps";

const MAX_HELP_WITH = 2;
const MAX_STYLES = 3;
const MAX_PALETTES = 2;

const SIZE_ROWS: readonly { kind: SizeKind; label: string }[] = [
  { kind: "tops", label: "Tops" },
  { kind: "bottoms", label: "Trousers and skirts" },
  { kind: "shoes", label: "Shoes" },
];

// Common labels to tap. They are matched to a shop's own labels exactly
// (sizePreselect.ts), never converted between brands.
const SIZE_CHOICES: Record<"womenswear" | "menswear", Record<SizeKind, readonly string[]>> = {
  womenswear: { tops: ["XS", "S", "M", "L", "XL"], bottoms: ["34", "36", "38", "40", "42"], shoes: ["37", "38", "39", "40", "41"] },
  menswear: { tops: ["S", "M", "L", "XL", "XXL"], bottoms: ["44", "46", "48", "50", "52"], shoes: ["41", "42", "43", "44", "45"] },
};

/** The steps whose answers live only in the answers, so Profile can reuse them. */
export type AnswerStepId = Extract<
  StepId,
  "shopsFor" | "helpWith" | "occasions" | "workDressCode" | "taste" | "styles" | "palette" | "fit" | "sizes" | "wardrobe" | "threshold"
>;

const one = <Id,>(value: Id | null | undefined): Id[] => (value === null || value === undefined ? [] : [value]);

function sizeChoices(shopsFor: ShopsFor | null, kind: SizeKind) {
  const labels =
    shopsFor === "menswear" ? SIZE_CHOICES.menswear[kind]
      : shopsFor === "both" ? [...new Set([...SIZE_CHOICES.womenswear[kind], ...SIZE_CHOICES.menswear[kind]])]
        : SIZE_CHOICES.womenswear[kind];
  return labels.map((label) => ({ id: label, label }));
}

// Menswear asks about coat length instead of skirt length; both asks both.
function fitRowsFor(shopsFor: ShopsFor | null) {
  if (shopsFor === "womenswear") return FIT_ROW_OPTIONS.filter((row) => row.id !== "coats");
  if (shopsFor === "menswear") return FIT_ROW_OPTIONS.filter((row) => row.id !== "lengths");
  return FIT_ROW_OPTIONS;
}

function signatureFor(shopsFor: ShopsFor | null) {
  return SIGNATURE_OPTIONS.filter(
    (option) => option.audience === "both" || shopsFor === null || shopsFor === "both" || option.audience === shopsFor,
  );
}

function Group({ children, label, note }: { children: ReactNode; label: string; note?: string }) {
  return (
    <View style={bodyStyles.group}>
      <Text style={bodyStyles.groupLabel}>{label.toUpperCase()}</Text>
      {children}
      {note ? <Text style={bodyStyles.note}>{note}</Text> : null}
    </View>
  );
}

export function StepBody({ answers, onChange, pieces = [], step }: {
  answers: OnboardingAnswers;
  onChange: (answers: OnboardingAnswers) => void;
  /** Pieces coveted so far, for the threshold step's alert prices. */
  pieces?: Item[];
  step: AnswerStepId;
}) {
  const { details } = answers;
  const { shopsFor } = details;
  const setDetails = (patch: Partial<StyleDetails>) => onChange({ ...answers, details: { ...details, ...patch } });

  switch (step) {
    case "shopsFor":
      return (
        <PhotoChoice
          columns={3} max={1} onChange={([id]) => setDetails({ shopsFor: id ?? null })}
          options={SHOPS_FOR_OPTIONS} photoPrefix="shopsFor" selected={one(shopsFor)} shopsFor={shopsFor}
        />
      );
    case "helpWith":
      return (
        <PhotoChoice
          layout="rows" max={MAX_HELP_WITH} onChange={(helpWith) => setDetails({ helpWith })}
          options={HELP_WITH_OPTIONS} selected={details.helpWith} shopsFor={shopsFor}
        />
      );
    case "occasions": {
      // The two looks above follow the first two places picked.
      const looks: Occasion[] = answers.occasions.length > 0 ? answers.occasions.slice(0, 2) : ["work", "weekend"];
      return (
        <View style={bodyStyles.stack}>
          <View style={bodyStyles.pair}>
            {looks.map((occasion, position) => (
              <PhotoFrame
                fallback={labelOf(OCCASION_OPTIONS, occasion)} key={occasion} photoKey={`occasion.${occasion}`}
                position={position} shopsFor={shopsFor} style={bodyStyles.look}
              />
            ))}
          </View>
          <OccasionStylePicker onChange={(occasions) => onChange({ ...answers, occasions })} options={OCCASION_OPTIONS} selected={answers.occasions} />
        </View>
      );
    }
    case "workDressCode":
      return (
        <PhotoChoice
          layout="rows" max={1} onChange={([id]) => setDetails({ workDressCode: id ?? null })}
          options={WORK_DRESS_CODE_OPTIONS} photoPrefix="dressCode" selected={one(details.workDressCode)} shopsFor={shopsFor}
        />
      );
    case "taste":
      // Profile edits every axis at once; the flow asks them as rounds instead.
      return (
        <View style={bodyStyles.stack}>
          {TASTE_AXIS_OPTIONS.map((axis) => (
            <Group key={axis.id} label={axis.question}>
              <OccasionStylePicker
                onChange={([answer]) => setDetails({ tasteAxes: { ...details.tasteAxes, [axis.id]: answer } })}
                options={[...axis.poles, { id: "both" as const, label: "Both" }, { id: "neither" as const, label: "Neither" }]}
                selected={one(details.tasteAxes[axis.id])}
                selectionMode="single"
              />
            </Group>
          ))}
        </View>
      );
    case "styles":
      return (
        <PhotoChoice
          max={MAX_STYLES} onChange={(styles) => onChange({ ...answers, styles })}
          options={STYLE_OPTIONS} photoPrefix="style" selected={answers.styles} shopsFor={shopsFor}
        />
      );
    case "palette":
      return (
        <View style={bodyStyles.stack}>
          <SwatchChoice max={MAX_PALETTES} onChange={(palettes) => setDetails({ palettes })} selected={details.palettes} />
          <Group label="Never on me">
            <OccasionStylePicker onChange={(neverColours) => setDetails({ neverColours })} options={NEVER_COLOUR_OPTIONS} selected={details.neverColours} />
          </Group>
          <Group label="Prints and pattern">
            <OccasionStylePicker
              onChange={([prints]) => setDetails({ prints: prints ?? null })} options={PRINT_OPTIONS}
              selected={one(details.prints)} selectionMode="single"
            />
          </Group>
        </View>
      );
    case "fit":
      return (
        <View style={bodyStyles.stack}>
          {fitRowsFor(shopsFor).map((row) => (
            <Group key={row.id} label={row.label}>
              <PhotoChoice
                columns={3} max={1} onChange={([answer]) => setDetails({ fit: { ...details.fit, [row.id]: answer } })}
                options={row.options} photoPrefix={`fit.${row.id}`} selected={one(details.fit[row.id])} shopsFor={shopsFor}
              />
            </Group>
          ))}
        </View>
      );
    case "sizes":
      return (
        <View style={bodyStyles.stack}>
          {SIZE_ROWS.map(({ kind, label }) => (
            <Group key={kind} label={kind === "bottoms" && shopsFor === "menswear" ? "Trousers" : label}>
              <OccasionStylePicker
                onChange={([size]) => setDetails({ defaultSizes: { ...details.defaultSizes, [kind]: size } })}
                options={sizeChoices(shopsFor, kind)} selected={one(details.defaultSizes[kind])} selectionMode="single"
              />
            </Group>
          ))}
        </View>
      );
    case "wardrobe":
      return (
        <View style={bodyStyles.stack}>
          <Group label="Every week, I reach for" note="Outfits are built around these first.">
            <OccasionStylePicker onChange={(signature) => setDetails({ signature })} options={signatureFor(shopsFor)} selected={details.signature} />
          </Group>
          <Group label="My wardrobe is missing" note="Kept in your style brief, so no outfit counts on a piece you do not own.">
            <PhotoChoice
              layout="rows" onChange={(gaps) => setDetails({ gaps })} options={GAP_OPTIONS}
              photoPrefix="gap" selected={details.gaps} shopsFor={shopsFor}
            />
          </Group>
        </View>
      );
    case "threshold":
      return (
        <View style={bodyStyles.stack}>
          <OccasionStylePicker
            onChange={([threshold]) => setDetails({ dropThreshold: threshold ?? null })}
            options={DROP_THRESHOLD_OPTIONS} selected={one(details.dropThreshold)} selectionMode="single"
          />
          {pieces.length > 0 ? (
            <Group label="Your pieces would speak at">
              {pieces.map((piece) => (
                <View key={piece.id} style={bodyStyles.priceRow}>
                  <Text numberOfLines={1} style={bodyStyles.priceName}>{piece.name}</Text>
                  <Text style={bodyStyles.price}>{alertPriceText(piece.currentPrice, piece.currency, details.dropThreshold)}</Text>
                </View>
              ))}
            </Group>
          ) : null}
        </View>
      );
  }
}

const bodyStyles = StyleSheet.create({
  stack: { gap: 20 },
  pair: { flexDirection: "row", gap: 10 },
  look: { aspectRatio: 3 / 4, flexBasis: "48%" },
  group: { gap: 8 },
  groupLabel: { ...typography.kicker },
  note: { ...typography.caption },
  priceRow: { alignItems: "baseline", borderBottomColor: colors.line, borderBottomWidth: 1, flexDirection: "row", gap: 12, paddingVertical: 8 },
  priceName: { color: colors.ink, flex: 1, fontFamily: fonts.text, fontSize: 16 },
  price: { ...typography.price, color: colors.wine },
});
