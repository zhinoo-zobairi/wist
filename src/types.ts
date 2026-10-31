/** Whether the app holds a live catalogue: first load, loaded, or unreachable. */
export type CatalogueStatus = "loading" | "ready" | "error";

export type Brand = {
  id: string;
  name: string;
  monogram: string;
  curated: true;
};

export type ItemMedia = {
  type: "image" | "video";
  url: string;
};

export type ItemVariant = {
  id: string;
  label: string;
  available: boolean;
};

export type Currency = "EUR" | "GBP";

export type Item = {
  id: string;
  brandId: string;
  name: string;
  imageUrl: string;
  media?: ItemMedia[];
  variants?: ItemVariant[];
  currentPrice: number;
  currency: Currency;
  url: string;
  available?: boolean;
  observedAt?: string;
  previousPrice?: number | null;
  sourceProductId?: string;
};

export type PriceSnapshot = {
  id: string;
  itemId: string;
  price: number;
  capturedAt: string;
};

export type User = {
  id: string;
};

export type Follow = {
  userId: string;
  brandId: string;
};

export type Star = {
  userId: string;
  itemId: string;
};

export type Alert = {
  id: string;
  userId: string;
  itemId: string;
  oldPrice: number;
  newPrice: number;
  pctOff: number;
  createdAt: string;
  read: boolean;
};

export const OCCASION_OPTIONS = [
  { id: "work", label: "Work" },
  { id: "evening", label: "Evening" },
  { id: "weekend", label: "Weekend" },
  { id: "celebration", label: "Celebration" },
  { id: "travel", label: "Travel" },
] as const;

export const STYLE_OPTIONS = [
  { id: "minimal", label: "Minimal" },
  { id: "tailored", label: "Tailored" },
  { id: "romantic", label: "Romantic" },
  { id: "utilitarian", label: "Utilitarian" },
  { id: "bold", label: "Bold" },
  { id: "eclectic", label: "Eclectic" },
] as const;

export type Occasion = (typeof OCCASION_OPTIONS)[number]["id"];
export type Style = (typeof STYLE_OPTIONS)[number]["id"];

/** A choice on an N° 02 screen: a stored id, its label, an optional second line. */
export type ChoiceOption<Id> = { id: Id; label: string; detail?: string };

export const SHOPS_FOR_OPTIONS = [
  { id: "womenswear", label: "Womenswear" },
  { id: "menswear", label: "Menswear" },
  { id: "both", label: "Both" },
] as const;

export const HELP_WITH_OPTIONS = [
  { id: "use_what_i_own", label: "Getting more from what I own" },
  { id: "fewer_better", label: "Buying fewer, better pieces" },
  { id: "what_goes_together", label: "Knowing what goes together" },
  { id: "weather", label: "Dressing for the weather" },
  { id: "rare_occasions", label: "Occasions I rarely dress for" },
  { id: "find_my_style", label: "Finding a style that is mine" },
] as const;

export const WORK_DRESS_CODE_OPTIONS = [
  { id: "suited", label: "Suited", detail: "Law, finance, client-facing" },
  { id: "smart", label: "Smart", detail: "Tailoring without the tie" },
  { id: "creative", label: "Creative", detail: "Studios, agencies, anything goes" },
  { id: "casual", label: "Casual", detail: "Jeans on a Tuesday" },
  { id: "remote", label: "Mostly from home", detail: "Dressed from the waist up" },
] as const;

export type TasteAxis = "structure" | "edge" | "contrast" | "era" | "finish";
export type TastePole =
  | "structured" | "fluid" | "sharp" | "soft" | "tonal" | "contrast"
  | "classic" | "current" | "polished" | "lived_in";
export type TasteAnswer = TastePole | "both" | "neither";

export const TASTE_AXIS_OPTIONS: readonly {
  id: TasteAxis;
  question: string;
  poles: readonly [ChoiceOption<TastePole>, ChoiceOption<TastePole>];
}[] = [
  { id: "structure", question: "Structured, or fluid?", poles: [
    { id: "structured", label: "Structured", detail: "Shoulders, seams, a shape of its own" },
    { id: "fluid", label: "Fluid", detail: "Drape that moves with you" },
  ] },
  { id: "edge", question: "Sharp, or soft?", poles: [
    { id: "sharp", label: "Sharp", detail: "Clean lines, a waist, nothing loose" },
    { id: "soft", label: "Soft", detail: "Knits, pleats, movement" },
  ] },
  { id: "contrast", question: "Tonal, or contrast?", poles: [
    { id: "tonal", label: "Tonal", detail: "One colour family, head to toe" },
    { id: "contrast", label: "Contrast", detail: "Light against dark, colour against neutral" },
  ] },
  { id: "era", question: "Classic, or of the moment?", poles: [
    { id: "classic", label: "Classic", detail: "Right ten years ago, right in ten more" },
    { id: "current", label: "Of the moment", detail: "What this season is wearing" },
  ] },
  { id: "finish", question: "Polished, or lived-in?", poles: [
    { id: "polished", label: "Polished", detail: "Pressed, finished, considered" },
    { id: "lived_in", label: "Lived-in", detail: "Washed, creased, easy" },
  ] },
];

