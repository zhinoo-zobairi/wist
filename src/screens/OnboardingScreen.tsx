import { useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { OccasionStylePicker } from "../components/OccasionStylePicker";
import { saveStyleProfile } from "../services/catalogueClient";
import { commitStyleProfile } from "../styleProfileCommit";
import { useWistStore } from "../store/useWistStore";
import { colors, fonts, radii } from "../theme";
import {
  OCCASION_OPTIONS,
  STYLE_OPTIONS,
  type Occasion,
  type Style,
} from "../types";

export function OnboardingScreen() {
  const [step, setStep] = useState<"occasions" | "styles">("occasions");
  const [occasions, setOccasions] = useState<Occasion[]>([]);
  const [styles, setStyles] = useState<Style[]>([]);
  const markProfileSkipped = useWistStore(
    (state) => state.markProfileSkipped,
  );
  const replaceStyleProfile = useWistStore(
    (state) => state.replaceStyleProfile,
  );

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
      contentContainerStyle={screenStyles.content}
      style={screenStyles.screen}
    >
      <View style={screenStyles.topline}>
        <Text style={screenStyles.wordmark}>WIST</Text>
        <Pressable onPress={markProfileSkipped}>
          <Text style={screenStyles.skip}>SKIP</Text>
        </Pressable>
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
        <Pressable
          onPress={() => void continueOnboarding()}
          style={screenStyles.continueButton}
        >
          <Text style={screenStyles.continueText}>
            {isOccasionStep ? "CONTINUE" : "SAVE MY PROFILE"}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const screenStyles = StyleSheet.create({
  screen: { backgroundColor: colors.paper, flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 24, paddingVertical: 22 },
  topline: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  wordmark: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 20,
    letterSpacing: 3,
  },
  skip: {
    color: colors.muted,
    fontFamily: fonts.textSemibold,
    fontSize: 9,
    letterSpacing: 1.4,
    padding: 8,
  },
  intro: { marginTop: 70, maxWidth: 480 },
  kicker: {
    color: colors.wine,
    fontFamily: fonts.textSemibold,
    fontSize: 9,
    letterSpacing: 1.7,
  },
  title: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 43,
    lineHeight: 46,
    marginTop: 12,
  },
  subtitle: {
    color: colors.muted,
    fontFamily: fonts.text,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 12,
  },
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
  continueButton: {
    alignItems: "center",
    backgroundColor: colors.wine,
    borderRadius: radii.pill,
    justifyContent: "center",
    marginTop: 20,
    minHeight: 52,
  },
  continueText: {
    color: colors.card,
    fontFamily: fonts.textSemibold,
    fontSize: 10,
    letterSpacing: 1.4,
  },
});
