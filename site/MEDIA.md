# WIST site media

Every slot already exists in `index.html`. Drop a file in with the exact name below and it appears; no code change is needed. Until then, each slot shows its empty state (a typographic mock of the app screen, or a wash rectangle with a faint WIST mark), and the browser console logs a harmless 404 for the missing file.

Rules for every file:

- Feature clips show real houses' pieces as they appear in WIST. The owner chose this on 2026-11-01 and accepts the copyright risk; the houses have not given permission yet. Never show a house's own website in a clip.
- Price drops in clips must be real: the alert clip uses Gaala's own reduction of the Paola Wool Coat (€560 to €385), not an invented price.
- Editorial photos (`images/`) come from a free-licence library (Unsplash, not Unsplash+), never from a house.
- Keep files local in `media/` and `images/`. Never link to a file on another site.

## Feature clips (`media/`)

Each clip has two files: `<name>.mp4` and `<name>.jpg` (the poster).

| Slot | Files | Where on the page |
| --- | --- | --- |
| discover | `media/discover.mp4`, `media/discover.jpg` | How it works, 01 · Follow |
| covet | `media/covet.mp4`, `media/covet.jpg` | How it works, 02 · Covet |
| alert | `media/alert.mp4`, `media/alert.jpg` | How it works, 03 · The drop |
| wardrobe | `media/wardrobe.mp4`, `media/wardrobe.jpg` | How it works, 04 · Wear it |
| outfits | `media/outfits.mp4`, `media/outfits.jpg` | Dress me |

- Aspect ratio 9:19.5 (portrait phone screen). Export at **720 × 1560 px**. A raw iPhone screen recording (1179 × 2556) is the same shape and can be scaled down.
- MP4, H.264, no audio track, 2 to 3 seconds, a seamless loop, ideally under 1.5 MB.
- The poster is the same size as the clip. Pick a frame that tells the story on its own: visitors who ask for reduced motion see only the poster, never the clip.
- Crop out the iOS status bar if it shows a real time, battery or carrier.

### Storyboards

**discover** (01 · Follow)
- 0.0 to 1.0 s: Discover, one house's pieces on screen.
- 1.0 to 2.0 s: tap FOLLOW; the label turns to FOLLOWING.
- 2.0 to 3.0 s: hold on the house, now followed.

**covet** (02 · Covet)
- 0.0 to 1.0 s: Coveted, a product link pasted into the field.
- 1.0 to 2.0 s: tap ADD TO COVETED.
- 2.0 to 3.0 s: the piece appears in the list, marked COVETED with today's date.

**alert** (03 · The drop)
- 0.0 to 1.0 s: the price-drop notification slides in over the home screen.
- 1.0 to 2.0 s: tap it; the piece opens.
- 2.0 to 3.0 s: hold on the piece at its new price.

**wardrobe** (04 · Wear it)
- 0.0 to 1.0 s: a coveted piece's page, VIEW ON … and I BOUGHT THIS in view.
- 1.0 to 2.0 s: tap I BOUGHT THIS.
- 2.0 to 3.0 s: the garment opens in the wardrobe with its details filled in.

**outfits** (Dress me)
- 0.0 to 1.0 s: Dress me, the weather line and FOR TODAY at the top.
- 1.0 to 2.0 s: tap an occasion, for example WEEKEND.
- 2.0 to 3.0 s: an outfit made of the reader's own pieces.

## Editorial photos (`images/`)

JPEG, sRGB, under 400 KB each. The photos are decorative, so the page hides them from screen readers. If a photo ever carries meaning, replace `aria-hidden="true"` on its plate with `role="img"` and an `aria-label`.

| Slot | File | Aspect ratio | Pixel size | Where on the page |
| --- | --- | --- | --- | --- |
| Hero plate | `images/editorial-1.jpg` | 4:5 | 1200 × 1500 | Hero, behind the price card. Keep the lower left calm: the card sits there. |
| Dress me | `images/editorial-2.jpg` | 3:4 | 900 × 1200 | Beside the outfits clip, on the moss section. |
| Style brief | `images/editorial-3.jpg` | 4:5 | 1200 × 1500 | Next to the four chapters. |
| Contact print | `images/editorial-4.jpg` | 4:5 | 1200 × 1500 | A tilted print with a paper border, on the wine section. |

Photos are shown with `background-size: cover`, so keep the subject away from the edges.