export type Palette = "ivory_camel" | "ink_grey" | "earth" | "jewel" | "brights" | "pastels";

// Swatch colours from the storyboard's palette screen.
export const PALETTE_OPTIONS: readonly { id: Palette; label: string; swatches: readonly string[] }[] = [
  { id: "ivory_camel", label: "Ivory & camel", swatches: ["#F2EBDD", "#C8A27A", "#8C6A4A", "#181715"] },
  { id: "ink_grey", label: "Ink & grey", swatches: ["#1F2A3A", "#6E7178", "#C9CCD1", "#FFFFFF"] },
  { id: "earth", label: "Earth", swatches: ["#7A3E22", "#6B6B3A", "#4A2E22", "#D8C3A5"] },
  { id: "jewel", label: "Jewel", swatches: ["#6E1F2B", "#1F4D3A", "#23325E", "#C6A15B"] },
  { id: "brights", label: "Brights", swatches: ["#D64933", "#F2B134", "#2E86AB", "#E7E1D7"] },
  { id: "pastels", label: "Pastels", swatches: ["#E8C7C1", "#C9D6C3", "#C6D3E3", "#EFE4CF"] },
];

export const NEVER_COLOUR_OPTIONS = [
  { id: "orange", label: "Orange" },
  { id: "neon", label: "Neon" },
  { id: "yellow", label: "Yellow" },
  { id: "pink", label: "Pink" },
  { id: "all_black", label: "Head-to-toe black" },
] as const;

export const PRINT_OPTIONS = [
  { id: "plain", label: "Plain only" },
  { id: "small_doses", label: "In small doses" },
  { id: "lots", label: "The more the better" },
] as const;

export type FitRow = "tops" | "trousers" | "lengths" | "coats";
export type FitAnswer =
  | "fitted" | "relaxed" | "oversized" | "slim" | "straight" | "wide"
  | "mini" | "midi" | "maxi" | "cropped" | "hip" | "long";

export const FIT_ROW_OPTIONS: readonly { id: FitRow; label: string; options: readonly ChoiceOption<FitAnswer>[] }[] = [
  { id: "tops", label: "Tops and jackets", options: [
    { id: "fitted", label: "Fitted" }, { id: "relaxed", label: "Relaxed" }, { id: "oversized", label: "Oversized" },
  ] },
  { id: "trousers", label: "Trousers", options: [
    { id: "slim", label: "Slim" }, { id: "straight", label: "Straight" }, { id: "wide", label: "Wide" },
  ] },
  { id: "lengths", label: "Skirts and dresses", options: [
    { id: "mini", label: "Mini" }, { id: "midi", label: "Midi" }, { id: "maxi", label: "Maxi" },
  ] },
  { id: "coats", label: "Coats", options: [
    { id: "cropped", label: "Cropped" }, { id: "hip", label: "Hip length" }, { id: "long", label: "Long" },
  ] },
];

export type SizeKind = "tops" | "bottoms" | "shoes";

// The womenswear and menswear screens show different pieces; the ids are shared.
export const SIGNATURE_OPTIONS = [
  { id: "blazer", label: "A blazer", audience: "both" },
  { id: "fine_knits", label: "Fine knits", audience: "both" },
  { id: "white_shirt", label: "A white shirt", audience: "both" },
  { id: "straight_jeans", label: "Straight jeans", audience: "both" },
  { id: "trench", label: "A trench", audience: "both" },
  { id: "loafers", label: "Loafers", audience: "both" },
  { id: "ankle_boots", label: "Ankle boots", audience: "womenswear" },
  { id: "slip_skirt", label: "A slip skirt", audience: "womenswear" },
  { id: "overcoat", label: "An overcoat", audience: "menswear" },
  { id: "chinos", label: "Chinos", audience: "menswear" },
] as const;

export const GAP_OPTIONS = [
  { id: "long_coat", label: "A long coat" },
  { id: "evening_shoes", label: "Evening shoes" },
  { id: "bag", label: "A good bag" },
  { id: "tailored_trousers", label: "Tailored trousers" },
] as const;

export const DROP_THRESHOLD_OPTIONS = [
  { id: 0, label: "Any new low" },
  { id: 10, label: "From 10% off" },
  { id: 20, label: "From 20% off" },
  { id: 30, label: "From 30% off" },
] as const;

