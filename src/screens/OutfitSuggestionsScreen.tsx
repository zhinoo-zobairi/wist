import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { GarmentPhoto } from "../components/GarmentPhoto";
import { OccasionStylePicker } from "../components/OccasionStylePicker";
import { orderForToday } from "../outfitOrder";
import {
  loadOutfits, removeSavedOutfit, requestMoreIdeas, saveLocation, saveOutfitIdea, type MoreIdeasResult,
} from "../services/catalogueClient";
import { currentCoarseLocation } from "../services/location";
import { useWistStore } from "../store/useWistStore";
import { colors, fonts } from "../theme";
import { OCCASION_OPTIONS, type Garment, type Occasion, type OutfitBoard } from "../types";
import { weatherLine } from "../weatherMessages";

// D5: re-read stored outfits while a run is pending or running. GET is free; no Claude call.
const REFRESH_MS = 15_000;

const MORE_IDEAS_COPY: Record<MoreIdeasResult, string> = {
  queued: "New ideas are on their way. You can leave this screen.",
  daily_limit_reached: "You've reached today's limit of new ideas.",
  wardrobe_too_small: "Add at least 3 tagged pieces to get outfit ideas.",
  unavailable: "Couldn't ask for new ideas right now.",
};

type BoardState = { status: "loading" } | { status: "ready"; board: OutfitBoard } | { status: "error" };

function OutfitCard({ label, garments, reason, forToday, missing, action, onEdit, disabled }: {
  label: string; garments: Garment[]; reason: string; forToday: string | undefined; missing: number;
  action: { text: string; accessibilityLabel: string; onPress: () => void }; onEdit: (garment: Garment) => void; disabled: boolean;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardLabel}>{label}</Text>
      {forToday && <View style={styles.forToday}>
        <Text style={styles.forTodayLabel}>FOR TODAY</Text>
        <Text style={styles.forTodayReason}>{forToday}</Text>
      </View>}
      <View style={styles.collage}>
        {garments.map((garment) => <Pressable key={garment.id} accessibilityRole="button"
          accessibilityLabel={`Edit ${garment.name}`} onPress={() => onEdit(garment)}
          style={garments.length === 3 || garments.length >= 5 ? styles.third : styles.half}>
          <GarmentPhoto garment={garment} />
          <Text style={styles.garmentName}>{garment.name}</Text>
        </Pressable>)}
      </View>
      {missing > 0 && <Text style={styles.help}>Missing a piece</Text>}
      <Text style={styles.reason}>{reason}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={action.accessibilityLabel} disabled={disabled}
        onPress={action.onPress}
        style={[styles.secondary, disabled && styles.disabled]}>
        <Text style={styles.secondaryText}>{action.text}</Text>
      </Pressable>
    </View>
  );
}

