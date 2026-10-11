import { runDueDailyPick, type DailyPickDeps } from "./dailyPickRun.js";
import { runOutfitGeneration, type GenerationDeps } from "./outfitGeneration.js";
import { capDay, capDayStart, decideRun, type RunTrigger } from "./outfitSchedule.js";

export type SchedulerDeps = GenerationDeps & DailyPickDeps;

export const OUTFIT_TICK_MS = 60_000;
const RUN_LOG_RETENTION_MS = 7 * 24 * 60 * 60_000;

/** Starts at most one run if one is due; returns its trigger. */
export async function runDueOutfitGeneration(deps: GenerationDeps, now: Date): Promise<RunTrigger | null> {
  const summary = await deps.outfits.runSummary(capDayStart(now));
  if (summary.running) return null;
  const { trigger, checkCatchUp } = decideRun({
    lastChangedAt: await deps.wardrobe.lastChangedAt(),
    lastAttemptedChangedAt: summary.lastAttemptedChangedAt,
    lastSucceededChangedAt: summary.lastSucceededChangedAt,
    runsThisCapDay: summary.runsThisCapDay,
    moreIdeasRequested: await deps.outfits.moreIdeasRequested(),
    catchUpCheckedDay: await deps.outfits.catchUpCheckedDay(),
  }, now);
  if (checkCatchUp) await deps.outfits.setCatchUpCheckedDay(capDay(now));
  if (!trigger) return null;
  await deps.outfits.pruneRuns(new Date(now.getTime() - RUN_LOG_RETENTION_MS));
  await runOutfitGeneration(deps, trigger);
  return trigger;
}

export function startOutfitScheduler(deps: SchedulerDeps, tickMs = OUTFIT_TICK_MS): () => void {
  let stopped = false;
  let timer: NodeJS.Timeout | undefined;
  const tick = async () => {
    try {
      const trigger = await runDueOutfitGeneration(deps, new Date());
      if (trigger) console.log(`Outfit run finished (${trigger})`);
    } catch (error) {
      console.error("Outfit scheduler tick failed", { errorClass: error instanceof Error ? error.name : "UnknownError" });
    }
    // Same tick, after generation: a generation error never blocks the morning pick.
    try {
      const outcome = await runDueDailyPick(deps, new Date());
      if (outcome) console.log(`Daily pick finished (${outcome})`);
    } catch (error) {
      console.error("Daily pick tick failed", { errorClass: error instanceof Error ? error.name : "UnknownError" });
    }
    // Ticks are sequential, so at most one Claude call is ever in progress.
    if (!stopped) timer = setTimeout(tick, tickMs);
  };
  void tick();
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}
