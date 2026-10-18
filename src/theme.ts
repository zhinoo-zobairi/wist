export const colors = {
  paper: "#F4F1EB",
  card: "#FFFFFF",
  ink: "#181715",
  muted: "#77736C",
  line: "#DCD7CE",
  wine: "#A52A37",
  ring: "#B6A88C",
  moss: "#4E5748",
  wash: "#E9E4DC",
  // Text and rules on a wine block.
  onWineMuted: "#E7BEC3",
  onWineSoft: "#F2DADD",
  onWineLine: "#C86570",
  // Text on a moss block.
  onMossMuted: "#C9D0C4",
  onMossSoft: "#D8DDD4",
} as const;

export const fonts = {
  display: "CormorantGaramond_600SemiBold",
  displayItalic: "CormorantGaramond_600SemiBold_Italic",
  text: "Inter_400Regular",
  textMedium: "Inter_500Medium",
  textSemibold: "Inter_600SemiBold",
} as const;

export const radii = {
  card: 3,
  pill: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 14,
  lg: 20,
  xl: 28,
  gutter: 22,
} as const;

// Named text styles. Screens spread these and may override colour:
//   kicker: { ...typography.kicker, color: colors.wine }
// Nothing in the app sits below 10 px.
export const typography = {
  wordmark: { fontFamily: fonts.display, fontSize: 22, letterSpacing: 4, color: colors.ink },
  kicker: { fontFamily: fonts.textSemibold, fontSize: 10, letterSpacing: 1.6, color: colors.muted },
  label: { fontFamily: fonts.textSemibold, fontSize: 10, letterSpacing: 1.2, color: colors.ink },
  caption: { fontFamily: fonts.text, fontSize: 11, lineHeight: 16, color: colors.muted },
  body: { fontFamily: fonts.text, fontSize: 13, lineHeight: 20, color: colors.muted },
  price: { fontFamily: fonts.textSemibold, fontSize: 13, color: colors.ink },
  titleXL: { fontFamily: fonts.display, fontSize: 44, lineHeight: 46, color: colors.ink },
  titleL: { fontFamily: fonts.display, fontSize: 28, lineHeight: 32, color: colors.ink },
  titleM: { fontFamily: fonts.display, fontSize: 20, lineHeight: 22, color: colors.ink },
  titleS: { fontFamily: fonts.display, fontSize: 18, lineHeight: 20, color: colors.ink },
} as const;
