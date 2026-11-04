export const DEFAULTS = Object.freeze({ enabled: true, highlightWater: false });
export function sanitize(value = {}) {
  return {
    enabled: typeof value.enabled === 'boolean' ? value.enabled : DEFAULTS.enabled,
    highlightWater: typeof value.highlightWater === 'boolean' ? value.highlightWater : DEFAULTS.highlightWater,
  };
}
export async function readSettings() {
  try { return sanitize(await chrome.storage.local.get(DEFAULTS)); }
  catch { return { ...DEFAULTS }; }
}
