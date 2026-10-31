# N° 02 · Your edit — Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the two-question style onboarding with the fourteen-question N° 02 flow, store the new answers in the catalogue service's style profile, apply the reader's drop threshold, send the brief to the outfit engine, and end at the reveal.

**Architecture:** The catalogue service keeps owning the style profile. It gains twelve optional fields: child tables for the sets and columns for the single values, upgraded in place. `PUT` keeps an absent field and clears a `null` one. The owner's drop threshold joins the size rule in the alert decision, and the outfit engine's profile text gets longer. In the app, `OnboardingFlow` replaces `OnboardingScreen`. The flow is a list of steps drawn by small input components. Answers live in a persisted draft until the Composing screen commits them through the existing optimistic `commitStyleProfile` path. The interlude, brief and reveal sentences are pure functions in `src/onboardingCopy.ts`.

**Tech Stack:** Expo SDK 57, React Native 0.86, TypeScript (strict, `noUncheckedIndexedAccess`), zustand 5 `persist`, vitest, Node 22 `node:sqlite`.

**Spec:** [docs/superpowers/specs/2026-10-31-onboarding-your-edit-design.md](../specs/2026-10-31-onboarding-your-edit-design.md) (approved 2026-10-31 with all fourteen recommended decisions).

---

## Before you start

- Run everything from the repository root, `/Users/zhinoo.zobairi/Code/WIST`.
- After every commit, `npm run typecheck && npm test` must pass.
- Commit subjects use `type(scope): description`, lowercase and imperative, with no trailing period. No co-author or AI attribution lines. Do not push.
- Write the product name as WIST in every new string. Leave existing "Wist" copy alone.
- Never stage `.env.local` or any `.env*.local` file.
- **Deploy order:** Part A must run on the AtomMan catalogue before Part B talks to it. An older catalogue ignores the new fields and returns a profile without them. The app then reads that as an empty brief and replaces the brief it just saved locally.

## Choices made while planning (beyond the spec)

These keep the approved behaviour but were not spelled out in the spec. They need the owner's yes before execution.

1. **Where the threshold lives.** The spec puts the threshold inside `detectCovetedPriceDrop`. This plan puts it in the alert decision in `SqliteCatalogueRepository.recordObservation`, next to the size rule, with the same effect. A drop below the threshold is not announced and does not move `lowest_announced_price`, so a deeper drop later still alerts. The watch scheduler's log counts these drops as "silenced". The test lives in `sqliteRepository.test.ts`, not `covetedPriceDrop.test.ts`. `pctOff` is rounded, so a 19.6 % drop counts as 20 %, the same number the alert itself shows. `observeProduct.ts` reads the threshold too.
2. **A stored "unsynced" flag (`profileUnsynced`).** The spec relies on "the existing launch synchronization re-sends it later". Today that only happens when the catalogue has no profile at all. Take a reader whose catalogue profile already exists and who completes the brief offline. On the next launch, sync would load the older catalogue copy over the new answers. With the flag, launch sync first re-sends local answers the catalogue never accepted. A Profile edit made while answers are unsynced sends the whole local brief, not just the edited field.
3. **`GET` shape.** A single answer that was never set is `null`. A set that was never set is `[]`, and a per-row map (`tasteAxes`, `fit`, `defaultSizes`) is `{}`.
4. **Houses (screen 11).** Nothing is pre-selected for a new reader. A reader who opened N° 02 from Profile starts with their current follows. Picks are written when the reader taps Continue, and they replace the follow list. Continuing with none picked counts as Skip. The one-time follow-everything waits until onboarding is over, so it cannot run under the reader's choice.
5. **The gate.** A stored draft keeps the flow on screen even after Composing marks the profile answered, so the brief and the reveal can show. "Complete your style brief" on Profile starts a draft, which opens the same flow.
6. **Photographs.** The photo table ships empty, because Decision 1 says nothing ships with stand-ins. Every screen shows its labels on a plain wash frame until licensed images are added to `src/onboarding/photos.ts`. Until then the flow reads text-led.
7. **Composing timing.** Lines appear 450 ms apart. The screen moves on by itself once every line has shown and the save has settled, and a tap skips the wait. This is cosmetic.
8. **Sizes.** The reader taps chips from a fixed list per `shopsFor`, with no free-text field in this slice. The API still accepts any label of 1 to 12 characters.
9. **Screen 12** caps at three hearts. Screen 13 drops the storyboard's "You can name your own price for any piece later", because a per-watch price does not exist (Decision 6).
10. **Pre-selected sizes** show on the onboarding covet card and on the product page's size chips. If saving them fails, the watch stays on any size and the failure is only logged.

## File structure

**Catalogue service (Part A)**

| File | Change | Responsibility |
|---|---|---|
| `catalogue-service/src/styleProfile.ts` | Modify | Vocabulary, `StyleDetails`, `emptyStyleDetails()`, `parseStyleProfile` for every field |
| `catalogue-service/src/styleProfile.test.ts` | Modify | Parser tests |
| `catalogue-service/src/sqliteStyleProfileRepository.ts` | Rewrite | Child tables, in-place columns, merge write, `getDropThreshold()` |
| `catalogue-service/src/sqliteStyleProfileRepository.test.ts` | Modify | Round trip, keep/clear, August upgrade |
| `catalogue-service/src/app.test.ts` | Modify | Memory repository merges; API keep/clear and 400 |
| `catalogue-service/src/sqliteRepository.ts` | Modify | `dropThreshold` option in the alert decision |
| `catalogue-service/src/sqliteRepository.test.ts` | Modify | Threshold test |
| `catalogue-service/src/server.ts`, `observeProduct.ts` | Modify | Wire the threshold |
| `catalogue-service/src/claudeOutfitSuggester.ts` (+ test) | Modify | Send the brief; prompt lines |

**App (Part B)**

| File | Change | Responsibility |
|---|---|---|
| `src/types.ts` | Modify | Option lists with labels, `StyleDetails`, `OnboardingAnswers`, `OnboardingDraft`, `StyleProfile.details` |
| `src/services/catalogueClient.ts` (+ test) | Modify | `toStyleDetails`, `saveStyleBrief` |
| `src/store/useWistStore.ts` (+ test) | Modify | `styleDetails`, `profileUnsynced`, `onboardingDraft`, `chooseFollows`, `startStyleBrief` |
| `src/styleProfileCommit.ts` (+ test) | Modify | Carry details and the unsynced flag |
| `src/profileGate.ts` (+ test) | Modify | A draft keeps onboarding open |
| `src/sizePreselect.ts` (+ test) | Create | Default sizes that equal a shop's labels |
| `src/onboardingCopy.ts` (+ test) | Create | Interlude, brief, promises, composing, reveal, alert price |
| `src/onboarding/steps.ts` (+ test) | Create | Step list, titles, question numbers |
| `src/onboarding/photos.ts` | Create | Licensed photograph slots (empty for now) |
| `src/onboarding/inputs.tsx` | Create | `PhotoFrame`, `PhotoChoice`, `SwatchChoice`, `ThisOrThatRound` |
| `src/onboarding/StepBody.tsx` | Create | The input for each answer-only question (reused by Profile) |
| `src/onboarding/StoreSteps.tsx` | Create | Houses, covet and notification screens |
| `src/onboarding/Finale.tsx` | Create | Interlude, Composing, Brief, Reveal |
| `src/onboarding/OnboardingFlow.tsx` | Create | The flow: draft, navigation, commit |
| `src/components/OccasionStylePicker.tsx` | Modify | Accept numeric ids |
| `src/screens/OnboardingScreen.tsx` | Delete | Replaced by `OnboardingFlow` |
| `src/screens/ProfileScreen.tsx` | Modify | Brief rows, step editors, "Complete your style brief" |
| `App.tsx` | Modify | Gate, seeding, sync, covet options, flow props |

---

# Part A — Catalogue service

### Task 1: Validate the brief answers

**Files:**
- Modify: `catalogue-service/src/styleProfile.ts` (whole file)
- Test: `catalogue-service/src/styleProfile.test.ts`

- [ ] **Step 1: Write the failing tests**

Append inside the existing `describe("style profile validation", …)` block in `catalogue-service/src/styleProfile.test.ts`:

```ts
  it("accepts every brief answer and returns sets in vocabulary order", () => {
    expect(
      parseStyleProfile({
        occasions: [],
        styles: [],
        shopsFor: "both",
        helpWith: ["weather", "use_what_i_own"],
        workDressCode: "smart",
        tasteAxes: { structure: "fluid", edge: "both", finish: "lived_in" },
        palettes: ["ink_grey", "ivory_camel"],
        neverColours: ["neon", "orange"],
        prints: "small_doses",
        fit: { tops: "relaxed", coats: "long" },
        defaultSizes: { tops: " S ", shoes: "38" },
        signature: ["loafers", "blazer"],
        gaps: ["long_coat"],
        dropThreshold: 20,
      }),
    ).toEqual({
      occasions: [],
      styles: [],
      shopsFor: "both",
      helpWith: ["use_what_i_own", "weather"],
      workDressCode: "smart",
      tasteAxes: { structure: "fluid", edge: "both", finish: "lived_in" },
      palettes: ["ivory_camel", "ink_grey"],
      neverColours: ["orange", "neon"],
      prints: "small_doses",
      fit: { tops: "relaxed", coats: "long" },
      defaultSizes: { tops: "S", shoes: "38" },
      signature: ["blazer", "loafers"],
      gaps: ["long_coat"],
      dropThreshold: 20,
    });
  });

  // Decision 4: an absent answer keeps what is stored, so the parser leaves
  // it out; null clears it.
  it("leaves out an absent answer and turns null into a cleared one", () => {
    expect(
      parseStyleProfile({
        occasions: [],
        styles: [],
        shopsFor: null,
        palettes: null,
        fit: null,
      }),
    ).toEqual({ occasions: [], styles: [], shopsFor: null, palettes: [], fit: {} });
  });

  it.each([
    { shopsFor: "kids" },
    { helpWith: ["weather", "weather"] },
    { helpWith: ["weather", "fewer_better", "use_what_i_own"] },
    { workDressCode: "black_tie" },
    { tasteAxes: { structure: "sharp" } },
    { tasteAxes: { colour: "tonal" } },
    { tasteAxes: ["fluid"] },
    { palettes: ["earth", "jewel", "brights"] },
    { neverColours: ["beige"] },
    { prints: "none" },
    { fit: { tops: "wide" } },
    { defaultSizes: { tops: "" } },
    { defaultSizes: { tops: "   " } },
    { defaultSizes: { tops: "1234567890123" } },
    { defaultSizes: { hats: "M" } },
    { defaultSizes: { tops: 38 } },
    { signature: ["blazer", "blazer"] },
    { gaps: ["umbrella"] },
    { dropThreshold: 15 },
    { dropThreshold: "20" },
  ])("rejects an invalid brief answer: %j", (answer) => {
    expect(
      parseStyleProfile({ occasions: [], styles: [], ...answer }),
    ).toBeNull();
  });
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npx vitest run catalogue-service/src/styleProfile.test.ts`
Expected: the new tests FAIL. The parser drops the unknown keys, so the `toEqual` cases differ and the reject cases return a profile instead of `null`.

- [ ] **Step 3: Implement**

Replace `catalogue-service/src/styleProfile.ts` with:

```ts
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
) as Record<TasteAxis, readonly TasteAnswer[]>;

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
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npx vitest run catalogue-service/src/styleProfile.test.ts`
Expected: PASS, including the three original tests.

- [ ] **Step 5: Typecheck, full suite, commit**

```bash
npm run typecheck && npm test
git add catalogue-service/src/styleProfile.ts catalogue-service/src/styleProfile.test.ts
git commit -m "feat(catalogue): validate the n° 02 style brief answers"
```

---

### Task 2: Store the brief beside occasions and styles

**Files:**
- Rewrite: `catalogue-service/src/sqliteStyleProfileRepository.ts`
- Modify: `catalogue-service/src/styleProfile.ts` (the `StyleProfile` type)
- Modify: `catalogue-service/src/app.test.ts:31-45` (memory repository)
- Modify: `catalogue-service/src/claudeOutfitSuggester.test.ts:12` (fixture)
- Test: `catalogue-service/src/sqliteStyleProfileRepository.test.ts`

- [ ] **Step 1: Write the failing tests**

In `catalogue-service/src/sqliteStyleProfileRepository.test.ts`, add after the existing imports:

```ts
import { emptyStyleDetails, type StyleDetails } from "./styleProfile.js";

const fullBrief: StyleDetails = {
  shopsFor: "womenswear",
  helpWith: ["use_what_i_own"],
  workDressCode: "smart",
  tasteAxes: { structure: "fluid", edge: "soft" },
  palettes: ["ivory_camel", "ink_grey"],
  neverColours: ["orange"],
  prints: "small_doses",
  fit: { tops: "relaxed", trousers: "wide", lengths: "midi" },
  defaultSizes: { tops: "S", bottoms: "36", shoes: "38" },
  signature: ["blazer", "loafers"],
  gaps: ["long_coat", "evening_shoes"],
  dropThreshold: 20,
};
```

Then append inside the `describe` block:

```ts
  it("reads a profile saved without a brief as unanswered", async () => {
    const repository = createRepository();
    await repository.replaceProfile({ occasions: ["work"], styles: [] });

    await expect(repository.getProfile()).resolves.toEqual({
      ...emptyStyleDetails(),
      occasions: ["work"],
      styles: [],
      updatedAt: expect.any(String),
    });
  });

  it("round-trips every brief answer", async () => {
    const repository = createRepository();

    await expect(
      repository.replaceProfile({ occasions: [], styles: [], ...fullBrief }),
    ).resolves.toMatchObject(fullBrief);
    await expect(repository.getProfile()).resolves.toMatchObject(fullBrief);
  });

  // Decision 4: a client that predates a field cannot erase it.
  it("keeps the answers a write leaves out and clears the empty ones", async () => {
    const repository = createRepository();
    await repository.replaceProfile({ occasions: [], styles: [], ...fullBrief });
    await repository.replaceProfile({
      occasions: ["travel"],
      styles: [],
      palettes: [],
      shopsFor: null,
      fit: {},
    });

    await expect(repository.getProfile()).resolves.toEqual({
      ...fullBrief,
      occasions: ["travel"],
      styles: [],
      palettes: [],
      shopsFor: null,
      fit: {},
      updatedAt: expect.any(String),
    });
  });

  it("reads the drop threshold, 0 until answered", async () => {
    const repository = createRepository();
    expect(repository.getDropThreshold()).toBe(0);

    await repository.replaceProfile({ occasions: [], styles: [], dropThreshold: 30 });
    expect(repository.getDropThreshold()).toBe(30);
  });

  it("upgrades a database made by the August schema and keeps its answers", async () => {
    const directory = mkdtempSync(join(tmpdir(), "wist-style-profile-"));
    temporaryDirectories.push(directory);
    const path = join(directory, "profile.sqlite");
    const august = new DatabaseSync(path);
    august.exec(`
      CREATE TABLE style_profiles (id TEXT PRIMARY KEY, updated_at TEXT NOT NULL);
      CREATE TABLE style_profile_occasions (
        profile_id TEXT NOT NULL REFERENCES style_profiles(id) ON DELETE CASCADE,
        occasion TEXT NOT NULL,
        PRIMARY KEY (profile_id, occasion)
      );
      CREATE TABLE style_profile_styles (
        profile_id TEXT NOT NULL REFERENCES style_profiles(id) ON DELETE CASCADE,
        style TEXT NOT NULL,
        PRIMARY KEY (profile_id, style)
      );
      INSERT INTO style_profiles VALUES ('owner', '2026-08-21T12:00:00.000Z');
      INSERT INTO style_profile_occasions VALUES ('owner', 'work');
      INSERT INTO style_profile_styles VALUES ('owner', 'minimal');
    `);
    august.close();

    const repository = createRepository(path);
    await expect(repository.getProfile()).resolves.toEqual({
      ...emptyStyleDetails(),
      occasions: ["work"],
      styles: ["minimal"],
      updatedAt: "2026-08-21T12:00:00.000Z",
    });
    await repository.replaceProfile({
      occasions: ["work"],
      styles: ["minimal"],
      dropThreshold: 10,
    });
    expect(repository.getDropThreshold()).toBe(10);
  });
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npx vitest run catalogue-service/src/sqliteStyleProfileRepository.test.ts`
Expected: FAIL. `getDropThreshold` is not a function, and profiles come back without the brief fields.

