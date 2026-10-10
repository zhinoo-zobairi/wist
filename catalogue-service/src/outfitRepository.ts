import type { GeneratedOutfit } from "./outfits.js";
import type { RunTrigger } from "./outfitSchedule.js";
import type { Occasion } from "./styleProfile.js";

export const MAX_SUGGESTIONS_PER_OCCASION = 10;

type StoredOutfit = { id: string; occasion: Occasion; reason: string; garmentIds: string[] };
export type SuggestionRecord = StoredOutfit & { createdAt: string };
export type SavedOutfitRecord = StoredOutfit & { savedAt: string };
export type RunStatus = "running" | "succeeded" | "failed" | "skipped";

export type RunSummary = {
  runsThisCapDay: number;
  running: boolean;
  lastAttemptedChangedAt: string | null;
  lastSucceededChangedAt: string | null;
  lastRun: { at: string; status: RunStatus } | null;
};

export interface OutfitRepository {
  /** Stores new suggestions, skipping duplicates, then trims each occasion to the cap. Returns how many were added. */
  storeSuggestions(outfits: GeneratedOutfit[]): Promise<number>;
  /** Deletes suggestions that use any garment outside `existingGarmentIds`. Saved outfits are untouched. */
  deleteSuggestionsWithout(existingGarmentIds: ReadonlySet<string>): Promise<number>;
  listSuggestions(): Promise<SuggestionRecord[]>;
  /** Moves a suggestion into saved outfits; null if it no longer exists. */
  saveSuggestion(id: string): Promise<SavedOutfitRecord | null>;
  listSaved(): Promise<SavedOutfitRecord[]>;
  deleteSaved(id: string): Promise<boolean>;

  startRun(trigger: RunTrigger, inputChangedAt: string | null): Promise<number>;
  finishRun(id: number, status: Exclude<RunStatus, "running">, added: number, error: string | null): Promise<void>;
  /** `capDayStart` bounds `runsThisCapDay`; skipped runs never count (D2). */
  runSummary(capDayStart: Date): Promise<RunSummary>;
  failInterruptedRuns(): Promise<void>;
  /** Deletes runs started before `before`, except the latest successful one. */
  pruneRuns(before: Date): Promise<void>;

  requestMoreIdeas(): Promise<void>;
  moreIdeasRequested(): Promise<boolean>;
  clearMoreIdeasRequest(): Promise<void>;
  catchUpCheckedDay(): Promise<string | null>;
  setCatchUpCheckedDay(day: string): Promise<void>;
}
