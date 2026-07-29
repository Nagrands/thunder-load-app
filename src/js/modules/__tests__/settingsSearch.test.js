jest.mock("../i18n.js", () => ({
  t: (key, params = {}) => {
    const values = {
      "settings.search.empty": "Ничего не найдено",
      "settings.search.count": `Найдено настроек: ${params.count}`,
    };
    return values[key] || key;
  },
}));

import {
  __test,
  initSettingsSearch,
} from "../features/settings/settingsSearch.js";

function buildDom() {
  document.body.innerHTML = `
    <div id="settings-modal">
      <div class="settings-search">
        <input
          id="settings-search-input"
          role="combobox"
          aria-expanded="false"
          aria-controls="settings-search-results"
        />
        <button id="settings-search-clear" type="button" hidden></button>
        <div id="settings-search-results" role="listbox" hidden></div>
        <div id="settings-search-live"></div>
      </div>
      <button id="general-tab">Общие</button>
      <button id="player-tab">Плеер</button>
      <div
        id="general-settings"
        class="tab-pane"
        aria-labelledby="general-tab"
      >
        <section
          id="startup-card"
          class="settings-card"
          data-settings-search-item
          data-settings-search-id="startup"
        >
          <h3 class="settings-card__title">Автозапуск</h3>
          <p class="settings-card__desc">Запускать Thunder при входе.</p>
        </section>
      </div>
      <div
        id="player-settings"
        class="tab-pane"
        aria-labelledby="player-tab"
      >
        <details id="player-details">
          <div
            id="background-control"
            class="settings-control"
            data-settings-search-item
            data-settings-search-id="background"
          >
            <input id="background-input" type="checkbox" />
            <label for="background-input">
              <span class="settings-choice__meta">
                <strong>Фоновое воспроизведение</strong>
                <small>Продолжать воспроизведение вне вкладки.</small>
              </span>
            </label>
          </div>
        </details>
      </div>
    </div>
  `;
  Element.prototype.scrollIntoView = jest.fn();
  window.requestAnimationFrame = (callback) => callback();
  window.matchMedia = jest.fn(() => ({ matches: true }));
}

describe("settingsSearch", () => {
  let controller;
  let activateCategory;

  beforeEach(() => {
    buildDom();
    activateCategory = jest.fn();
    controller = initSettingsSearch({
      root: document.getElementById("settings-modal"),
      activateCategory,
    });
  });

  afterEach(() => {
    controller?.dispose();
  });

  test("searches localized titles and descriptions across categories", () => {
    const input = document.getElementById("settings-search-input");
    input.value = "воспроизведение";
    input.dispatchEvent(new Event("input", { bubbles: true }));

    const options = document.querySelectorAll(".settings-search-result");
    expect(options).toHaveLength(1);
    expect(options[0].textContent).toContain("Фоновое воспроизведение");
    expect(options[0].textContent).toContain("Плеер");
    expect(input.getAttribute("aria-expanded")).toBe("true");
  });

  test("supports keyboard selection and opens the target details element", () => {
    const input = document.getElementById("settings-search-input");
    input.value = "фоновое";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );

    expect(activateCategory).toHaveBeenCalledWith("player-settings");
    expect(document.getElementById("player-details").open).toBe(true);
    expect(document.activeElement.id).toBe("background-input");
    expect(
      document
        .getElementById("background-control")
        .classList.contains("is-search-target"),
    ).toBe(true);
  });

  test("Escape closes results without clearing the query", () => {
    const input = document.getElementById("settings-search-input");
    input.value = "запуск";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );

    expect(document.getElementById("settings-search-results").hidden).toBe(
      true,
    );
    expect(input.value).toBe("запуск");
  });

  test("rebuilds the localized index on i18n changes", () => {
    const title = document.querySelector("#startup-card h3");
    title.textContent = "Launch automatically";
    window.dispatchEvent(new CustomEvent("i18n:changed"));

    const input = document.getElementById("settings-search-input");
    input.value = "launch";
    input.dispatchEvent(new Event("input", { bubbles: true }));

    expect(document.querySelectorAll(".settings-search-result")).toHaveLength(
      1,
    );
  });

  test("creates highlights as text nodes without interpreting markup", () => {
    const root = document.createElement("strong");
    __test.appendHighlightedText(root, "<img src=x> Setting", "setting");

    expect(root.querySelector("img")).toBeNull();
    expect(root.querySelector("mark")?.textContent).toBe("Setting");
    expect(root.textContent).toBe("<img src=x> Setting");
  });
});