- [ ] **Step 3: Make the read type complete**

In `catalogue-service/src/styleProfile.ts`, replace the `StyleProfile` type with:

```ts
export type StyleProfile = {
  occasions: Occasion[];
  styles: Style[];
} & StyleDetails & {
  updatedAt: string;
};
```

- [ ] **Step 4: Rewrite the repository**

Replace `catalogue-service/src/sqliteStyleProfileRepository.ts` with:

```ts
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

import {
  FIT_ROWS,
  HELP_WITH,
  NEVER_COLOURS,
  OCCASIONS,
  PALETTES,
  SIGNATURE_PIECES,
  SIZE_KINDS,
  STYLES,
  TASTE_AXES,
  WARDROBE_GAPS,
  type FitRow,
  type HelpWith,
  type NeverColour,
  type Occasion,
  type Palette,
  type SignaturePiece,
  type Style,
  type StyleDetails,
  type StyleProfile,
  type StyleProfileSelection,
  type TasteAxis,
  type WardrobeGap,
} from "./styleProfile.js";
import type { StyleProfileRepository } from "./styleProfileRepository.js";

const OWNER_PROFILE_ID = "owner";

// The set answers, one child table each, written delete-then-insert like
// occasions and styles. The CHECK lists come from the constants the parser
// validates against.
const SET_TABLES = {
  helpWith: { table: "style_profile_help", vocabulary: HELP_WITH },
  palettes: { table: "style_profile_palettes", vocabulary: PALETTES },
  neverColours: {
    table: "style_profile_never_colours",
    vocabulary: NEVER_COLOURS,
  },
  signature: { table: "style_profile_signature", vocabulary: SIGNATURE_PIECES },
  gaps: { table: "style_profile_gaps", vocabulary: WARDROBE_GAPS },
} as const;
type SetKey = keyof typeof SET_TABLES;

const TASTE_AXIS_NAMES = Object.keys(TASTE_AXES) as TasteAxis[];
const FIT_ROW_NAMES = Object.keys(FIT_ROWS) as FitRow[];

// The single answers, as columns on style_profiles. They are added at startup
// when missing, the way sqliteWardrobeRepository upgrades garments, so a
// database from the August schema keeps its profile.
const DETAIL_COLUMNS = [
  "shops_for TEXT",
  "work_dress_code TEXT",
  "prints TEXT",
  "drop_threshold INTEGER",
  ...TASTE_AXIS_NAMES.map((axis) => `taste_${axis} TEXT`),
  ...FIT_ROW_NAMES.map((row) => `fit_${row} TEXT`),
  ...SIZE_KINDS.map((kind) => `size_${kind} TEXT`),
];

type ProfileRow = Record<string, string | number | null>;

// Table, column and vocabulary names are constants above, never request
// data, so building SQL from them cannot inject anything.
const sqlList = (values: readonly string[]) =>
  values.map((value) => `'${value}'`).join(", ");

// Per-row answers stored as one column each, e.g. taste_edge. A NULL column is
// an unanswered row and stays out of the map.
function columnAnswers(
  row: ProfileRow,
  prefix: string,
  names: readonly string[],
): Record<string, string> {
  return Object.fromEntries(
    names.flatMap((name) => {
      const value = row[`${prefix}_${name}`];
      return typeof value === "string" ? [[name, value]] : [];
    }),
  );
}

export class SqliteStyleProfileRepository implements StyleProfileRepository {
  private readonly database: DatabaseSync;

  constructor(path: string) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.database = new DatabaseSync(path);
    this.database.exec("PRAGMA foreign_keys = ON");
    this.database.exec("PRAGMA journal_mode = WAL");
    this.database.exec("PRAGMA busy_timeout = 5000");
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS style_profiles (
        id TEXT PRIMARY KEY,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS style_profile_occasions (
        profile_id TEXT NOT NULL REFERENCES style_profiles(id) ON DELETE CASCADE,
        occasion TEXT NOT NULL CHECK (
          occasion IN ('work', 'evening', 'weekend', 'celebration', 'travel')
        ),
        PRIMARY KEY (profile_id, occasion)
      );

      CREATE TABLE IF NOT EXISTS style_profile_styles (
        profile_id TEXT NOT NULL REFERENCES style_profiles(id) ON DELETE CASCADE,
        style TEXT NOT NULL CHECK (
          style IN ('minimal', 'tailored', 'romantic', 'utilitarian', 'bold', 'eclectic')
        ),
        PRIMARY KEY (profile_id, style)
      );
    `);
    for (const { table, vocabulary } of Object.values(SET_TABLES)) {
      this.database.exec(`
        CREATE TABLE IF NOT EXISTS ${table} (
          profile_id TEXT NOT NULL REFERENCES style_profiles(id) ON DELETE CASCADE,
          value TEXT NOT NULL CHECK (value IN (${sqlList(vocabulary)})),
          PRIMARY KEY (profile_id, value)
        )
      `);
    }
    this.migrateDetailColumns();
  }

  private migrateDetailColumns(): void {
    const columns = this.database.prepare("PRAGMA table_info(style_profiles)")
      .all() as unknown as Array<{ name: string }>;
    const names = new Set(columns.map((column) => column.name));
    for (const definition of DETAIL_COLUMNS) {
      const name = definition.slice(0, definition.indexOf(" "));
      if (!names.has(name)) {
        this.database.exec(`ALTER TABLE style_profiles ADD COLUMN ${definition}`);
      }
    }
  }

  async getProfile(): Promise<StyleProfile | null> {
    return this.readProfile();
  }

  /** The owner's drop threshold in whole percent; 0, any new low, until answered. */
  getDropThreshold(): number {
    const row = this.database
      .prepare("SELECT drop_threshold FROM style_profiles WHERE id = ?")
      .get(OWNER_PROFILE_ID) as unknown as
      | { drop_threshold: number | null }
      | undefined;
    return row?.drop_threshold ?? 0;
  }

  async replaceProfile(
    selection: StyleProfileSelection,
  ): Promise<StyleProfile> {
    const updatedAt = new Date().toISOString();
    this.database.exec("BEGIN IMMEDIATE");
    try {
      this.database
        .prepare(`
          INSERT INTO style_profiles (id, updated_at)
          VALUES (?, ?)
          ON CONFLICT (id) DO UPDATE SET updated_at = excluded.updated_at
        `)
        .run(OWNER_PROFILE_ID, updatedAt);
      this.database
        .prepare("DELETE FROM style_profile_occasions WHERE profile_id = ?")
        .run(OWNER_PROFILE_ID);
      this.database
        .prepare("DELETE FROM style_profile_styles WHERE profile_id = ?")
        .run(OWNER_PROFILE_ID);

      const insertOccasion = this.database.prepare(`
        INSERT INTO style_profile_occasions (profile_id, occasion)
        VALUES (?, ?)
      `);
      selection.occasions.forEach((occasion) => {
        insertOccasion.run(OWNER_PROFILE_ID, occasion);
      });

      const insertStyle = this.database.prepare(`
        INSERT INTO style_profile_styles (profile_id, style)
        VALUES (?, ?)
      `);
      selection.styles.forEach((style) => {
        insertStyle.run(OWNER_PROFILE_ID, style);
      });

      this.writeDetails(selection);
      // Read inside the transaction: awaiting here would let another request
      // start its own BEGIN on this connection.
      const profile = this.readProfile()!;
      this.database.exec("COMMIT");
      return profile;
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }

  // Only the answers present in the selection are written: an absent key
  // keeps the stored answer (Decision 4).
  private writeDetails(selection: StyleProfileSelection): void {
    const columns: Record<string, string | number | null> = {};
    if (selection.shopsFor !== undefined) columns.shops_for = selection.shopsFor;
    if (selection.workDressCode !== undefined) {
      columns.work_dress_code = selection.workDressCode;
    }
    if (selection.prints !== undefined) columns.prints = selection.prints;
    if (selection.dropThreshold !== undefined) {
      columns.drop_threshold = selection.dropThreshold;
    }
    const { defaultSizes, fit, tasteAxes } = selection;
    if (tasteAxes) {
      TASTE_AXIS_NAMES.forEach((axis) => {
        columns[`taste_${axis}`] = tasteAxes[axis] ?? null;
      });
    }
    if (fit) {
      FIT_ROW_NAMES.forEach((row) => {
        columns[`fit_${row}`] = fit[row] ?? null;
      });
    }
    if (defaultSizes) {
      SIZE_KINDS.forEach((kind) => {
        columns[`size_${kind}`] = defaultSizes[kind] ?? null;
      });
    }
    const names = Object.keys(columns);
    if (names.length > 0) {
      this.database
        .prepare(
          `UPDATE style_profiles SET ${names.map((name) => `${name} = ?`).join(", ")} WHERE id = ?`,
        )
        .run(...Object.values(columns), OWNER_PROFILE_ID);
    }

    for (const key of Object.keys(SET_TABLES) as SetKey[]) {
      const values = selection[key];
      if (values === undefined) continue;
      const { table } = SET_TABLES[key];
      this.database
        .prepare(`DELETE FROM ${table} WHERE profile_id = ?`)
        .run(OWNER_PROFILE_ID);
      const insert = this.database.prepare(
        `INSERT INTO ${table} (profile_id, value) VALUES (?, ?)`,
      );
      values.forEach((value) => {
        insert.run(OWNER_PROFILE_ID, value);
      });
    }
  }

  private readProfile(): StyleProfile | null {
    const row = this.database
      .prepare("SELECT * FROM style_profiles WHERE id = ?")
      .get(OWNER_PROFILE_ID) as unknown as ProfileRow | undefined;
    if (!row) return null;

    const occasionRows = this.database
      .prepare(
        "SELECT occasion FROM style_profile_occasions WHERE profile_id = ?",
      )
      .all(OWNER_PROFILE_ID) as unknown as Array<{ occasion: Occasion }>;
    const styleRows = this.database
      .prepare("SELECT style FROM style_profile_styles WHERE profile_id = ?")
      .all(OWNER_PROFILE_ID) as unknown as Array<{ style: Style }>;
    const occasions = new Set(occasionRows.map((entry) => entry.occasion));
    const styles = new Set(styleRows.map((entry) => entry.style));

    return {
      occasions: OCCASIONS.filter((occasion) => occasions.has(occasion)),
      styles: STYLES.filter((style) => styles.has(style)),
      shopsFor: row.shops_for as StyleDetails["shopsFor"],
      helpWith: this.readSet("helpWith") as HelpWith[],
      workDressCode: row.work_dress_code as StyleDetails["workDressCode"],
      tasteAxes: columnAnswers(row, "taste", TASTE_AXIS_NAMES) as StyleDetails["tasteAxes"],
      palettes: this.readSet("palettes") as Palette[],
      neverColours: this.readSet("neverColours") as NeverColour[],
      prints: row.prints as StyleDetails["prints"],
      fit: columnAnswers(row, "fit", FIT_ROW_NAMES) as StyleDetails["fit"],
      defaultSizes: columnAnswers(row, "size", SIZE_KINDS),
      signature: this.readSet("signature") as SignaturePiece[],
      gaps: this.readSet("gaps") as WardrobeGap[],
      dropThreshold: row.drop_threshold as StyleDetails["dropThreshold"],
      updatedAt: row.updated_at as string,
    };
  }

  private readSet(key: SetKey): string[] {
    const { table, vocabulary } = SET_TABLES[key];
    const rows = this.database
      .prepare(`SELECT value FROM ${table} WHERE profile_id = ?`)
      .all(OWNER_PROFILE_ID) as unknown as Array<{ value: string }>;
    const stored = new Set(rows.map((entry) => entry.value));
    return (vocabulary as readonly string[]).filter((value) => stored.has(value));
  }

  close(): void {
    this.database.close();
  }
}
```

- [ ] **Step 5: Bring the two fixtures up to the complete type**

In `catalogue-service/src/app.test.ts`, change the import to:

```ts
import {
  emptyStyleDetails,
  type StyleProfile,
  type StyleProfileSelection,
} from "./styleProfile.js";
```

and replace `MemoryStyleProfileRepository.replaceProfile` with the merging version (it mirrors Decision 4):

```ts
  async replaceProfile(selection: StyleProfileSelection) {
    this.profile = {
      ...emptyStyleDetails(),
      ...this.profile,
      ...selection,
      updatedAt: "2026-08-21T12:00:00.000Z",
    };
    return this.profile;
  }
```

In `catalogue-service/src/claudeOutfitSuggester.test.ts`, add `import { emptyStyleDetails } from "./styleProfile.js";` and change line 12 to:

```ts
  profile: { ...emptyStyleDetails(), occasions: ["work"], styles: ["minimal"], updatedAt: "private-timestamp" },
```

- [ ] **Step 6: Run the tests and confirm they pass**

Run: `npx vitest run catalogue-service/src/sqliteStyleProfileRepository.test.ts catalogue-service/src/app.test.ts`
Expected: PASS.

- [ ] **Step 7: Typecheck, full suite, commit**

```bash
npm run typecheck && npm test
git add catalogue-service/src/styleProfile.ts catalogue-service/src/sqliteStyleProfileRepository.ts catalogue-service/src/sqliteStyleProfileRepository.test.ts catalogue-service/src/app.test.ts catalogue-service/src/claudeOutfitSuggester.test.ts
git commit -m "feat(catalogue): store the style brief beside occasions and styles"
```

---

### Task 3: Cover the brief in the profile API

`app.ts` already passes whatever `parseStyleProfile` returns to `replaceProfile`, so the route needs no change. These tests pin that contract.

**Files:**
- Test: `catalogue-service/src/app.test.ts`

- [ ] **Step 1: Write the tests**

Add after the test `"reads and replaces the owner style profile"`:

```ts
  it("keeps brief answers a request leaves out and clears the ones sent as null", async () => {
    const profiles = new MemoryStyleProfileRepository();
    const put = (body: unknown) =>
      handleRequest("PUT", "/v1/profile", repository, auth, {
        profiles,
        body: JSON.stringify(body),
      });
    await put({
      occasions: ["work"],
      styles: [],
      shopsFor: "menswear",
      palettes: ["earth"],
      dropThreshold: 30,
    });

    await expect(
      put({ occasions: ["work"], styles: ["minimal"], palettes: null }),
    ).resolves.toMatchObject({
      status: 200,
      body: {
        profile: {
          styles: ["minimal"],
          shopsFor: "menswear",
          palettes: [],
          dropThreshold: 30,
        },
      },
    });
    await expect(
      handleRequest("GET", "/v1/profile", repository, auth, { profiles }),
    ).resolves.toMatchObject({
      body: { profile: { shopsFor: "menswear", palettes: [], dropThreshold: 30 } },
    });
  });

  it("rejects an invalid brief answer without storing anything", async () => {
    const profiles = new MemoryStyleProfileRepository();
    await expect(
      handleRequest("PUT", "/v1/profile", repository, auth, {
        profiles,
        body: JSON.stringify({ occasions: [], styles: [], dropThreshold: 15 }),
      }),
    ).resolves.toEqual({ status: 400, body: { error: "invalid_profile" } });
    expect(profiles.profile).toBeNull();
  });
