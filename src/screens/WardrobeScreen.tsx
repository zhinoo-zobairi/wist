import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { GarmentPhoto } from "../components/GarmentPhoto";
import { UncertainWardrobeRequestError, WardrobeApiError } from "../services/catalogueClient";
import { prepareGarmentPhoto } from "../services/garmentPhoto";
import { useWistStore } from "../store/useWistStore";
import { colors, fonts } from "../theme";
import type { Garment } from "../types";

export function WardrobeScreen({ onBack, onEdit }: { onBack: () => void; onEdit: (id: string) => void }) {
  const wardrobe = useWistStore((state) => state.wardrobe);
  const status = useWistStore((state) => state.wardrobeStatus);
  const refresh = useWistStore((state) => state.refreshWardrobe);
  const addPhoto = useWistStore((state) => state.addGarmentPhoto);
  const tagGarment = useWistStore((state) => state.tagGarment);
  const [chooser, setChooser] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);
  const pending = useRef(false);

  const refreshList = async () => {
    setError(null);
    try { await refresh(); } catch {
      if (alive.current) setError("Could not load your wardrobe. Check your connection and retry.");
    }
  };
  useEffect(() => {
    alive.current = true;
    void refreshList();
    return () => { alive.current = false; };
  }, [refresh]);

  const capture = async (source: "camera" | "library") => {
    if (pending.current) return;
    pending.current = true;
    setChooser(false);
    setError(null);
    setBusy("Choosing a photo…");
    try {
      if (source === "camera") {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) throw new Error("Allow camera access in Settings, or choose a photo instead.");
      }
      if (!alive.current) return;
      const options: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], allowsMultipleSelection: false, quality: 1 };
      const result = source === "camera"
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
      if (result.canceled || !result.assets[0] || !alive.current) return;
      setBusy("Reading your garment…");
      const uri = await prepareGarmentPhoto(result.assets[0]);
      if (!alive.current) return;
      const garment = await addPhoto(uri);
      if (alive.current) onEdit(garment.id);
    } catch (caught) {
      if (!alive.current) return;
      setError(caught instanceof UncertainWardrobeRequestError ? caught.message
        : caught instanceof WardrobeApiError && caught.code === "wardrobe_full" ? "Your wardrobe is full (300 garments). Remove one before adding another."
        : caught instanceof WardrobeApiError && caught.code === "payload_too_large" ? "This photo is too large. Choose a smaller photo."
        : caught instanceof Error ? caught.message : "Could not add this photo. Please try again.");
    } finally {
      pending.current = false;
      if (alive.current) setBusy(null);
    }
  };

  const retryTag = async (garment: Garment) => {
    if (pending.current) return;
    pending.current = true;
    setBusy("Reading your garment…");
    setError(null);
    try {
      const tagged = await tagGarment(garment.id);
      if (alive.current && tagged.tagStatus !== "tagged") setError("Could not read the photo. You can edit the garment yourself or retry later.");
    } catch (caught) {
      if (alive.current) setError(caught instanceof UncertainWardrobeRequestError ? caught.message : "Could not read the photo. You can edit the garment yourself or retry later.");
    } finally {
      pending.current = false;
      if (alive.current) setBusy(null);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.topline}>
        <Pressable accessibilityRole="button" onPress={onBack}><Text style={styles.action}>‹ PROFILE</Text></Pressable>
        <Pressable accessibilityRole="button" disabled={!!busy || status === "loading"} onPress={() => setChooser(!chooser)}>
          <Text style={[styles.action, !!busy && styles.disabled]}>+ ADD</Text>
        </Pressable>
      </View>
      <View style={styles.heading}>
        <Text style={styles.title}>Your wardrobe</Text>
        <Text style={styles.subtitle}>{wardrobe.length} pieces you own.</Text>
      </View>
      {chooser && <View style={styles.chooser}>
        <Pressable accessibilityRole="button" onPress={() => void capture("camera")}><Text style={styles.choice}>Take a photo</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={() => void capture("library")}><Text style={styles.choice}>Choose from library</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={() => setChooser(false)}><Text style={styles.choice}>Cancel</Text></Pressable>
      </View>}
      {busy && <View style={styles.notice}><ActivityIndicator color={colors.moss} /><Text style={styles.subtitle}>{busy}</Text></View>}
      {error && <View style={styles.notice}>
        <Text accessibilityRole="alert" style={styles.subtitle}>{error}</Text>
        <Pressable accessibilityRole="button" disabled={!!busy || status === "loading"} onPress={() => void refreshList()}>
          <Text style={styles.action}>RETRY · REFRESH WARDROBE</Text>
        </Pressable>
      </View>}
      <FlatList
        data={wardrobe} keyExtractor={(garment) => garment.id} numColumns={2}
        contentContainerStyle={styles.grid} columnWrapperStyle={styles.row}
        refreshing={status === "loading"} onRefresh={() => { if (!busy) void refreshList(); }}
        ListEmptyComponent={<Text style={styles.empty}>{status === "loading" ? "Loading your wardrobe…" : "Start with a few pieces you love. Add a photo, then check its details."}</Text>}
        renderItem={({ item }) => <View style={styles.card}>
          <Pressable accessibilityRole="button" disabled={!!busy} onPress={() => onEdit(item.id)}>
            <GarmentPhoto garment={item} />
            <Text style={styles.name}>{item.name}</Text>
          </Pressable>
          {item.tagStatus !== "tagged" && <Pressable accessibilityRole="button" disabled={!!busy}
            onPress={() => void retryTag(item)} style={styles.tagChip}>
            <Text style={styles.tagText}>{item.tagStatus === "failed" ? "Couldn't tag · Retry" : "Not tagged · Retry"}</Text>
          </Pressable>}
        </View>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  topline: { flexDirection: "row", justifyContent: "space-between", padding: 22 },
  action: { color: colors.moss, fontFamily: fonts.textSemibold, fontSize: 11, letterSpacing: 1 },
  disabled: { opacity: 0.4 },
  heading: { paddingHorizontal: 22, paddingBottom: 20 },
  title: { color: colors.ink, fontFamily: fonts.display, fontSize: 40 },
  subtitle: { color: colors.muted, fontFamily: fonts.text, fontSize: 12, lineHeight: 19 },
  chooser: { backgroundColor: colors.wash, paddingHorizontal: 22, marginHorizontal: 22, borderRadius: 20 },
  choice: { color: colors.ink, fontFamily: fonts.textMedium, fontSize: 14, paddingVertical: 16 },
  notice: { paddingHorizontal: 22, paddingBottom: 16, gap: 10 },
  grid: { paddingHorizontal: 22, paddingBottom: 24, gap: 20 },
  row: { gap: 14 },
  card: { width: "48%" },
  name: { color: colors.ink, fontFamily: fonts.display, fontSize: 22, marginTop: 9 },
  tagChip: { alignSelf: "flex-start", backgroundColor: colors.wash, borderRadius: 20, marginTop: 7, padding: 8 },
  tagText: { color: colors.moss, fontFamily: fonts.textMedium, fontSize: 10 },
  empty: { color: colors.muted, fontFamily: fonts.text, fontSize: 14, lineHeight: 22, paddingVertical: 40 },
});
