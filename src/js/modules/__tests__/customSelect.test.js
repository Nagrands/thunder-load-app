/** @jest-environment jsdom */

import { initCustomSelect } from "../customSelect.js";

describe("custom select", () => {
  beforeEach(() => {
    document.body.innerHTML = `<div class="settings-cookies-select">
      <button class="settings-cookies-select__trigger"><span></span></button>
      <select><option value="a">Alpha</option><option value="b">Beta</option></select>
      <div class="settings-cookies-select__menu hidden"></div>
    </div>`;
  });

  test("mirrors native options, selection, disabled state, and change events", () => {
    const root = document.querySelector("div");
    const select = root.querySelector("select");
    const trigger = root.querySelector("button");
    const label = trigger.querySelector("span");
    const menu = root.querySelector(".settings-cookies-select__menu");
    const onChange = jest.fn();
    select.addEventListener("change", onChange);
    const custom = initCustomSelect(root, select, { trigger, label, menu });

    expect(label.textContent).toBe("Alpha");
    expect(menu.querySelectorAll('[role="option"]')).toHaveLength(2);
    menu.querySelectorAll('[role="option"]')[1].click();
    expect(select.value).toBe("b");
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(label.textContent).toBe("Beta");
    select.disabled = true;
    custom.sync();
    expect(trigger.disabled).toBe(true);
  });

  test("opens with keyboard and closes with Escape", () => {
    const root = document.querySelector("div");
    const trigger = root.querySelector("button");
    const menu = root.querySelector(".settings-cookies-select__menu");
    initCustomSelect(root, root.querySelector("select"), {
      trigger,
      label: trigger.querySelector("span"),
      menu,
    });
    trigger.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
    );
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(menu.classList.contains("hidden")).toBe(false);
    menu
      .querySelector('[role="option"]')
      .dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(trigger);
  });
});
