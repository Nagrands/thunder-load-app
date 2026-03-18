const OPEN_SETTINGS_HANDLERS_KEY = "__thunder_open_settings_handlers__";
const OPEN_SETTINGS_DISPATCH_READY_KEY =
  "__thunder_open_settings_dispatch_ready__";

export function onOpenSettings(listenerKey, handler) {
  const subscribe = window?.electron?.on;
  if (typeof subscribe !== "function" || typeof handler !== "function") return;

  const handlers =
    window[OPEN_SETTINGS_HANDLERS_KEY] ||
    (window[OPEN_SETTINGS_HANDLERS_KEY] = new Map());
  handlers.set(listenerKey, handler);

  if (window[OPEN_SETTINGS_DISPATCH_READY_KEY]) return;

  subscribe("open-settings", (...args) => {
    for (const [key, listener] of handlers.entries()) {
      try {
        listener(...args);
      } catch (error) {
        console.error(
          `[settings] open-settings handler error (${key}):`,
          error,
        );
      }
    }
  });
  window[OPEN_SETTINGS_DISPATCH_READY_KEY] = true;
}

export function clearOpenSettingsHandlers() {
  const handlers = window?.[OPEN_SETTINGS_HANDLERS_KEY];
  if (handlers && typeof handlers.clear === "function") {
    handlers.clear();
  }
}
