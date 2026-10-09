import { useEffect, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { garmentPhotoSource } from "../services/catalogueClient";
import { colors, fonts } from "../theme";
import type { Garment } from "../types";

export function GarmentPhoto({ garment }: { garment: Garment }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [garment.id, garment.photoUrl]);
  const source = garmentPhotoSource(garment);
  return (
    <View style={styles.frame}>
      {source && !failed ? (
        <Image accessibilityLabel={garment.name} source={source} resizeMode="cover"
          onError={() => setFailed(true)} style={styles.image} />
      ) : <Text style={styles.placeholder}>{source ? "Photo unavailable" : "No photo"}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { aspectRatio: 4 / 5, backgroundColor: colors.wash, borderRadius: 20,
    overflow: "hidden", alignItems: "center", justifyContent: "center", width: "100%" },
  image: { width: "100%", height: "100%" },
  placeholder: { color: colors.muted, fontFamily: fonts.text, fontSize: 12 },
});
