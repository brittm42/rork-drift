const palette = {
  cream: "#F5F1E8",
  creamSoft: "#EDE7D9",
  paper: "#FBF8F1",
  ink: "#1C2620",
  inkSoft: "#4A554E",
  inkMuted: "#8A928B",
  inkFaint: "#B5BAB4",
  sage: "#8FA896",
  sageDeep: "#3E5B48",
  sageDark: "#2B4434",
  forest: "#1E3226",
  amber: "#C98A3C",
  urgent: "#B4593A",
  border: "#E3DDCE",
  borderSoft: "#EFEADC",
  tabIconDefault: "#B5BAB4",
  tabIconSelected: "#3E5B48",
};

export const Colors = {
  ...palette,
  text: palette.ink,
  background: palette.paper,
  tint: palette.sageDeep,
  tabIconDefault: palette.inkFaint,
  tabIconSelected: palette.sageDeep,
};

export default {
  light: {
    text: palette.ink,
    background: palette.paper,
    tint: palette.sageDeep,
    tabIconDefault: palette.inkFaint,
    tabIconSelected: palette.sageDeep,
  },
  ...palette,
};
