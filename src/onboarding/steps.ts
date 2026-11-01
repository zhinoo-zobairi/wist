export type StepId =
  | "shopsFor" | "helpWith" | "occasions" | "workDressCode" | "interludeWork"
  | "taste" | "styles" | "palette" | "interludePalette"
  | "fit" | "sizes" | "wardrobe"
  | "houses" | "covet" | "threshold" | "notify"
  | "composing" | "brief" | "reveal";

type Step = {
  id: StepId;
  kind: "question" | "interlude" | "finale";
  chapter?: string;
  title?: string;
  subtitle?: string;
};

export const QUESTION_COUNT = 14;

// The storyboard's order and copy ("WIST onboarding storyboard", 26 screens).
export const ONBOARDING_STEPS: readonly Step[] = [
  { id: "shopsFor", kind: "question", chapter: "N° 02 · Your edit", title: "What do you shop for?", subtitle: "Every photograph after this is chosen from your answer." },
  { id: "helpWith", kind: "question", chapter: "Chapter I · Your world", title: "What would make getting dressed easier?", subtitle: "Pick up to two. Dress me keeps them in mind when it explains an outfit." },
  { id: "occasions", kind: "question", chapter: "Chapter I · Your world", title: "Where does your wardrobe take you?", subtitle: "Each place you pick brings its own look onto this page." },
  { id: "workDressCode", kind: "question", chapter: "Chapter I · Your world", title: "What does work ask of you?", subtitle: "So a Monday suggestion is never too much, or too little." },
  { id: "interludeWork", kind: "interlude" },
  { id: "taste", kind: "question", chapter: "Chapter II · Your eye", title: "This or that", subtitle: "Tap the one you would rather wear. No wrong answers, only yours." },
  { id: "styles", kind: "question", chapter: "Chapter II · Your point of view", title: "Which would you wear?", subtitle: "Pick up to three." },
  { id: "palette", kind: "question", chapter: "Chapter II · Your eye", title: "Which palette feels like you?", subtitle: "Pick up to two. Outfits are built inside them." },
  { id: "interludePalette", kind: "interlude" },
  { id: "fit", kind: "question", chapter: "Chapter III · Your fit", title: "How do you like clothes to sit?", subtitle: "How you like to wear things, never your body. Dress me keeps proportions balanced around it." },
  { id: "sizes", kind: "question", chapter: "Chapter III · In your size", title: "What sizes do you wear?", subtitle: "A drop only reaches you when it lands in your size. When a shop uses the same label, WIST picks it for you as you covet; you can always change it." },
  { id: "wardrobe", kind: "question", chapter: "Chapter III · Your wardrobe", title: "What do you reach for, and what is missing?" },
  { id: "houses", kind: "question", chapter: "Chapter IV · Your houses", title: "Which houses do you love?", subtitle: "WIST watches the houses you follow." },
  { id: "covet", kind: "question", chapter: "Chapter IV · What you are waiting for", title: "Pick three pieces you would buy at the right price.", subtitle: "From your houses, in your sizes." },
  { id: "threshold", kind: "question", chapter: "Chapter IV · Your price", title: "When is a drop worth telling you?", subtitle: "WIST stays silent below this." },
  { id: "notify", kind: "question", chapter: "Chapter IV · When it drops", title: "You know first.", subtitle: "WIST speaks only when one of your pieces reaches a new low in your size. Never twice for the same drop." },
  { id: "composing", kind: "finale" },
  { id: "brief", kind: "finale" },
  { id: "reveal", kind: "finale" },
];

/** The question's number from 1 to 14, or null for an interlude or the finale. */
export function questionNumber(stepIndex: number): number | null {
  if (ONBOARDING_STEPS[stepIndex]?.kind !== "question") return null;
  return ONBOARDING_STEPS.slice(0, stepIndex + 1).filter((step) => step.kind === "question").length;
}
