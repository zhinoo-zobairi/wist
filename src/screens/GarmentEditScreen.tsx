import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { GarmentPhoto } from "../components/GarmentPhoto";
import { OccasionStylePicker } from "../components/OccasionStylePicker";
import { UncertainWardrobeRequestError, WardrobeApiError } from "../services/catalogueClient";
import { useWistStore } from "../store/useWistStore";
import { colors, fonts } from "../theme";
import { garmentEditErrorMessage } from "../wardrobeMessages";
import { FORMALITY_OPTIONS, GARMENT_CATEGORY_OPTIONS, OCCASION_OPTIONS, WARMTH_OPTIONS, type Garment, type GarmentInput } from "../types";

function editableFields(garment: Garment): GarmentInput {
  const { name, category, colors, formality, warmth, occasions, notes } = garment;
  return { name, category, colors, formality, warmth, occasions, notes };
}

export function GarmentEditScreen({ garment, onBack, backLabel = "WARDROBE" }: {
  garment: Garment; onBack: () => void; backLabel?: string;
}) {
  const [draft, setDraft] = useState<GarmentInput>(() => editableFields(garment));
  const [colorsText, setColorsText] = useState(garment.colors.join(", "));
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmRetag, setConfirmRetag] = useState(false);
  const pending = useRef(false);
  const alive = useRef(true);
  const update = useWistStore((state) => state.updateGarment);
  const remove = useWistStore((state) => state.removeGarment);
  const tag = useWistStore((state) => state.tagGarment);
  const refresh = useWistStore((state) => state.refreshWardrobe);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const apply = (next: Garment) => { setDraft(editableFields(next)); setColorsText(next.colors.join(", ")); };
  const run = async (label: string, action: () => Promise<void>) => {
    if (pending.current) return;
    pending.current = true;
    setBusy(label); setError(null);
    try { await action(); if (alive.current) setUncertain(false); } catch (caught) {
      if (!alive.current) return;
      const lost = caught instanceof UncertainWardrobeRequestError;
      setUncertain((previous) => previous || lost);
      setError(garmentEditErrorMessage(caught));
      // A deleted garment would otherwise linger in the store and fail every retry.
      if (caught instanceof WardrobeApiError && caught.code === "garment_not_found") void refresh();
    } finally {
      pending.current = false;
      if (alive.current) setBusy(null);
    }
  };

  const save = () => {
    const selectedColors = colorsText.split(",").map((color) => color.trim().toLowerCase());
    if (!draft.name.trim() || draft.name.trim().length > 80 || selectedColors.length < 1 || selectedColors.length > 3 ||
      selectedColors.some((color) => !color || color.length > 24) || new Set(selectedColors).size !== selectedColors.length ||
      (draft.notes?.trim().length ?? 0) > 280) {
      setError("Enter a name and 1–3 different colors separated by commas (up to 24 characters each). Notes can use up to 280 characters.");
      return;
    }
    void run("Saving…", async () => {
      const saved = await update(garment.id, { ...draft, name: draft.name.trim(), colors: selectedColors, notes: draft.notes?.trim() || null });
      if (alive.current) { apply(saved); onBack(); }
    });
  };

  const reread = () => void run("Reading your garment…", async () => {
    const tagged = await tag(garment.id, true);
    if (alive.current) {
      apply(tagged); setConfirmRetag(false);
      if (tagged.tagStatus !== "tagged") setError("Could not read the photo. You can edit these details yourself or retry later.");
    }
  });

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.screen}>
      <View style={styles.topline}>
        <Pressable accessibilityRole="button" onPress={onBack}><Text style={styles.action}>‹ {backLabel}</Text></Pressable>
        <Pressable accessibilityRole="button" disabled={!!busy || uncertain} onPress={save}><Text style={[styles.action, (!!busy || uncertain) && styles.disabled]}>SAVE</Text></Pressable>
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <Text style={styles.title}>Garment details</Text>
        <View style={styles.photo}><GarmentPhoto garment={garment} /></View>
        {garment.tagStatus !== "tagged" && <Text style={styles.help}>{garment.tagStatus === "failed" ? "Couldn't tag this photo. Edit the details below or re-read it." : "Not tagged. Edit the details below or re-read the photo."}</Text>}
        {busy && <View style={styles.notice}><ActivityIndicator color={colors.moss} /><Text style={styles.help}>{busy}</Text></View>}
        {error && <Text accessibilityRole="alert" style={styles.help}>{error}</Text>}
        {uncertain && <Pressable accessibilityRole="button" disabled={!!busy} onPress={() => void run("Refreshing…", async () => {
          await refresh();
          const current = useWistStore.getState().wardrobe.find((entry) => entry.id === garment.id);
          if (alive.current) { if (current) apply(current); else onBack(); }
        })}><Text style={styles.choice}>REFRESH GARMENT</Text></Pressable>}
        <Text style={styles.label}>NAME</Text>
        <TextInput accessibilityLabel="Garment name" editable={!busy} maxLength={80} value={draft.name}
          onChangeText={(name) => setDraft({ ...draft, name })} style={styles.input} />
        <Text style={styles.label}>CATEGORY</Text>
        <OccasionStylePicker disabled={!!busy} selectionMode="single" selectedColor={colors.moss}
          options={GARMENT_CATEGORY_OPTIONS} selected={[draft.category]} onChange={([category]) => category && setDraft({ ...draft, category })} />
        <Text style={styles.label}>COLORS · 1–3, SEPARATED BY COMMAS</Text>
        <TextInput accessibilityLabel="Garment colors" editable={!busy} value={colorsText} onChangeText={setColorsText}
          autoCapitalize="none" placeholder="navy, cream" placeholderTextColor={colors.muted} style={styles.input} />
        <Text style={styles.label}>FORMALITY</Text>
        <OccasionStylePicker disabled={!!busy} selectionMode="single" selectedColor={colors.moss}
          options={FORMALITY_OPTIONS} selected={[draft.formality]} onChange={([formality]) => formality && setDraft({ ...draft, formality })} />
        <Text style={styles.label}>WARMTH</Text>
        <OccasionStylePicker disabled={!!busy} selectionMode="single" selectedColor={colors.moss}
          options={WARMTH_OPTIONS} selected={[draft.warmth]} onChange={([warmth]) => warmth && setDraft({ ...draft, warmth })} />
        <Text style={styles.label}>OCCASIONS</Text>
        <OccasionStylePicker disabled={!!busy} selectedColor={colors.moss} options={OCCASION_OPTIONS}
          selected={draft.occasions} onChange={(occasions) => setDraft({ ...draft, occasions })} />
        <Text style={styles.label}>NOTES · OPTIONAL</Text>
        <TextInput accessibilityLabel="Garment notes" editable={!busy} multiline maxLength={280} value={draft.notes ?? ""}
          onChangeText={(notes) => setDraft({ ...draft, notes })} style={[styles.input, styles.notes]} />
        <Pressable accessibilityRole="button" disabled={!!busy || uncertain} onPress={save} style={styles.save}>
          <Text style={styles.saveText}>SAVE CHANGES</Text>
        </Pressable>
        {garment.photoUrl && <>
          <Pressable accessibilityRole="button" disabled={!!busy || uncertain} onPress={() => setConfirmRetag(!confirmRetag)}><Text style={styles.choice}>RE-READ PHOTO</Text></Pressable>
          {confirmRetag && <View style={styles.confirm}>
            <Text style={styles.help}>Re-reading replaces your saved details and notes, plus any unsaved edits. It may incur another processing charge.</Text>
            <Pressable accessibilityRole="button" disabled={!!busy} onPress={reread}><Text style={styles.choice}>RE-READ AND REPLACE DETAILS</Text></Pressable>
            <Pressable accessibilityRole="button" disabled={!!busy} onPress={() => setConfirmRetag(false)}><Text style={styles.choice}>CANCEL</Text></Pressable>
          </View>}
        </>}
        <Pressable accessibilityRole="button" disabled={!!busy} onPress={() => setConfirmDelete(!confirmDelete)}><Text style={styles.choice}>DELETE GARMENT</Text></Pressable>
        {confirmDelete && <View style={styles.confirm}>
          <Text style={styles.help}>Delete this garment and its photo permanently? This cannot be undone.</Text>
          <Pressable accessibilityRole="button" disabled={!!busy} onPress={() => void run("Deleting…", async () => {
            await remove(garment.id); if (alive.current) onBack();
          })}><Text style={styles.choice}>DELETE PERMANENTLY</Text></Pressable>
          <Pressable accessibilityRole="button" disabled={!!busy} onPress={() => setConfirmDelete(false)}><Text style={styles.choice}>CANCEL</Text></Pressable>
        </View>}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  topline: { flexDirection: "row", justifyContent: "space-between", padding: 22 },
  action: { color: colors.moss, fontFamily: fonts.textSemibold, fontSize: 11, letterSpacing: 1 },
  disabled: { opacity: 0.4 },
  content: { paddingHorizontal: 22, paddingBottom: 32 },
  title: { color: colors.ink, fontFamily: fonts.display, fontSize: 38, marginBottom: 20 },
  photo: { width: "65%", alignSelf: "center", marginBottom: 16 },
  help: { color: colors.muted, fontFamily: fonts.text, fontSize: 12, lineHeight: 19, marginVertical: 8 },
  notice: { alignItems: "center", gap: 8 },
  label: { color: colors.muted, fontFamily: fonts.textSemibold, fontSize: 10, letterSpacing: 1, marginTop: 25, marginBottom: 12 },
  input: { borderColor: colors.ring, borderWidth: 1, borderRadius: 12, padding: 14, color: colors.ink, fontFamily: fonts.text, fontSize: 14 },
  notes: { minHeight: 90, textAlignVertical: "top" },
  save: { backgroundColor: colors.moss, borderRadius: 999, padding: 18, alignItems: "center", marginTop: 26 },
  saveText: { color: colors.card, fontFamily: fonts.textSemibold, fontSize: 11, letterSpacing: 1 },
  choice: { color: colors.moss, fontFamily: fonts.textSemibold, fontSize: 11, paddingVertical: 18 },
  confirm: { backgroundColor: colors.wash, borderRadius: 20, padding: 16 },
});
