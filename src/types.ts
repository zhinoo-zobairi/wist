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

export type Item = {
  id: string;
  brandId: string;
  name: string;
  imageUrl: string;
  media?: ItemMedia[];
  variants?: ItemVariant[];
  currentPrice: number;
  currency: "EUR";
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

export const LOCAL_USER_ID = "local-user";