```

- [ ] **Step 2: Run them**

Run: `npx vitest run catalogue-service/src/app.test.ts`
Expected: PASS, because Tasks 1 and 2 did the work. If either test fails, the route is dropping the parsed fields. Fix that in `app.ts` before you continue.

- [ ] **Step 3: Commit**

```bash
npm run typecheck && npm test
git add catalogue-service/src/app.test.ts
git commit -m "test(catalogue): cover the style brief in the profile api"
```

---

### Task 4: Stay silent below the owner's drop threshold

**Files:**
- Modify: `catalogue-service/src/sqliteRepository.ts:124-134` (constructor), `:488-499` (alert decision)
- Modify: `catalogue-service/src/server.ts:25-26`, `catalogue-service/src/observeProduct.ts:18,27`
- Test: `catalogue-service/src/sqliteRepository.test.ts`

- [ ] **Step 1: Write the failing test**

Append inside `describe("SQLite catalogue repository", …)`:

```ts
  // A drop under the owner's threshold is silenced like a drop that misses
  // their size: no alert, and the floor stays where it was, so a deeper drop
  // later still reaches them.
  it("stays silent below the owner's drop threshold and speaks at a deeper drop", async () => {
    const repository = new SqliteCatalogueRepository(":memory:", {
      dropThreshold: () => 20,
    });
    repositories.push(repository);
    await repository.recordObservation(brand, itemAt(200, "2026-08-08T12:00:00.000Z"));
    await repository.watchItem("bobbies-L-M24WO-OPE01");

    await expect(
      repository.recordObservation(brand, itemAt(180, "2026-08-09T12:00:00.000Z")),
    ).resolves.toMatchObject({ priceDrop: { pctOff: 10 }, alerted: false });
    await expect(
      repository.recordObservation(brand, itemAt(160, "2026-08-10T12:00:00.000Z")),
    ).resolves.toMatchObject({ priceDrop: { pctOff: 20 }, alerted: true });
    await expect(repository.listPriceDropAlerts()).resolves.toMatchObject([
      { newPrice: 160, pctOff: 20 },
    ]);
  });
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run catalogue-service/src/sqliteRepository.test.ts -t "drop threshold"`
Expected: FAIL. The 180 observation comes back `alerted: true`. (Passing the second argument may also be a type error under `npm run typecheck`.)

- [ ] **Step 3: Implement**

In `catalogue-service/src/sqliteRepository.ts`, above `export class SqliteCatalogueRepository`, add:

```ts
type CatalogueRepositoryOptions = {
  /** The owner's drop threshold in whole percent, read at each observation. */
  dropThreshold?: () => number;
};
```

Change the start of the class to:

```ts
export class SqliteCatalogueRepository
  implements CatalogueObservationRepository
{
  private readonly database: DatabaseSync;
  private readonly dropThreshold: () => number;

  constructor(
    path: string,
    { dropThreshold = () => 0 }: CatalogueRepositoryOptions = {},
  ) {
    this.dropThreshold = dropThreshold;
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
```

(the rest of the constructor is unchanged). In `recordObservation`, replace the comment and the `alerted` expression (currently lines 488–499) with:

```ts
      // A drop is only worth telling the owner about if it reaches a size they
      // asked for and is at least as deep as the threshold they chose. Both
      // rules silence a drop without moving the floor below.
      const watchedSizeRows = this.database
        .prepare("SELECT label FROM catalogue_watch_sizes WHERE item_id = ?")
        .all(item.id) as unknown as Array<{ label: string }>;
      const alerted =
        priceDrop !== null &&
        priceDrop.pctOff >= this.dropThreshold() &&
        reachesWatchedSize({
          variants: item.variants,
          watchedSizes: watchedSizeRows.map((row) => row.label),
        });
```

In `catalogue-service/src/server.ts`, replace lines 25–26 with:

```ts
const profiles = new SqliteStyleProfileRepository(databasePath);
const repository = new SqliteCatalogueRepository(databasePath, {
  dropThreshold: () => profiles.getDropThreshold(),
});
```

In `catalogue-service/src/observeProduct.ts`, add `import { SqliteStyleProfileRepository } from "./sqliteStyleProfileRepository.js";` next to the repository import, then replace line 18 with:

```ts
  const profiles = new SqliteStyleProfileRepository(databasePath);
  const repository = new SqliteCatalogueRepository(databasePath, {
    dropThreshold: () => profiles.getDropThreshold(),
  });
```

and, in its `finally`, close both:

```ts
  } finally {
    repository.close();
    profiles.close();
  }
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npx vitest run catalogue-service/src/sqliteRepository.test.ts`
Expected: PASS, including every existing drop test, because they use the default threshold of 0.

- [ ] **Step 5: Commit**

```bash
npm run typecheck && npm test
git add catalogue-service/src/sqliteRepository.ts catalogue-service/src/sqliteRepository.test.ts catalogue-service/src/server.ts catalogue-service/src/observeProduct.ts
git commit -m "feat(catalogue): stay silent below the owner's drop threshold"
```

---

### Task 5: Send the brief to the outfit engine

**Files:**
- Modify: `catalogue-service/src/claudeOutfitSuggester.ts:19-36`
- Test: `catalogue-service/src/claudeOutfitSuggester.test.ts`

- [ ] **Step 1: Write the failing test**

Append inside `describe("Claude outfit suggester", …)`:

```ts
  it("sends the brief the outfit engine uses and nothing it does not", async () => {
    const { suggester, parse } = stub({ stop_reason: "end_turn", parsed_output: { outfits } });
    await suggester.suggest({
      ...input,
      profile: {
        ...input.profile!,
        workDressCode: "smart",
        neverColours: ["orange"],
        signature: ["blazer"],
        gaps: ["long_coat"],
        defaultSizes: { tops: "S" },
        dropThreshold: 20,
        shopsFor: "womenswear",
      },
    });
    const [request] = parse.mock.calls[0]!;
    const profile = request.messages[0].content[1];
    expect(JSON.parse(profile.text.slice("Owner style profile: ".length))).toEqual({
      occasions: ["work"],
      styles: ["minimal"],
      workDressCode: "smart",
      tasteAxes: {},
      palettes: [],
      neverColours: ["orange"],
      prints: null,
      fit: {},
      signature: ["blazer"],
      helpWith: [],
      gaps: ["long_coat"],
    });
    expect(request.system).toContain("Use the owner's work dress code");
  });
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run catalogue-service/src/claudeOutfitSuggester.test.ts`
Expected: FAIL. Only `occasions` and `styles` are sent.

- [ ] **Step 3: Implement**

In `catalogue-service/src/claudeOutfitSuggester.ts`, add `import type { StyleProfile } from "./styleProfile.js";` with the other imports. In `OUTFIT_SYSTEM_PROMPT`, replace the line

```
Respect the owner's style words and the requested occasion. Do not assume weather or a dress code not provided.
```

with these three lines:

```
Respect the owner's style words, taste, palettes, prints, fit, and the requested occasion. Use the owner's work dress code for work outfits when given; otherwise do not assume one, and never assume weather.
Avoid colours listed in neverColours. Favour garments of the owner's signature kinds where they genuinely fit. Gaps are pieces the owner lacks: never include or invent them. helpWith says what the owner finds hard; let it shape the reason you give.
Taste axes hold one pole of a pair, or both, or neither. Work dress codes: suited means formal tailoring; smart means tailoring without a tie; creative means expressive and unconventional; casual means relaxed; remote means mostly working from home.
```

Above `export class ClaudeOutfitSuggester`, add:

```ts
// The brief's answers that shape an outfit. Sizes, the drop threshold and what
// the owner shops for steer alerts and photographs instead, and the timestamp
// is private, so none of them is sent.
function outfitProfile({
  occasions, styles, workDressCode, tasteAxes, palettes, neverColours, prints, fit, signature, helpWith, gaps,
}: StyleProfile) {
  return { occasions, styles, workDressCode, tasteAxes, palettes, neverColours, prints, fit, signature, helpWith, gaps };
}
```

and replace line 36 with:

```ts
      const profile = input.profile ? outfitProfile(input.profile) : null;
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npx vitest run catalogue-service/src/claudeOutfitSuggester.test.ts`
Expected: PASS. The first test still checks that `private-timestamp` is not sent.

- [ ] **Step 5: Commit**

```bash
npm run typecheck && npm test
git add catalogue-service/src/claudeOutfitSuggester.ts catalogue-service/src/claudeOutfitSuggester.test.ts
git commit -m "feat(catalogue): send the style brief to the outfit engine"
```

---

# Part B — App

### Task 6: Add the brief vocabulary to the app

Types and labels only, so the typecheck is the test.

**Files:**
- Modify: `src/types.ts` (after `export type Style …`, line 90)

- [ ] **Step 1: Add the vocabulary**

Insert after `export type Style = (typeof STYLE_OPTIONS)[number]["id"];`:

```ts
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
```

- [ ] **Step 2: Typecheck, full suite, commit**

```bash
npm run typecheck && npm test
git add src/types.ts
git commit -m "feat(app): add the style brief vocabulary"
```

---

### Task 7: Read and send the brief

**Files:**
- Modify: `src/types.ts:92-96` (`StyleProfile`)
- Modify: `src/services/catalogueClient.ts:181-210` (`toStyleProfile`), `:556-576` (`saveStyleProfile`)
- Modify: `src/styleProfileCommit.test.ts` (fixtures gain `details`)
- Test: `src/services/catalogueClient.test.ts`

- [ ] **Step 1: Write the failing tests**

In `src/services/catalogueClient.test.ts`, add `saveStyleBrief` to the import from `./catalogueClient` and `import { emptyStyleDetails } from "../types";`. In the test `"loads and replaces the owner style profile"`, change both `.resolves.toEqual(profile)` to:

```ts
    ).resolves.toEqual({ ...profile, details: emptyStyleDetails() });
```

Then add after that test:

```ts
  it("reads the style brief and sends only the answers it is given", async () => {
    const profile = {
      occasions: ["work"],
      styles: [],
      updatedAt: "2026-10-31T12:00:00.000Z",
      shopsFor: "menswear",
      helpWith: [],
      workDressCode: "smart",
      tasteAxes: { edge: "soft" },
      palettes: ["earth"],
      neverColours: [],
      prints: null,
      fit: { coats: "long" },
      defaultSizes: { shoes: "43" },
      signature: ["overcoat"],
      gaps: [],
      dropThreshold: 10,
    };
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ profile })));

    await expect(
      saveStyleBrief(
        ["work"],
        [],
        { dropThreshold: 10, palettes: ["earth"] },
        fetchImpl,
        "http://catalogue.test",
        "owner-token",
      ),
    ).resolves.toMatchObject({
      details: {
        shopsFor: "menswear",
        tasteAxes: { edge: "soft" },
        fit: { coats: "long" },
        defaultSizes: { shoes: "43" },
        dropThreshold: 10,
      },
    });
    expect(JSON.parse(fetchImpl.mock.calls[0]![1].body)).toEqual({
      occasions: ["work"],
      styles: [],
      dropThreshold: 10,
      palettes: ["earth"],
    });
  });

  it("rejects a brief answer this app does not know", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        profile: { occasions: [], styles: [], updatedAt: "2026-10-31T12:00:00.000Z", palettes: ["neon"] },
      })),
    );

    await expect(
      loadStyleProfile(fetchImpl, "http://catalogue.test", "owner-token"),
    ).rejects.toThrow("invalid palettes");
  });
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `npx vitest run src/services/catalogueClient.test.ts`
Expected: FAIL, because `saveStyleBrief` is not exported and no `details` is returned.

- [ ] **Step 3: Implement**

In `src/types.ts`, replace `StyleProfile` with:

```ts
export type StyleProfile = {
  occasions: Occasion[];
  styles: Style[];
  details: StyleDetails;
  updatedAt: string;
};
```

In `src/services/catalogueClient.ts`, add these names to the existing import from `../types`: `DROP_THRESHOLD_OPTIONS, FIT_ROW_OPTIONS, GAP_OPTIONS, HELP_WITH_OPTIONS, NEVER_COLOUR_OPTIONS, PALETTE_OPTIONS, PRINT_OPTIONS, SHOPS_FOR_OPTIONS, SIGNATURE_OPTIONS, TASTE_AXIS_OPTIONS, WORK_DRESS_CODE_OPTIONS, type FitRow, type SizeKind, type StyleDetails, type TasteAxis`. Add above `function toStyleProfile`:

```ts
const TASTE_ANSWERS = Object.fromEntries(
  TASTE_AXIS_OPTIONS.map((axis) => [axis.id, [...axis.poles.map((pole) => pole.id), "both", "neither"]]),
) as Record<TasteAxis, readonly string[]>;
const FIT_ANSWERS = Object.fromEntries(
  FIT_ROW_OPTIONS.map((row) => [row.id, row.options.map((option) => option.id)]),
) as Record<FitRow, readonly string[]>;
const SIZE_KINDS: readonly SizeKind[] = ["tops", "bottoms", "shoes"];

// The brief's answers. A catalogue that predates a field leaves it out, which
// reads as unanswered; an id this app does not know fails the profile, as an
// unknown occasion does.
function toStyleDetails(value: Record<string, unknown>): StyleDetails {
  const invalid = (key: string) => new Error(`Catalogue returned an invalid ${key}`);
  const one = <Id extends string | number>(key: string, options: readonly { id: Id }[]): Id | null => {
    const answer = value[key];
    if (answer === undefined || answer === null) return null;
    if (!options.some((option) => option.id === answer)) throw invalid(key);
    return answer as Id;
  };
  const many = <Id extends string>(key: string, options: readonly { id: Id }[]): Id[] => {
    const answer = value[key];
    if (answer === undefined || answer === null) return [];
    if (!Array.isArray(answer) || answer.some((id) => !options.some((option) => option.id === id))) {
      throw invalid(key);
    }
    return options.map((option) => option.id).filter((id) => answer.includes(id));
  };
  const rows = (key: string, allowed: (row: string, answer: unknown) => boolean): Record<string, string> => {
    const answer = value[key];
    if (answer === undefined || answer === null) return {};
    if (!isObject(answer) || Object.entries(answer).some(([row, id]) => !allowed(row, id))) {
      throw invalid(key);
    }
    return answer as Record<string, string>;
  };
  return {
    shopsFor: one("shopsFor", SHOPS_FOR_OPTIONS),
    helpWith: many("helpWith", HELP_WITH_OPTIONS),
    workDressCode: one("workDressCode", WORK_DRESS_CODE_OPTIONS),
    tasteAxes: rows("tasteAxes", (axis, id) =>
      (TASTE_ANSWERS[axis as TasteAxis] ?? []).includes(id as string)) as StyleDetails["tasteAxes"],
    palettes: many("palettes", PALETTE_OPTIONS),
    neverColours: many("neverColours", NEVER_COLOUR_OPTIONS),
    prints: one("prints", PRINT_OPTIONS),
    fit: rows("fit", (row, id) =>
      (FIT_ANSWERS[row as FitRow] ?? []).includes(id as string)) as StyleDetails["fit"],
    defaultSizes: rows("defaultSizes", (kind, label) =>
      SIZE_KINDS.includes(kind as SizeKind) && typeof label === "string"),
    signature: many("signature", SIGNATURE_OPTIONS),
    gaps: many("gaps", GAP_OPTIONS),
    dropThreshold: one("dropThreshold", DROP_THRESHOLD_OPTIONS),
  };
}
```

In `toStyleProfile`, add `details: toStyleDetails(value),` to the returned object, just before `updatedAt`. Replace `saveStyleProfile` with:

```ts
export async function saveStyleBrief(
  occasions: Occasion[],
  styles: Style[],
  details: Partial<StyleDetails>,
  fetchImpl: Fetch = fetch,
  baseUrl = defaultBaseUrl,
  ownerToken = defaultOwnerToken,
): Promise<StyleProfile> {
  const root = baseUrl.replace(/\/$/, "");
  const fetchWithTimeout = withTimeout(fetchImpl, CATALOGUE_TIMEOUT_MS);
  const body = await responseJson(
    await fetchWithTimeout(`${root}/v1/profile`, {
      body: JSON.stringify({ occasions, styles, ...details }),
      headers: {
        ...authorizationHeaders(ownerToken),
        "content-type": "application/json",
      },
      method: "PUT",
    }),
  );
  return toStyleProfile(body.profile);
}

/** Occasions and styles only: the catalogue keeps every brief answer it holds. */
export function saveStyleProfile(
  occasions: Occasion[],
  styles: Style[],
  fetchImpl: Fetch = fetch,
  baseUrl = defaultBaseUrl,
  ownerToken = defaultOwnerToken,
): Promise<StyleProfile> {
  return saveStyleBrief(occasions, styles, {}, fetchImpl, baseUrl, ownerToken);
}
```

