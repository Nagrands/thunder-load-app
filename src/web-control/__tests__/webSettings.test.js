const {
  bindSettingsBeforeUnload,
  createWebSettingsController,
} = require("../web-settings.js");

function setup(request = jest.fn()) {
  document.body.innerHTML = `
    <input id="toggle" type="checkbox" />
    <select id="theme"><option value="dark">Dark</option><option value="violet">Violet</option><option value="sunset">Sunset</option></select>
    <select id="language"><option value="ru">RU</option><option value="en">EN</option></select>
    <input id="path" type="text" />
    <select id="parallel"><option value="1">1</option><option value="2">2</option></select>
    <button id="save"></button>
    <span id="status"></span>
  `;
  const fields = {
    enabled: document.getElementById("toggle"),
    theme: document.getElementById("theme"),
    language: document.getElementById("language"),
    downloadPath: document.getElementById("path"),
    parallelLimit: document.getElementById("parallel"),
  };
  const controller = createWebSettingsController({
    fields,
    saveButton: document.getElementById("save"),
    status: document.getElementById("status"),
    request,
  });
  return {
    controller,
    fields,
    request,
    save: document.getElementById("save"),
    status: document.getElementById("status"),
  };
}

function change(node, value) {
  if (node.type === "checkbox") node.checked = value;
  else node.value = value;
  node.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("web settings controller", () => {
  const initial = {
    enabled: false,
    theme: "dark",
    language: "ru",
    downloadPath: "/downloads",
    parallelLimit: 1,
  };

  it("preserves dirty toggles, theme and language during remote sync", () => {
    const { controller, fields, save } = setup();
    controller.applyRemote(initial);
    change(fields.enabled, true);
    change(fields.theme, "violet");
    change(fields.language, "en");

    controller.applyRemote({ ...initial, downloadPath: "/new-downloads" });

    expect(fields.enabled.checked).toBe(true);
    expect(fields.theme.value).toBe("violet");
    expect(fields.language.value).toBe("en");
    expect(fields.downloadPath.value).toBe("/new-downloads");
    expect(save.disabled).toBe(false);
  });

  it("marks same-field remote changes as conflicts without losing the draft", () => {
    const { controller, fields, status } = setup();
    controller.applyRemote(initial);
    change(fields.theme, "violet");

    controller.applyRemote({ ...initial, theme: "sunset", language: "en" });

    expect(fields.theme.value).toBe("violet");
    expect(fields.language.value).toBe("en");
    expect(controller.getState().conflictFields.has("theme")).toBe(true);
    expect(status.dataset.tone).toBe("warning");
  });

  it("uses the latest persisted state when canceling", () => {
    const { controller, fields, save } = setup();
    controller.applyRemote(initial);
    change(fields.theme, "violet");
    controller.applyRemote({ ...initial, language: "en" });

    controller.cancel();

    expect(fields.theme.value).toBe("dark");
    expect(fields.language.value).toBe("en");
    expect(save.disabled).toBe(true);
  });

  it("saves only dirty fields and adopts the canonical response", async () => {
    const request = jest.fn().mockResolvedValue({
      result: { ...initial, theme: "violet" },
    });
    const { controller, fields, save } = setup(request);
    controller.applyRemote(initial);
    change(fields.theme, "violet");
    change(fields.parallelLimit, "2");

    await controller.save();

    expect(request).toHaveBeenCalledWith("/api/settings", {
      method: "POST",
      body: JSON.stringify({ theme: "violet", parallelLimit: 2 }),
    });
    expect(controller.isDirty()).toBe(false);
    expect(save.disabled).toBe(true);
  });

  it("keeps the draft after a save error", async () => {
    const request = jest
      .fn()
      .mockRejectedValueOnce(new Error("failed"))
      .mockResolvedValueOnce({ settings: initial });
    const { controller, fields, status } = setup(request);
    controller.applyRemote(initial);
    change(fields.language, "en");

    await controller.save();

    expect(fields.language.value).toBe("en");
    expect(controller.isDirty()).toBe(true);
    expect(status.dataset.tone).toBe("error");
  });

  it("ignores a settings response that started before a successful save", async () => {
    let resolveStale;
    const staleResponse = new Promise((resolve) => {
      resolveStale = resolve;
    });
    const request = jest.fn((path, options = {}) => {
      if (path === "/api/settings" && !options.method) return staleResponse;
      return Promise.resolve({ result: { ...initial, theme: "violet" } });
    });
    const { controller, fields } = setup(request);
    controller.applyRemote(initial);
    change(fields.theme, "violet");
    const staleRefresh = controller.refreshRemote();

    await controller.save();
    resolveStale({ settings: initial });
    await staleRefresh;

    expect(fields.theme.value).toBe("violet");
    expect(controller.isDirty()).toBe(false);
  });

  it("guards browser unload only while the draft is dirty", () => {
    let dirty = false;
    const unbind = bindSettingsBeforeUnload(() => dirty);
    const cleanEvent = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(cleanEvent);
    expect(cleanEvent.defaultPrevented).toBe(false);

    dirty = true;
    const dirtyEvent = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(dirtyEvent);
    expect(dirtyEvent.defaultPrevented).toBe(true);
    unbind();
  });
});
