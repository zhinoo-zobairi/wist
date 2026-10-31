import { useEffect, useState } from "react";
import { Image, type StyleProp, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { colors, typography } from "../theme";

type Props = {
  uri: string;
  // The caller sizes the frame: every list crops its photos differently.
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  // For frames too small for the caption: a failed photo leaves only the wash.
  compact?: boolean;
};

export function ProductPhoto({ accessibilityLabel, compact = false, style, uri }: Props) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [uri]);
  return (
    <View style={[styles.frame, style]}>
      {!failed ? (
        // Only a labelled photo is a VoiceOver stop; inside a labelled button it stays silent.
        <Image accessible={accessibilityLabel !== undefined} accessibilityLabel={accessibilityLabel} onError={() => setFailed(true)} resizeMode="cover"
          source={{ uri }} style={StyleSheet.absoluteFill} />
      ) : compact ? null : <Text style={styles.placeholder}>Photo unavailable</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { alignItems: "center", backgroundColor: colors.wash, justifyContent: "center", overflow: "hidden" },
  placeholder: { ...typography.caption, paddingHorizontal: 8, textAlign: "center" },
});
