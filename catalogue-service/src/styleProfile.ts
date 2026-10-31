export const OCCASIONS = [
  "work",
  "evening",
  "weekend",
  "celebration",
  "travel",
] as const;

export const STYLES = [
  "minimal",
  "tailored",
  "romantic",
  "utilitarian",
  "bold",
  "eclectic",
] as const;

// The N° 02 vocabulary. Ids are stored, so renaming one needs a data migration.
export const SHOPS_FOR = ["womenswear", "menswear", "both"] as const;
export const HELP_WITH = [
  "use_what_i_own",
  "fewer_better",
  "what_goes_together",
  "weather",
  "rare_occasions",
  "find_my_style",
] as const;
export const WORK_DRESS_CODES = [
  "suited",
  "smart",
  "creative",
  "casual",
  "remote",
] as const;
// Each axis is a pair of poles; any axis can also be answered both or neither.
export const TASTE_AXES = {
  structure: ["structured", "fluid"],
  edge: ["sharp", "soft"],
  contrast: ["tonal", "contrast"],
  era: ["classic", "current"],
  finish: ["polished", "lived_in"],
} as const;
export const TASTE_EITHER = ["both", "neither"] as const;
export const PALETTES = [
  "ivory_camel",
  "ink_grey",
  "earth",
  "jewel",
  "brights",
  "pastels",
] as const;
export const NEVER_COLOURS = [
  "orange",
  "neon",
  "yellow",
  "pink",
  "all_black",
] as const;
export const PRINTS = ["plain", "small_doses", "lots"] as const;
export const FIT_ROWS = {
  tops: ["fitted", "relaxed", "oversized"],
  trousers: ["slim", "straight", "wide"],
  lengths: ["mini", "midi", "maxi"],
  coats: ["cropped", "hip", "long"],
} as const;
export const SIZE_KINDS = ["tops", "bottoms", "shoes"] as const;
export const SIGNATURE_PIECES = [
  "blazer",
  "fine_knits",
  "white_shirt",
  "straight_jeans",
  "trench",
  "loafers",
  "ankle_boots",
  "slip_skirt",
  "overcoat",
  "chinos",
] as const;
export const WARDROBE_GAPS = [
  "long_coat",
  "evening_shoes",
  "bag",
  "tailored_trousers",
] as const;
/** Whole percent off the coveted price; 0 lets every new low through. */
export const DROP_THRESHOLDS = [0, 10, 20, 30] as const;

const MAX_HELP_WITH = 2;
const MAX_PALETTES = 2;
const MAX_SIZE_LABEL_LENGTH = 12;

export type Occasion = (typeof OCCASIONS)[number];
export type Style = (typeof STYLES)[number];
export type ShopsFor = (typeof SHOPS_FOR)[number];
export type HelpWith = (typeof HELP_WITH)[number];
export type WorkDressCode = (typeof WORK_DRESS_CODES)[number];
export type TasteAxis = keyof typeof TASTE_AXES;
export type TasteAnswer =
  | (typeof TASTE_AXES)[TasteAxis][number]
  | (typeof TASTE_EITHER)[number];
export type Palette = (typeof PALETTES)[number];
export type NeverColour = (typeof NEVER_COLOURS)[number];
export type Prints = (typeof PRINTS)[number];
export type FitRow = keyof typeof FIT_ROWS;
export type FitAnswer = (typeof FIT_ROWS)[FitRow][number];
export type SizeKind = (typeof SIZE_KINDS)[number];
export type SignaturePiece = (typeof SIGNATURE_PIECES)[number];
export type WardrobeGap = (typeof WARDROBE_GAPS)[number];
export type DropThreshold = (typeof DROP_THRESHOLDS)[number];

/** The N° 02 answers that sit beside occasions and styles. */
export type StyleDetails = {
  shopsFor: ShopsFor | null;
  helpWith: HelpWith[];
  workDressCode: WorkDressCode | null;
  tasteAxes: Partial<Record<TasteAxis, TasteAnswer>>;
  palettes: Palette[];
  neverColours: NeverColour[];
  prints: Prints | null;
  fit: Partial<Record<FitRow, FitAnswer>>;
  defaultSizes: Partial<Record<SizeKind, string>>;
  signature: SignaturePiece[];
  gaps: WardrobeGap[];
  dropThreshold: DropThreshold | null;
};

/** Every brief answer unanswered. A fresh object each call, safe to change. */
export function emptyStyleDetails(): StyleDetails {
  return {
    shopsFor: null,
    helpWith: [],
    workDressCode: null,
    tasteAxes: {},
    palettes: [],
    neverColours: [],
    prints: null,
    fit: {},
    defaultSizes: {},
    signature: [],
    gaps: [],
    dropThreshold: null,
  };
}

/** A PUT body: occasions and styles always, each brief answer only when sent. */
export type StyleProfileSelection = {
  occasions: Occasion[];
  styles: Style[];
} & Partial<StyleDetails>;

export type StyleProfile = StyleProfileSelection & {
  updatedAt: string;
};

