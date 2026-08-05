import { StyleSheet, Text, View } from "react-native";

import type { Brand } from "../types";
import { colors, fonts } from "../theme";

type Props = {
  brand: Brand;
  size?: "small" | "large";
};

export function BrandAvatar({ brand, size = "large" }: Props) {
  const isSmall = size === "small";

  return (
    <View style={[styles.avatar, isSmall ? styles.small : styles.large]}>
      <Text style={[styles.monogram, isSmall ? styles.smallText : styles.largeText]}>
        {brand.monogram}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: "center",
    backgroundColor: colors.card,
    borderColor: colors.ring,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: "center",
  },
  large: {
    height: 60,
    width: 60,
  },
  small: {
    height: 34,
    width: 34,
  },
  monogram: {
    color: colors.ink,
    fontFamily: fonts.display,
  },
  largeText: {
    fontSize: 22,
  },
  smallText: {
    fontSize: 15,
  },
});
