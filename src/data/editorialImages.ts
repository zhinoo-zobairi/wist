import type { ImageSourcePropType } from "react-native";

// Editorial photography shown in the intro, bundled with the app and credited
// on screen. Every photograph is free to use under the Unsplash License (not
// Unsplash+), shows no house's pieces, logos or campaigns, and no
// recognisable face (no model release is needed).
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
    credit: "Louis Paulin",
    sourceUrl: "https://unsplash.com/photos/sEuhlVOjNxs",
    alt: "A woman in a long black coat seen from behind on a checkered marble floor, in black and white",
    aspect: 1200 / 1350,
  },
  coverInset: {
    source: require("../../assets/editorial/cover-inset.jpg"),
    credit: "Olga Kozachenko",
    sourceUrl: "https://unsplash.com/photos/o9dtfshlJ60",
    alt: "Folded knitwear stacked in cream, camel and mustard",
    aspect: 720 / 758,
  },
  covet: {
    source: require("../../assets/editorial/covet.jpg"),
    credit: "Natálie Malotová",
    sourceUrl: "https://unsplash.com/photos/w8qRfrQMSHY",
    alt: "A black coat on a hanger beside a sheer curtain and the shadows of plants",
    aspect: 1000 / 1431,
  },
  covetInset: {
    source: require("../../assets/editorial/covet-inset.jpg"),
    credit: "Roman Manshin",
    sourceUrl: "https://unsplash.com/photos/-Ah6NPOCTvI",
    alt: "A white jumper folded over a gold hanger",
    aspect: 640 / 800,
  },
  watch: {
    source: require("../../assets/editorial/watch.jpg"),
    credit: "Hoseung Han",
    sourceUrl: "https://unsplash.com/photos/qETSeFtTCqM",
    alt: "A man in a beige trench coat and flat cap, seen from behind",
    aspect: 1000 / 1431,
  },
  hero: {
    source: require("../../assets/editorial/hero.jpg"),
    credit: "Second Breakfast",
    sourceUrl: "https://unsplash.com/photos/jdDbHdNfeXQ",
    alt: "A close-up of a woven knit, in black and white",
    aspect: 1000 / 1125,
  },
};
