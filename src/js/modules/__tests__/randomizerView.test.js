/**
 * @file randomizerView.test.js
 */

import renderRandomizerView from "../views/randomizerView.js";
import { showToast } from "../toast.js";

jest.mock("../toast.js", () => ({
  showToast: jest.fn(),
}));

jest.mock("../tooltipInitializer.js", () => ({
  initTooltips: jest.fn(),
}));

const setup = (options = {}) => {
  document.body.innerHTML = "";
  localStorage.clear();
  jest.clearAllMocks();
  global.confirm = jest.fn(() => true);
  global.prompt = jest.fn();
  global.navigator.clipboard = {
    readText: jest.fn(),
    writeText: jest.fn(),
  };
  if (options.items) {
    localStorage.setItem("randomizerItems", JSON.stringify(options.items));
  }
  if ("pool" in options) {
    localStorage.setItem("randomizerPool", JSON.stringify(options.pool));
  }
  if (options.settings) {
    localStorage.setItem(
      "randomizerSettings",
      JSON.stringify(options.settings),
    );
  }
  if (options.presets) {
    localStorage.setItem("randomizerPresets", JSON.stringify(options.presets));
  }
  if (options.currentPreset) {
    localStorage.setItem("randomizerCurrentPreset", options.currentPreset);
  }
  if (options.defaultPreset) {
    localStorage.setItem("randomizerDefaultPreset", options.defaultPreset);
  }
  const view = renderRandomizerView();
  document.body.appendChild(view);
  return view;
};

const getChips = (root = document) =>
  Array.from(root.querySelectorAll(".randomizer-chip"));

const getStoredItems = () =>
  JSON.parse(localStorage.getItem("randomizerItems") || "[]");
const getStoredValues = () =>
  getStoredItems().map((item) => (item?.value ? item.value : item));
const getStoredPresets = () =>
  JSON.parse(localStorage.getItem("randomizerPresets") || "[]");

