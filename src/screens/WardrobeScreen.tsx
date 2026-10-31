import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { ActionLink } from "../components/ActionLink";
import { BackLink } from "../components/BackLink";
import { Button } from "../components/Button";
import { GarmentPhoto } from "../components/GarmentPhoto";
import { ScreenHeader } from "../components/ScreenHeader";
import { pageStyle, useLayout } from "../layout";
import { UncertainWardrobeRequestError } from "../services/catalogueClient";
import { prepareGarmentPhoto } from "../services/garmentPhoto";
import { useWistStore } from "../store/useWistStore";
import { colors, radii, spacing, typography } from "../theme";
import type { Garment } from "../types";
import { WardrobeNotice, captureErrorMessage } from "../wardrobeMessages";

export function WardrobeScreen({ onBack, onEdit, onDressMe }: {
  onBack: () => void;
  onEdit: (id: string) => void;
  onDressMe: () => void;
}) {
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
  const layout = useLayout();
  const { wide } = layout;
  const numColumns = wide ? 4 : 2;

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
        if (!permission.granted) throw new WardrobeNotice("Allow camera access in Settings, or choose a photo instead.");
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
      setError(captureErrorMessage(caught));
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
      <View style={pageStyle(layout, true)}>
        <View style={styles.topline}>
          <BackLink label="Profile" onPress={onBack} />
          <ActionLink color={colors.moss} disabled={!!busy || status === "loading"} label="+ Add" onPress={() => setChooser(!chooser)} />
        </View>
        <ScreenHeader subtitle={`${wardrobe.length} pieces you own.`} title="Your wardrobe" />
        <View style={styles.dressMe}>
          <Button color={colors.moss} disabled={!!busy} label="Dress me" onPress={onDressMe} />
        </View>
        {chooser && <View style={styles.chooser}>
          <ActionLink color={colors.ink} label="Take a photo" onPress={() => void capture("camera")} />
          <ActionLink color={colors.ink} label="Choose from library" onPress={() => void capture("library")} />
          <ActionLink color={colors.ink} label="Cancel" onPress={() => setChooser(false)} />
        </View>}
        {busy && <View style={styles.notice}><ActivityIndicator color={colors.moss} /><Text style={styles.subtitle}>{busy}</Text></View>}
        {error && <View style={styles.notice}>
          <Text accessibilityRole="alert" style={styles.subtitle}>{error}</Text>
          <ActionLink color={colors.moss} disabled={!!busy || status === "loading"} label="Retry · Refresh wardrobe" onPress={() => void refreshList()} />
        </View>}
      </View>
      <FlatList
        key={numColumns}
        data={wardrobe} keyExtractor={(garment) => garment.id} numColumns={numColumns}
        contentContainerStyle={[styles.grid, pageStyle(layout, true), wide && styles.gridWide]} columnWrapperStyle={styles.row}
        refreshing={status === "loading"} onRefresh={() => { if (!busy) void refreshList(); }}
        ListEmptyComponent={<Text style={styles.empty}>{status === "loading" ? "Loading your wardrobe…" : "Start with a few pieces you love. Add a photo, then check its details."}</Text>}
        renderItem={({ item }) => <View style={[styles.card, wide && styles.cardWide]}>
          <Pressable accessibilityRole="button" disabled={!!busy} onPress={() => onEdit(item.id)}
            style={({ pressed }) => [pressed && styles.pressed]}>
            <GarmentPhoto garment={item} />
            <Text style={styles.name}>{item.name}</Text>
          </Pressable>
          {item.tagStatus !== "tagged" && <Pressable accessibilityRole="button" disabled={!!busy}
            onPress={() => void retryTag(item)} style={({ pressed }) => [styles.tagChip, pressed && styles.pressed]}>
            <Text style={styles.tagText}>{item.tagStatus === "failed" ? "Couldn't tag · Retry" : "Not tagged · Retry"}</Text>
          </Pressable>}
        </View>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  topline: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", padding: spacing.gutter },
  dressMe: { marginHorizontal: spacing.gutter, marginBottom: 20 },
  subtitle: typography.body,
  // Links hug their label, so a tap beside one never fires it.
  chooser: {
    alignItems: "flex-start",
    backgroundColor: colors.card,
    borderColor: colors.line,
    borderRadius: radii.card,
    borderWidth: 1,
    gap: 6,
    marginHorizontal: spacing.gutter,
    paddingHorizontal: spacing.gutter,
    paddingVertical: 12,
  },
  notice: { paddingHorizontal: spacing.gutter, paddingBottom: 16, gap: 10 },
  grid: { paddingHorizontal: spacing.gutter, paddingBottom: 24, gap: 20 },
  // The grid carries its own gutter, so on wide it takes the full wide gutter rather than summing with pageStyle.
  gridWide: { paddingHorizontal: spacing.gutterWide },
  row: { gap: 14 },
  card: { width: "48%" },
  cardWide: { width: "23%" },
  name: { ...typography.titleM, marginTop: 9 },
  tagChip: { alignSelf: "flex-start", backgroundColor: colors.wash, borderRadius: radii.card, marginTop: 7, padding: 8 },
  tagText: { ...typography.caption, color: colors.moss },
  empty: { ...typography.body, fontSize: 14, lineHeight: 22, paddingVertical: 40 },
  pressed: { opacity: 0.85 },
});
