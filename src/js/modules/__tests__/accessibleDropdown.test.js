import {
  initAccessibleDropdown,
  syncAccessibleDropdownSelection,
} from "../features/settings/accessibleDropdown.js";

describe("accessible settings dropdown", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <button id="trigger" type="button">Choose</button>
      <ul id="menu" class="dropdown-menu">
        <li data-value="one">One</li>
        <li data-value="two">Two</li>
        <li data-value="three">Three</li>
      </ul>
    `;
  });

  test("adds listbox semantics and opens from the keyboard", () => {
    const trigger = document.getElementById("trigger");
    const menu = document.getElementById("menu");
    const options = Array.from(menu.querySelectorAll("[data-value]"));

    syncAccessibleDropdownSelection(menu, "two");
    initAccessibleDropdown(trigger, menu);
    trigger.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
    );

    expect(trigger.getAttribute("aria-haspopup")).toBe("listbox");
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(menu.getAttribute("role")).toBe("listbox");
    expect(options[1].getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(options[1]);
  });

  test("supports arrow navigation, selection and Escape", () => {
    const trigger = document.getElementById("trigger");
    const menu = document.getElementById("menu");
    const options = Array.from(menu.querySelectorAll("[data-value]"));
    const clickSpy = jest.fn();
    const windowEscapeSpy = jest.fn();
    options[1].addEventListener("click", clickSpy);

    initAccessibleDropdown(trigger, menu);
    trigger.click();
    options[0].focus();
    options[0].dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
    );
    expect(document.activeElement).toBe(options[1]);

    options[1].dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(options[1].getAttribute("aria-selected")).toBe("true");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(trigger);

    trigger.click();
    trigger.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    expect(trigger.getAttribute("aria-expanded")).toBe("false");

    trigger.click();
    options[1].focus();
    window.addEventListener("keydown", windowEscapeSpy);
    options[1].dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(trigger);
    expect(windowEscapeSpy).not.toHaveBeenCalled();
    window.removeEventListener("keydown", windowEscapeSpy);
  });
});
