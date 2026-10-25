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
