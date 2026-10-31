import { useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";

import { ActionLink } from "../components/ActionLink";
import { Button } from "../components/Button";
import { Wordmark } from "../components/Wordmark";
import { pageStyle, useLayout } from "../layout";
import { composingLines, paletteInterlude, paletteSwatches, workInterlude } from "../onboardingCopy";
import { saveStyleBrief } from "../services/catalogueClient";
import { newOnboardingDraft, useWistStore } from "../store/useWistStore";
import { commitStyleProfile } from "../styleProfileCommit";
import { colors, spacing, typography } from "../theme";
import {
  TASTE_AXIS_OPTIONS,
  type Brand, type CatalogueStatus, type Item, type OnboardingAnswers, type OnboardingDraft, type SizeKind, type TasteAnswer,
} from "../types";
import { BriefScreen, Composing, Interlude, Reveal } from "./Finale";
import { ThisOrThatRound } from "./inputs";
import { StepBody, type AnswerStepId } from "./StepBody";
import { CovetStep, HousesStep, NotifyStep } from "./StoreSteps";
import { ONBOARDING_STEPS, QUESTION_COUNT, questionNumber } from "./steps";

/** The reveal shows the three pieces screen 12 asked for. */
const MAX_REVEALED_PIECES = 3;

type Props = {
  brands: Brand[];
  catalogueStatus: CatalogueStatus;
  /** Item ids the reader covets, from the store. */
  coveted: string[];
  items: Item[];
  onReload: () => void;
  /** Covets or un-covets at once through the watch API, without the covet-time permission prompt. */
  onToggleCovet: (item: Item, defaultSizes: Partial<Record<SizeKind, string>>) => void;
  syncingIds: string[];
};

export function OnboardingFlow({ brands, catalogueStatus, coveted, items, onReload, onToggleCovet, syncingIds }: Props) {
  const saveOnboardingDraft = useWistStore((state) => state.saveOnboardingDraft);
  const clearOnboardingDraft = useWistStore((state) => state.clearOnboardingDraft);
  const chooseFollows = useWistStore((state) => state.chooseFollows);
  const markProfileSkipped = useWistStore((state) => state.markProfileSkipped);
  const replaceStyleProfile = useWistStore((state) => state.replaceStyleProfile);
  const profileStatus = useWistStore((state) => state.profileStatus);
  const [draft, setDraft] = useState<OnboardingDraft>(() => {
    const state = useWistStore.getState();
    return state.onboardingDraft ?? newOnboardingDraft(state);
  });
  const [round, setRound] = useState(0);
  const [saveSettled, setSaveSettled] = useState(false);
  const layout = useLayout();

  const step = ONBOARDING_STEPS[draft.stepIndex] ?? ONBOARDING_STEPS[0]!;
  const { answers } = draft;
  const shopsFor = answers.details.shopsFor;

  // Every change is kept on the phone, so a killed app resumes on this step (Decision 11).
  useEffect(() => {
    saveOnboardingDraft(draft);
  }, [draft, saveOnboardingDraft]);

  // The answers are sent once, when Composing opens: applied on the phone
  // first, then to the catalogue. They are read once per visit; a change after
  // the brief goes back through "Change an answer" and Composing again.
  useEffect(() => {
    if (step.id !== "composing") return;
    let cancelled = false;
    setSaveSettled(false);
    void commitStyleProfile({
      occasions: answers.occasions,
      styles: answers.styles,
      details: answers.details,
      apply: replaceStyleProfile,
      save: (occasions, styles, details) => saveStyleBrief(occasions, styles, details ?? {}),
    })
      .catch(() => {
        Alert.alert(
          "Saved on this phone",
          "Your answers are saved on this phone. WIST will sync them when it can reach the index.",
        );
      })
      .finally(() => {
        if (!cancelled) setSaveSettled(true);
      });
    return () => {
      cancelled = true;
    };
  }, [step.id]);

  const setAnswers = (updated: OnboardingAnswers) => setDraft((current) => ({ ...current, answers: updated }));
  const goTo = (stepIndex: number) => {
    setRound(0);
    setDraft((current) => ({ ...current, stepIndex }));
  };
  const next = () => goTo(Math.min(draft.stepIndex + 1, ONBOARDING_STEPS.length - 1));
  const back = () => goTo(Math.max(draft.stepIndex - 1, 0));

  const tasteAxis = step.id === "taste" ? TASTE_AXIS_OPTIONS[round] : undefined;
  const answerTaste = (answer: TasteAnswer) => {
    if (!tasteAxis) return;
    setAnswers({
      ...answers,
      details: { ...answers.details, tasteAxes: { ...answers.details.tasteAxes, [tasteAxis.id]: answer } },
    });
    if (round + 1 < TASTE_AXIS_OPTIONS.length) setRound(round + 1);
    else next();
  };

  // Houses are written when the reader moves on, so toggling stays on this
  // screen; continuing with none picked is the same as Skip (the one-time
  // follow runs after onboarding instead).
  const continueFromHouses = () => {
    if (answers.houseIds.length > 0) chooseFollows(answers.houseIds);
    next();
  };

  const finish = () => clearOnboardingDraft();
  const skipAll = () => {
    clearOnboardingDraft();
    if (profileStatus === "unknown") markProfileSkipped();
  };

  const covetedPieces = items.filter((item) => coveted.includes(item.id)).slice(0, MAX_REVEALED_PIECES);
  const houseNames = brands.filter((brand) => answers.houseIds.includes(brand.id)).map((brand) => brand.name);

  if (step.kind === "interlude") {
    const work = step.id === "interludeWork";
    return (
      <Interlude
        copy={work ? workInterlude(answers) : paletteInterlude(answers)}
        onBack={back}
        onContinue={next}
        photoKey={work ? `interlude.work.${answers.details.workDressCode ?? "any"}` : "interlude.palette"}
        shopsFor={shopsFor}
        swatches={work ? [] : paletteSwatches(answers)}
      />
    );
  }
  if (step.id === "composing") {
    return <Composing lines={composingLines(answers, houseNames, covetedPieces.length)} onDone={next} settled={saveSettled} />;
  }
  if (step.id === "brief") {
    return <BriefScreen answers={answers} coveted={covetedPieces.length} onChangeAnswer={() => goTo(0)} onShowEdit={next} />;
  }
  if (step.id === "reveal") {
    return <Reveal answers={answers} onOpen={finish} pieces={covetedPieces} />;
  }

  const renderQuestion = () => {
    switch (step.id) {
      case "taste":
        return tasteAxis ? <ThisOrThatRound axis={tasteAxis} onAnswer={answerTaste} round={round} shopsFor={shopsFor} /> : null;
      case "houses":
        return (
          <HousesStep
            brands={brands} catalogueStatus={catalogueStatus} items={items}
            onChange={(houseIds) => setAnswers({ ...answers, houseIds })} onReload={onReload} picked={answers.houseIds}
          />
        );
      case "covet":
        return (
          <CovetStep
            brands={brands} catalogueStatus={catalogueStatus} coveted={coveted} houseIds={answers.houseIds} items={items}
            onReload={onReload} onToggleCovet={(item) => onToggleCovet(item, answers.details.defaultSizes)} syncingIds={syncingIds}
          />
        );
      case "notify":
        return (
          <NotifyStep
            brands={brands}
            onAnswered={(notificationsAllowed) => {
              setAnswers({ ...answers, notificationsAllowed });
              next();
            }}
            sample={covetedPieces[0] ?? null}
          />
        );
      case "threshold":
        return <StepBody answers={answers} onChange={setAnswers} pieces={covetedPieces} step="threshold" />;
      default:
        return <StepBody answers={answers} onChange={setAnswers} step={step.id as AnswerStepId} />;
    }
  };

  const number = questionNumber(draft.stepIndex) ?? 0;
  return (
    <View style={flowStyles.screen}>
      <ScrollView contentContainerStyle={[flowStyles.content, pageStyle(layout, true), layout.wide && flowStyles.contentWide]}>
        <View style={flowStyles.topline}>
          {draft.stepIndex === 0 ? (
            <Wordmark />
          ) : (
            <ActionLink label="Back" onPress={tasteAxis && round > 0 ? () => setRound(round - 1) : back} />
          )}
          <Text accessibilityLabel={`Question ${number} of ${QUESTION_COUNT}`} style={flowStyles.counter}>
            {String(number).padStart(2, "0")} / {QUESTION_COUNT}
          </Text>
          <ActionLink color={colors.muted} label="Skip all" onPress={skipAll} />
        </View>
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={flowStyles.progress}>
          {Array.from({ length: QUESTION_COUNT }, (_, index) => (
            <View key={index} style={[flowStyles.segment, index < number && flowStyles.segmentDone]} />
          ))}
        </View>
        <View style={flowStyles.intro}>
          <Text style={flowStyles.kicker}>
            {(tasteAxis ? `${step.chapter} · Round ${round + 1} of ${TASTE_AXIS_OPTIONS.length}` : step.chapter ?? "").toUpperCase()}
          </Text>
          <Text accessibilityRole="header" style={flowStyles.title}>{tasteAxis?.question ?? step.title}</Text>
          {step.subtitle ? <Text style={flowStyles.subtitle}>{step.subtitle}</Text> : null}
        </View>
        <View style={flowStyles.body}>{renderQuestion()}</View>
      </ScrollView>
      <View style={flowStyles.footer}>
        {step.id === "taste" || step.id === "notify" ? null : (
          <View style={flowStyles.continue}>
            <Button color={colors.wine} label="Continue" onPress={step.id === "houses" ? continueFromHouses : next} />
          </View>
        )}
        {step.id === "notify" ? null : <ActionLink color={colors.muted} label="Skip this question" onPress={next} />}
      </View>
    </View>
  );
}

const flowStyles = StyleSheet.create({
  screen: { backgroundColor: colors.paper, flex: 1 },
  content: { paddingHorizontal: spacing.gutter, paddingVertical: 18 },
  // The content carries its own gutter, so on wide it takes the full wide gutter rather than summing with pageStyle.
  contentWide: { paddingHorizontal: spacing.gutterWide },
  topline: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", minHeight: 44 },
  counter: { ...typography.kicker },
  progress: { flexDirection: "row", gap: 3, marginTop: 6 },
  segment: { backgroundColor: colors.line, flex: 1, height: 2 },
  segmentDone: { backgroundColor: colors.wine },
  intro: { gap: 8, marginTop: 24 },
  kicker: { ...typography.kicker, color: colors.wine },
  title: { ...typography.titleL },
  subtitle: { ...typography.body },
  body: { marginTop: 22 },
  footer: { alignItems: "center", gap: 10, paddingHorizontal: spacing.gutter, paddingVertical: 14 },
  continue: { alignSelf: "stretch" },
});
