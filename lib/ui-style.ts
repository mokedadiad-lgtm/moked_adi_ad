export type UiStyle = "fresh" | "classic";

export const UI_STYLE_STORAGE_KEY = "ui-style";
export const UI_STYLE_DEFAULT: UiStyle = "fresh";

export function parseUiStyle(value: string | null | undefined): UiStyle {
  return value === "classic" ? "classic" : "fresh";
}

export function uiStyleLabel(style: UiStyle): string {
  return style === "classic" ? "עיצוב ישן" : "עיצוב חדש";
}
