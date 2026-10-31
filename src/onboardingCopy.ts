import { formatPrice } from "./money";
import {
  FIT_ROW_OPTIONS, GAP_OPTIONS, NEVER_COLOUR_OPTIONS, PALETTE_OPTIONS, SIGNATURE_OPTIONS, STYLE_OPTIONS,
  TASTE_AXIS_OPTIONS,
  type Currency, type FitRow, type Occasion, type OnboardingAnswers, type Palette, type Prints,
  type StyleDetails, type TasteAnswer, type WorkDressCode,
} from "./types";

// Every sentence N° 02 says back to the reader is built here from the answers,
// so it is unit-tested rather than screen-tested (spec, App design).

export type InterludeCopy = { kicker: string; title: string; body: string };

export function labelOf<Id extends string | number>(
  options: readonly { id: Id; label: string }[],
  id: Id,
): string {
  return options.find((option) => option.id === id)?.label ?? "";
}

/** "a", "a and b", "a, b and c". */
export function listJoin(words: readonly string[], conjunction = "and"): string {
  if (words.length <= 1) return words[0] ?? "";
  return `${words.slice(0, -1).join(", ")} ${conjunction} ${words.at(-1)}`;
}

const capitalized = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const lower = (text: string) => text.toLowerCase();
const NUMBER_WORDS = ["no", "one", "two", "three"];

const OCCASION_PHRASES: Record<Occasion, string> = {
  work: "work", evening: "evenings out", weekend: "the weekend", celebration: "celebrations", travel: "travel",
};

const WORK_TITLES: Record<WorkDressCode, string> = {
  suited: "Sharp, polished, nothing loose.",
  smart: "Sharp, quiet, nothing extra.",
  creative: "Your own rules, well cut.",
  casual: "Easy, never careless.",
  remote: "Comfortable, and ready for the camera.",
};

const WORK_WEEK_PHRASES: Record<WorkDressCode, string> = {
  suited: "suited for work", smart: "smart for work", creative: "creative at work",
  casual: "casual at work", remote: "working mostly from home",
};

// A short colour list per palette, shared by the interlude, brief and reveal.
const PALETTE_WORDS: Record<Palette, string[]> = {
  ivory_camel: ["ivory", "camel"], ink_grey: ["ink", "grey"], earth: ["earth tones"],
  jewel: ["jewel tones"], brights: ["brights"], pastels: ["pastels"],
};

const PRINT_PHRASES: Record<Prints, string> = {
  plain: "Plain only", small_doses: "Prints in small doses", lots: "Prints, the more the better",
};

const TASTE_HEADLINE_PHRASES: Partial<Record<TasteAnswer, string>> = {
  soft: "a little soft", sharp: "a little sharp", fluid: "easy in the line", structured: "cut to hold its shape",
};

const FIT_PHRASES: Record<FitRow, string> = { tops: "on top", trousers: "below", lengths: "lengths", coats: "coats" };

const paletteWords = (details: StyleDetails) => details.palettes.flatMap((palette) => PALETTE_WORDS[palette]);
const styleWords = (answers: OnboardingAnswers) =>
  answers.styles.map((style) => lower(labelOf(STYLE_OPTIONS, style)));
const sizeLabels = (details: StyleDetails) =>
  (["tops", "bottoms", "shoes"] as const).flatMap((kind) => details.defaultSizes[kind] ?? []);

export function workInterlude(answers: OnboardingAnswers): InterludeCopy {
  const code = answers.details.workDressCode;
  if (code) {
    return {
      kicker: "For work, you said",
      title: WORK_TITLES[code],
      body: 'This is how WIST reads "work" for you. Every answer from here changes what you will see.',
    };
  }
  const places = answers.occasions.map((occasion) => OCCASION_PHRASES[occasion]);
  return {
    kicker: "Your week, so far",
    title: places.length > 0 ? `${capitalized(listJoin(places))}.` : "Whatever the week asks for.",
    body: "This is the week WIST dresses you for. Every answer from here changes what you will see.",
  };
}

export function paletteInterlude(answers: OnboardingAnswers): InterludeCopy {
  const words = paletteWords(answers.details);
  return {
    kicker: "Your palette, so far",
    title: words.length > 0 ? `${capitalized(listJoin(words))}.` : "Colour, your way.",
    body: "Colours that never argue with each other. Wear one piece you love and the rest of the outfit is already decided.",
  };
}

export function paletteSwatches(answers: OnboardingAnswers): string[] {
  return answers.details.palettes.flatMap(
    (palette) => PALETTE_OPTIONS.find((option) => option.id === palette)?.swatches ?? [],
  );
}

export function briefHeadline(answers: OnboardingAnswers): string {
  const { tasteAxes } = answers.details;
  const phrase =
    TASTE_HEADLINE_PHRASES[tasteAxes.edge ?? "neither"] ?? TASTE_HEADLINE_PHRASES[tasteAxes.structure ?? "neither"];
  const words = [...styleWords(answers), ...(phrase ? [phrase] : [])];
  return words.length > 0 ? `${capitalized(listJoin(words))}.` : "Your style, in your words.";
}

export function weekText({ details, occasions }: OnboardingAnswers): string {
  const work = details.workDressCode ? [WORK_WEEK_PHRASES[details.workDressCode]] : [];
  const places = occasions
    .filter((occasion) => work.length === 0 || occasion !== "work")
    .map((occasion) => OCCASION_PHRASES[occasion]);
  return capitalized(listJoin([...work, ...places]));
}

export function eyeText({ details }: OnboardingAnswers): string {
  const words = TASTE_AXIS_OPTIONS.flatMap((axis) => {
    const answer = details.tasteAxes[axis.id];
    if (answer === "both") return [`${lower(axis.poles[0].label)} and ${lower(axis.poles[1].label)}`];
    const pole = axis.poles.find((candidate) => candidate.id === answer);
    return pole ? [lower(pole.label)] : [];
  });
  return capitalized(words.join(", "));
}

