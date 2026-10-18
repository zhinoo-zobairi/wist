import { useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";

import { ActionLink } from "../components/ActionLink";
import { Button } from "../components/Button";
import { OccasionStylePicker } from "../components/OccasionStylePicker";
import { Wordmark } from "../components/Wordmark";
import { pageStyle, useLayout } from "../layout";
import { saveStyleProfile } from "../services/catalogueClient";
import { commitStyleProfile } from "../styleProfileCommit";
import { useWistStore } from "../store/useWistStore";
import { colors, radii, spacing, typography } from "../theme";
import {
  OCCASION_OPTIONS,
  STYLE_OPTIONS,
  type Occasion,
  type Style,
} from "../types";
import { IntroScreen } from "./IntroScreen";

export function OnboardingScreen() {
  const [step, setStep] = useState<"intro" | "occasions" | "styles">("intro");
  const [occasions, setOccasions] = useState<Occasion[]>([]);
  const [styles, setStyles] = useState<Style[]>([]);
  const markProfileSkipped = useWistStore(
    (state) => state.markProfileSkipped,
  );
  const replaceStyleProfile = useWistStore(
    (state) => state.replaceStyleProfile,
  );
  const layout = useLayout();
  const { wide } = layout;

  if (step === "intro") {
    return <IntroScreen onBegin={() => setStep("occasions")} onSkip={markProfileSkipped} />;
  }

  const continueOnboarding = async () => {
    if (step === "occasions") {
      setStep("styles");
      return;
    }

    // Optimistic: the local answers are applied immediately (entering the app),
    // so a catalogue outage never traps the user. Only surface a sync failure.
    try {
      await commitStyleProfile({
        occasions,
        styles,
        apply: replaceStyleProfile,
        save: saveStyleProfile,
      });
    } catch (error) {
      Alert.alert(
        "Saved on this device",
        error instanceof Error ? error.message : "Unknown catalogue error",
      );
    }
  };

  const isOccasionStep = step === "occasions";

  return (
    <ScrollView
      contentContainerStyle={[screenStyles.content, pageStyle(layout, true), wide && screenStyles.contentWide]}
      style={screenStyles.screen}
    >
      <View style={screenStyles.topline}>
        <Wordmark />
        <ActionLink color={colors.muted} label="Skip" onPress={markProfileSkipped} />
      </View>

      <View style={screenStyles.intro}>
        <Text style={screenStyles.kicker}>
          {isOccasionStep ? "01 · YOUR WORLD" : "02 · YOUR POINT OF VIEW"}
        </Text>
        <Text style={screenStyles.title}>
          {isOccasionStep
            ? "Where does your wardrobe take you?"
            : "How would you describe your style?"}
        </Text>
        <Text style={screenStyles.subtitle}>
          {isOccasionStep
            ? "Choose every setting you dress for."
            : "Choose up to three words that feel like you."}
        </Text>
      </View>

      <View style={screenStyles.picker}>
        {isOccasionStep ? (
          <OccasionStylePicker
            onChange={setOccasions}
            options={OCCASION_OPTIONS}
            selected={occasions}
          />
        ) : (
          <OccasionStylePicker
            maxSelections={3}
            onChange={setStyles}
            options={STYLE_OPTIONS}
            selected={styles}
          />
        )}
      </View>

      <View style={screenStyles.footer}>
        <View style={screenStyles.progress}>
          <View style={[screenStyles.dot, screenStyles.dotActive]} />
          <View
            style={[screenStyles.dot, !isOccasionStep && screenStyles.dotActive]}
          />
        </View>
        <View style={screenStyles.continueButton}>
          <Button
            color={colors.wine}
            label={isOccasionStep ? "Continue" : "Save my profile"}
            onPress={() => void continueOnboarding()}
          />
        </View>
      </View>
    </ScrollView>
  );
}

const screenStyles = StyleSheet.create({
  screen: { backgroundColor: colors.paper, flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: spacing.gutter + 2, paddingVertical: 22 },
  // The content carries its own gutter, so on wide it takes the full wide gutter rather than summing with pageStyle.
  contentWide: { paddingHorizontal: spacing.gutterWide },
  topline: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  intro: { marginTop: 70, maxWidth: 480 },
  kicker: { ...typography.kicker, color: colors.wine },
  title: { ...typography.titleXL, marginTop: 12 },
  subtitle: { ...typography.body, marginTop: 12 },
  picker: { marginTop: 38 },
  footer: { marginTop: "auto", paddingTop: 42 },
  progress: { flexDirection: "row", gap: 7, justifyContent: "center" },
  dot: {
    backgroundColor: colors.line,
    borderRadius: radii.pill,
    height: 5,
    width: 22,
  },
  dotActive: { backgroundColor: colors.wine },
  continueButton: { marginTop: 20 },
});
