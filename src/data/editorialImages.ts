// Editorial photography shown in the intro, hotlinked from the brands' own
// sites and credited on screen. Nothing is copied into the repository.
export type EditorialImage = {
  /** Public https image URL on the brand's own CDN. */
  url: string;
  /** Brand name as shown in the credit line. */
  brand: string;
  /** The page the photograph was seen on, for the reference line. */
  sourceUrl: string;
  /** Plain-language description for screen readers. */
  alt: string;
  /** width / height of the photograph. */
  aspect: number;
};

export type EditorialRole =
  | "cover"
  | "coverInset"
  | "covet"
  | "covetInset"
  | "watch"
  | "hero";

const BOBBIES_HOME = "https://www.bobbies.com/en/";
const SANDRO_HOME = "https://de.sandro-paris.com/";
const SANDRO_LOOKBOOK_WOMEN = "https://de.sandro-paris.com/de/herbst-winter-sandro/lookbook.html";
const SANDRO_LOOKBOOK_MEN = "https://de.sandro-paris.com/de/herbst-winter-sandro/lookbook-man.html";
const CLAUDIE_PIERLOT_HOME = "https://de.claudiepierlot.com/";

// Curated set, seen on the brands' sites on 2026-10-18. Aspects are the
// measured pixel dimensions of each file as served.
export const editorial: Record<EditorialRole, EditorialImage> = {
  cover: {
    url: "https://images.prismic.io/bobbies/eCSeJDohNP1ZOQGV_Fe%CC%82tes-FW22-13-CropWeb1-1-.jpg?w=1400&fit=max",
    brand: "Bobbies",
    sourceUrl: BOBBIES_HOME,
    alt: "Suede knee boots striding across an airfield, a woman seated by a silver jet behind",
    aspect: 1400 / 1575,
  },
  coverInset: {
    url: "https://de.sandro-paris.com/dw/image/v2/BCMW_PRD/on/demandware.static/-/Library-Sites-Sandro-Shared/default/dw0e6582cb/Homepage/2026/LOOKBOOKFW26/V1/SLIDER_LOOKBOOK_F_DESK.jpg",
    brand: "Sandro",
    sourceUrl: SANDRO_HOME,
    alt: "A woman in a burgundy jumper and pleated tartan skirt on a staircase with brass rails",
    aspect: 1440 / 1515,
  },
  covet: {
    url: "https://de.sandro-paris.com/dw/image/v2/BCMW_PRD/on/demandware.static/-/Library-Sites-Sandro-Shared/default/dw2263a9f2/LOOKBOOK/LOOKBOOK%20FW26%20FEMME/N01_LOOKBOOK_FW26_F.jpg?sw=1400",
    brand: "Sandro",
    sourceUrl: SANDRO_LOOKBOOK_WOMEN,
    alt: "A woman in an argyle jumper and leather trousers seated in a dance studio",
    aspect: 1400 / 2004,
  },
  covetInset: {
    url: "https://de.claudiepierlot.com/on/demandware.static/-/Library-Sites-Claudie-Shared/default/dwe57fbfef/Homepage/2026/S42/S42-JardinSon-Push3-Mailles-DESK.jpg",
    brand: "Claudie Pierlot",
    sourceUrl: CLAUDIE_PIERLOT_HOME,
    alt: "A woman in a beret and striped rugby shirt holding a small suede bag",
    aspect: 1280 / 1600,
  },
  watch: {
    url: "https://de.sandro-paris.com/dw/image/v2/BCMW_PRD/on/demandware.static/-/Library-Sites-Sandro-Shared/default/dwc647ca9f/LOOKBOOK/LOOKBOOK%20FW26%20HOMME/N02_LOOKBOOK_FW26_H.jpg?sw=1400",
    brand: "Sandro",
    sourceUrl: SANDRO_LOOKBOOK_MEN,
    alt: "A man in a long camel coat leaning against a window in a riveted iron hallway",
    aspect: 1400 / 2004,
  },
  hero: {
    url: "https://images.prismic.io/bobbies/lwzUmOpLPyDxsPR8_Lifestyle-H-L3-01-LQ1-1-.jpg?w=1400&fit=max",
    brand: "Bobbies",
    sourceUrl: BOBBIES_HOME,
    alt: "A man in a checked jacket and leather boots sitting on the wing of a small plane",
    aspect: 1400 / 1575,
  },
};
