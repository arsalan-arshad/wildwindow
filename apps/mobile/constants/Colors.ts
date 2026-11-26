/**
 * WildWindow colour tokens (ARCHITECTURE mobile shell).
 * Forest green brand from the splash; light and dark both stay readable outdoors.
 */
export const palette = {
  forest: '#1a4030',
  forestMuted: '#2d5a45',
  moss: '#3d7a5a',
  sand: '#f3efe6',
  ink: '#14201a',
  mist: '#e8f0eb',
  cloud: '#f7faf8',
  night: '#0c1611',
  nightElevated: '#15241c',
  amber: '#c47a2c',
  danger: '#b42318',
} as const;

const tintColorLight = palette.forest;
const tintColorDark = '#8fd4b0';

export type ColorSchemeName = 'light' | 'dark';

export type ThemeColors = {
  text: string;
  textMuted: string;
  background: string;
  surface: string;
  border: string;
  tint: string;
  tabIconDefault: string;
  tabIconSelected: string;
  danger: string;
  accent: string;
};

const Colors: Record<ColorSchemeName, ThemeColors> = {
  light: {
    text: palette.ink,
    textMuted: '#4a5c52',
    background: palette.cloud,
    surface: '#ffffff',
    border: '#d5e0d9',
    tint: tintColorLight,
    tabIconDefault: '#8a9a90',
    tabIconSelected: tintColorLight,
    danger: palette.danger,
    accent: palette.amber,
  },
  dark: {
    text: '#eef5f0',
    textMuted: '#9bb0a4',
    background: palette.night,
    surface: palette.nightElevated,
    border: '#24352c',
    tint: tintColorDark,
    tabIconDefault: '#6b7f74',
    tabIconSelected: tintColorDark,
    danger: '#f97066',
    accent: '#e0a35a',
  },
};

export default Colors;
