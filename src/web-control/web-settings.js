function createWebSettingsController({ fields, saveButton, status, request }) {
  const state = {
    persistedSettings: {},
    draftSettings: {},
    dirtyFields: new Set(),
    conflictFields: new Set(),
    saving: false,
    pendingRemote: null,
    remoteRequestVersion: 0,
    initialized: false,
  };

  const normalizeValue = (key, value) => {
    const node = fields[key];
    return node?.type === "checkbox" ? Boolean(value) : String(value ?? "");
  };

  const normalizeSettings = (settings = {}) => {
    const normalized = {};
    Object.keys(fields).forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(settings, key)) {
        normalized[key] = normalizeValue(key, settings[key]);
      }
    });
    return normalized;
  };

  const readField = (key) => {
    const node = fields[key];
    return node.type === "checkbox" ? node.checked : node.value;
  };

  const writeField = (key, value) => {
    const node = fields[key];
    if (!node) return;
    if (node.type === "checkbox") node.checked = Boolean(value);
    else node.value = String(value ?? "");
  };

  const setStatus = (message = "", tone = "muted") => {
    status.textContent = message;
    status.dataset.tone = tone;
  };

  const renderControls = () => {
    Object.entries(state.draftSettings).forEach(([key, value]) => {
      writeField(key, value);
    });
    Object.values(fields).forEach((node) => {
      node.disabled = state.saving;
    });
    saveButton.disabled = state.saving || state.dirtyFields.size === 0;
    saveButton.classList.toggle("is-loading", state.saving);
    saveButton.setAttribute("aria-busy", state.saving ? "true" : "false");
  };

  const syncDirtyField = (key) => {
    const matches = state.draftSettings[key] === state.persistedSettings[key];
    if (matches) {
      state.dirtyFields.delete(key);
      state.conflictFields.delete(key);
    } else {
      state.dirtyFields.add(key);
    }
  };

  const replaceCanonical = (settings = {}) => {
    const canonical = normalizeSettings(settings);
    state.persistedSettings = { ...canonical };
    state.draftSettings = { ...canonical };
    state.dirtyFields.clear();
    state.conflictFields.clear();
    state.pendingRemote = null;
    state.initialized = true;
    renderControls();
  };

  const applyRemote = (settings = {}) => {
    const remote = normalizeSettings(settings);
    if (state.saving) {
      state.pendingRemote = remote;
      return;
    }
    if (!state.initialized) {
      replaceCanonical(remote);
      return;
    }

    Object.entries(remote).forEach(([key, value]) => {
      const previous = state.persistedSettings[key];
      state.persistedSettings[key] = value;
      if (!state.dirtyFields.has(key)) {
        state.draftSettings[key] = value;
        return;
      }
      if (state.draftSettings[key] === value) {
        state.dirtyFields.delete(key);
        state.conflictFields.delete(key);
      } else if (previous !== value) {
        state.conflictFields.add(key);
      }
    });
    renderControls();
    if (state.conflictFields.size > 0) {
      setStatus(
        "Настройки изменились в основном приложении. Ваши изменения сохранены.",
        "warning",
      );
    } else {
      setStatus(
        state.dirtyFields.size > 0 ? "Есть несохранённые изменения" : "",
        "muted",
      );
    }
  };

  const refreshRemote = async () => {
    const requestVersion = ++state.remoteRequestVersion;
    const { settings } = await request("/api/settings");
    if (requestVersion !== state.remoteRequestVersion) return null;
    applyRemote(settings);
    return settings;
  };

  const serializePatchValue = (key, value) => {
    if (key === "parallelLimit") return Number(value);
    return value;
  };

  const save = async () => {
    if (state.saving || state.dirtyFields.size === 0) return false;
    const patch = {};
    state.dirtyFields.forEach((key) => {
      patch[key] = serializePatchValue(key, state.draftSettings[key]);
    });
    state.saving = true;
    state.remoteRequestVersion += 1;
    renderControls();
    setStatus("Сохранение…", "loading");
    try {
      const { result } = await request("/api/settings", {
        method: "POST",
        body: JSON.stringify(patch),
      });
      state.saving = false;
      replaceCanonical(result);
      setStatus("Сохранено", "success");
      return true;
    } catch (_error) {
      state.saving = false;
      const pending = state.pendingRemote;
      state.pendingRemote = null;
      if (pending) applyRemote(pending);
      try {
        await refreshRemote();
      } catch {}
      renderControls();
      setStatus("Не удалось сохранить. Изменения не потеряны.", "error");
      return false;
    }
  };

  const cancel = () => {
    state.draftSettings = { ...state.persistedSettings };
    state.dirtyFields.clear();
    state.conflictFields.clear();
    state.pendingRemote = null;
    renderControls();
    setStatus();
  };

  Object.entries(fields).forEach(([key, node]) => {
    const updateDraft = () => {
      state.draftSettings[key] = normalizeValue(key, readField(key));
      syncDirtyField(key);
      renderControls();
      setStatus(
        state.dirtyFields.size > 0 ? "Есть несохранённые изменения" : "",
        "muted",
      );
    };
    node.addEventListener("input", updateDraft);
    node.addEventListener("change", updateDraft);
  });

  renderControls();
  return {
    applyRemote,
    cancel,
    getState: () => state,
    isDirty: () => state.dirtyFields.size > 0,
    refreshRemote,
    save,
  };
}

function bindSettingsBeforeUnload(isDirty, target = window) {
  const handler = (event) => {
    if (!isDirty()) return;
    event.preventDefault();
    event.returnValue = "";
  };
  target.addEventListener("beforeunload", handler);
  return () => target.removeEventListener("beforeunload", handler);
}

const settingsApi = { bindSettingsBeforeUnload, createWebSettingsController };
if (typeof module !== "undefined") module.exports = settingsApi;
if (typeof window !== "undefined") window.WebSettings = settingsApi;
