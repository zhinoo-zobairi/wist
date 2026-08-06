import Svg, { Circle, Line, Path } from "react-native-svg";

import { colors } from "../theme";

export type IconName =
  | "search"
  | "bell"
  | "star"
  | "share"
  | "bookmark"
  | "heart"
  | "arrow"
  | "home"
  | "user";

type Props = {
  color: string;
  filled?: boolean;
  name: IconName;
  size?: number;
};

export function Icon({ color, filled = false, name, size = 22 }: Props) {
  const isFilledSave = (name === "star" || name === "heart") && filled;
  const iconColor = isFilledSave ? colors.wine : color;
  const strokeWidth = ["search", "bell", "home", "user"].includes(name)
    ? 1.6
    : 1.5;

  const paths = {
    search: (
      <>
        <Circle cx={11} cy={11} r={7} />
        <Line x1={16.5} x2={21} y1={16.5} y2={21} />
      </>
    ),
    bell: (
      <>
        <Path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6" />
        <Path d="M10 20a2 2 0 0 0 4 0" />
      </>
    ),
    star: (
      <Path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z" />
    ),
    share: (
      <>
        <Path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" />
        <Path d="M12 15V3" />
        <Path d="M8 7l4-4 4 4" />
      </>
    ),
    bookmark: <Path d="M6 4h12v16l-6-4-6 4z" />,
    heart: <Path d="M20.8 5.8c-1.8-1.8-4.8-1.8-6.6 0L12 8l-2.2-2.2a4.7 4.7 0 0 0-6.6 6.6L12 21l8.8-8.6a4.7 4.7 0 0 0 0-6.6z" />,
    arrow: (
      <>
        <Path d="M5 12h14" />
        <Path d="M14 7l5 5-5 5" />
      </>
    ),
    home: <Path d="M4 11l8-6 8 6v8a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1z" />,
    user: (
      <>
        <Circle cx={12} cy={8} r={4} />
        <Path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
      </>
    ),
  } satisfies Record<IconName, React.ReactNode>;

  return (
    <Svg
      color={iconColor}
      fill={isFilledSave ? "currentColor" : "none"}
      height={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={strokeWidth}
      viewBox="0 0 24 24"
      width={size}
    >
      {paths[name]}
    </Svg>
  );
}