describe("Randomizer view", () => {
  test("renders default items as chips", () => {
    const view = setup();
    const chips = getChips(view);
    expect(chips.length).toBeGreaterThanOrEqual(1);
    expect(view.querySelector("#randomizer-count")?.textContent).toContain(
      "вариант",
    );
  });

  test("keeps list empty after clearing and reload", () => {
    const view = setup({
      items: [],
      presets: [{ name: "Основной", items: [] }],
      currentPreset: "Основной",
      defaultPreset: "Основной",
    });
    expect(getChips(view).length).toBe(0);
    expect(
      view.querySelector("#randomizer-list .placeholder")?.textContent,
    ).toMatch(/Пока нет вариантов/);
    expect(getStoredItems()).toEqual([]);
  });

  test("adds a new item and persists it", () => {
    const view = setup();
    const initialCount = getChips(view).length;
    const input = view.querySelector("#randomizer-input");
    input.value = "Новая идея";
    view.querySelector("#randomizer-add").click();

    const chips = getChips(view);
    expect(chips.length).toBe(initialCount + 1);
    expect(getStoredValues()).toContain("Новая идея");
    expect(showToast).toHaveBeenCalled();
  });

  test("does not add duplicates", () => {
    const view = setup();
    const firstValue = getChips(view)[0].querySelector(".text").textContent;
    const initialCount = getChips(view).length;

    const input = view.querySelector("#randomizer-input");
    input.value = firstValue;
    view.querySelector("#randomizer-add").click();

    expect(getChips(view).length).toBe(initialCount);
  });

  test("supports inline edit on chip", () => {
    const view = setup();
    const targetChip = getChips(view)[0];
    const newValue = "Обновлённое значение";

    targetChip.dispatchEvent(new Event("dblclick", { bubbles: true }));
    const editInput = view.querySelector(".chip-edit-input");
    expect(editInput).toBeTruthy();
    editInput.value = newValue;
    editInput.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));

    const chips = getChips(view);
    expect(chips.some((chip) => chip.textContent.includes(newValue))).toBe(
      true,
    );

    expect(getStoredValues()).toContain(newValue);
  });

  test("selects chips and performs bulk delete", () => {
    const view = setup();
    const firstChip = getChips(view)[0];
    const initialCount = getChips(view).length;
    firstChip.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    const bulkDelete = view.querySelector("#randomizer-delete-selected");
    expect(bulkDelete.disabled).toBe(false);
    bulkDelete.click();

    expect(getChips(view).length).toBe(initialCount - 1);
    expect(getStoredItems().length).toBe(initialCount - 1);
    expect(showToast).toHaveBeenCalled();
  });

  test("weighted roll prefers items with higher weight", () => {
    jest.useFakeTimers();
    const originalRandom = Math.random;
    Math.random = jest.fn(() => 0.9); // bias towards heavier item

    const view = setup({
      items: [
        { value: "Low", weight: 1 },
        { value: "High", weight: 5 },
      ],
      settings: { noRepeat: false },
    });

    view.querySelector("#randomizer-roll").click();
    jest.advanceTimersByTime(400);

    expect(view.querySelector("#randomizer-result-text").textContent).toBe(
      "High",
    );

    Math.random = originalRandom;
    jest.useRealTimers();
  });

  test("creates a new template via 'save as' and switches templates", () => {
    const view = setup({
      presets: [
        { name: "Base", items: [{ value: "A" }] },
        { name: "Alt", items: [{ value: "B" }] },
      ],
      currentPreset: "Base",
      defaultPreset: "Base",
    });

    // Switch to Alt
    const select = view.querySelector("#randomizer-preset-select");
    select.value = "Alt";
    select.dispatchEvent(new Event("change", { bubbles: true }));

    expect(
      getChips(view).map((chip) => chip.querySelector(".text").textContent),
    ).toEqual(["B"]);

    // Save current list as new preset
    global.prompt.mockReturnValueOnce("NewPreset");
    view.querySelector("#randomizer-preset-save-as").click();

    const presets = getStoredPresets();
    expect(presets.some((p) => p.name === "NewPreset")).toBe(true);
  });

  test("marks chips that left the pool", () => {
    jest.useFakeTimers();
    const originalRandom = Math.random;
    Math.random = jest.fn(() => 0); // pick the first item

    try {
      const view = setup({
        items: [
          { value: "One", weight: 1 },
          { value: "Two", weight: 1 },
        ],
        settings: { noRepeat: true, spinSeconds: 0 },
      });

      view.querySelector("#randomizer-roll").click();
      jest.runAllTimers();

      const chipByValue = (value) =>
        getChips(view).find(
          (chip) => chip.querySelector(".text")?.textContent === value,
        );

      const chipOne = chipByValue("One");
      const chipTwo = chipByValue("Two");

      expect(chipOne?.classList.contains("is-depleted")).toBe(true);
      expect(chipTwo?.classList.contains("is-depleted")).toBe(false);

      const toggle = view.querySelector("#randomizer-no-repeat");
      toggle.checked = false;
      toggle.dispatchEvent(new Event("change", { bubbles: true }));

      expect(
        getChips(view).some((chip) => chip.classList.contains("is-depleted")),
      ).toBe(false);
    } finally {
      Math.random = originalRandom;
      jest.useRealTimers();
    }
  });

  test("creates an empty template via the new button", () => {
    const view = setup({
      items: [{ value: "One" }],
      presets: [{ name: "Основной", items: [{ value: "One" }] }],
      currentPreset: "Основной",
      defaultPreset: "Основной",
    });

    global.prompt.mockReturnValueOnce("Empty");
    view.querySelector("#randomizer-preset-new").click();

    const presets = getStoredPresets();
    const created = presets.find((p) => p.name === "Empty");
    expect(created).toBeTruthy();
    expect(created.items).toEqual([]);
    expect(getChips(view).length).toBe(0);
  });
});
