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

const setup = () => {
  document.body.innerHTML = "";
  localStorage.clear();
  jest.clearAllMocks();
  global.confirm = jest.fn(() => true);
  global.navigator.clipboard = {
    readText: jest.fn(),
    writeText: jest.fn(),
  };
  const view = renderRandomizerView();
  document.body.appendChild(view);
  return view;
};

const getChips = (root = document) =>
  Array.from(root.querySelectorAll(".randomizer-chip"));

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
    const stored = JSON.parse(localStorage.getItem("randomizerItems") || "[]");
    expect(stored).toContain("Новая идея");
    expect(showToast).toHaveBeenCalled();
  });

  test("does not add duplicates", () => {
    const view = setup();
    const firstValue = getChips(view)[0].textContent;
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

    const stored = JSON.parse(localStorage.getItem("randomizerItems") || "[]");
    expect(stored).toContain(newValue);
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
    const stored = JSON.parse(localStorage.getItem("randomizerItems") || "[]");
    expect(stored.length).toBe(initialCount - 1);
    expect(showToast).toHaveBeenCalled();
  });
});
