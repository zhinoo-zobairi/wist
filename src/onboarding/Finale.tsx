import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { ActionLink } from "../components/ActionLink";
import { Button } from "../components/Button";
import { ProductPhoto } from "../components/ProductPhoto";
import { Wordmark } from "../components/Wordmark";
import { formatPrice } from "../money";
import { briefHeadline, briefPromises, briefRows, revealSummary, type InterludeCopy } from "../onboardingCopy";
import { useWistStore } from "../store/useWistStore";
import { colors, fonts, spacing, typography } from "../theme";
import type { Item, OnboardingAnswers, ShopsFor } from "../types";
import { PhotoFrame } from "./inputs";

/** How long each Composing line waits before the next appears. */
const LINE_INTERVAL_MS = 450;

export function Interlude({ copy, onBack, onContinue, photoKey, shopsFor, swatches }: {
  copy: InterludeCopy;
  onBack: () => void;
  onContinue: () => void;
  photoKey: string;
  shopsFor: ShopsFor | null;
  swatches: string[];
}) {
  return (
    <View style={finaleStyles.screen}>
      <PhotoFrame fallback="" photoKey={photoKey} shopsFor={shopsFor} style={finaleStyles.interludePhoto} />
      <View style={finaleStyles.interludeCopy}>
        <ActionLink label="Back" onPress={onBack} />
        <Text style={finaleStyles.kicker}>{copy.kicker.toUpperCase()}</Text>
        <Text accessibilityRole="header" style={finaleStyles.title}>{copy.title}</Text>
        {swatches.length > 0 ? (
          <View style={finaleStyles.swatches}>
            {swatches.map((hex) => <View key={hex} style={[finaleStyles.swatch, { backgroundColor: hex }]} />)}
          </View>
        ) : null}
        <Text style={finaleStyles.body}>{copy.body}</Text>
        <Button color={colors.wine} label="Keep going" onPress={onContinue} />
      </View>
    </View>
  );
}

