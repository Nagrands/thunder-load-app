/** @jest-environment jsdom */

describe("i18n translations split", () => {
  beforeEach(() => {
    jest.resetModules();
    localStorage.clear();
    document.body.innerHTML = "";
    delete window.__i18nReloading;
  });

  test("keeps translations accessible after split", async () => {
    const { translations } = await import("../../i18n/translations.js");

    expect(Object.keys(translations.ru).length).toBe(
      Object.keys(translations.en).length,
    );
    expect(translations.ru["backup.hints.title"]).toBe("Советы");
    expect(translations.en["backup.hints.title"]).toBe("Tips");
    expect(translations.ru["update.flyover.done.title"]).toBe(
      "Обновление загружено",
    );
    expect(translations.en["wg.autoShutdown.toast.cancel"]).toBe(
      "Cancel shutdown",
    );
  });

  test("t and applyI18n work with merged translation sections", async () => {
    const { applyI18n, setLanguagePreview, t } = await import("../i18n.js");

    document.body.innerHTML = `
      <button id="btn" data-i18n-title="backup.common.hide"></button>
      <span id="text" data-i18n="backup.hints.title"></span>
      <input id="field" data-i18n-placeholder="input.url.placeholder" />
    `;

    applyI18n(document);
    expect(document.getElementById("text")?.textContent).toBe("Советы");
    expect(document.getElementById("btn")?.getAttribute("title")).toBe(
      "Скрыть",
    );
    expect(document.getElementById("field")?.getAttribute("placeholder")).toBe(
      "Введите URL видео или аудио",
    );
    expect(t("wg.autoShutdown.toast.title")).toBe("Авто‑закрытие");

    setLanguagePreview("en");
    expect(document.getElementById("text")?.textContent).toBe("Tips");
    expect(document.getElementById("btn")?.getAttribute("title")).toBe("Hide");
    expect(document.getElementById("field")?.getAttribute("placeholder")).toBe(
      "Enter video or audio URL",
    );
    expect(t("wg.autoShutdown.toast.title")).toBe("Auto-close");
  });
});