export function paletteText({ details }: OnboardingAnswers): string {
  const never = details.neverColours.map((colour) => lower(labelOf(NEVER_COLOUR_OPTIONS, colour)));
  return [
    capitalized(listJoin(paletteWords(details))),
    never.length > 0 ? `Never ${listJoin(never, "or")}` : "",
    details.prints ? PRINT_PHRASES[details.prints] : "",
  ].filter(Boolean).join(". ");
}

export function fitText({ details }: OnboardingAnswers): string {
  const phrases = FIT_ROW_OPTIONS.flatMap((row) => {
    const option = row.options.find((candidate) => candidate.id === details.fit[row.id]);
    return option ? [`${lower(option.label)} ${FIT_PHRASES[row.id]}`] : [];
  });
  return capitalized(listJoin(phrases));
}

export function sizesText({ details }: OnboardingAnswers): string {
  return sizeLabels(details).join(" · ");
}

export function wardrobeText({ details }: OnboardingAnswers): string {
  const pieces = details.signature.map((id) => lower(labelOf(SIGNATURE_OPTIONS, id)));
  const gaps = details.gaps.map((id) => lower(labelOf(GAP_OPTIONS, id)));
  return [
    pieces.length > 0 ? `Built on ${listJoin(pieces)}` : "",
    gaps.length > 0 ? `Missing ${listJoin(gaps)}` : "",
  ].filter(Boolean).join(". ");
}

export function briefRows(answers: OnboardingAnswers): Array<{ label: string; value: string }> {
  return [
    { label: "Your week", value: weekText(answers) },
    { label: "Your eye", value: eyeText(answers) },
    { label: "Palette", value: paletteText(answers) },
    { label: "Fit", value: [fitText(answers), sizesText(answers)].filter(Boolean).join(". ") },
    { label: "Wardrobe", value: wardrobeText(answers) },
  ].filter((row) => row.value.length > 0);
}

/** The brief's three promises; `coveted` counts the pieces watched so far. */
export function briefPromises(answers: OnboardingAnswers, coveted: number): string[] {
  const { details, occasions } = answers;
  const forWork = details.workDressCode !== null || occasions.includes("work");
  const nouns = details.signature.map((id) => lower(labelOf(SIGNATURE_OPTIONS, id)).replace(/^an? /, ""));
  const gaps = details.gaps.map((id) => lower(labelOf(GAP_OPTIONS, id)));
  const pieces =
    coveted === 0 ? "a piece you covet falls" : coveted === 1 ? "your piece falls" : `your ${NUMBER_WORDS[coveted] ?? coveted} pieces fall`;
  const depth = details.dropThreshold ? `${details.dropThreshold}% or more` : "to a new low";
  // The second promise says "keep on your list", never "look for": there is no
  // product discovery yet (Decision 7, issue #18).
  return [
    `Dress you for ${forWork ? "work" : "your week"} from what you own${nouns.length > 0 ? `, starting with your ${listJoin(nouns)}` : ""}.`,
    gaps.length > 0
      ? `Keep ${listJoin(gaps)} on your list, in your palette and size.`
      : "Build every outfit inside your palette, in your size.",
    `Tell you when ${pieces} ${depth}, in your size.${answers.notificationsAllowed === false ? " You will find it in Alerts rather than as a banner." : ""}`,
  ];
}

export function composingLines(answers: OnboardingAnswers, houseNames: readonly string[], coveted: number): string[] {
  const sizes = sizeLabels(answers.details);
  const inPalette = answers.details.palettes.length > 0;
  return [
    houseNames.length > 0 ? `Reading ${listJoin(houseNames)}` : "Reading the houses WIST watches",
    sizes.length > 0
      ? `Keeping what comes in ${listJoin(sizes)}${inPalette ? ", in your palette" : ""}`
      : inPalette ? "Keeping to your palette" : "Learning your eye",
    coveted > 0
      ? `Setting a watch on your ${coveted === 1 ? "piece" : `${NUMBER_WORDS[coveted] ?? coveted} pieces`}`
      : "Getting your edit ready",
  ];
}

export function revealSummary(answers: OnboardingAnswers): string {
  const styles = styleWords(answers);
  const colours = paletteWords(answers.details);
  const sizes = sizeLabels(answers.details);
  const places = answers.occasions.map((occasion) => OCCASION_PHRASES[occasion]);
  const fit = fitText(answers);
  const sentences = [
    styles.length > 0
      ? `${capitalized(listJoin(styles))}${colours.length > 0 ? `, in ${listJoin(colours)}` : ""}.`
      : colours.length > 0 ? `In ${listJoin(colours)}.` : "",
    fit ? `${fit}.` : "",
    places.length > 0
      ? `For ${listJoin(places)}${sizes.length > 0 ? `, in ${listJoin(sizes)}` : ""}.`
      : sizes.length > 0 ? `In ${listJoin(sizes)}.` : "",
  ];
  return sentences.filter(Boolean).join(" ") || "Your edit starts here, and sharpens with every piece you covet.";
}

/** What a piece would have to cost before the chosen threshold lets an alert through. */
export function alertPriceText(price: number, currency: Currency, threshold: number | null): string {
  if (!threshold) return `below ${formatPrice(price, currency)}`;
  return formatPrice((price * (100 - threshold)) / 100, currency);
}

/** Whether any brief answer exists; occasions and styles are not part of it. */
export function hasStyleBrief(details: StyleDetails): boolean {
  return Object.values(details).some(
    (value) => value !== null && (typeof value !== "object" || Object.keys(value).length > 0),
  );
}
