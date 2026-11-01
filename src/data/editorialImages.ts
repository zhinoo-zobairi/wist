import type { ImageSourcePropType } from "react-native";

// Editorial photography shown in the intro, bundled with the app and credited
// on screen. Every photograph is free to use under the Unsplash License (not
// Unsplash+) and shows no house's pieces, logos or campaigns.
export type EditorialImage = {
  /** Bundled photograph under assets/editorial/. */
  source: ImageSourcePropType;
  /** Photographer as shown in the credit line. */
  credit: string;
  /** The photograph's page on Unsplash, for the reference line. */
  sourceUrl: string;
  /** Plain-language description for screen readers. */
  alt: string;
  /** width / height of the bundled file. */
  aspect: number;
};

export type EditorialRole =
  | "cover"
  | "coverInset"
  | "covet"
  | "covetInset"
  | "watch"
  | "hero";

// Chosen on 2026-11-01; licence pages checked the same day. Each file is
// cropped to its slot, so the aspects are the files' own pixel dimensions.
export const editorial: Record<EditorialRole, EditorialImage> = {
  cover: {
    source: require("../../assets/editorial/cover.jpg"),
    credit: "Ali Karimiboroujeni",
    sourceUrl: "https://unsplash.com/photos/SdKYFvF4JjU",
    alt: "A woman in a black turtleneck holding a camel coat over her shoulder, in warm low light",
    aspect: 1200 / 1350,
  },
  coverInset: {
    source: require("../../assets/editorial/cover-inset.jpg"),
    credit: "Teslariu Mihai",
    sourceUrl: "https://unsplash.com/photos/lYA3dijweik",
    alt: "A woman in a cream turtleneck jumper in low warm light",
    aspect: 720 / 758,
  },
  covet: {
    source: require("../../assets/editorial/covet.jpg"),
    credit: "The AW Creative",
    sourceUrl: "https://unsplash.com/photos/ydT30WRWeEc",
    alt: "A woman in a camel coat over an olive dress by tall black doors",
    aspect: 1000 / 1431,
  },
  covetInset: {
    source: require("../../assets/editorial/covet-inset.jpg"),
    credit: "Mak Mozza",
    sourceUrl: "https://unsplash.com/photos/4Sror4SaAac",
    alt: "A woman in an oversized grey turtleneck, one hand on her shoulder",
    aspect: 640 / 800,
  },
  watch: {
    source: require("../../assets/editorial/watch.jpg"),
    credit: "Taras Chernus",
    sourceUrl: "https://unsplash.com/photos/iIjResyhhW0",
    alt: "A man in a camel coat and turtleneck against a cream wall",
    aspect: 1000 / 1431,
  },
  hero: {
    source: require("../../assets/editorial/hero.jpg"),
    credit: "Joel Timothy",
    sourceUrl: "https://unsplash.com/photos/-m3Oipywceo",
    alt: "A man in a white ribbed jumper seated on a plinth, in black and white",
    aspect: 1200 / 1350,
  },
};
