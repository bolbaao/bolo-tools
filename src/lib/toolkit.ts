export const TOOLKIT_OPEN_EVENT = "pineapple:toolkit-open";

export type ToolkitOpenDetail = {
  filterCategory?: string;
};

export function openToolkit(detail?: ToolkitOpenDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(TOOLKIT_OPEN_EVENT, { detail }));
}