In `src/styleProfileCommit.test.ts`, add `import { emptyStyleDetails } from "./types";`. Then add `details: emptyStyleDetails(),` to the two `StyleProfile` literals: `canonical` (line 34) and the one returned by the `save` mock (line 56).

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npx vitest run src/services/catalogueClient.test.ts src/styleProfileCommit.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
npm run typecheck && npm test
git add src/types.ts src/services/catalogueClient.ts src/services/catalogueClient.test.ts src/styleProfileCommit.test.ts
git commit -m "feat(app): read and send the style brief"
```

---

### Task 8: Keep the brief, its draft and chosen follows in the store

**Files:**
- Modify: `src/store/useWistStore.ts` (state type, initial values, actions, `partialize`)
- Test: `src/store/useWistStore.test.ts`

- [ ] **Step 1: Write the failing tests**

Add `import { emptyStyleDetails } from "../types";` to `src/store/useWistStore.test.ts`, and change the store import to `import { newOnboardingDraft, useWistStore } from "./useWistStore";`. Append at the end of the file:

```ts
describe("Wist style brief store", () => {
  beforeEach(() => {
    useWistStore.setState({
      occasions: [],
      styles: [],
      styleDetails: emptyStyleDetails(),
      profileStatus: "unknown",
      profileUnsynced: false,
      onboardingDraft: null,
      followedBrandIds: ["seed-house"],
      followsSeeded: false,
    });
  });

  it("keeps the stored brief and its sync state when only occasions and styles change", () => {
    const details = { ...emptyStyleDetails(), shopsFor: "menswear" as const };
    useWistStore.getState().replaceStyleProfile(["work"], [], details, true);
    useWistStore.getState().replaceStyleProfile(["travel"], ["bold"]);

    expect(useWistStore.getState()).toMatchObject({
      occasions: ["travel"],
      styles: ["bold"],
      styleDetails: details,
      profileStatus: "answered",
      profileUnsynced: true,
    });
  });

  it("follows exactly the houses the reader chose and counts the follows as seeded", () => {
    useWistStore.getState().chooseFollows(["sandro", "bobbies", "sandro"]);

    expect(useWistStore.getState()).toMatchObject({
      followedBrandIds: ["sandro", "bobbies"],
      followsSeeded: true,
    });
  });

  it("starts a draft from what the phone knows, without the sample follows", () => {
    useWistStore.setState({ occasions: ["work"], styles: ["minimal"] });
    useWistStore.getState().startStyleBrief();
    expect(useWistStore.getState().onboardingDraft).toEqual({
      stepIndex: 0,
      answers: {
        occasions: ["work"],
        styles: ["minimal"],
        details: emptyStyleDetails(),
        houseIds: [],
        notificationsAllowed: null,
      },
    });

    useWistStore.getState().clearOnboardingDraft();
    expect(useWistStore.getState().onboardingDraft).toBeNull();
  });

  it("prefills the houses of a reader who already chose them", () => {
    useWistStore.setState({ followedBrandIds: ["sandro"], followsSeeded: true });
    expect(newOnboardingDraft(useWistStore.getState()).answers.houseIds).toEqual(["sandro"]);
  });

  it("persists the brief, its sync state and the draft", () => {
    const draft = newOnboardingDraft(useWistStore.getState());
    useWistStore.getState().saveOnboardingDraft({ ...draft, stepIndex: 3 });
    const persisted = useWistStore.persist.getOptions().partialize?.(useWistStore.getState());

    expect(persisted).toMatchObject({
      styleDetails: emptyStyleDetails(),
      profileUnsynced: false,
      onboardingDraft: { stepIndex: 3 },
    });
  });
});
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `npx vitest run src/store/useWistStore.test.ts`
Expected: FAIL, because `newOnboardingDraft`, `chooseFollows`, `startStyleBrief` and the other new members do not exist.

- [ ] **Step 3: Implement**

In `src/store/useWistStore.ts`:

1. Extend the type import from `../types` with `emptyStyleDetails`, `type OnboardingDraft` and `type StyleDetails`. `emptyStyleDetails` is a value, so put it outside the `import type`. Use `import { emptyStyleDetails, type Alert, … } from "../types";`.
2. In `type WistState`, add after `profileStatus: ProfileStatus;`:

```ts
  styleDetails: StyleDetails;
  /** The style answers on this phone have not reached the catalogue yet. */
  profileUnsynced: boolean;
  /** N° 02 in progress, kept so a killed app resumes where the reader was (Decision 11). */
  onboardingDraft: OnboardingDraft | null;
```

   Then replace `replaceStyleProfile: (occasions: Occasion[], styles: Style[]) => void;` with:

```ts
  /** Without details the stored brief stays; without unsynced the sync state stays. */
  replaceStyleProfile: (occasions: Occasion[], styles: Style[], details?: StyleDetails, unsynced?: boolean) => void;
  saveOnboardingDraft: (draft: OnboardingDraft) => void;
  clearOnboardingDraft: () => void;
  /** Opens N° 02 from Profile, prefilled with the stored answers. */
  startStyleBrief: () => void;
  /** The houses picked on screen 11: they replace the follow list. */
  chooseFollows: (brandIds: string[]) => void;
```

3. Above `export const useWistStore`, add:

```ts
/** A fresh N° 02 draft, prefilled with what this phone already knows. */
export function newOnboardingDraft(
  state: Pick<WistState, "occasions" | "styles" | "styleDetails" | "followedBrandIds" | "followsSeeded">,
): OnboardingDraft {
  return {
    stepIndex: 0,
    answers: {
      occasions: [...state.occasions],
      styles: [...state.styles],
      details: state.styleDetails,
      // Before the one-time follow the list holds sample ids, not a choice.
      houseIds: state.followsSeeded ? [...state.followedBrandIds] : [],
      notificationsAllowed: null,
    },
  };
}
```

4. In the initial state, after `profileStatus: "unknown",` add:

```ts
      styleDetails: emptyStyleDetails(),
      profileUnsynced: false,
      onboardingDraft: null,
```

5. Replace the `replaceStyleProfile` action with:

```ts
      replaceStyleProfile: (occasions, styles, details, unsynced) =>
        set((state) => ({
          occasions: [...occasions],
          styles: [...styles],
          styleDetails: details ?? state.styleDetails,
          profileStatus: "answered",
          profileUnsynced: unsynced ?? state.profileUnsynced,
        })),
      saveOnboardingDraft: (onboardingDraft) => set({ onboardingDraft }),
      clearOnboardingDraft: () => set({ onboardingDraft: null }),
      startStyleBrief: () => set((state) => ({ onboardingDraft: newOnboardingDraft(state) })),
      // The reader's own picks replace the list, and WIST will not follow every
      // house on top of them later.
      chooseFollows: (brandIds) =>
        set({ followedBrandIds: [...new Set(brandIds)], followsSeeded: true }),
```

6. In `partialize`, add `onboardingDraft`, `profileUnsynced` and `styleDetails` to both the destructured parameter list and the returned object, keeping the alphabetical order. No persist version bump is needed: zustand fills keys missing from an older blob with the initial values above.

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npx vitest run src/store/useWistStore.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
npm run typecheck && npm test
git add src/store/useWistStore.ts src/store/useWistStore.test.ts
git commit -m "feat(app): keep the style brief, its draft and chosen follows in the store"
```

---

### Task 9: Carry the brief through commit and launch sync

**Files:**
- Modify: `src/styleProfileCommit.ts` (whole file)
- Modify: `App.tsx:196-210` (the `synchronizeStyleProfile` call)
- Test: `src/styleProfileCommit.test.ts`

- [ ] **Step 1: Write the failing tests and update the sync test's contract**

In `src/styleProfileCommit.test.ts`, change the test `"uploads a cached answer when the backend profile is missing"` so `getLocal` returns the full local shape and the calls carry it:

```ts
    await synchronizeStyleProfile({
      apply,
      getLocal: () => ({
        occasions: ["travel", "work"],
        styles: ["bold", "minimal"],
        details: emptyStyleDetails(),
        unsynced: false,
      }),
      load: async () => null,
      save,
    });

    expect(save).toHaveBeenCalledWith(
      ["travel", "work"],
      ["bold", "minimal"],
      emptyStyleDetails(),
    );
    expect(apply).toHaveBeenCalledWith(
      ["work", "travel"],
      ["minimal", "bold"],
      emptyStyleDetails(),
      false,
    );
```

Then append inside the `describe`:

```ts
  it("marks a committed brief unsynced until the catalogue accepts it", async () => {
    const apply = vi.fn();
    const details = { ...emptyStyleDetails(), palettes: ["earth" as const] };

    await expect(
      commitStyleProfile({
        occasions: ["work"],
        styles: [],
        details,
        apply,
        save: () => Promise.reject(new Error("offline")),
      }),
    ).rejects.toThrow("offline");

    expect(apply).toHaveBeenCalledTimes(1);
    expect(apply).toHaveBeenCalledWith(["work"], [], details, true);
  });

  // Loading first would replace answers the catalogue never saw with its older copy.
  it("re-sends answers the catalogue never accepted instead of loading over them", async () => {
    const details = { ...emptyStyleDetails(), palettes: ["earth" as const] };
    const load = vi.fn();
    const apply = vi.fn();
    const save = vi.fn(async (): Promise<StyleProfile> => ({
      occasions: ["work"],
      styles: [],
      details,
      updatedAt: "2026-10-31T00:00:00.000Z",
    }));

    await synchronizeStyleProfile({
      apply,
      getLocal: () => ({ occasions: ["work"], styles: [], details, unsynced: true }),
      load,
      save,
    });

    expect(load).not.toHaveBeenCalled();
    expect(save).toHaveBeenCalledWith(["work"], [], details);
    expect(apply).toHaveBeenCalledWith(["work"], [], details, false);
  });
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `npx vitest run src/styleProfileCommit.test.ts`
Expected: FAIL, because the details and the flag are not passed.

- [ ] **Step 3: Implement**

Replace `src/styleProfileCommit.ts` with:

```ts
import type { Occasion, Style, StyleDetails, StyleProfile } from "./types";

type LocalStyleProfile = {
  occasions: Occasion[];
  styles: Style[];
  details: StyleDetails;
  /** Answered on this phone but not yet accepted by the catalogue. */
  unsynced: boolean;
};

type SaveStyleProfile = (
  occasions: Occasion[],
  styles: Style[],
  details?: StyleDetails,
) => Promise<StyleProfile>;

type ApplyStyleProfile = (
  occasions: Occasion[],
  styles: Style[],
  details?: StyleDetails,
  unsynced?: boolean,
) => void;

type CommitStyleProfileArgs = {
  occasions: Occasion[];
  styles: Style[];
  details?: StyleDetails;
  save: SaveStyleProfile;
  apply: ApplyStyleProfile;
};

// Optimistic write: store the answers locally first so the user always leaves
// onboarding — even offline — then sync to the catalogue and reconcile with the
// canonical response. A sync failure rejects for the caller to surface, but the
// local answers are already applied, and marked unsynced so the next launch
// sends them, so the user is never trapped in the wizard.
export async function commitStyleProfile({
  occasions,
  styles,
  details,
  save,
  apply,
}: CommitStyleProfileArgs): Promise<void> {
  apply(occasions, styles, details, true);
  const profile = await save(occasions, styles, details);
  apply(profile.occasions, profile.styles, profile.details, false);
}

export async function synchronizeStyleProfile({
  apply,
  getLocal,
  load,
  save,
}: {
  apply: ApplyStyleProfile;
  getLocal: () => LocalStyleProfile | null;
  load: () => Promise<StyleProfile | null>;
  save: SaveStyleProfile;
}): Promise<void> {
  const localProfile = getLocal();
  // Answers the catalogue never accepted are newer than its copy, so they are
  // sent before anything is loaded over them.
  if (!localProfile?.unsynced) {
    const remoteProfile = await load();
    if (remoteProfile) {
      apply(remoteProfile.occasions, remoteProfile.styles, remoteProfile.details, false);
      return;
    }
  }

  if (!localProfile) return;

  const synchronizedProfile = await save(
    localProfile.occasions,
    localProfile.styles,
    localProfile.details,
  );
  apply(
    synchronizedProfile.occasions,
    synchronizedProfile.styles,
    synchronizedProfile.details,
    false,
  );
}
```

In `App.tsx`, replace the `apply`, `getLocal` and `save` arguments of the `synchronizeStyleProfile({ … })` call with:

```tsx
      apply: (occasions, styles, details, unsynced) => {
        if (!cancelled) replaceStyleProfile(occasions, styles, details, unsynced);
      },
      getLocal: () => {
        const state = useWistStore.getState();
        return state.profileStatus === "answered"
          ? {
              occasions: state.occasions,
              styles: state.styles,
              details: state.styleDetails,
              unsynced: state.profileUnsynced,
            }
          : null;
      },
      load: loadStyleProfile,
      save: (occasions, styles, details) => saveStyleBrief(occasions, styles, details ?? {}),
```

and in App.tsx's import from `./src/services/catalogueClient`, add `saveStyleBrief`. Remove `saveStyleProfile` from that import if nothing else in `App.tsx` uses it (`rtk proxy grep -n saveStyleProfile App.tsx`).

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npx vitest run src/styleProfileCommit.test.ts`
Expected: PASS, including the two original commit tests. Their `apply` reads only the first two arguments.

- [ ] **Step 5: Commit**

```bash
npm run typecheck && npm test
git add src/styleProfileCommit.ts src/styleProfileCommit.test.ts App.tsx
git commit -m "feat(app): carry the style brief through commit and launch sync"
```

---

### Task 10: Pre-select default sizes when a piece is coveted

**Files:**
- Create: `src/sizePreselect.ts`
- Test: `src/sizePreselect.test.ts`
- Modify: `App.tsx:399-424` (`toggleLiveCovet`)

- [ ] **Step 1: Write the failing test**

Create `src/sizePreselect.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { preselectedSizes } from "./sizePreselect";

const variants = [
  { id: "1", label: "36", available: true },
  { id: "2", label: "36/38", available: true },
  { id: "3", label: " s ", available: false },
  { id: "4", label: "38", available: true },
];

