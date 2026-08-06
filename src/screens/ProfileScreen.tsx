import { Pressable, StyleSheet, Text, View } from "react-native";

import { seedBrands } from "../data/seed";
import { useCovetStore } from "../store/useCovetStore";
import { colors, fonts } from "../theme";

export function ProfileScreen() {
  const followed = useCovetStore((state) => state.followedBrandIds);
  const toggleFollow = useCovetStore((state) => state.toggleFollow);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.kicker}>YOUR TASTE, IN PROGRESS</Text>
        <Text style={styles.title}>Profile</Text>
        <Text style={styles.subtitle}>The preferences COVET uses to shape your edit.</Text>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>FOLLOWED HOUSES · {followed.length}</Text>
        {seedBrands.map((brand, index) => {
          const selected = followed.includes(brand.id);
          return (
            <View key={brand.id} style={styles.row}>
              <Text style={styles.index}>0{index + 1}</Text>
              <View style={styles.monogram}><Text style={styles.monogramText}>{brand.monogram}</Text></View>
              <Text style={styles.brand}>{brand.name}</Text>
              <Pressable onPress={() => toggleFollow(brand.id)}>
                <Text style={[styles.action, !selected && styles.follow]}>{selected ? "FOLLOWING" : "FOLLOW"}</Text>
              </Pressable>
            </View>
          );
        })}
      </View>
      <View style={styles.note}>
        <Text style={styles.noteLabel}>HOW COVET LEARNS</Text>
        <Text style={styles.noteTitle}>Every choice sharpens the edit.</Text>
        <Text style={styles.noteBody}>Following a house and coveting a piece are the signals available in this first version.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.paper, flex: 1 },
  header: { paddingBottom: 29, paddingHorizontal: 22, paddingTop: 12 },
  kicker: { color: colors.muted, fontFamily: fonts.textSemibold, fontSize: 8, letterSpacing: 1.8 },
  title: { color: colors.ink, fontFamily: fonts.display, fontSize: 45, lineHeight: 49, marginTop: 3 },
  subtitle: { color: colors.muted, fontFamily: fonts.text, fontSize: 12, marginTop: 5 },
  section: { borderTopColor: colors.ink, borderTopWidth: 1, marginHorizontal: 22 },
  sectionLabel: { color: colors.muted, fontFamily: fonts.textSemibold, fontSize: 8, letterSpacing: 1.4, paddingVertical: 14 },
  row: { alignItems: "center", borderTopColor: colors.line, borderTopWidth: 1, flexDirection: "row", minHeight: 68 },
  index: { color: colors.muted, fontFamily: fonts.text, fontSize: 8, width: 25 },
  monogram: { alignItems: "center", borderColor: colors.ring, borderWidth: 1, height: 36, justifyContent: "center", width: 36 },
  monogramText: { color: colors.ink, fontFamily: fonts.display, fontSize: 15 },
  brand: { color: colors.ink, flex: 1, fontFamily: fonts.display, fontSize: 20, paddingLeft: 13 },
  action: { color: colors.muted, fontFamily: fonts.textSemibold, fontSize: 8, letterSpacing: 1.1 },
  follow: { color: colors.wine },
  note: { backgroundColor: colors.moss, marginHorizontal: 14, marginTop: 35, padding: 22 },
  noteLabel: { color: "#C9D0C4", fontFamily: fonts.textSemibold, fontSize: 8, letterSpacing: 1.4 },
  noteTitle: { color: colors.card, fontFamily: fonts.display, fontSize: 25, marginTop: 7 },
  noteBody: { color: "#D8DDD4", fontFamily: fonts.text, fontSize: 11, lineHeight: 17, marginTop: 6 },
});
