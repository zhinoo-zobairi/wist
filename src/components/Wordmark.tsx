import { StyleSheet, Text } from "react-native";

import { typography } from "../theme";

export function Wordmark({ color }: { color?: string }) {
  return (
    <Text accessibilityRole="header" style={[styles.wordmark, color ? { color } : null]}>
      WIST
    </Text>
  );
}

const styles = StyleSheet.create({
  wordmark: typography.wordmark,
});