export type ShopsFor = (typeof SHOPS_FOR_OPTIONS)[number]["id"];
export type HelpWith = (typeof HELP_WITH_OPTIONS)[number]["id"];
export type WorkDressCode = (typeof WORK_DRESS_CODE_OPTIONS)[number]["id"];
export type NeverColour = (typeof NEVER_COLOUR_OPTIONS)[number]["id"];
export type Prints = (typeof PRINT_OPTIONS)[number]["id"];
export type SignaturePiece = (typeof SIGNATURE_OPTIONS)[number]["id"];
export type WardrobeGap = (typeof GAP_OPTIONS)[number]["id"];
export type DropThreshold = (typeof DROP_THRESHOLD_OPTIONS)[number]["id"];

/** The N° 02 answers beside occasions and styles; mirrors the catalogue's StyleDetails. */
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

/** Every brief answer unanswered. A fresh object each call. */
export function emptyStyleDetails(): StyleDetails {
  return {
    shopsFor: null, helpWith: [], workDressCode: null, tasteAxes: {}, palettes: [], neverColours: [],
    prints: null, fit: {}, defaultSizes: {}, signature: [], gaps: [], dropThreshold: null,
  };
}

/** Everything N° 02 collects. The details are sent on the Composing screen. */
export type OnboardingAnswers = {
  occasions: Occasion[];
  styles: Style[];
  details: StyleDetails;
  /** Houses picked on screen 11, written to the follow list when the reader continues. */
  houseIds: string[];
  /** The answer on screen 14, for the brief's third promise; null until asked. */
  notificationsAllowed: boolean | null;
};

/** N° 02 in progress: the step on screen and the answers so far. */
export type OnboardingDraft = { stepIndex: number; answers: OnboardingAnswers };

export type StyleProfile = {
  occasions: Occasion[];
  styles: Style[];
  updatedAt: string;
};

export const GARMENT_CATEGORY_OPTIONS = [
  { id: "top", label: "Top" },
  { id: "bottom", label: "Bottom" },
  { id: "dress", label: "Dress" },
  { id: "outerwear", label: "Outerwear" },
  { id: "shoes", label: "Shoes" },
  { id: "bag", label: "Bag" },
  { id: "accessory", label: "Accessory" },
] as const;
export const FORMALITY_OPTIONS = [
  { id: "casual", label: "Casual" },
  { id: "smart_casual", label: "Smart casual" },
  { id: "formal", label: "Formal" },
] as const;
export const WARMTH_OPTIONS = [
  { id: "light", label: "Light" },
  { id: "medium", label: "Medium" },
  { id: "heavy", label: "Heavy" },
] as const;
export type GarmentCategory = (typeof GARMENT_CATEGORY_OPTIONS)[number]["id"];
export type Formality = (typeof FORMALITY_OPTIONS)[number]["id"];
export type Warmth = (typeof WARMTH_OPTIONS)[number]["id"];
export type GarmentInput = {
  name: string;
  category: GarmentCategory;
  colors: string[];
  formality: Formality;
  warmth: Warmth;
  occasions: Occasion[];
  notes: string | null;
};
export type Garment = GarmentInput & {
  id: string;
  source: "manual" | "photo" | "purchase";
  catalogueItemId: string | null;
  /** Purchase: absolute public URL. Photo: relative, owner-protected API path. */
  photoUrl: string | null;
  tagStatus: "untagged" | "tagged" | "failed";
  createdAt: string;
  updatedAt: string;
};

export type OutfitIdea = { id: string; occasion: Occasion; reason: string; createdAt: string; garments: Garment[] };
export type SavedOutfit = {
  id: string; occasion: Occasion; reason: string; savedAt: string; garments: Garment[]; missingGarmentIds: string[];
};
export type OutfitRunStatus = "running" | "succeeded" | "failed" | "skipped";
export type OutfitStatus = {
  pending: boolean; running: boolean; lastRunAt: string | null; lastRunStatus: OutfitRunStatus | null;
  runsLeftToday: number; generationEnabled: boolean;
};
export type Coordinates = { latitude: number; longitude: number };
export type WeatherSummary = {
  minC: number;
  maxC: number;
  precipitationChancePct: number;
  maxWindKph: number;
  condition: "clear" | "cloudy" | "fog" | "drizzle" | "rain" | "snow" | "thunderstorm";
};
/** The 06:00 ranking of every stored outfit; `reasons` covers the top 3. */
export type DailyPick = { day: string; weather: WeatherSummary; order: string[]; reasons: Record<string, string> };
export type OutfitBoard = { suggestions: OutfitIdea[]; saved: SavedOutfit[]; status: OutfitStatus; today: DailyPick | null };

export const LOCAL_USER_ID = "local-user";
