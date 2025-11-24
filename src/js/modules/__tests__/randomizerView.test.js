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
  global.navigator.clipboard = {
    readText: jest.fn(),
    writeText: jest.fn(),
  };
  if (options.items) {
    localStorage.setItem("randomizerItems", JSON.stringify(options.items));
  }
  if (options.settings) {
    localStorage.setItem("randomizerSettings", JSON.stringify(options.settings));
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

describe("Randomizer view", () => {
  test("renders default items as chips", () => {
    const view = setup();
    const chips = getChips(view);
    expect(chips.length).toBeGreaterThanOrEqual(1);
    expect(view.querySelector("#randomizer-count")?.textContent).toContain(
      "вариант",
    );
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

    expect(
      view.querySelector("#randomizer-result-text").textContent,
    ).toBe("High");

    Math.random = originalRandom;
    jest.useRealTimers();
  });
});
