import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { OccasionStylePicker } from "../components/OccasionStylePicker";
import { seedBrands } from "../data/seed";
import { saveStyleProfile } from "../services/catalogueClient";
import { useWistStore } from "../store/useWistStore";
import { colors, fonts, radii } from "../theme";
import {
  OCCASION_OPTIONS,
  STYLE_OPTIONS,
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

export function ProfileScreen() {
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
        <View style={screenStyles.header}>
          <Text style={screenStyles.kicker}>YOUR TASTE, IN PROGRESS</Text>
          <Text style={screenStyles.title}>Profile</Text>
          <Text style={screenStyles.subtitle}>
            The preferences Wist uses to shape your edit.
          </Text>
        </View>

        <View style={screenStyles.section}>
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
          {seedBrands.map((brand, index) => {
            const selected = followed.includes(brand.id);
            return (
              <View key={brand.id} style={screenStyles.row}>
                <Text style={screenStyles.index}>0{index + 1}</Text>
                <View style={screenStyles.monogram}>
                  <Text style={screenStyles.monogramText}>{brand.monogram}</Text>
                </View>
                <Text style={screenStyles.brand}>{brand.name}</Text>
                <Pressable onPress={() => toggleFollow(brand.id)}>
                  <Text
                    style={[
                      screenStyles.action,
                      !selected && screenStyles.follow,
                    ]}
                  >
                    {selected ? "FOLLOWING" : "FOLLOW"}
                  </Text>
                </Pressable>
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
            <Pressable disabled={saving} onPress={() => setEditor(null)}>
              <Text style={screenStyles.modalAction}>CANCEL</Text>
            </Pressable>
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
          <Pressable
            disabled={saving}
            onPress={() => void saveEditor()}
            style={screenStyles.saveButton}
          >
            {saving ? (
              <ActivityIndicator color={colors.card} />
            ) : (
              <Text style={screenStyles.saveText}>SAVE CHANGES</Text>
            )}
          </Pressable>
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
    <Pressable onPress={onEdit} style={screenStyles.tasteRow}>
      <View style={screenStyles.tasteCopy}>
        <Text style={screenStyles.tasteLabel}>{label}</Text>
        <Text style={screenStyles.tasteValue}>{value}</Text>
      </View>
      <Text style={[screenStyles.action, screenStyles.edit]}>EDIT</Text>
    </Pressable>
  );
}

const screenStyles = StyleSheet.create({
  screen: { backgroundColor: colors.paper, flex: 1 },
  header: { paddingBottom: 29, paddingHorizontal: 22, paddingTop: 12 },
  kicker: {
    color: colors.muted,
    fontFamily: fonts.textSemibold,
    fontSize: 8,
    letterSpacing: 1.8,
  },
  title: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 45,
    lineHeight: 49,
    marginTop: 3,
  },
  subtitle: {
    color: colors.muted,
    fontFamily: fonts.text,
    fontSize: 12,
    marginTop: 5,
  },
  section: {
    borderTopColor: colors.ink,
    borderTopWidth: 1,
    marginHorizontal: 22,
  },
  followedSection: { marginTop: 34 },
  sectionLabel: {
    color: colors.muted,
    fontFamily: fonts.textSemibold,
    fontSize: 8,
    letterSpacing: 1.4,
    paddingVertical: 14,
  },
  tasteRow: {
    alignItems: "center",
    borderTopColor: colors.line,
    borderTopWidth: 1,
    flexDirection: "row",
    minHeight: 76,
  },
  tasteCopy: { flex: 1, paddingRight: 20 },
  tasteLabel: {
    color: colors.muted,
    fontFamily: fonts.textSemibold,
    fontSize: 8,
    letterSpacing: 1.2,
  },
  tasteValue: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 20,
    marginTop: 4,
  },
  row: {
    alignItems: "center",
    borderTopColor: colors.line,
    borderTopWidth: 1,
    flexDirection: "row",
    minHeight: 68,
  },
  index: { color: colors.muted, fontFamily: fonts.text, fontSize: 8, width: 25 },
  monogram: {
    alignItems: "center",
    borderColor: colors.ring,
    borderWidth: 1,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  monogramText: { color: colors.ink, fontFamily: fonts.display, fontSize: 15 },
  brand: {
    color: colors.ink,
    flex: 1,
    fontFamily: fonts.display,
    fontSize: 20,
    paddingLeft: 13,
  },
  action: {
    color: colors.muted,
    fontFamily: fonts.textSemibold,
    fontSize: 8,
    letterSpacing: 1.1,
  },
  edit: { color: colors.wine },
  follow: { color: colors.wine },
  note: {
    backgroundColor: colors.moss,
    marginBottom: 28,
    marginHorizontal: 14,
    marginTop: 35,
    padding: 22,
  },
  noteLabel: {
    color: "#C9D0C4",
    fontFamily: fonts.textSemibold,
    fontSize: 8,
    letterSpacing: 1.4,
  },
  noteTitle: {
    color: colors.card,
    fontFamily: fonts.display,
    fontSize: 25,
    marginTop: 7,
  },
  noteBody: {
    color: "#D8DDD4",
    fontFamily: fonts.text,
    fontSize: 11,
    lineHeight: 17,
    marginTop: 6,
  },
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
  modalAction: {
    color: colors.wine,
    fontFamily: fonts.textSemibold,
    fontSize: 9,
    letterSpacing: 1.2,
    width: 58,
  },
  modalActionSpacer: { width: 58 },
  modalKicker: {
    color: colors.muted,
    fontFamily: fonts.textSemibold,
    fontSize: 8,
    letterSpacing: 1.4,
  },
  modalContent: { padding: 24 },
  modalTitle: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 39,
    marginTop: 20,
  },
  modalSubtitle: {
    color: colors.muted,
    fontFamily: fonts.text,
    fontSize: 12,
    marginTop: 8,
  },
  modalPicker: { marginTop: 34 },
  saveButton: {
    alignItems: "center",
    backgroundColor: colors.wine,
    borderRadius: radii.pill,
    justifyContent: "center",
    marginHorizontal: 24,
    marginVertical: 16,
    minHeight: 52,
  },
  saveText: {
    color: colors.card,
    fontFamily: fonts.textSemibold,
    fontSize: 10,
    letterSpacing: 1.4,
  },
});
