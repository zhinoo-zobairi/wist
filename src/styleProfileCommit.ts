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
