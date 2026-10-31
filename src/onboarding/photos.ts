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