describe("default size pre-selection", () => {
  it("picks only labels equal to a default after trimming and ignoring case", () => {
    expect(preselectedSizes(variants, { tops: "S", bottoms: "36" })).toEqual(["36", " s "]);
  });

  it("never converts between labels", () => {
    expect(preselectedSizes(variants, { bottoms: "37" })).toEqual([]);
  });

  it("picks nothing without defaults", () => {
    expect(preselectedSizes(variants, {})).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run src/sizePreselect.test.ts`
Expected: FAIL, "Failed to resolve import ./sizePreselect".

- [ ] **Step 3: Implement**

Create `src/sizePreselect.ts`:

```ts
import type { ItemVariant, SizeKind } from "./types";

const normalized = (label: string) => label.trim().toLowerCase();

// Sizes are each storefront's own labels and WIST does not convert between
// brands (decision of 2026-09-13), so a default only picks a label that is the
// same label: "36" never matches "36/38". The shop's own label is returned,
// because the watch API checks labels against the item's variants.
export function preselectedSizes(
  variants: readonly ItemVariant[],
  defaults: Partial<Record<SizeKind, string>>,
): string[] {
  const wanted = new Set(
    Object.values(defaults).flatMap((label) => (label ? [normalized(label)] : [])),
  );
  return [
    ...new Set(
      variants.map((variant) => variant.label).filter((label) => wanted.has(normalized(label))),
    ),
  ];
}
```

- [ ] **Step 4: Run it and confirm it passes**

Run: `npx vitest run src/sizePreselect.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire it into coveting**

In `App.tsx`, add `import { preselectedSizes } from "./src/sizePreselect";`, and add `type SizeKind` to the import from `./src/types`. Replace the whole `toggleLiveCovet` definition, and add `preselectDefaultSizes` above it:

```tsx
  // A fresh covet starts with the reader's default sizes where the shop uses
  // the same labels (spec Decision 5). They show as chosen on the piece, and in
  // onboarding, and can be changed there. A failed save leaves the watch on
  // any size, which can only mean more alerts, so it is logged, not shown.
  const preselectDefaultSizes = async (item: Item, defaultSizes: Partial<Record<SizeKind, string>>) => {
    if ((useWistStore.getState().watchedSizesByItemId[item.id] ?? []).length > 0) return;
    const labels = preselectedSizes(item.variants ?? [], defaultSizes);
    if (labels.length === 0) return;
    setWatchedSizes(item.id, labels);
    try {
      await saveWatchSizes(item.id, labels);
    } catch (error) {
      setWatchedSizes(item.id, []);
      console.warn(
        `Default sizes not saved: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  };

  const toggleLiveCovet = async (
    item: Item,
    {
      askPermission = true,
      defaultSizes,
    }: { askPermission?: boolean; defaultSizes?: Partial<Record<SizeKind, string>> } = {},
  ) => {
    if (syncingWatchIds.includes(item.id)) return;
    const watched = !covetedIds.includes(item.id);
    setStarredItem(item.id, watched, item.currentPrice);
    setSyncingWatchIds((itemIds) => [...itemIds, item.id]);
    try {
      await setCatalogueWatch(item.id, watched);
      if (watched) {
        // Before the refresh below, so the re-read watch list carries the sizes.
        await preselectDefaultSizes(
          item,
          defaultSizes ?? useWistStore.getState().styleDetails.defaultSizes,
        );
        // Onboarding asks about notifications on its own screen (Decision 9).
        if (askPermission) void askForPriceDropPermission();
      }
      // The server is the authority on the watch list: re-read it so a list
      // discarded by this tap's revision bump still arrives.
      void refreshWatches().catch((error: unknown) => {
        console.warn(
          `Watch synchronization unavailable: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      });
    } catch (error) {
      setStarredItem(item.id, !watched, item.currentPrice);
      Alert.alert(
        "Could not update Coveted",
        catalogueWatchErrorMessage(error),
      );
    } finally {
      setSyncingWatchIds((itemIds) =>
        itemIds.filter((itemId) => itemId !== item.id),
      );
    }
  };
```

The existing call sites pass only the item, so they keep today's behaviour.

- [ ] **Step 6: Commit**

```bash
npm run typecheck && npm test
git add src/sizePreselect.ts src/sizePreselect.test.ts
git commit -m "feat(app): match default sizes to a shop's own labels"
git add App.tsx
git commit -m "feat(app): pre-select default sizes when a piece is coveted"
```

---

### Task 11: Write the style brief copy

**Files:**
- Create: `src/onboardingCopy.ts`
- Test: `src/onboardingCopy.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/onboardingCopy.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  alertPriceText, briefHeadline, briefPromises, briefRows, composingLines, hasStyleBrief,
  listJoin, paletteInterlude, revealSummary, workInterlude,
} from "./onboardingCopy";
import { emptyStyleDetails, type OnboardingAnswers } from "./types";

const blank: OnboardingAnswers = {
  occasions: [], styles: [], details: emptyStyleDetails(), houseIds: [], notificationsAllowed: null,
};
const reader: OnboardingAnswers = {
  ...blank,
  occasions: ["work", "weekend"],
  styles: ["minimal", "tailored"],
  details: {
    ...emptyStyleDetails(),
    shopsFor: "womenswear",
    workDressCode: "smart",
    tasteAxes: { structure: "fluid", edge: "soft", contrast: "tonal" },
    palettes: ["ivory_camel", "ink_grey"],
    neverColours: ["orange", "neon"],
    prints: "small_doses",
    fit: { tops: "relaxed", trousers: "wide", lengths: "midi" },
    defaultSizes: { tops: "S", bottoms: "36", shoes: "38" },
    signature: ["blazer", "fine_knits", "loafers"],
    gaps: ["long_coat", "evening_shoes"],
    dropThreshold: 20,
  },
};

describe("onboarding copy", () => {
  it("joins words as a sentence would", () => {
    expect(listJoin([])).toBe("");
    expect(listJoin(["a"])).toBe("a");
    expect(listJoin(["a", "b"])).toBe("a and b");
    expect(listJoin(["a", "b", "c"], "or")).toBe("a, b or c");
  });

  it("answers the work interlude from the dress code, else the week", () => {
    expect(workInterlude(reader)).toEqual({
      kicker: "For work, you said",
      title: "Sharp, quiet, nothing extra.",
      body: 'This is how WIST reads "work" for you. Every answer from here changes what you will see.',
    });
    expect(workInterlude({ ...blank, occasions: ["evening", "weekend"] }).title).toBe(
      "Evenings out and the weekend.",
    );
    expect(workInterlude(blank).title).toBe("Whatever the week asks for.");
  });

  it("names the chosen palettes", () => {
    expect(paletteInterlude(reader).title).toBe("Ivory, camel, ink and grey.");
    expect(paletteInterlude(blank).title).toBe("Colour, your way.");
  });

  it("heads the brief with the style words and the softest taste", () => {
    expect(briefHeadline(reader)).toBe("Minimal, tailored and a little soft.");
    expect(briefHeadline(blank)).toBe("Your style, in your words.");
  });

  it("reads every answer back and leaves out what was skipped", () => {
    expect(briefRows(reader)).toEqual([
      { label: "Your week", value: "Smart for work and the weekend" },
      { label: "Your eye", value: "Fluid, soft, tonal" },
      { label: "Palette", value: "Ivory, camel, ink and grey. Never orange or neon. Prints in small doses" },
      { label: "Fit", value: "Relaxed on top, wide below and midi lengths. S · 36 · 38" },
      { label: "Wardrobe", value: "Built on a blazer, fine knits and loafers. Missing a long coat and evening shoes" },
    ]);
    expect(briefRows(blank)).toEqual([]);
  });

  it("promises what WIST will do with the answers", () => {
    expect(briefPromises(reader, 3)).toEqual([
      "Dress you for work from what you own, starting with your blazer, fine knits and loafers.",
      "Keep a long coat and evening shoes on your list, in your palette and size.",
      "Tell you when your three pieces fall 20% or more, in your size.",
    ]);
    expect(briefPromises({ ...blank, notificationsAllowed: false }, 0)[2]).toBe(
      "Tell you when a piece you covet falls to a new low, in your size. You will find it in Alerts rather than as a banner.",
    );
  });

  it("composes from the houses, sizes and pieces", () => {
    expect(composingLines(reader, ["Sandro", "Claudie Pierlot", "Bobbies"], 3)).toEqual([
      "Reading Sandro, Claudie Pierlot and Bobbies",
      "Keeping what comes in S, 36 and 38, in your palette",
      "Setting a watch on your three pieces",
    ]);
  });

  it("sums up the edit", () => {
    expect(revealSummary(reader)).toBe(
      "Minimal and tailored, in ivory, camel, ink and grey. Relaxed on top, wide below and midi lengths. For work and the weekend, in S, 36 and 38.",
    );
    expect(revealSummary(blank)).toBe("Your edit starts here, and sharpens with every piece you covet.");
  });

  it("prices the alert at the chosen threshold", () => {
    expect(alertPriceText(455, "EUR", 20)).toBe("€ 364");
    expect(alertPriceText(215, "GBP", 0)).toBe("below £ 215");
    expect(alertPriceText(140, "GBP", null)).toBe("below £ 140");
  });

  it("knows whether any brief answer exists", () => {
    expect(hasStyleBrief(emptyStyleDetails())).toBe(false);
    expect(hasStyleBrief({ ...emptyStyleDetails(), dropThreshold: 0 })).toBe(true);
    expect(hasStyleBrief({ ...emptyStyleDetails(), gaps: ["bag"] })).toBe(true);
  });
});
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `npx vitest run src/onboardingCopy.test.ts`
Expected: FAIL, "Failed to resolve import ./onboardingCopy".

- [ ] **Step 3: Implement**

Create `src/onboardingCopy.ts`:

```ts
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
```

- [ ] **Step 4: Run them and confirm they pass**

Run: `npx vitest run src/onboardingCopy.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
npm run typecheck && npm test
git add src/onboardingCopy.ts src/onboardingCopy.test.ts
git commit -m "feat(app): write the style brief copy from the answers"
```

---

### Task 12: Define the steps and the photograph slots

**Files:**
- Create: `src/onboarding/steps.ts`, `src/onboarding/photos.ts`
- Test: `src/onboarding/steps.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/onboarding/steps.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { ONBOARDING_STEPS, QUESTION_COUNT, questionNumber } from "./steps";

describe("N° 02 steps", () => {
  it("asks fourteen questions", () => {
    expect(ONBOARDING_STEPS.filter((step) => step.kind === "question")).toHaveLength(QUESTION_COUNT);
  });

  it("numbers questions and leaves interludes and the finale unnumbered", () => {
    const at = (id: string) => ONBOARDING_STEPS.findIndex((step) => step.id === id);
    expect(questionNumber(at("shopsFor"))).toBe(1);
    expect(questionNumber(at("interludeWork"))).toBeNull();
    expect(questionNumber(at("taste"))).toBe(5);
    expect(questionNumber(at("notify"))).toBe(14);
    expect(questionNumber(at("brief"))).toBeNull();
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run src/onboarding/steps.test.ts`
Expected: FAIL, "Failed to resolve import ./steps".

- [ ] **Step 3: Implement**

Create `src/onboarding/steps.ts`:

```ts
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
  { id: "helpWith", kind: "question", chapter: "Chapter I · Your world", title: "What would make getting dressed easier?", subtitle: "Pick up to two. Dress me starts here." },
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
```

Create `src/onboarding/photos.ts`:

```ts
import type { ImageSourcePropType } from "react-native";

import type { ShopsFor } from "../types";

export type OnboardingPhoto = {
  source: ImageSourcePropType;
  /** House name for the credit tag on the photograph. */
  credit: string;
  /** Plain-language description for screen readers. */
  alt: string;
};

type Audience = "womenswear" | "menswear";

// Licensed photographs, bundled with the app (spec Decisions 1 and 2). The set
// is empty until written permission arrives. Until then every screen shows its
// labels on a plain frame, because nothing ships with stand-in photographs.
//
// Slot keys: shopsFor.<id>, occasion.<id>, dressCode.<id>, interlude.work.<id|any>,
// taste.<axis>.<pole>, style.<id>, interlude.palette, fit.<row>.<answer>,
// gap.<id>, reveal. Each slot holds a womenswear and/or a menswear photograph,
// e.g. "dressCode.smart": { womenswear: { source: require("../../assets/onboarding/w-smart.jpg"), credit: "Sandro", alt: "…" } }.
const PHOTOS: Record<string, Partial<Record<Audience, OnboardingPhoto>>> = {};

/** The photograph for a slot. "Both" alternates womenswear and menswear by position. */
export function onboardingPhoto(key: string, shopsFor: ShopsFor | null, position = 0): OnboardingPhoto | null {
  const slot = PHOTOS[key];
  if (!slot) return null;
  const audience: Audience =
    shopsFor === "menswear" || (shopsFor === "both" && position % 2 === 1) ? "menswear" : "womenswear";
  return slot[audience] ?? slot.womenswear ?? slot.menswear ?? null;
}
```

- [ ] **Step 4: Run it and confirm it passes**

Run: `npx vitest run src/onboarding/steps.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
npm run typecheck && npm test
git add src/onboarding/steps.ts src/onboarding/steps.test.ts src/onboarding/photos.ts
git commit -m "feat(app): define the n° 02 steps and photograph slots"
```

---

### Task 13: Add the onboarding inputs

No component tests exist in this repository. The typecheck and the manual pass in Task 19 cover these.

**Files:**
- Create: `src/onboarding/inputs.tsx`
- Modify: `src/components/OccasionStylePicker.tsx:5-6,10,20` (accept numeric ids)

- [ ] **Step 1: Let the chip picker take numeric ids**

In `src/components/OccasionStylePicker.tsx`, replace each `Value extends string` (in `PickerOption`, `OccasionStylePickerProps` and `OccasionStylePicker`) with `Value extends string | number`. The drop thresholds (0, 10, 20, 30) need this.

- [ ] **Step 2: Create the inputs**

Create `src/onboarding/inputs.tsx`:

```tsx
import { Image, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

import { ActionLink } from "../components/ActionLink";
import { colors, fonts, radii, typography } from "../theme";
import { PALETTE_OPTIONS, TASTE_AXIS_OPTIONS, type ChoiceOption, type Palette, type ShopsFor, type TasteAnswer } from "../types";
import { onboardingPhoto } from "./photos";

/** A licensed photograph, or its label on a plain frame until the photographs arrive. */
export function PhotoFrame({ fallback, photoKey, position = 0, shopsFor, style }: {
  fallback: string;
  photoKey: string;
  position?: number;
  shopsFor: ShopsFor | null;
  style?: StyleProp<ViewStyle>;
}) {
  const photo = onboardingPhoto(photoKey, shopsFor, position);
  return (
    <View style={[inputStyles.frame, style]}>
      {photo ? (
        <>
          <Image accessibilityLabel={photo.alt} resizeMode="cover" source={photo.source} style={StyleSheet.absoluteFill} />
          <Text style={inputStyles.credit}>{photo.credit.toUpperCase()}</Text>
        </>
      ) : (
        <Text accessibilityElementsHidden importantForAccessibility="no" style={inputStyles.fallback}>{fallback}</Text>
      )}
    </View>
  );
}

/** Photo cards in a grid, or rows: one choice when max is 1, else up to max. */
export function PhotoChoice<Id extends string>({
  columns = 2, layout = "grid", max, onChange, options, photoPrefix, selected, shopsFor,
}: {
  columns?: 2 | 3;
  layout?: "grid" | "rows";
  max?: number;
  onChange: (selected: Id[]) => void;
  options: readonly ChoiceOption<Id>[];
  /** Photograph slots are `${photoPrefix}.${id}`; rows without it show text only. */
  photoPrefix?: string;
  selected: Id[];
  shopsFor: ShopsFor | null;
}) {
  const single = max === 1;
  const toggle = (id: Id) => {
    if (single) return onChange([id]);
    onChange(selected.includes(id) ? selected.filter((candidate) => candidate !== id) : [...selected, id]);
  };
  return (
    <View style={layout === "grid" ? inputStyles.grid : inputStyles.rows}>
      {options.map((option, position) => {
        const isSelected = selected.includes(option.id);
        const isDisabled = !single && !isSelected && max !== undefined && selected.length >= max;
        return (
          <Pressable
            accessibilityHint={option.detail}
            accessibilityLabel={option.label}
            accessibilityRole={single ? "radio" : "checkbox"}
            accessibilityState={{ checked: isSelected, disabled: isDisabled }}
            disabled={isDisabled}
            key={option.id}
            onPress={() => toggle(option.id)}
            style={({ pressed }) => [
              layout === "grid" ? [inputStyles.card, { flexBasis: columns === 3 ? "30%" : "47%" }] : inputStyles.row,
              isSelected && inputStyles.selected,
              isDisabled && inputStyles.disabled,
              pressed && inputStyles.pressed,
            ]}
          >
            {photoPrefix ? (
              <PhotoFrame
                fallback={layout === "grid" ? option.label : ""}
                photoKey={`${photoPrefix}.${option.id}`}
                position={position}
                shopsFor={shopsFor}
                style={layout === "grid" ? inputStyles.cardPhoto : inputStyles.rowPhoto}
              />
            ) : null}
            <View style={inputStyles.copy}>
              <Text style={[inputStyles.label, isSelected && inputStyles.labelSelected]}>{option.label}</Text>
              {option.detail ? <Text style={inputStyles.detail}>{option.detail}</Text> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

/** The six palettes as swatch sets, up to max. */
export function SwatchChoice({ max, onChange, selected }: {
  max: number;
  onChange: (selected: Palette[]) => void;
  selected: Palette[];
}) {
  return (
    <View style={inputStyles.grid}>
      {PALETTE_OPTIONS.map((palette) => {
        const isSelected = selected.includes(palette.id);
        const isDisabled = !isSelected && selected.length >= max;
        return (
          <Pressable
            accessibilityLabel={palette.label}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: isSelected, disabled: isDisabled }}
            disabled={isDisabled}
            key={palette.id}
            onPress={() => onChange(isSelected ? selected.filter((id) => id !== palette.id) : [...selected, palette.id])}
            style={({ pressed }) => [inputStyles.swatchCard, isSelected && inputStyles.selected, isDisabled && inputStyles.disabled, pressed && inputStyles.pressed]}
          >
            <View style={inputStyles.swatches}>
              {palette.swatches.map((hex) => <View key={hex} style={[inputStyles.swatch, { backgroundColor: hex }]} />)}
            </View>
            <Text style={[inputStyles.swatchLabel, isSelected && inputStyles.labelSelected]}>{palette.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** One this-or-that round: two photographs, then Both or Neither. Any tap answers. */
export function ThisOrThatRound({ axis, onAnswer, round, shopsFor }: {
  axis: (typeof TASTE_AXIS_OPTIONS)[number];
  onAnswer: (answer: TasteAnswer) => void;
  round: number;
  shopsFor: ShopsFor | null;
}) {
  return (
    <View>
      <View style={inputStyles.pair}>
        {axis.poles.map((pole, position) => (
          <Pressable
            accessibilityHint={pole.detail}
            accessibilityLabel={pole.label}
            accessibilityRole="button"
            key={pole.id}
            onPress={() => onAnswer(pole.id)}
            style={({ pressed }) => [inputStyles.pole, pressed && inputStyles.pressed]}
          >
            <PhotoFrame fallback={pole.label} photoKey={`taste.${axis.id}.${pole.id}`} position={round + position} shopsFor={shopsFor} style={inputStyles.polePhoto} />
            <Text style={inputStyles.label}>{pole.label}</Text>
            {pole.detail ? <Text style={inputStyles.detail}>{pole.detail}</Text> : null}
          </Pressable>
        ))}
      </View>
      <View style={inputStyles.eitherRow}>
        <ActionLink label="Both, equally" onPress={() => onAnswer("both")} />
        <ActionLink color={colors.muted} label="Neither" onPress={() => onAnswer("neither")} />
      </View>
    </View>
  );
}

const inputStyles = StyleSheet.create({
  frame: { alignItems: "center", backgroundColor: colors.wash, borderRadius: radii.card, justifyContent: "center", overflow: "hidden" },
  fallback: { ...typography.titleS, color: colors.muted, paddingHorizontal: 10, textAlign: "center" },
  credit: {
    ...typography.kicker, backgroundColor: "rgba(244,241,235,0.92)", borderRadius: radii.card, bottom: 8, left: 8,
    paddingHorizontal: 7, paddingVertical: 3, position: "absolute",
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  rows: { gap: 8 },
  card: { backgroundColor: colors.card, borderColor: colors.line, borderRadius: radii.card, borderWidth: 1, flexGrow: 1, overflow: "hidden" },
  row: {
    alignItems: "center", backgroundColor: colors.card, borderColor: colors.line, borderRadius: radii.card,
    borderWidth: 1, flexDirection: "row", minHeight: 56, overflow: "hidden",
  },
  cardPhoto: { aspectRatio: 3 / 4, borderRadius: 0 },
  rowPhoto: { borderRadius: 0, height: 72, width: 56 },
  copy: { flex: 1, gap: 2, paddingHorizontal: 12, paddingVertical: 10 },
  selected: { borderColor: colors.wine, borderWidth: 2 },
  disabled: { opacity: 0.35 },
  pressed: { opacity: 0.7 },
  label: { color: colors.ink, fontFamily: fonts.display, fontSize: 18 },
  labelSelected: { color: colors.wine },
  detail: { ...typography.caption },
  swatchCard: { backgroundColor: colors.card, borderColor: colors.line, borderRadius: radii.card, borderWidth: 1, flexBasis: "30%", flexGrow: 1, gap: 8, padding: 10 },
  swatches: { flexDirection: "row", height: 36 },
  swatch: { borderColor: colors.line, borderWidth: StyleSheet.hairlineWidth, flex: 1 },
  swatchLabel: { color: colors.ink, fontFamily: fonts.label, fontSize: 12 },
  pair: { flexDirection: "row", gap: 10 },
  pole: { flex: 1, gap: 4 },
  polePhoto: { aspectRatio: 3 / 4 },
  eitherRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 16 },
});
```

- [ ] **Step 3: Typecheck, full suite, commit**

```bash
npm run typecheck && npm test
git add src/components/OccasionStylePicker.tsx
git commit -m "refactor(app): let the chip picker take numeric ids"
git add src/onboarding/inputs.tsx
git commit -m "feat(app): add the onboarding photo, swatch and this-or-that inputs"
```

---

### Task 14: Draw each answer-only question

**Files:**
- Create: `src/onboarding/StepBody.tsx`

- [ ] **Step 1: Create the component**

Create `src/onboarding/StepBody.tsx`:

```tsx
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
          <Group label="My wardrobe is missing" note="Kept on your list, so outfits and your edit plan around what is missing.">
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
  look: { aspectRatio: 3 / 4, flex: 1 },
  group: { gap: 8 },
  groupLabel: { ...typography.kicker },
  note: { ...typography.caption },
  priceRow: { alignItems: "baseline", borderBottomColor: colors.line, borderBottomWidth: 1, flexDirection: "row", gap: 12, paddingVertical: 8 },
  priceName: { color: colors.ink, flex: 1, fontFamily: fonts.text, fontSize: 16 },
  price: { ...typography.price, color: colors.wine },
});
```

- [ ] **Step 2: Typecheck, full suite, commit**

```bash
npm run typecheck && npm test
git add src/onboarding/StepBody.tsx
git commit -m "feat(app): draw each n° 02 question from its answers"
```

---

### Task 15: Add the houses, covet and notification screens

**Files:**
- Create: `src/onboarding/StoreSteps.tsx`

- [ ] **Step 1: Create the screens**

Create `src/onboarding/StoreSteps.tsx`:

```tsx
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { ActionLink } from "../components/ActionLink";
import { Button } from "../components/Button";
import { Icon } from "../components/Icon";
import { IndexStatus } from "../components/IndexStatus";
import { ProductPhoto } from "../components/ProductPhoto";
import { formatPrice } from "../money";
import { requestPriceDropPermission } from "../services/notifications";
import { useWistStore } from "../store/useWistStore";
import { colors, fonts, radii, typography } from "../theme";
import type { Brand, CatalogueStatus, Item } from "../types";

/** Screen 12 asks for three pieces; more can be coveted after onboarding. */
const COVET_GOAL = 3;
const PHOTOS_PER_HOUSE = 3;
/** Enough of the catalogue to choose from without an endless scroll. */
const MAX_PIECES_SHOWN = 12;

export function HousesStep({ brands, catalogueStatus, items, onChange, onReload, picked }: {
  brands: Brand[];
  catalogueStatus: CatalogueStatus;
  items: Item[];
  onChange: (brandIds: string[]) => void;
  onReload: () => void;
  picked: string[];
}) {
  if (catalogueStatus !== "ready") {
    return <IndexStatus detail="You can skip this and follow houses from Profile." onReload={onReload} status={catalogueStatus} />;
  }
  return (
    <View style={storeStyles.stack}>
      <Text style={storeStyles.count}>Following {picked.length}.</Text>
      {brands.map((brand) => {
        const following = picked.includes(brand.id);
        const photos = items.filter((item) => item.brandId === brand.id).slice(0, PHOTOS_PER_HOUSE);
        return (
          <View key={brand.id} style={storeStyles.house}>
            <View style={storeStyles.houseTop}>
              <Text style={storeStyles.houseName}>{brand.name}</Text>
              <Button
                color={colors.wine} compact label={following ? "Following" : "Follow"}
                onPress={() => onChange(following ? picked.filter((id) => id !== brand.id) : [...picked, brand.id])}
                selected={following} variant={following ? "primary" : "secondary"}
              />
            </View>
            <View style={storeStyles.housePhotos}>
              {photos.map((item) => (
                <ProductPhoto accessibilityLabel={item.name} compact key={item.id} style={storeStyles.housePhoto} uri={item.imageUrl} />
              ))}
            </View>
          </View>
        );
      })}
      <Text style={storeStyles.note}>Any Shopify shop can be added later by pasting a product link in Coveted.</Text>
    </View>
  );
}

export function CovetStep({ brands, catalogueStatus, coveted, houseIds, items, onReload, onToggleCovet, syncingIds }: {
  brands: Brand[];
  catalogueStatus: CatalogueStatus;
  coveted: string[];
  houseIds: string[];
  items: Item[];
  onReload: () => void;
  onToggleCovet: (item: Item) => void;
  syncingIds: string[];
}) {
  const watchedSizes = useWistStore((state) => state.watchedSizesByItemId);
  if (catalogueStatus !== "ready") {
    return <IndexStatus detail="You can skip this and covet pieces once WIST reaches the index." onReload={onReload} status={catalogueStatus} />;
  }
  // A reader who skipped the houses sees the whole catalogue.
  const visible = items
    .filter((item) => houseIds.length === 0 || houseIds.includes(item.brandId))
    .slice(0, MAX_PIECES_SHOWN);
  const chosen = visible.filter((item) => coveted.includes(item.id));
  return (
    <View style={storeStyles.stack}>
      <Text style={storeStyles.count}>{chosen.length} of {COVET_GOAL} chosen.</Text>
      <View style={storeStyles.grid}>
        {visible.map((item) => {
          const isCoveted = coveted.includes(item.id);
          const sizes = watchedSizes[item.id] ?? [];
          const disabled = syncingIds.includes(item.id) || (!isCoveted && chosen.length >= COVET_GOAL);
          const price = formatPrice(item.currentPrice, item.currency);
          return (
            <Pressable
              accessibilityLabel={`${item.name}, ${price}`}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isCoveted, disabled }}
              disabled={disabled}
              key={item.id}
              onPress={() => onToggleCovet(item)}
              style={({ pressed }) => [storeStyles.piece, disabled && !isCoveted && storeStyles.disabled, pressed && storeStyles.pressed]}
            >
              <View>
                <ProductPhoto style={storeStyles.piecePhoto} uri={item.imageUrl} />
                <View style={storeStyles.heart}><Icon color={colors.ink} filled={isCoveted} name="heart" size={20} /></View>
              </View>
              <Text numberOfLines={1} style={storeStyles.pieceBrand}>{brands.find((brand) => brand.id === item.brandId)?.name ?? ""}</Text>
              <Text numberOfLines={2} style={storeStyles.pieceName}>{item.name}</Text>
              {/* Default sizes picked at covet time are shown here, never silent (Decision 5). */}
              <Text style={storeStyles.piecePrice}>{price}{sizes.length > 0 ? ` · size ${sizes.join(", ")}` : ""}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function NotifyStep({ brands, onAnswered, sample }: {
  brands: Brand[];
  onAnswered: (allowed: boolean) => void;
  /** A coveted piece for the sample banner, when there is one. */
  sample: Item | null;
}) {
  const [asking, setAsking] = useState(false);
  const allow = async () => {
    setAsking(true);
    const allowed = await requestPriceDropPermission();
    setAsking(false);
    onAnswered(allowed);
  };
  const house = (sample && brands.find((brand) => brand.id === sample.brandId)?.name) ?? "WIST";
  return (
    <View style={storeStyles.stack}>
      <View accessibilityLabel="An example notification" accessible style={storeStyles.banner}>
        <Text style={storeStyles.bannerTitle}>{house}: a drop in your size</Text>
        <Text style={storeStyles.bannerBody}>
          {sample
            ? `${sample.name} is now below the ${formatPrice(sample.currentPrice, sample.currency)} you coveted it at.`
            : "A piece you coveted is now below the price you wanted it at."}
        </Text>
      </View>
      <Button busy={asking} color={colors.wine} label="Turn on notifications" onPress={() => void allow()} />
      <View style={storeStyles.centered}>
        <ActionLink color={colors.muted} label="Not now" onPress={() => onAnswered(false)} />
      </View>
    </View>
  );
}

const storeStyles = StyleSheet.create({
  stack: { gap: 16 },
  count: { ...typography.caption },
  house: { borderTopColor: colors.line, borderTopWidth: 1, gap: 10, paddingTop: 12 },
  houseTop: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  houseName: { ...typography.titleM },
  housePhotos: { flexDirection: "row", gap: 6 },
  housePhoto: { aspectRatio: 3 / 4, flex: 1 },
  note: { ...typography.caption },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  piece: { flexBasis: "47%", flexGrow: 1, gap: 3 },
  piecePhoto: { aspectRatio: 3 / 4, borderRadius: radii.card },
  heart: { backgroundColor: colors.card, borderRadius: radii.pill, padding: 6, position: "absolute", right: 8, top: 8 },
  pieceBrand: { ...typography.kicker, marginTop: 6 },
  pieceName: { color: colors.ink, fontFamily: fonts.text, fontSize: 15, lineHeight: 19 },
  piecePrice: { ...typography.price, fontSize: 14 },
  disabled: { opacity: 0.35 },
  pressed: { opacity: 0.7 },
  banner: { backgroundColor: colors.card, borderColor: colors.line, borderRadius: 14, borderWidth: 1, gap: 4, padding: 14 },
  bannerTitle: { color: colors.ink, fontFamily: fonts.label, fontSize: 13 },
  bannerBody: { ...typography.caption, color: colors.ink },
  centered: { alignItems: "center" },
});
```

- [ ] **Step 2: Typecheck, full suite, commit**

```bash
npm run typecheck && npm test
git add src/onboarding/StoreSteps.tsx
git commit -m "feat(app): add the houses, covet and notification screens"
```

---

### Task 16: Add the interludes, Composing, the brief and the reveal

**Files:**
- Create: `src/onboarding/Finale.tsx`

- [ ] **Step 1: Create the screens**

Create `src/onboarding/Finale.tsx`:

```tsx
import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { ActionLink } from "../components/ActionLink";
import { Button } from "../components/Button";
import { ProductPhoto } from "../components/ProductPhoto";
import { Wordmark } from "../components/Wordmark";
import { formatPrice } from "../money";
import { briefHeadline, briefPromises, briefRows, revealSummary, type InterludeCopy } from "../onboardingCopy";
import { useWistStore } from "../store/useWistStore";
import { colors, fonts, spacing, typography } from "../theme";
import type { Item, OnboardingAnswers, ShopsFor } from "../types";
import { PhotoFrame } from "./inputs";

/** How long each Composing line waits before the next appears. */
const LINE_INTERVAL_MS = 450;

export function Interlude({ copy, onBack, onContinue, photoKey, shopsFor, swatches }: {
  copy: InterludeCopy;
  onBack: () => void;
  onContinue: () => void;
  photoKey: string;
  shopsFor: ShopsFor | null;
  swatches: string[];
}) {
  return (
    <View style={finaleStyles.screen}>
      <PhotoFrame fallback="" photoKey={photoKey} shopsFor={shopsFor} style={finaleStyles.interludePhoto} />
      <View style={finaleStyles.interludeCopy}>
        <ActionLink label="Back" onPress={onBack} />
        <Text style={finaleStyles.kicker}>{copy.kicker.toUpperCase()}</Text>
        <Text style={finaleStyles.title}>{copy.title}</Text>
        {swatches.length > 0 ? (
          <View style={finaleStyles.swatches}>
            {swatches.map((hex) => <View key={hex} style={[finaleStyles.swatch, { backgroundColor: hex }]} />)}
          </View>
        ) : null}
        <Text style={finaleStyles.body}>{copy.body}</Text>
        <Button color={colors.wine} label="Keep going" onPress={onContinue} />
      </View>
    </View>
  );
}

/** Shows the lines one by one, then opens the brief once the save has settled. */
export function Composing({ lines, onDone, settled }: { lines: string[]; onDone: () => void; settled: boolean }) {
  const [shown, setShown] = useState(1);
  const done = useRef(false);
  const allShown = shown >= lines.length;
  const finish = () => {
    if (done.current || !settled) return;
    done.current = true;
    onDone();
  };

  useEffect(() => {
    if (allShown) return;
    const timer = setTimeout(() => setShown((count) => count + 1), LINE_INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [allShown, shown]);

  useEffect(() => {
    if (allShown && settled) finish();
  }, [allShown, settled]);

  return (
    <Pressable accessibilityHint="Opens your style brief" accessibilityRole="button" onPress={finish} style={finaleStyles.composing}>
      <Wordmark />
      <View style={finaleStyles.composingCopy}>
        <Text style={finaleStyles.kicker}>A MOMENT</Text>
        <Text style={finaleStyles.title}>Composing your edit…</Text>
        {lines.slice(0, shown).map((line) => <Text key={line} style={finaleStyles.line}>{line}</Text>)}
      </View>
      <Text style={finaleStyles.hint}>{settled ? "Opens by itself · tap to skip" : "Saving your answers…"}</Text>
    </Pressable>
  );
}

export function BriefScreen({ answers, coveted, onChangeAnswer, onShowEdit }: {
  answers: OnboardingAnswers;
  coveted: number;
  onChangeAnswer: () => void;
  onShowEdit: () => void;
}) {
  return (
    <ScrollView contentContainerStyle={finaleStyles.content} style={finaleStyles.screen}>
      <View style={finaleStyles.topline}>
        <Wordmark />
        <ActionLink color={colors.muted} label="Change an answer" onPress={onChangeAnswer} />
      </View>
      <Text style={finaleStyles.kicker}>N° 02 · YOUR STYLE BRIEF</Text>
      <Text style={finaleStyles.title}>{briefHeadline(answers)}</Text>
      <View style={finaleStyles.rows}>
        {briefRows(answers).map((row) => (
          <View key={row.label} style={finaleStyles.row}>
            <Text style={finaleStyles.rowLabel}>{row.label.toUpperCase()}</Text>
            <Text style={finaleStyles.rowValue}>{row.value}</Text>
          </View>
        ))}
      </View>
      <Text style={finaleStyles.sectionLabel}>WHAT WIST WILL DO FOR YOU</Text>
      {briefPromises(answers, coveted).map((promise, index) => (
        <View key={promise} style={finaleStyles.promise}>
          <Text style={finaleStyles.promiseNumber}>{String(index + 1).padStart(2, "0")}</Text>
          <Text style={finaleStyles.promiseText}>{promise}</Text>
        </View>
      ))}
      <View style={finaleStyles.footer}><Button label="Show my edit" onPress={onShowEdit} /></View>
    </ScrollView>
  );
}

export function Reveal({ answers, onOpen, pieces }: { answers: OnboardingAnswers; onOpen: () => void; pieces: Item[] }) {
  const watchedSizes = useWistStore((state) => state.watchedSizesByItemId);
  return (
    <ScrollView contentContainerStyle={finaleStyles.content} style={finaleStyles.screen}>
      <PhotoFrame fallback="" photoKey="reveal" shopsFor={answers.details.shopsFor} style={finaleStyles.revealPhoto} />
      <Text style={finaleStyles.kicker}>N° 02 · YOUR EDIT</Text>
      <Text style={finaleStyles.title}>Your edit is ready.</Text>
      <Text style={finaleStyles.body}>{revealSummary(answers)}</Text>
      {pieces.length > 0 ? (
        <>
          <Text style={finaleStyles.sectionLabel}>
            WIST IS WATCHING {pieces.length} {pieces.length === 1 ? "PIECE" : "PIECES"} FOR YOU
          </Text>
          <View style={finaleStyles.pieces}>
            {pieces.map((piece) => {
              const sizes = watchedSizes[piece.id] ?? [];
              return (
                <View key={piece.id} style={finaleStyles.piece}>
                  <ProductPhoto accessibilityLabel={piece.name} compact style={finaleStyles.piecePhoto} uri={piece.imageUrl} />
                  <Text style={finaleStyles.piecePrice}>
                    {formatPrice(piece.currentPrice, piece.currency)}{sizes.length > 0 ? ` · ${sizes.join(", ")}` : ""}
                  </Text>
                </View>
              );
            })}
          </View>
        </>
      ) : null}
      <View style={finaleStyles.footer}><Button color={colors.wine} label="Open your edit" onPress={onOpen} /></View>
    </ScrollView>
  );
}

const finaleStyles = StyleSheet.create({
  screen: { backgroundColor: colors.paper, flex: 1 },
  content: { gap: 12, paddingHorizontal: spacing.gutter, paddingVertical: 18 },
  topline: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", minHeight: 44 },
  kicker: { ...typography.kicker, color: colors.wine, marginTop: 8 },
  title: { ...typography.titleL },
  body: { ...typography.body },
  interludePhoto: { borderRadius: 0, flex: 1 },
  interludeCopy: { gap: 10, padding: spacing.gutter },
  swatches: { flexDirection: "row", gap: 6 },
  swatch: { borderColor: colors.line, borderRadius: 3, borderWidth: StyleSheet.hairlineWidth, height: 28, width: 28 },
  composing: { backgroundColor: colors.paper, flex: 1, justifyContent: "space-between", padding: spacing.gutter },
  composingCopy: { gap: 12 },
  line: { ...typography.body, color: colors.ink },
  hint: { ...typography.kicker, textAlign: "center" },
  rows: { backgroundColor: colors.card, borderColor: colors.line, borderRadius: 3, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 4 },
  row: { borderBottomColor: colors.line, borderBottomWidth: 1, flexDirection: "row", gap: 12, paddingVertical: 8 },
  rowLabel: { ...typography.kicker, flexBasis: 82, paddingTop: 3 },
  rowValue: { color: colors.ink, flex: 1, fontFamily: fonts.text, fontSize: 15, lineHeight: 19 },
  sectionLabel: { ...typography.kicker, marginTop: 8 },
  promise: { flexDirection: "row", gap: 10 },
  promiseNumber: { ...typography.kicker, color: colors.moss, paddingTop: 4 },
  promiseText: { color: colors.ink, flex: 1, fontFamily: fonts.text, fontSize: 16, lineHeight: 20 },
  revealPhoto: { aspectRatio: 4 / 5 },
  pieces: { flexDirection: "row", gap: 8 },
  piece: { flex: 1, gap: 4 },
  piecePhoto: { aspectRatio: 3 / 4 },
  piecePrice: { ...typography.price, fontSize: 14 },
  footer: { marginTop: 16 },
});
```

- [ ] **Step 2: Typecheck, full suite, commit**

```bash
npm run typecheck && npm test
git add src/onboarding/Finale.tsx
git commit -m "feat(app): add the interludes, composing, brief and reveal"
```

---

### Task 17: Replace the two-question onboarding with N° 02

**Files:**
- Create: `src/onboarding/OnboardingFlow.tsx`
- Modify: `src/profileGate.ts` (+ `src/profileGate.test.ts`)
- Modify: `App.tsx` (imports, selectors, seeding effect, gate, flow props)
- Delete: `src/screens/OnboardingScreen.tsx`

- [ ] **Step 1: Write the failing gate test**

Append inside `describe("style profile startup gate", …)` in `src/profileGate.test.ts`:

```ts
  // Composing marks the profile answered before the brief and reveal show.
  it("keeps N° 02 open while a draft exists, even once the profile is answered", () => {
    expect(
      resolveProfileGate({
        fontsLoaded: true,
        fontError: null,
        introSeen: true,
        onboardingInProgress: true,
        profileLookupComplete: true,
        profileStatus: "answered",
        storeHydrated: true,
      }),
    ).toBe("onboarding");
  });
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run src/profileGate.test.ts`
Expected: FAIL, returns `"app"`.

- [ ] **Step 3: Implement the gate**

In `src/profileGate.ts`, add `onboardingInProgress = false,` to the destructured parameters and `/** A stored N° 02 draft: the reader has not reached the end of the flow. */ onboardingInProgress?: boolean;` to the parameter type. Then replace the last line with:

```ts
  if (onboardingInProgress) return "onboarding";
  return profileStatus === "unknown" ? "onboarding" : "app";
```

Run: `npx vitest run src/profileGate.test.ts`. Expected: PASS. The existing tests omit the new argument, which defaults to false.

- [ ] **Step 4: Create the flow**

Create `src/onboarding/OnboardingFlow.tsx`:

```tsx
import { useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";

import { ActionLink } from "../components/ActionLink";
import { Button } from "../components/Button";
import { Wordmark } from "../components/Wordmark";
import { pageStyle, useLayout } from "../layout";
import { composingLines, paletteInterlude, paletteSwatches, workInterlude } from "../onboardingCopy";
import { saveStyleBrief } from "../services/catalogueClient";
import { newOnboardingDraft, useWistStore } from "../store/useWistStore";
import { commitStyleProfile } from "../styleProfileCommit";
import { colors, spacing, typography } from "../theme";
import {
  TASTE_AXIS_OPTIONS,
  type Brand, type CatalogueStatus, type Item, type OnboardingAnswers, type OnboardingDraft, type SizeKind, type TasteAnswer,
} from "../types";
import { BriefScreen, Composing, Interlude, Reveal } from "./Finale";
import { ThisOrThatRound } from "./inputs";
import { StepBody, type AnswerStepId } from "./StepBody";
import { CovetStep, HousesStep, NotifyStep } from "./StoreSteps";
import { ONBOARDING_STEPS, QUESTION_COUNT, questionNumber } from "./steps";

/** The reveal shows the three pieces screen 12 asked for. */
const MAX_REVEALED_PIECES = 3;

type Props = {
  brands: Brand[];
  catalogueStatus: CatalogueStatus;
  /** Item ids the reader covets, from the store. */
  coveted: string[];
  items: Item[];
  onReload: () => void;
  /** Covets or un-covets at once through the watch API, without the covet-time permission prompt. */
  onToggleCovet: (item: Item, defaultSizes: Partial<Record<SizeKind, string>>) => void;
  syncingIds: string[];
};

export function OnboardingFlow({ brands, catalogueStatus, coveted, items, onReload, onToggleCovet, syncingIds }: Props) {
  const saveOnboardingDraft = useWistStore((state) => state.saveOnboardingDraft);
  const clearOnboardingDraft = useWistStore((state) => state.clearOnboardingDraft);
  const chooseFollows = useWistStore((state) => state.chooseFollows);
  const markProfileSkipped = useWistStore((state) => state.markProfileSkipped);
  const replaceStyleProfile = useWistStore((state) => state.replaceStyleProfile);
  const profileStatus = useWistStore((state) => state.profileStatus);
  const [draft, setDraft] = useState<OnboardingDraft>(() => {
    const state = useWistStore.getState();
    return state.onboardingDraft ?? newOnboardingDraft(state);
  });
  const [round, setRound] = useState(0);
  const [saveSettled, setSaveSettled] = useState(false);
  const layout = useLayout();

  const step = ONBOARDING_STEPS[draft.stepIndex] ?? ONBOARDING_STEPS[0]!;
  const { answers } = draft;
  const shopsFor = answers.details.shopsFor;

  // Every change is kept on the phone, so a killed app resumes on this step (Decision 11).
  useEffect(() => {
    saveOnboardingDraft(draft);
  }, [draft, saveOnboardingDraft]);

  // The answers are sent once, when Composing opens: applied on the phone
  // first, then to the catalogue. They are read once per visit; a change after
  // the brief goes back through "Change an answer" and Composing again.
  useEffect(() => {
    if (step.id !== "composing") return;
    let cancelled = false;
    setSaveSettled(false);
    void commitStyleProfile({
      occasions: answers.occasions,
      styles: answers.styles,
      details: answers.details,
      apply: replaceStyleProfile,
      save: (occasions, styles, details) => saveStyleBrief(occasions, styles, details ?? {}),
    })
      .catch(() => {
        Alert.alert(
          "Saved on this phone",
          "Your answers are saved on this phone. WIST will sync them when it can reach the index.",
        );
      })
      .finally(() => {
        if (!cancelled) setSaveSettled(true);
      });
    return () => {
      cancelled = true;
    };
  }, [step.id]);

  const setAnswers = (updated: OnboardingAnswers) => setDraft((current) => ({ ...current, answers: updated }));
  const goTo = (stepIndex: number) => {
    setRound(0);
    setDraft((current) => ({ ...current, stepIndex }));
  };
  const next = () => goTo(Math.min(draft.stepIndex + 1, ONBOARDING_STEPS.length - 1));
  const back = () => goTo(Math.max(draft.stepIndex - 1, 0));

  const tasteAxis = step.id === "taste" ? TASTE_AXIS_OPTIONS[round] : undefined;
  const answerTaste = (answer: TasteAnswer) => {
    if (!tasteAxis) return;
    setAnswers({
      ...answers,
      details: { ...answers.details, tasteAxes: { ...answers.details.tasteAxes, [tasteAxis.id]: answer } },
    });
    if (round + 1 < TASTE_AXIS_OPTIONS.length) setRound(round + 1);
    else next();
  };

  // Houses are written when the reader moves on, so toggling stays on this
  // screen; continuing with none picked is the same as Skip (the one-time
  // follow runs after onboarding instead).
  const continueFromHouses = () => {
    if (answers.houseIds.length > 0) chooseFollows(answers.houseIds);
    next();
  };

  const finish = () => clearOnboardingDraft();
  const skipAll = () => {
    clearOnboardingDraft();
    if (profileStatus === "unknown") markProfileSkipped();
  };

  const covetedPieces = items.filter((item) => coveted.includes(item.id)).slice(0, MAX_REVEALED_PIECES);
  const houseNames = brands.filter((brand) => answers.houseIds.includes(brand.id)).map((brand) => brand.name);

  if (step.kind === "interlude") {
    const work = step.id === "interludeWork";
    return (
      <Interlude
        copy={work ? workInterlude(answers) : paletteInterlude(answers)}
        onBack={back}
        onContinue={next}
        photoKey={work ? `interlude.work.${answers.details.workDressCode ?? "any"}` : "interlude.palette"}
        shopsFor={shopsFor}
        swatches={work ? [] : paletteSwatches(answers)}
      />
    );
  }
  if (step.id === "composing") {
    return <Composing lines={composingLines(answers, houseNames, covetedPieces.length)} onDone={next} settled={saveSettled} />;
  }
  if (step.id === "brief") {
    return <BriefScreen answers={answers} coveted={covetedPieces.length} onChangeAnswer={() => goTo(0)} onShowEdit={next} />;
  }
  if (step.id === "reveal") {
    return <Reveal answers={answers} onOpen={finish} pieces={covetedPieces} />;
  }

  const renderQuestion = () => {
    switch (step.id) {
      case "taste":
        return tasteAxis ? <ThisOrThatRound axis={tasteAxis} onAnswer={answerTaste} round={round} shopsFor={shopsFor} /> : null;
      case "houses":
        return (
          <HousesStep
            brands={brands} catalogueStatus={catalogueStatus} items={items}
            onChange={(houseIds) => setAnswers({ ...answers, houseIds })} onReload={onReload} picked={answers.houseIds}
          />
        );
      case "covet":
        return (
          <CovetStep
            brands={brands} catalogueStatus={catalogueStatus} coveted={coveted} houseIds={answers.houseIds} items={items}
            onReload={onReload} onToggleCovet={(item) => onToggleCovet(item, answers.details.defaultSizes)} syncingIds={syncingIds}
          />
        );
      case "notify":
        return (
          <NotifyStep
            brands={brands}
            onAnswered={(notificationsAllowed) => {
              setAnswers({ ...answers, notificationsAllowed });
              next();
            }}
            sample={covetedPieces[0] ?? null}
          />
        );
      case "threshold":
        return <StepBody answers={answers} onChange={setAnswers} pieces={covetedPieces} step="threshold" />;
      default:
        return <StepBody answers={answers} onChange={setAnswers} step={step.id as AnswerStepId} />;
    }
  };

  const number = questionNumber(draft.stepIndex) ?? 0;
  return (
    <View style={flowStyles.screen}>
      <ScrollView contentContainerStyle={[flowStyles.content, pageStyle(layout, true), layout.wide && flowStyles.contentWide]}>
        <View style={flowStyles.topline}>
          {draft.stepIndex === 0 ? (
            <Wordmark />
          ) : (
            <ActionLink label="Back" onPress={tasteAxis && round > 0 ? () => setRound(round - 1) : back} />
          )}
          <Text accessibilityLabel={`Question ${number} of ${QUESTION_COUNT}`} style={flowStyles.counter}>
            {String(number).padStart(2, "0")} / {QUESTION_COUNT}
          </Text>
          <ActionLink color={colors.muted} label="Skip all" onPress={skipAll} />
        </View>
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={flowStyles.progress}>
          {Array.from({ length: QUESTION_COUNT }, (_, index) => (
            <View key={index} style={[flowStyles.segment, index < number && flowStyles.segmentDone]} />
          ))}
        </View>
        <View style={flowStyles.intro}>
          <Text style={flowStyles.kicker}>
            {(tasteAxis ? `${step.chapter} · Round ${round + 1} of ${TASTE_AXIS_OPTIONS.length}` : step.chapter ?? "").toUpperCase()}
          </Text>
          <Text style={flowStyles.title}>{tasteAxis?.question ?? step.title}</Text>
          {step.subtitle ? <Text style={flowStyles.subtitle}>{step.subtitle}</Text> : null}
        </View>
        <View style={flowStyles.body}>{renderQuestion()}</View>
      </ScrollView>
      <View style={flowStyles.footer}>
        {step.id === "taste" || step.id === "notify" ? null : (
          <View style={flowStyles.continue}>
            <Button color={colors.wine} label="Continue" onPress={step.id === "houses" ? continueFromHouses : next} />
          </View>
        )}
        {step.id === "notify" ? null : <ActionLink color={colors.muted} label="Skip this question" onPress={next} />}
      </View>
    </View>
  );
}

const flowStyles = StyleSheet.create({
  screen: { backgroundColor: colors.paper, flex: 1 },
  content: { paddingHorizontal: spacing.gutter, paddingVertical: 18 },
  // The content carries its own gutter, so on wide it takes the full wide gutter rather than summing with pageStyle.
  contentWide: { paddingHorizontal: spacing.gutterWide },
  topline: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", minHeight: 44 },
  counter: { ...typography.kicker },
  progress: { flexDirection: "row", gap: 3, marginTop: 6 },
  segment: { backgroundColor: colors.line, flex: 1, height: 2 },
  segmentDone: { backgroundColor: colors.wine },
  intro: { gap: 8, marginTop: 24 },
  kicker: { ...typography.kicker, color: colors.wine },
  title: { ...typography.titleL },
  subtitle: { ...typography.body },
  body: { marginTop: 22 },
  footer: { alignItems: "center", gap: 10, paddingHorizontal: spacing.gutter, paddingVertical: 14 },
  continue: { alignSelf: "stretch" },
});
```

- [ ] **Step 5: Wire it into App.tsx**

1. Replace `import { OnboardingScreen } from "./src/screens/OnboardingScreen";` with `import { OnboardingFlow } from "./src/onboarding/OnboardingFlow";`.
2. Next to `const profileStatus = useWistStore((state) => state.profileStatus);` (line 112), add:

```tsx
  const onboardingDraft = useWistStore((state) => state.onboardingDraft);
  // N° 02 is on screen, or will be: the houses step makes the reader's own follow choice.
  const onboardingOpen = profileStatus === "unknown" || onboardingDraft !== null;
```

3. Replace the seeding effect (lines 172–177) with:

```tsx
  // A new install follows the catalogue's houses once. It waits for the stored
  // preferences, which say whether this phone already did, and for N° 02 to
  // end, because its houses step makes the reader's own choice instead.
  useEffect(() => {
    if (!storeSettled || followsSeeded || onboardingOpen || liveCatalogue.brands.length === 0) return;
    seedFollows(liveCatalogue.brands.map((brand) => brand.id));
  }, [followsSeeded, liveCatalogue, onboardingOpen, seedFollows, storeSettled]);
```

4. In the `resolveProfileGate({ … })` call, add `onboardingInProgress: onboardingDraft !== null,`.
5. Move the `askForPriceDropPermission`, `preselectDefaultSizes` and `toggleLiveCovet` definitions so they sit immediately above `const profileGate = resolveProfileGate(`. They are plain functions, not hooks, so the early returns may follow them. The gate branch below needs `toggleLiveCovet`.
6. Replace `<OnboardingScreen />` in the gate branch with:

```tsx
            <OnboardingFlow
              brands={brands}
              catalogueStatus={catalogueStatus}
              coveted={covetedIds}
              items={items}
              onReload={() => void reloadCatalogue()}
              onToggleCovet={(item, defaultSizes) => void toggleLiveCovet(item, { askPermission: false, defaultSizes })}
              syncingIds={syncingWatchIds}
            />
```

- [ ] **Step 6: Delete the old screen**

```bash
git rm src/screens/OnboardingScreen.tsx
rtk proxy grep -rn "OnboardingScreen" App.tsx src
```

Expected: no matches.

- [ ] **Step 7: Typecheck, full suite, commit**

```bash
npm run typecheck && npm test
git add src/profileGate.ts src/profileGate.test.ts
git commit -m "feat(app): keep onboarding open while a draft exists"
git add src/onboarding/OnboardingFlow.tsx App.tsx
git commit -m "feat(app): replace the two-question onboarding with n° 02"
```

(The `git rm` from Step 6 is already staged, so it lands in the second commit.)

---

### Task 18: Edit the style brief from Profile

**Files:**
- Modify: `src/screens/ProfileScreen.tsx`

- [ ] **Step 1: Add the brief rows and editors**

In `src/screens/ProfileScreen.tsx`:

1. Replace the `saveStyleProfile` import with `saveStyleBrief`. Add these imports:

```tsx
import { StepBody, type AnswerStepId } from "../onboarding/StepBody";
import { ONBOARDING_STEPS } from "../onboarding/steps";
import { eyeText, fitText, hasStyleBrief, labelOf, paletteText, sizesText, wardrobeText } from "../onboardingCopy";
```

   Add these to the `../types` import: `DROP_THRESHOLD_OPTIONS, HELP_WITH_OPTIONS, SHOPS_FOR_OPTIONS, WORK_DRESS_CODE_OPTIONS, type OnboardingAnswers, type StyleDetails`.
2. Replace `type Editor = "occasions" | "styles";` with:

```tsx
type BriefStep = Exclude<AnswerStepId, "occasions" | "styles">;
type Editor = "occasions" | "styles" | BriefStep;

// One row per N° 02 question; each opens that question's own input.
const BRIEF_ROWS: ReadonlyArray<{
  step: BriefStep;
  label: string;
  fields: readonly (keyof StyleDetails)[];
  value: (answers: OnboardingAnswers) => string;
}> = [
  { step: "shopsFor", label: "SHOPS FOR", fields: ["shopsFor"],
    value: ({ details }) => (details.shopsFor ? labelOf(SHOPS_FOR_OPTIONS, details.shopsFor) : "") },
  { step: "helpWith", label: "WHAT WOULD HELP", fields: ["helpWith"],
    value: ({ details }) => details.helpWith.map((id) => labelOf(HELP_WITH_OPTIONS, id)).join(", ") },
  { step: "workDressCode", label: "WORK", fields: ["workDressCode"],
    value: ({ details }) => (details.workDressCode ? labelOf(WORK_DRESS_CODE_OPTIONS, details.workDressCode) : "") },
  { step: "taste", label: "YOUR EYE", fields: ["tasteAxes"], value: eyeText },
  { step: "palette", label: "PALETTE", fields: ["palettes", "neverColours", "prints"], value: paletteText },
  { step: "fit", label: "FIT", fields: ["fit"], value: fitText },
  { step: "sizes", label: "SIZES", fields: ["defaultSizes"], value: sizesText },
  { step: "wardrobe", label: "WARDROBE", fields: ["signature", "gaps"], value: wardrobeText },
  { step: "threshold", label: "DROP ALERTS", fields: ["dropThreshold"],
    value: ({ details }) => (details.dropThreshold === null ? "" : labelOf(DROP_THRESHOLD_OPTIONS, details.dropThreshold)) },
];
```

3. In `ProfileScreen`, add store reads and a draft:

```tsx
  const styleDetails = useWistStore((state) => state.styleDetails);
  const profileUnsynced = useWistStore((state) => state.profileUnsynced);
  const startStyleBrief = useWistStore((state) => state.startStyleBrief);
  const [draftDetails, setDraftDetails] = useState<StyleDetails>(styleDetails);
  const briefAnswers: OnboardingAnswers = { occasions, styles, details: styleDetails, houseIds: [], notificationsAllowed: null };
```

4. In `openEditor`, add `setDraftDetails(styleDetails);`. Replace `saveEditor` with:

```tsx
  const saveEditor = async () => {
    setSaving(true);
    try {
      const row = BRIEF_ROWS.find((candidate) => candidate.step === editor);
      const patch = row
        ? (Object.fromEntries(row.fields.map((field) => [field, draftDetails[field]])) as Partial<StyleDetails>)
        : {};
      // Answers this phone never synced travel with the edit so they are not
      // lost; otherwise only the edited answers are sent (Decision 4).
      const profile = await saveStyleBrief(
        draftOccasions,
        draftStyles,
        profileUnsynced ? { ...styleDetails, ...patch } : patch,
      );
      replaceStyleProfile(profile.occasions, profile.styles, profile.details, false);
      setEditor(null);
    } catch {
      Alert.alert(
        "Could not update your profile",
        "Couldn't save your taste. Check your connection and try again.",
      );
    } finally {
      setSaving(false);
    }
  };
```

5. After the `YOUR TASTE` section's closing `</View>`, add:

```tsx
        <View style={[screenStyles.section, { marginTop: 28 }]}>
          <Text style={screenStyles.sectionLabel}>YOUR STYLE BRIEF</Text>
          {hasStyleBrief(styleDetails) ? (
            BRIEF_ROWS.map((row) => (
              <TasteRow key={row.step} label={row.label} onEdit={() => openEditor(row.step)} value={row.value(briefAnswers) || "Not set"} />
            ))
          ) : (
            // Decision 12: readers of the two-question onboarding are invited, not forced.
            <TasteRow action="START" label="COMPLETE YOUR STYLE BRIEF" onEdit={startStyleBrief} value="Fourteen questions, so WIST can dress you better" />
          )}
        </View>
```

6. In the modal, replace the title, the subtitle and the picker switch with:

```tsx
            <Text style={screenStyles.modalTitle}>
              {editor === "occasions" ? "Your occasions" : editor === "styles" ? "Your style"
                : ONBOARDING_STEPS.find((step) => step.id === editor)?.title ?? ""}
            </Text>
            <Text style={screenStyles.modalSubtitle}>
              {editor === "occasions" ? "Choose every setting you dress for."
                : editor === "styles" ? "Choose up to three words."
                  : ONBOARDING_STEPS.find((step) => step.id === editor)?.subtitle ?? ""}
            </Text>
            <View style={screenStyles.modalPicker}>
              {editor === "occasions" ? (
                <OccasionStylePicker onChange={setDraftOccasions} options={OCCASION_OPTIONS} selected={draftOccasions} />
              ) : editor === "styles" ? (
                <OccasionStylePicker maxSelections={3} onChange={setDraftStyles} options={STYLE_OPTIONS} selected={draftStyles} />
              ) : editor ? (
                <StepBody
                  answers={{ ...briefAnswers, details: draftDetails }}
                  onChange={(updated) => setDraftDetails(updated.details)}
                  step={editor}
                />
              ) : null}
            </View>
```

7. Give `TasteRow` an optional action label. Add `action = "EDIT",` to its destructured props, `action?: string;` to its type, and render `{action}` in place of the literal `EDIT`.

- [ ] **Step 2: Typecheck, full suite, commit**

```bash
npm run typecheck && npm test
git add src/screens/ProfileScreen.tsx
git commit -m "feat(app): edit the style brief from profile"
```

---

### Task 19: Verify the whole flow on the simulator

Follow the recipe in the memory file `wist-ui-verification-setup.md`: the simulator MCP tool drives Expo Go, uses the env override and the local catalogue. Tap by coordinates on any screen with covet hearts. Do not tap by label text.

- [ ] **Step 1: Start the catalogue and the app**

```bash
npm run catalogue:start
```

Then start Expo in a second terminal (`npm run ios`). Attach the simulator panel first, then reset the app's stored preferences: delete Expo Go's data for WIST, or reinstall.

- [ ] **Step 2: Womenswear, catalogue reachable**

Go intro → BEGIN → all fourteen questions. Check each of these:
- the counter runs `01 / 14` … `14 / 14` and the bar fills
- the interludes show the work and palette sentences
- the five taste rounds advance on one tap, and Back steps between rounds
- the houses step writes follows only on Continue
- three hearts cap the covet grid, and a coveted piece shows `· size 36` when a label matches
- the threshold step shows each piece's alert price
- "Turn on notifications" shows the iOS prompt
- Composing shows three lines, then the brief and the reveal
- "Open your edit" lands on Home with only the picked houses

Then confirm the server copy:

```bash
curl -s -H "Authorization: Bearer $CATALOGUE_OWNER_TOKEN" http://localhost:8787/v1/profile
```

Expected: the JSON holds `shopsFor`, `tasteAxes`, `palettes`, `dropThreshold` and the rest. Check the port and token against `.env.local`; never print the token in a shared log.

- [ ] **Step 3: Menswear and both**

Reset again and repeat. Check that the fit step shows Coats in place of Skirts and dresses, and that the signature chips change. In both, check that all four fit rows show and the size chips merge.

- [ ] **Step 4: Catalogue stopped**

Stop `catalogue:start` and run a fresh install. Check that:
- screens 11 and 12 show the index-unreachable status with Try again and can be skipped
- Composing shows "Saved on this phone"
- the brief and the reveal still show

Restart the catalogue and relaunch the app. `GET /v1/profile` now holds the answers: the unsynced re-send worked.

- [ ] **Step 5: Resume, skip all, and Profile**

- Kill the app at question 7 and relaunch: it resumes on question 7 with the earlier answers.
- Skip all on a fresh install: the app opens with every house followed (the one-time follow).
- On Profile, the brief rows show, and editing PALETTE saves only those fields. Check with `GET /v1/profile`: the other answers are unchanged.
- On an install that skipped N° 02, Profile shows "Complete your style brief", which opens the flow.

- [ ] **Step 6: Report**

Record what passed and what could not be checked. As before, injected taps don't reach lock-screen notifications, and VoiceOver was not covered. Commit nothing for this task unless a fix was needed.

---

## Not in this plan

- The paywall, purchases, accounts and StoreKit (Decision 13, issue #26).
- Obtaining the image licences, and filling `src/onboarding/photos.ts` once they arrive.
- Product discovery for gaps (#18), taste-based ranking (Decision 10), and analytics (Decision 14).
