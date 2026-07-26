export const PLAYER_SETTINGS_APPLY_EVENT = "now-playing:settings-apply";
export const PLAYER_SETTINGS_STATE_EVENT = "now-playing:settings-state";

function dispatch(name, settings) {
  window.dispatchEvent(
    new CustomEvent(name, {
      detail: { ...settings },
    }),
  );
}

export function applyPlayerSettings(settings) {
  dispatch(PLAYER_SETTINGS_APPLY_EVENT, settings);
}

export function publishPlayerSettings(settings) {
  dispatch(PLAYER_SETTINGS_STATE_EVENT, settings);
}

export function onPlayerSettingsApply(handler) {
  window.addEventListener(PLAYER_SETTINGS_APPLY_EVENT, handler);
  return () => window.removeEventListener(PLAYER_SETTINGS_APPLY_EVENT, handler);
}

export function onPlayerSettingsState(handler) {
  window.addEventListener(PLAYER_SETTINGS_STATE_EVENT, handler);
  return () => window.removeEventListener(PLAYER_SETTINGS_STATE_EVENT, handler);
}
