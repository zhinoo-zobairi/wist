import { useEffect, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ActionLink } from "../components/ActionLink";
import { Button } from "../components/Button";
import { OccasionStylePicker } from "../components/OccasionStylePicker";
import { ScreenHeader } from "../components/ScreenHeader";
import { saveStyleProfile } from "../services/catalogueClient";
import { useWistStore } from "../store/useWistStore";
import { colors, radii, typography } from "../theme";
import {
  OCCASION_OPTIONS,
  STYLE_OPTIONS,
  type Brand,
  type Occasion,
  type Style,
} from "../types";

type Editor = "occasions" | "styles";

function selectionLabels<Value extends string>(
  selected: Value[],
  options: readonly { id: Value; label: string }[],
) {
  const labels = options
    .filter((option) => selected.includes(option.id))
    .map((option) => option.label);
  return labels.length > 0 ? labels.join(", ") : "Not set";
}

export function ProfileScreen({ brands, onOpenWardrobe }: { brands: Brand[]; onOpenWardrobe: () => void }) {
  const wardrobe = useWistStore((state) => state.wardrobe);
  const wardrobeStatus = useWistStore((state) => state.wardrobeStatus);
  const refreshWardrobe = useWistStore((state) => state.refreshWardrobe);
  useEffect(() => { void refreshWardrobe().catch(() => undefined); }, [refreshWardrobe]);
  const followed = useWistStore((state) => state.followedBrandIds);
  const occasions = useWistStore((state) => state.occasions);
  const styles = useWistStore((state) => state.styles);
  const toggleFollow = useWistStore((state) => state.toggleFollow);
  const replaceStyleProfile = useWistStore(
    (state) => state.replaceStyleProfile,
  );
  const [editor, setEditor] = useState<Editor | null>(null);
  const [draftOccasions, setDraftOccasions] = useState<Occasion[]>([]);
  const [draftStyles, setDraftStyles] = useState<Style[]>([]);
  const [saving, setSaving] = useState(false);

  const openEditor = (nextEditor: Editor) => {
    setDraftOccasions(occasions);
    setDraftStyles(styles);
    setEditor(nextEditor);
  };

  const saveEditor = async () => {
    setSaving(true);
    try {
      const profile = await saveStyleProfile(draftOccasions, draftStyles);
      replaceStyleProfile(profile.occasions, profile.styles);
      setEditor(null);
    } catch (error) {
      Alert.alert(
        "Could not update your profile",
        error instanceof Error ? error.message : "Unknown catalogue error",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <ScrollView style={screenStyles.screen}>
        <ScreenHeader kicker="YOUR TASTE, IN PROGRESS" subtitle="The preferences Wist uses to shape your edit." title="Profile" />

        <View style={screenStyles.section}>
          <Pressable
            accessibilityRole="button"
            onPress={onOpenWardrobe}
            style={({ pressed }) => [screenStyles.tasteRow, pressed && screenStyles.pressed]}
          >
            <View style={screenStyles.tasteCopy}>
              <Text style={screenStyles.tasteLabel}>WARDROBE</Text>
              <Text style={screenStyles.tasteValue}>{wardrobeStatus === "loading" ? "Loading your pieces…" : wardrobeStatus === "error" ? "Open to reconnect" : `${wardrobe.length} pieces you own`}</Text>
            </View>
            <ActionLink color={colors.moss} label="Open" onPress={onOpenWardrobe} />
          </Pressable>
        </View>

        <View style={[screenStyles.section, { marginTop: 28 }]}>
          <Text style={screenStyles.sectionLabel}>YOUR TASTE</Text>
          <TasteRow
            label="OCCASIONS"
            onEdit={() => openEditor("occasions")}
            value={selectionLabels(occasions, OCCASION_OPTIONS)}
          />
          <TasteRow
            label="STYLE"
            onEdit={() => openEditor("styles")}
            value={selectionLabels(styles, STYLE_OPTIONS)}
          />
        </View>

        <View style={[screenStyles.section, screenStyles.followedSection]}>
          <Text style={screenStyles.sectionLabel}>
            FOLLOWED HOUSES · {followed.length}
          </Text>
          {brands.map((brand, index) => {
            const selected = followed.includes(brand.id);
            return (
              <View key={brand.id} style={screenStyles.row}>
                <Text style={screenStyles.index}>0{index + 1}</Text>
                <View style={screenStyles.monogram}>
                  <Text style={screenStyles.monogramText}>{brand.monogram}</Text>
                </View>
                <Text style={screenStyles.brand}>{brand.name}</Text>
                <ActionLink
                  color={selected ? colors.muted : colors.wine}
                  label={selected ? "Following" : "Follow"}
                  onPress={() => toggleFollow(brand.id)}
                />
              </View>
            );
          })}
        </View>

        <View style={screenStyles.note}>
          <Text style={screenStyles.noteLabel}>HOW WIST LEARNS</Text>
          <Text style={screenStyles.noteTitle}>
            Every choice sharpens the edit.
          </Text>
          <Text style={screenStyles.noteBody}>
            Your occasions, style words, followed houses, and coveted pieces form
            the signals available in this first version.
          </Text>
        </View>
      </ScrollView>

      <Modal
        animationType="slide"
        onRequestClose={() => !saving && setEditor(null)}
        presentationStyle="pageSheet"
        visible={editor !== null}
      >
        <SafeAreaView edges={["top", "bottom"]} style={screenStyles.modal}>
          <View style={screenStyles.modalTopline}>
            <View style={screenStyles.modalActionSpacer}>
              <ActionLink color={colors.wine} disabled={saving} label="Cancel" onPress={() => setEditor(null)} />
            </View>
            <Text style={screenStyles.modalKicker}>EDIT YOUR TASTE</Text>
            <View style={screenStyles.modalActionSpacer} />
          </View>
          <ScrollView contentContainerStyle={screenStyles.modalContent}>
            <Text style={screenStyles.modalTitle}>
              {editor === "occasions" ? "Your occasions" : "Your style"}
            </Text>
            <Text style={screenStyles.modalSubtitle}>
              {editor === "occasions"
                ? "Choose every setting you dress for."
                : "Choose up to three words."}
            </Text>
            <View style={screenStyles.modalPicker}>
              {editor === "occasions" ? (
                <OccasionStylePicker
                  onChange={setDraftOccasions}
                  options={OCCASION_OPTIONS}
                  selected={draftOccasions}
                />
              ) : (
                <OccasionStylePicker
                  maxSelections={3}
                  onChange={setDraftStyles}
                  options={STYLE_OPTIONS}
                  selected={draftStyles}
                />
              )}
            </View>
          </ScrollView>
          <View style={screenStyles.saveButton}>
            <Button busy={saving} color={colors.wine} label="Save changes" onPress={() => void saveEditor()} />
          </View>
        </SafeAreaView>
      </Modal>
    </>
  );
}

function TasteRow({
  label,
  onEdit,
  value,
}: {
  label: string;
  onEdit: () => void;
  value: string;
}) {
  return (
    <Pressable
      onPress={onEdit}
      style={({ pressed }) => [screenStyles.tasteRow, pressed && screenStyles.pressed]}
    >
      <View style={screenStyles.tasteCopy}>
        <Text style={screenStyles.tasteLabel}>{label}</Text>
        <Text style={screenStyles.tasteValue}>{value}</Text>
      </View>
      <ActionLink color={colors.wine} label="Edit" onPress={onEdit} />
    </Pressable>
  );
}

const screenStyles = StyleSheet.create({
  screen: { backgroundColor: colors.paper, flex: 1 },
  section: {
    borderTopColor: colors.ink,
    borderTopWidth: 1,
    marginHorizontal: 22,
  },
  followedSection: { marginTop: 34 },
  sectionLabel: { ...typography.kicker, paddingVertical: 14 },
  tasteRow: {
    alignItems: "center",
    borderTopColor: colors.line,
    borderTopWidth: 1,
    flexDirection: "row",
    minHeight: 76,
  },
  tasteCopy: { flex: 1, paddingRight: 20 },
  tasteLabel: typography.kicker,
  tasteValue: { ...typography.titleM, marginTop: 4 },
  row: {
    alignItems: "center",
    borderTopColor: colors.line,
    borderTopWidth: 1,
    flexDirection: "row",
    minHeight: 68,
  },
  index: { ...typography.caption, width: 25 },
  monogram: {
    alignItems: "center",
    borderColor: colors.ring,
    borderRadius: radii.card,
    borderWidth: 1,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  monogramText: typography.titleS,
  brand: { ...typography.titleM, flex: 1, paddingLeft: 13 },
  note: {
    backgroundColor: colors.moss,
    borderRadius: radii.card,
    marginBottom: 28,
    marginHorizontal: 14,
    marginTop: 35,
    padding: 22,
  },
  noteLabel: { ...typography.kicker, color: colors.onMossMuted },
  noteTitle: { ...typography.titleL, color: colors.card, marginTop: 7 },
  noteBody: { ...typography.body, color: colors.onMossSoft, marginTop: 6 },
  modal: { backgroundColor: colors.paper, flex: 1 },
  modalTopline: {
    alignItems: "center",
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 22,
    paddingVertical: 17,
  },
  modalActionSpacer: { width: 58 },
  modalKicker: typography.kicker,
  modalContent: { padding: 24 },
  modalTitle: { ...typography.titleXL, fontSize: 39, lineHeight: 42, marginTop: 20 },
  modalSubtitle: { ...typography.body, marginTop: 8 },
  modalPicker: { marginTop: 34 },
  saveButton: { marginHorizontal: 24, marginVertical: 16 },
  pressed: { opacity: 0.85 },
});
