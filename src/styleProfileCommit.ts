import type { Occasion, Style, StyleProfile } from "./types";

type StyleProfileSelection = {
  occasions: Occasion[];
  styles: Style[];
};

type SaveStyleProfile = (
  occasions: Occasion[],
  styles: Style[],
) => Promise<StyleProfile>;

type ApplyStyleProfile = (occasions: Occasion[], styles: Style[]) => void;

type CommitStyleProfileArgs = {
  occasions: Occasion[];
  styles: Style[];
  save: SaveStyleProfile;
  apply: ApplyStyleProfile;
};

// Optimistic write: store the answers locally first so the user always leaves
// onboarding — even offline — then sync to the catalogue and reconcile with the
// canonical response. A sync failure rejects for the caller to surface, but the
// local answers are already applied, so the user is never trapped in the wizard.
export async function commitStyleProfile({
  occasions,
  styles,
  save,
  apply,
}: CommitStyleProfileArgs): Promise<void> {
  apply(occasions, styles);
  const profile = await save(occasions, styles);
  apply(profile.occasions, profile.styles);
}

export async function synchronizeStyleProfile({
  apply,
  getLocal,
  load,
  save,
}: {
  apply: ApplyStyleProfile;
  getLocal: () => StyleProfileSelection | null;
  load: () => Promise<StyleProfile | null>;
  save: SaveStyleProfile;
}): Promise<void> {
  const remoteProfile = await load();
  if (remoteProfile) {
    apply(remoteProfile.occasions, remoteProfile.styles);
    return;
  }

  const localProfile = getLocal();
  if (!localProfile) return;

  const synchronizedProfile = await save(
    localProfile.occasions,
    localProfile.styles,
  );
  apply(synchronizedProfile.occasions, synchronizedProfile.styles);
}
