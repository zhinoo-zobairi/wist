import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { GarmentPhoto } from "../components/GarmentPhoto";
import { OccasionStylePicker } from "../components/OccasionStylePicker";
import { suggestOutfits } from "../services/catalogueClient";
import { useWistStore } from "../store/useWistStore";
import { colors, fonts } from "../theme";
import { OCCASION_OPTIONS, type Garment, type Occasion, type SuggestedOutfit } from "../types";

type RequestState =
  | { status: "idle" | "loading" }
  | { status: "ready"; outfits: SuggestedOutfit[] }
  | { status: "error"; reason: "wardrobe_too_small" | "unavailable" };

export function OutfitSuggestionsScreen({ onBack, onEdit }: {
  onBack: () => void;
  onEdit: (garment: Garment) => void;
}) {
  const profileStatus = useWistStore((state) => state.profileStatus);
  const profileOccasions = useWistStore((state) => state.occasions);
  const [occasion, setOccasion] = useState<Occasion | null>(() =>
    profileStatus === "answered" ? profileOccasions[0] ?? null : null);
  const [request, setRequest] = useState<RequestState>({ status: "idle" });
  const pending = useRef<AbortController | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      pending.current?.abort();
    };
  }, []);

  const suggest = async () => {
    if (!occasion || pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    setRequest({ status: "loading" });
    try {
      const result = await suggestOutfits({ occasion }, controller.signal);
      if (!alive.current || controller.signal.aborted || pending.current !== controller) return;
      if (result.ok) setRequest({ status: "ready", outfits: result.outfits });
      else if (result.reason !== "cancelled") setRequest({ status: "error", reason: result.reason });
    } finally {
      if (pending.current === controller) pending.current = null;
    }
  };

  const leave = () => { pending.current?.abort(); onBack(); };
  const loading = request.status === "loading";
  const occasionLabel = OCCASION_OPTIONS.find((option) => option.id === occasion)?.label;

  return (
    <View style={styles.screen}>
      <View style={styles.topline}>
        <Pressable accessibilityRole="button" onPress={leave}><Text style={styles.action}>‹ WARDROBE</Text></Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Dress me</Text>
        <Text style={styles.subtitle}>Outfit ideas from the pieces you already own.</Text>
        <Text style={styles.label}>WHAT’S THE OCCASION?</Text>
        <OccasionStylePicker disabled={loading} selectionMode="single" selectedColor={colors.moss}
          options={OCCASION_OPTIONS} selected={occasion ? [occasion] : []} onChange={([next]) => {
            if (!next || pending.current) return;
            setOccasion(next);
            if (next !== occasion) setRequest({ status: "idle" });
          }} />
        {!occasion && <Text style={styles.help}>Choose an occasion to get started.</Text>}
        {(request.status === "idle" || loading) && <Pressable accessibilityRole="button"
          disabled={!occasion || loading} onPress={() => void suggest()}
          style={[styles.button, (!occasion || loading) && styles.disabled]}>
          {loading ? <ActivityIndicator color={colors.card} /> : <Text style={styles.buttonText}>SUGGEST</Text>}
        </Pressable>}
        {loading && <Text accessibilityLiveRegion="polite" style={styles.help}>Putting outfits together…</Text>}
        {request.status === "error" && <View style={styles.notice}>
          <Text accessibilityRole="alert" style={styles.error}>
            {request.reason === "wardrobe_too_small"
              ? "Add at least 3 tagged pieces to get outfit ideas."
              : "Couldn't put outfits together right now."}
          </Text>
          <Pressable accessibilityRole="button" style={styles.button}
            onPress={request.reason === "wardrobe_too_small" ? leave : () => void suggest()}>
            <Text style={styles.buttonText}>{request.reason === "wardrobe_too_small" ? "BACK TO WARDROBE" : "RETRY"}</Text>
          </Pressable>
        </View>}
        {request.status === "ready" && <>
          <View style={styles.results}>
            {request.outfits.map((outfit, index) => <View key={index} style={styles.card}>
              <Text style={styles.cardLabel}>OUTFIT {String(index + 1).padStart(2, "0")} · {occasionLabel?.toUpperCase()}</Text>
              <View style={styles.collage}>
                {outfit.garments.map((garment) => <Pressable key={garment.id} accessibilityRole="button"
                  accessibilityLabel={`Edit ${garment.name}`} onPress={() => onEdit(garment)}
                  style={outfit.garments.length === 3 || outfit.garments.length >= 5 ? styles.third : styles.half}>
                  <GarmentPhoto garment={garment} />
                  <Text style={styles.garmentName}>{garment.name}</Text>
                </Pressable>)}
              </View>
              <Text style={styles.reason}>{outfit.reason}</Text>
              <Pressable accessibilityRole="button" onPress={() => void suggest()} style={styles.button}>
                <Text style={styles.buttonText}>TRY AGAIN</Text>
              </Pressable>
            </View>)}
          </View>
        </>}
        <Text style={styles.footnote}>Each new request may incur a processing charge.</Text>
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
  help: { color: colors.muted, fontFamily: fonts.text, fontSize: 12, lineHeight: 19, marginTop: 16, textAlign: "center" },
  button: { backgroundColor: colors.moss, borderRadius: 999, padding: 18, alignItems: "center", marginTop: 24, minHeight: 50 },
  buttonText: { color: colors.card, fontFamily: fonts.textSemibold, fontSize: 11, letterSpacing: 1 },
  disabled: { opacity: 0.45 },
  notice: { marginTop: 24 },
  error: { color: colors.ink, fontFamily: fonts.text, fontSize: 14, lineHeight: 21 },
  results: { gap: 20, marginTop: 28 },
  card: { backgroundColor: colors.card, borderRadius: 20, borderWidth: 1, borderColor: colors.line, padding: 16 },
  cardLabel: { color: colors.muted, fontFamily: fonts.textSemibold, fontSize: 9, letterSpacing: 1, marginBottom: 16 },
  collage: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 14 },
  half: { width: "48%" },
  third: { width: "31%" },
  garmentName: { color: colors.ink, fontFamily: fonts.text, fontSize: 11, lineHeight: 16, marginTop: 7 },
  reason: { color: colors.ink, fontFamily: fonts.displayItalic, fontSize: 25, lineHeight: 29, marginTop: 20 },
  footnote: { color: colors.muted, fontFamily: fonts.text, fontSize: 10, lineHeight: 16, marginTop: 16, textAlign: "center" },
});
