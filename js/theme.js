export const ACCENTS = [
  { id: "gold", color: "#e8a87c", labelKey: "accentGold" },
  { id: "blue", color: "#5b9dff", labelKey: "accentBlue" },
  { id: "red", color: "#c44545", labelKey: "accentRed" },
  { id: "teal", color: "#2ec4b6", labelKey: "accentTeal" },
  { id: "orange", color: "#f08a4b", labelKey: "accentOrange" },
  { id: "violet", color: "#b794f6", labelKey: "accentViolet" },
];

const ACCENT_IDS = new Set(ACCENTS.map((item) => item.id));
const DARK_THEME_COLOR = "#0F1419";
const LIGHT_THEME_COLOR = "#F4EDE4";

export function normalizeAppearance(value) {
  return value === "light" ? "light" : "dark";
}

export function normalizeAccent(value) {
  return ACCENT_IDS.has(value) ? value : "gold";
}

export function applyTheme(settings) {
  const appearance = normalizeAppearance(settings?.appearance);
  const accent = normalizeAccent(settings?.accent);
  const root = document.documentElement;
  root.dataset.theme = appearance;
  root.dataset.accent = accent;
  root.style.colorScheme = appearance;
  const themeColor = document.querySelector('meta[name="theme-color"]');
  if (themeColor) {
    themeColor.setAttribute("content", appearance === "light" ? LIGHT_THEME_COLOR : DARK_THEME_COLOR);
  }
  const status = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
  if (status) {
    status.setAttribute("content", appearance === "light" ? "default" : "black-translucent");
  }
}