function isUnique(values: readonly unknown[]): boolean {
  return new Set(values).size === values.length;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// The brief parsers return undefined for an invalid answer, which leaves null
// free to mean "clear this answer".
function parseOne<Value extends string | number>(
  value: unknown,
  vocabulary: readonly Value[],
): Value | undefined {
  return vocabulary.includes(value as Value) ? (value as Value) : undefined;
}

// A set: unique known ids, at most `cap`, returned in vocabulary order.
function parseSet<Value extends string>(
  value: unknown,
  vocabulary: readonly Value[],
  cap = vocabulary.length,
): Value[] | undefined {
  if (!Array.isArray(value) || value.length > cap || !isUnique(value)) {
    return undefined;
  }
  if (value.some((id) => !vocabulary.includes(id as Value))) return undefined;
  return vocabulary.filter((id) => value.includes(id));
}

// One answer per named row, each from that row's own list. A row left out is
// unanswered.
function parseRows<Row extends string, Value extends string>(
  value: unknown,
  rows: Record<Row, readonly Value[]>,
): Partial<Record<Row, Value>> | undefined {
  if (!isRecord(value)) return undefined;
  const parsed: Partial<Record<Row, Value>> = {};
  for (const [row, answer] of Object.entries(value)) {
    if (!Object.keys(rows).includes(row)) return undefined;
    if (!rows[row as Row].includes(answer as Value)) return undefined;
    parsed[row as Row] = answer as Value;
  }
  return parsed;
}

// Sizes are each storefront's own labels, so any short text is a valid label.
function parseSizes(
  value: unknown,
): Partial<Record<SizeKind, string>> | undefined {
  if (!isRecord(value)) return undefined;
  const parsed: Partial<Record<SizeKind, string>> = {};
  for (const [kind, label] of Object.entries(value)) {
    if (!SIZE_KINDS.includes(kind as SizeKind) || typeof label !== "string") {
      return undefined;
    }
    const trimmed = label.trim();
    if (trimmed.length === 0 || trimmed.length > MAX_SIZE_LABEL_LENGTH) {
      return undefined;
    }
    parsed[kind as SizeKind] = trimmed;
  }
  return parsed;
}

const TASTE_ANSWERS = Object.fromEntries(
  Object.entries(TASTE_AXES).map(([axis, poles]) => [
    axis,
    [...poles, ...TASTE_EITHER],
  ]),
) as unknown as Record<TasteAxis, readonly TasteAnswer[]>;

const DETAIL_PARSERS: {
  [Key in keyof StyleDetails]: (value: unknown) => StyleDetails[Key] | undefined;
} = {
  shopsFor: (value) => parseOne(value, SHOPS_FOR),
  helpWith: (value) => parseSet(value, HELP_WITH, MAX_HELP_WITH),
  workDressCode: (value) => parseOne(value, WORK_DRESS_CODES),
  tasteAxes: (value) => parseRows(value, TASTE_ANSWERS),
  palettes: (value) => parseSet(value, PALETTES, MAX_PALETTES),
  neverColours: (value) => parseSet(value, NEVER_COLOURS),
  prints: (value) => parseOne(value, PRINTS),
  fit: (value) =>
    parseRows(value, FIT_ROWS as Record<FitRow, readonly FitAnswer[]>),
  defaultSizes: parseSizes,
  signature: (value) => parseSet(value, SIGNATURE_PIECES),
  gaps: (value) => parseSet(value, WARDROBE_GAPS),
  dropThreshold: (value) => parseOne(value, DROP_THRESHOLDS),
};

export function parseStyleProfile(
  value: unknown,
): StyleProfileSelection | null {
  if (!isRecord(value)) return null;

  const candidate = value;
  if (!Array.isArray(candidate.occasions) || !Array.isArray(candidate.styles)) {
    return null;
  }
  if (
    candidate.occasions.length > OCCASIONS.length ||
    candidate.styles.length > 3 ||
    !isUnique(candidate.occasions) ||
    !isUnique(candidate.styles)
  ) {
    return null;
  }

  const occasions = new Set(candidate.occasions);
  const styles = new Set(candidate.styles);
  if (
    candidate.occasions.some((occasion) =>
      !OCCASIONS.includes(occasion as Occasion),
    ) ||
    candidate.styles.some((style) => !STYLES.includes(style as Style))
  ) {
    return null;
  }

  const selection: StyleProfileSelection = {
    occasions: OCCASIONS.filter((occasion) => occasions.has(occasion)),
    styles: STYLES.filter((style) => styles.has(style)),
  };

  // A brief answer left out keeps what is stored (Decision 4), so it stays
  // out of the selection too; null clears it.
  const empty = emptyStyleDetails();
  for (const key of Object.keys(DETAIL_PARSERS) as Array<keyof StyleDetails>) {
    if (!(key in candidate)) continue;
    const answer =
      candidate[key] === null ? empty[key] : DETAIL_PARSERS[key](candidate[key]);
    if (answer === undefined) return null;
    Object.assign(selection, { [key]: answer });
  }
  return selection;
}
