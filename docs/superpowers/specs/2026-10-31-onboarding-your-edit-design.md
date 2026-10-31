# Onboarding "N° 02 · Your edit" — Design

**Date:** 2026-10-31
**Status:** Approved by the owner on 2026-10-31. The fourteen questions were approved first ("these fourteen questions are the right set"), then the recommended answer to every decision in the Decisions table ("approve the spec with the recommended answer to every decision").
**Builds on:** [Style profile & occasion onboarding](2026-08-21-style-profile-onboarding-design.md) (slice A), which this extends rather than replaces.
**Storyboard:** private Claude Design canvas "WIST onboarding storyboard" (https://claude.ai/artifact/1cmQZUKhvYuaMnFguRDsg1), 26 screens: the womenswear path in four chapters and a finale, with menswear variants of the photo screens.

## In plain words

Today a new reader sees the four-page intro and then two questions: which occasions they dress for and up to three style words. That is enough to label outfits, but not enough for WIST to dress anyone well, and it does not show what the app can do.

This onboarding asks fourteen questions in four chapters, almost all answered with photographs, swatches or silhouettes. Each answer is used for something the reader can see: what Dress me suggests, how alerts behave, what the edit shows. It ends with a style brief, a read-back of everything the reader said plus what WIST will now do for them, and then the reveal of their edit. The paywall that follows is designed on the storyboard but is not part of this slice: it waits for accounts and the App Store decision (issue #26).

## Problem

1. **The profile is too thin to dress someone.** The outfit engine receives two lists, occasions and style words. It knows nothing about dress code, colours, proportions, the pieces a person relies on or what is missing. Its prompt even tells Claude not to assume a dress code, because none is given.
2. **The onboarding does not sell the product.** Two chip questions say "preferences", not "this app will get you dressed better". The owner wants an onboarding that a reader invests time in because each step visibly shapes their edit.
3. **The visual quiz the August spec deferred is now wanted.** That spec put a pick-A-or-B taste quiz out of scope until a licensed image library exists. Licensing is still the blocker (Decision 1).

## What changes

| Before | After |
|---|---|
| Intro, then 2 questions (occasions, style words) | Intro, then 14 questions in 4 chapters, 2 interludes, a style brief and the reveal |
| Answers as text chips | Answers as photographs, this-or-that pairs, colour swatches, silhouettes and chips |
| Profile: occasions, styles | Profile adds what the reader shops for, what would help, work dress code, five taste axes, palettes, never-colours, prints, fit, default sizes, signature pieces, wardrobe gaps and a drop threshold |
| All live houses followed automatically on a new install | The reader picks the houses to follow |
| First covet and notification permission happen after onboarding | The reader covets three pieces and is asked about notifications inside onboarding |
| Every drop that is a new low alerts | A drop alerts only past the reader's threshold (any, 10, 20 or 30 %) |
| No read-back | A style brief: every answer, then what WIST will do with it |

**Ownership change.** The catalogue service already owns the style profile (August spec). It keeps owning it; the profile grows from two fields to fourteen. The service also becomes responsible for one new policy: applying the reader's drop threshold when it decides whether a drop becomes an alert. The app owns the onboarding flow, its photographs, the draft while it is being answered, and the follow list (which already lives on the phone). No new service, background job, polling or external dependency is introduced.

## The flow

The four-page intro stays as N° 01. N° 02 starts after BEGIN. Every question has a Skip; the header keeps "Skip all", which behaves like today's skip.

| # | Chapter | Screen | Input | Stored as |
|---|---|---|---|---|
| 1 | I · Your world | What do you shop for? | 3 photo cards, one choice | `shopsFor` |
| 2 | I | What would make getting dressed easier? | 6 rows, up to 2 | `helpWith` |
| 3 | I | Where does your wardrobe take you? | 5 chips; two looks above react to the choice | `occasions` (exists) |
| 4 | I | What does work ask of you? | 5 photo rows, one choice | `workDressCode` |
| — | I | Interlude: "For work, you said." | Full-screen look chosen from answers 1, 3, 4 | nothing |
| 5 | II · Your eye | This or that, 5 rounds | Two photos per round, or Both, or Neither | `tasteAxes` |
| 6 | II | Which would you wear? | 6 looks, up to 3, each labelled with a style word | `styles` (exists) |
| 7 | II | Which palette feels like you? | 6 swatch sets up to 2; never-colours; prints | `palettes`, `neverColours`, `prints` |
| — | II | Interlude: "Camel, ivory and ink." | Full-screen look and the chosen swatches | nothing |
| 8 | III · Your fit | How do you like clothes to sit? | 3 rows of 3 photos, one choice per row | `fit` |
| 9 | III | What sizes do you wear? | Tops, trousers and skirts, shoes | `defaultSizes` |
| 10 | III | What do you reach for, and what is missing? | Chips; photo cards | `signature`, `gaps` |
| 11 | IV · What you want | Which houses do you love? | Houses with three photos each, follow toggles | follow list (app) |
| 12 | IV | Pick three pieces you would buy at the right price | Catalogue grid from followed houses, 3 hearts | watches (exist) |
| 13 | IV | When is a drop worth telling you? | 4 choices; shows each piece's alert price | `dropThreshold` |
| 14 | IV | When it drops, you know first. | Sample banner, then the iOS prompt | notification permission |
| — | Finale | Composing your edit… | Progress lines from the answers | nothing |
| — | Finale | Your style brief | Read-back of all answers and three promises | nothing |
| — | Finale | Your edit is ready | Look, summary line, the three watched pieces | nothing |
| — | Finale | Keep WIST watching (paywall) | Designed only; not built in this slice | — |

Menswear swaps the photographs on screens 1, 3, 4, both interludes, 5, 6, 8 and the reveal. Screen 8 asks about coat length instead of skirt length. "Both" alternates womenswear and menswear photographs.

## Vocabulary (permanent ids; labels may change)

Ids are stored; renaming one later needs a data migration, as in the August spec.

| Field | Shape | Ids |
|---|---|---|
| `shopsFor` | one | `womenswear` · `menswear` · `both` |
| `helpWith` | up to 2 | `use_what_i_own` · `fewer_better` · `what_goes_together` · `weather` · `rare_occasions` · `find_my_style` |
| `workDressCode` | one | `suited` · `smart` · `creative` · `casual` · `remote` |
| `tasteAxes` | one value per axis | `structure`: `structured` · `fluid`; `edge`: `sharp` · `soft`; `contrast`: `tonal` · `contrast`; `era`: `classic` · `current`; `finish`: `polished` · `lived_in`. Every axis also accepts `both` and `neither`; a skipped axis is absent |
| `palettes` | up to 2 | `ivory_camel` · `ink_grey` · `earth` · `jewel` · `brights` · `pastels` |
| `neverColours` | any | `orange` · `neon` · `yellow` · `pink` · `all_black` |
| `prints` | one | `plain` · `small_doses` · `lots` |
| `fit` | one value per row | `tops`: `fitted` · `relaxed` · `oversized`; `trousers`: `slim` · `straight` · `wide`; `lengths`: `mini` · `midi` · `maxi`; `coats`: `cropped` · `hip` · `long` |
| `defaultSizes` | one label per kind | `tops`, `bottoms`, `shoes`: free text, 1 to 12 characters, trimmed |
| `signature` | any | `blazer` · `fine_knits` · `white_shirt` · `straight_jeans` · `trench` · `loafers` · `ankle_boots` · `slip_skirt` · `overcoat` · `chinos` |
| `gaps` | any | `long_coat` · `evening_shoes` · `bag` · `tailored_trousers` |
| `dropThreshold` | one | `0` (any new low) · `10` · `20` · `30`, as a whole percentage |

`occasions` and `styles` keep their August vocabulary. The womenswear and menswear screens show different subsets of `signature`; the stored ids are shared.

## Where each answer is used

| Answer | Used by | Exists today? | Change |
|---|---|---|---|
| `occasions`, `styles` | Outfit generation | Yes | None |
| `workDressCode`, `tasteAxes`, `palettes`, `neverColours`, `prints`, `fit`, `signature`, `helpWith`, `gaps` | Outfit generation | No | Added to the profile text the outfit engine already sends to Claude. The prompt line "Do not assume … a dress code not provided" becomes "use the dress code when given". Same single call per run, slightly longer input |
| `defaultSizes` | Coveting a piece | No | When a piece is coveted, any of its size labels that equals a default (trimmed, ignoring case) is pre-selected and shown. Decision 5 |
| `dropThreshold` | Price-drop rule in the catalogue service | No | A drop also needs `pctOff >= dropThreshold`. Decision 6 |
| Houses (screen 11) | Home, Discover | Yes, as the follow list | Onboarding writes it and marks follows as seeded. Decision 8 |
| Three pieces (screen 12) | Watches and alerts | Yes | Covets go through the existing watch API at the moment they are tapped, so the price baseline starts then |
| Notification answer (screen 14) | Price-drop banners | Yes | The permission is asked here. Decision 9 |
| `gaps` | Style brief, Profile "Looking for" list | No | Shown and kept; no automatic watching. Decision 7 |
| Everything | Style brief, Profile read-back | Partly (two rows) | Profile gains rows for the new fields with the same edit pattern |

Not changed in this slice: the daily weather pick, Home and Discover ordering (Decision 10), the wardrobe.

## Design

### Catalogue service

- `styleProfile.ts`: the new fields join `StyleProfileSelection`, each optional. `parseStyleProfile` validates every id against its list, the caps (2 for `helpWith` and `palettes`), uniqueness, the size label length and the threshold values. An unknown id, a duplicate or an over-cap list returns `400 invalid_profile`, as today.
- Storage: Decision 3. The recommended shape follows the existing profile pattern. Sets go into child tables keyed by `profile_id` (`style_profile_help`, `style_profile_palettes`, `style_profile_never_colours`, `style_profile_signature`, `style_profile_gaps`), written delete-then-insert in the same transaction. Single values become columns on `style_profiles` (`shops_for`, `work_dress_code`, `prints`, `drop_threshold`, the five `taste_*` axes, the four `fit_*` rows, the three `size_*` labels). Columns are added at startup with `ALTER TABLE … ADD COLUMN` when missing, the way `sqliteWardrobeRepository.ts` upgrades garments, so an existing database keeps its profile.
- API: `GET /v1/profile` returns the new fields, `null` when never set. `PUT /v1/profile` keeps `occasions` and `styles` required. For each new field, an absent key leaves the stored value as it is, and `null` clears it (Decision 4). This is the convention `PUT /v1/watches/:itemId` already uses for sizes, and it means an older client cannot wipe answers it does not know about.
- Outfit generation: `ClaudeOutfitSuggester` already sends `Owner style profile: …`. It now sends the new fields too, and the system prompt allows using a dress code when given. The validation of generated outfits is unchanged.
- Price-drop rule: `detectCovetedPriceDrop` gains the owner's threshold. A drop below it is not announced and does not move `lowestAnnouncedPrice`, so a deeper drop later still alerts. That is the same behaviour the size rule already has for suppressed drops.

### App

- `OnboardingScreen` becomes a short list of steps, each rendered by one small screen component per input kind. The kinds are photo choice, row choice, chips, this-or-that round, swatches, silhouettes, sizes, houses, covet grid, threshold, notification and interlude. Steps that differ by `shopsFor` read their photographs from one table keyed by step and `shopsFor`.
- The answers live in screen state while the reader goes through the flow (Decision 11 covers resuming after the app is killed). Screens 11 and 12 act immediately: follows are written and covets call the existing watch API. Everything else is sent once, on the Composing screen, through the existing `commitStyleProfile` path: applied locally first, then `PUT`, and "Saved on this phone" if the `PUT` fails. The existing launch synchronization re-sends it later.
- Interludes and the style brief are pure functions of the answers (`src/onboardingCopy.ts`), so their sentences are unit-tested rather than screen-tested.
- Profile shows the style brief as rows, each editable with the same modal pattern as Occasions and Style today. A reader who answered the old two questions gets a "Complete your style brief" row (Decision 12).
- Photographs come from a fixed, credited set (Decisions 1 and 2), not from the live catalogue, except screens 11 and 12, which show catalogue products.

### Error handling

- **Catalogue unreachable at screens 11 or 12:** the screen says the index cannot be reached, offers Try again, and can be skipped. The rest of the flow works offline, and the final `PUT` follows the existing saved-on-this-phone path.
- **A covet that fails at screen 12:** the heart reverts, the existing "Could not update Coveted" message shows, and the reader can continue with fewer than three.
- **Notification permission denied:** the flow continues, and the style brief's third promise says alerts will show in Alerts but not as banners.

## Decisions

All fourteen approved on 2026-10-31 as recommended; the Recommendation column is the decision.

| # | Question | Options | Recommendation |
|---|---|---|---|
| 1 | Where do the photographs come from? | (a) Written permission from Sandro, Claudie Pierlot and Bobbies for named images. (b) Creatives an affiliate network licenses for promotion. (c) A commissioned shoot or a licensed stock set | (a) for the launch set, because the storyboard already uses their looks, with (b) as the fallback. Nothing ships with today's stand-ins |
| 2 | Bundled in the app or served? | (a) Bundled assets, about 20 to 25 images at 720 px, roughly 3 MB. (b) Served by the catalogue service | (a): onboarding runs first and should not depend on the network. A new set means a new app build |
| 3 | How are the new fields stored? | (a) Child tables for sets and columns for single values, upgraded in place (the existing pattern). (b) One JSON column validated on write | (a), for consistency with the August spec and the wardrobe upgrade path |
| 4 | What does `PUT` do with a missing new field? | (a) Absent key keeps the stored value, `null` clears it. (b) Full replace, as `occasions` and `styles` do | (a), the sizes convention, so the phone and the AtomMan web app cannot erase each other's answers |
| 5 | How are default sizes used, given there is no cross-brand size normalization? | (a) Pre-select only labels that equal a default (trimmed, ignoring case), shown when coveting, never silent. (b) Store them for the brief only | (a). It keeps the decision of 2026-09-13 (sizes are the storefront's own labels) and simply saves taps when labels match |
| 6 | Where does the drop threshold live? | (a) One value on the profile, read by the drop rule. (b) Per watch | (a) now, per-watch override later if wanted. This changes which drops become alerts |
| 7 | What happens with wardrobe gaps? | (a) Shown in the brief and on Profile, and sent to the outfit engine. (b) Also watch the houses for those categories | (a). (b) needs product discovery (issue #18), which is gated. The brief's second promise is worded "keep a long coat on your list", not "look for one" |
| 8 | Does screen 11 replace the automatic follow? | (a) Yes: onboarding writes the follows and sets `followsSeeded`; a reader who skips gets today's one-time follow. (b) Keep the automatic follow and use screen 11 only to unfollow | (a) |
| 9 | When is notification permission asked? | (a) On screen 14 during onboarding, with the covet-time pre-prompt suppressed while onboarding runs. (b) Keep the first-covet rule from 2026-10-25 | (a) inside onboarding. The first-covet rule stays for readers who skipped |
| 10 | Should taste reorder Home and Discover? | (a) Not in this slice. (b) Tag catalogue items with colours and categories so they can be ranked, a paid model call per item | (a). Ranking needs item attributes the catalogue does not have |
| 11 | If the app is killed mid-onboarding? | (a) Resume where the reader left off, keeping the draft in local storage (one new stored key). (b) Start N° 02 again | (a), because fourteen questions is too much to repeat |
| 12 | Do people who already answered the old questions see N° 02? | (a) Not forced; a "Complete your style brief" row on Profile. (b) Shown once on next launch | (a) |
| 13 | Paywall and free tier | Separate spec after the App Store decision (issue #26): accounts, StoreKit, price, trial, what stays free | Ship the onboarding first, ending at the reveal; add the paywall when #26 is decided |
| 14 | How do we learn where people drop off? | (a) No measurement while WIST has one user. (b) Add analytics | (a) for now. This needs revisiting before a public release |

## Testing

- `styleProfile.test.ts`: every new field accepts its ids, rejects unknown ids, duplicates and over-cap lists, and size label length, with an empty profile still valid.
- `sqliteStyleProfileRepository.test.ts`: round-trip of every field; an absent key keeps a stored value and `null` clears it; a database created by the August schema opens, upgrades and keeps its occasions and styles.
- `app.test.ts`: `GET` and `PUT` with the new fields, `400` for invalid ones.
- `covetedPriceDrop.test.ts`: a drop below the threshold is not announced and does not move the lowest announced price; a later deeper drop is announced.
- `claudeOutfitSuggester.test.ts`: the profile text includes the new fields (stubbed transport, no real calls).
- App: `onboardingCopy.test.ts` for the interlude and brief sentences, a store test for the draft and resume, and the size pre-selection helper (matches only labels equal to a default after trimming and ignoring case; "36" never matches "36/38").
- Manual: the whole flow on the simulator in womenswear, menswear and both, with the catalogue reachable and stopped.
- `npm run typecheck && npm test` after every commit.

## Out of scope

The paywall, purchases, accounts and StoreKit (issue #26). Product discovery and watching categories (issue #18). Tagging catalogue items and taste-based ranking. Analytics. Obtaining the image licences themselves. A wide-window layout for the onboarding: it must render on the web app, but in the phone column.