export function OutfitSuggestionsScreen({ onBack, onEdit }: {
  onBack: () => void;
  onEdit: (garment: Garment) => void;
}) {
  const profileStatus = useWistStore((state) => state.profileStatus);
  const profileOccasions = useWistStore((state) => state.occasions);
  const [occasion, setOccasion] = useState<Occasion | null>(() =>
    profileStatus === "answered" ? profileOccasions[0] ?? null : null);
  const [state, setState] = useState<BoardState>({ status: "loading" });
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const alive = useRef(true);
  const loading = useRef(0);
  const locationSent = useRef(false);

  const refresh = useCallback(async () => {
    loading.current += 1;
    try {
      const board = await loadOutfits();
      if (alive.current) setState({ status: "ready", board });
    } catch {
      // Keep showing the last good board; only an initial failure becomes an error screen.
      if (alive.current) setState((previous) => previous.status === "ready" ? previous : { status: "error" });
    } finally {
      loading.current -= 1;
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    void refresh();
    // One location save per visit, even if React repeats mount effects in development.
    // Fire-and-forget: it never delays the board, errors and the 10 s timeout are ignored (owner answer 1),
    // and the 15 s refresh does not repeat it.
    if (!locationSent.current) {
      locationSent.current = true;
      void currentCoarseLocation()
        .then((location) => location ? saveLocation(location) : undefined)
        .catch(() => {});
    }
    return () => { alive.current = false; };
  }, [refresh]);

  const waiting = state.status === "ready" && (state.board.status.pending || state.board.status.running);
  useEffect(() => {
    if (!waiting) return;
    const timer = setInterval(() => { if (loading.current === 0) void refresh(); }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [waiting, refresh]);

  const act = async (action: () => Promise<string | null>) => {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    try {
      const message = await action();
      if (alive.current) setNotice(message);
    } catch {
      if (alive.current) setNotice("Something went wrong. Please try again.");
    } finally {
      // Also after a failure: a 404 means the idea is gone, so reload the board to drop its card.
      if (alive.current) await refresh();
      if (alive.current) setBusy(false);
    }
  };

  const matches = (candidate: Occasion) => occasion === null || candidate === occasion;
  const labelFor = (candidate: Occasion) =>
    OCCASION_OPTIONS.find((option) => option.id === candidate)?.label.toUpperCase() ?? "";

  return (
    <View style={styles.screen}>
      <View style={styles.topline}>
        <Pressable accessibilityRole="button" onPress={onBack}><Text style={styles.action}>‹ WARDROBE</Text></Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Dress me</Text>
        <Text accessibilityLiveRegion="polite" style={styles.subtitle}>
          {weatherLine(state.status === "ready" ? state.board.today?.weather ?? null : null, state.status === "loading")}
        </Text>
        <Text style={styles.subtitle}>Ideas prepared from the pieces you already own.</Text>
        <Text style={styles.label}>WHAT’S THE OCCASION?</Text>
        <OccasionStylePicker selectionMode="single" selectedColor={colors.moss} options={OCCASION_OPTIONS}
          selected={occasion ? [occasion] : []} onChange={([next]) => setOccasion(next ?? null)} />

        {state.status === "loading" && <ActivityIndicator style={styles.loading} color={colors.moss} />}
        {state.status === "error" && <View style={styles.notice}>
          <Text accessibilityRole="alert" style={styles.error}>Couldn't load your outfits.</Text>
          <Pressable accessibilityRole="button" style={styles.button} onPress={() => void refresh()}>
            <Text style={styles.buttonText}>RETRY</Text>
          </Pressable>
        </View>}

        {state.status === "ready" && (() => {
          const { board } = state;
          const order = board.today?.order ?? null;
          const forToday = (id: string) => board.today?.reasons[id];
          const ideas = orderForToday(board.suggestions.filter((idea) => matches(idea.occasion)), order);
          const saved = orderForToday(board.saved.filter((outfit) => matches(outfit.occasion)), order);
          return <>
            <Text style={styles.label}>IDEAS</Text>
            {ideas.length === 0 && <Text accessibilityLiveRegion="polite" style={styles.help}>
              {!board.status.generationEnabled ? "New ideas are switched off on the server. Your saved outfits are below."
                : waiting ? "Preparing ideas…" : "No ideas yet."}
            </Text>}
            <View style={styles.results}>
              {ideas.map((idea) => <OutfitCard key={idea.id} label={labelFor(idea.occasion)} garments={idea.garments}
                reason={idea.reason} forToday={forToday(idea.id)} missing={0} onEdit={onEdit} disabled={busy}
                action={{
                  text: "♡ SAVE", accessibilityLabel: `Save ${labelFor(idea.occasion).toLowerCase()} outfit: ${idea.garments.map((g) => g.name).join(", ")}`,
                  onPress: () => void act(async () => { await saveOutfitIdea(idea.id); return null; }),
                }} />)}
            </View>
            {board.status.generationEnabled && <>
              <Pressable accessibilityRole="button" disabled={busy || waiting}
                onPress={() => void act(async () => MORE_IDEAS_COPY[await requestMoreIdeas()])}
                style={[styles.button, (busy || waiting) && styles.disabled]}>
                <Text style={styles.buttonText}>{waiting ? "PREPARING IDEAS…" : "MORE IDEAS"}</Text>
              </Pressable>
              <Text style={styles.footnote}>Each new batch of ideas may incur a processing charge.</Text>
            </>}
            {notice && <Text accessibilityRole="alert" style={styles.help}>{notice}</Text>}
            {saved.length > 0 && <>
              <Text style={styles.label}>SAVED</Text>
              <View style={styles.results}>
                {saved.map((outfit) => <OutfitCard key={outfit.id} label={labelFor(outfit.occasion)} garments={outfit.garments}
                  reason={outfit.reason} forToday={forToday(outfit.id)} missing={outfit.missingGarmentIds.length} onEdit={onEdit} disabled={busy}
                  action={{
                    text: "REMOVE", accessibilityLabel: `Remove saved ${labelFor(outfit.occasion).toLowerCase()} outfit: ${outfit.garments.map((g) => g.name).join(", ")}`,
                    onPress: () => void act(async () => { await removeSavedOutfit(outfit.id); return null; }),
                  }} />)}
              </View>
            </>}
          </>;
        })()}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  topline: { padding: 22 },
  action: { color: colors.moss, fontFamily: fonts.textSemibold, fontSize: 11, letterSpacing: 1 },
  content: { paddingHorizontal: 22, paddingBottom: 32 },
  title: { color: colors.ink, fontFamily: fonts.display, fontSize: 40 },
  subtitle: { color: colors.muted, fontFamily: fonts.text, fontSize: 12, lineHeight: 19, marginTop: 4 },
  label: { color: colors.muted, fontFamily: fonts.textSemibold, fontSize: 10, letterSpacing: 1, marginTop: 28, marginBottom: 14 },
  loading: { marginTop: 32 },
  help: { color: colors.muted, fontFamily: fonts.text, fontSize: 12, lineHeight: 19, marginTop: 16, textAlign: "center" },
  button: { backgroundColor: colors.moss, borderRadius: 999, padding: 18, alignItems: "center", marginTop: 24, minHeight: 50 },
  buttonText: { color: colors.card, fontFamily: fonts.textSemibold, fontSize: 11, letterSpacing: 1 },
  secondary: { borderColor: colors.moss, borderWidth: 1, borderRadius: 999, padding: 14, alignItems: "center", marginTop: 20 },
  secondaryText: { color: colors.moss, fontFamily: fonts.textSemibold, fontSize: 11, letterSpacing: 1 },
  disabled: { opacity: 0.45 },
  notice: { marginTop: 24 },
  error: { color: colors.ink, fontFamily: fonts.text, fontSize: 14, lineHeight: 21 },
  results: { gap: 20 },
  card: { backgroundColor: colors.card, borderRadius: 20, borderWidth: 1, borderColor: colors.line, padding: 16 },
  cardLabel: { color: colors.muted, fontFamily: fonts.textSemibold, fontSize: 9, letterSpacing: 1, marginBottom: 16 },
  forToday: { borderLeftColor: colors.moss, borderLeftWidth: 2, paddingLeft: 10, marginBottom: 16 },
  forTodayLabel: { color: colors.moss, fontFamily: fonts.textSemibold, fontSize: 9, letterSpacing: 1 },
  forTodayReason: { color: colors.ink, fontFamily: fonts.text, fontSize: 12, lineHeight: 18, marginTop: 4 },
  collage: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 14 },
  half: { width: "48%" },
  third: { width: "31%" },
  garmentName: { color: colors.ink, fontFamily: fonts.text, fontSize: 11, lineHeight: 16, marginTop: 7 },
  reason: { color: colors.ink, fontFamily: fonts.displayItalic, fontSize: 25, lineHeight: 29, marginTop: 20 },
  footnote: { color: colors.muted, fontFamily: fonts.text, fontSize: 10, lineHeight: 16, marginTop: 16, textAlign: "center" },
});
