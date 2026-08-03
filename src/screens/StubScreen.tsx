import { StyleSheet, Text, View } from "react-native";

import { colors, fonts } from "../theme";

type Props = {
  title: string;
  body: string;
};

export function StubScreen({ title, body }: Props) {
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    alignItems: "center",
    backgroundColor: colors.paper,
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 48,
  },
  title: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 30,
  },
  body: {
    color: colors.muted,
    fontFamily: fonts.text,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 6,
    textAlign: "center",
  },
});