/** Shows the lines one by one, then opens the brief once the save has settled. */
export function Composing({ lines, onDone, settled }: { lines: string[]; onDone: () => void; settled: boolean }) {
  const [shown, setShown] = useState(1);
  const done = useRef(false);
  const allShown = shown >= lines.length;
  const finish = () => {
    if (done.current || !settled) return;
    done.current = true;
    onDone();
  };

  useEffect(() => {
    if (allShown) return;
    const timer = setTimeout(() => setShown((count) => count + 1), LINE_INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [allShown, shown]);

  useEffect(() => {
    if (allShown && settled) finish();
  }, [allShown, settled]);

  return (
    <Pressable accessibilityHint="Opens your style brief" accessibilityRole="button" accessibilityState={{ disabled: !settled }} onPress={finish} style={finaleStyles.composing}>
      <Wordmark />
      <View style={finaleStyles.composingCopy}>
        <Text style={finaleStyles.kicker}>A MOMENT</Text>
        <Text accessibilityRole="header" style={finaleStyles.title}>Composing your edit…</Text>
        {lines.slice(0, shown).map((line) => <Text key={line} style={finaleStyles.line}>{line}</Text>)}
      </View>
      <Text style={finaleStyles.hint}>{settled ? "Opens by itself · tap to skip" : "Saving your answers…"}</Text>
    </Pressable>
  );
}

export function BriefScreen({ answers, coveted, onChangeAnswer, onShowEdit }: {
  answers: OnboardingAnswers;
  coveted: number;
  onChangeAnswer: () => void;
  onShowEdit: () => void;
}) {
  return (
    <ScrollView contentContainerStyle={finaleStyles.content} style={finaleStyles.screen}>
      <View style={finaleStyles.topline}>
        <Wordmark />
        <ActionLink color={colors.muted} label="Change an answer" onPress={onChangeAnswer} />
      </View>
      <Text style={finaleStyles.kicker}>N° 02 · YOUR STYLE BRIEF</Text>
      <Text accessibilityRole="header" style={finaleStyles.title}>{briefHeadline(answers)}</Text>
      <View style={finaleStyles.rows}>
        {briefRows(answers).map((row) => (
          <View key={row.label} style={finaleStyles.row}>
            <Text style={finaleStyles.rowLabel}>{row.label.toUpperCase()}</Text>
            <Text style={finaleStyles.rowValue}>{row.value}</Text>
          </View>
        ))}
      </View>
      <Text style={finaleStyles.sectionLabel}>WHAT WIST WILL DO FOR YOU</Text>
      {briefPromises(answers, coveted).map((promise, index) => (
        <View key={promise} style={finaleStyles.promise}>
          <Text style={finaleStyles.promiseNumber}>{String(index + 1).padStart(2, "0")}</Text>
          <Text style={finaleStyles.promiseText}>{promise}</Text>
        </View>
      ))}
      <View style={finaleStyles.footer}><Button label="Show my edit" onPress={onShowEdit} /></View>
    </ScrollView>
  );
}

export function Reveal({ answers, onOpen, pieces }: { answers: OnboardingAnswers; onOpen: () => void; pieces: Item[] }) {
  const watchedSizes = useWistStore((state) => state.watchedSizesByItemId);
  return (
    <ScrollView contentContainerStyle={finaleStyles.content} style={finaleStyles.screen}>
      <PhotoFrame fallback="" photoKey="reveal" shopsFor={answers.details.shopsFor} style={finaleStyles.revealPhoto} />
      <Text style={finaleStyles.kicker}>N° 02 · YOUR EDIT</Text>
      <Text accessibilityRole="header" style={finaleStyles.title}>Your edit is ready.</Text>
      <Text style={finaleStyles.body}>{revealSummary(answers)}</Text>
      {pieces.length > 0 ? (
        <>
          <Text style={finaleStyles.sectionLabel}>
            WIST IS WATCHING {pieces.length} {pieces.length === 1 ? "PIECE" : "PIECES"} FOR YOU
          </Text>
          <View style={finaleStyles.pieces}>
            {pieces.map((piece) => {
              const sizes = watchedSizes[piece.id] ?? [];
              return (
                <View key={piece.id} style={finaleStyles.piece}>
                  <ProductPhoto accessibilityLabel={piece.name} compact style={finaleStyles.piecePhoto} uri={piece.imageUrl} />
                  <Text style={finaleStyles.piecePrice}>
                    {formatPrice(piece.currentPrice, piece.currency)}{sizes.length > 0 ? ` · ${sizes.join(", ")}` : ""}
                  </Text>
                </View>
              );
            })}
          </View>
        </>
      ) : null}
      <View style={finaleStyles.footer}><Button color={colors.wine} label="Open your edit" onPress={onOpen} /></View>
    </ScrollView>
  );
}

const finaleStyles = StyleSheet.create({
  screen: { backgroundColor: colors.paper, flex: 1 },
  content: { gap: 12, paddingHorizontal: spacing.gutter, paddingVertical: 18 },
  topline: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", minHeight: 44 },
  kicker: { ...typography.kicker, color: colors.wine, marginTop: 8 },
  title: { ...typography.titleL },
  body: { ...typography.body },
  interludePhoto: { borderRadius: 0, flex: 1 },
  interludeCopy: { gap: 10, padding: spacing.gutter },
  swatches: { flexDirection: "row", gap: 6 },
  swatch: { borderColor: colors.line, borderRadius: 3, borderWidth: StyleSheet.hairlineWidth, height: 28, width: 28 },
  composing: { backgroundColor: colors.paper, flex: 1, justifyContent: "space-between", padding: spacing.gutter },
  composingCopy: { gap: 12 },
  line: { ...typography.body, color: colors.ink },
  hint: { ...typography.kicker, textAlign: "center" },
  rows: { backgroundColor: colors.card, borderColor: colors.line, borderRadius: 3, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 4 },
  row: { borderBottomColor: colors.line, borderBottomWidth: 1, flexDirection: "row", gap: 12, paddingVertical: 8 },
  rowLabel: { ...typography.kicker, flexBasis: 82, paddingTop: 3 },
  rowValue: { color: colors.ink, flex: 1, fontFamily: fonts.text, fontSize: 15, lineHeight: 19 },
  sectionLabel: { ...typography.kicker, marginTop: 8 },
  promise: { flexDirection: "row", gap: 10 },
  promiseNumber: { ...typography.kicker, color: colors.moss, paddingTop: 4 },
  promiseText: { color: colors.ink, flex: 1, fontFamily: fonts.text, fontSize: 16, lineHeight: 20 },
  revealPhoto: { aspectRatio: 4 / 5 },
  pieces: { flexDirection: "row", gap: 8 },
  piece: { flexBasis: "31%", gap: 4 },
  piecePhoto: { aspectRatio: 3 / 4 },
  piecePrice: { ...typography.price, fontSize: 14 },
  footer: { marginTop: 16 },
});
