import { createActionMenu } from "../actionMenu.js";
import { createQueueActionMenu } from "../features/queue/actionMenu.js";

describe("action menu", () => {
  test("supports dynamic state, keyboard navigation and focus restoration", () => {
    document.body.innerHTML = '<main id="root"><button id="trigger">Menu</button></main>';
    const root = document.getElementById("root");
    const trigger = document.getElementById("trigger");
    root.getBoundingClientRect = () => ({ left: 0, top: 0, width: 500, height: 400 });
    const onAction = jest.fn();
    const controller = createActionMenu({
      root,
      items: [
        { id: "open", label: "Open" },
        { id: "delete", label: "Delete", danger: true },
      ],
      resolveItemState: (item, context) => ({
        disabled: item.id === "open" && !context.available,
      }),
      onAction,
    });

    controller.open({ available: false }, trigger, { x: 20, y: 20 });
    expect(controller.element.querySelector('[data-action="open"]').disabled).toBe(true);
    expect(document.activeElement.dataset.action).toBe("delete");
    controller.element.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    expect(controller.element.hidden).toBe(true);
    expect(document.activeElement).toBe(trigger);
    controller.dispose();
  });

  test("hides unavailable items and skips them when dispatching actions", () => {
    document.body.innerHTML = '<main id="root"><button id="trigger">Menu</button></main>';
    const root = document.getElementById("root");
    root.getBoundingClientRect = () => ({ left: 0, top: 0, width: 500, height: 400 });
    const onAction = jest.fn();
    const controller = createActionMenu({
      root,
      items: [
        { id: "unavailable", label: "Unavailable" },
        { id: "available", label: "Available" },
      ],
      resolveItemState: (item) => ({ hidden: item.id === "unavailable" }),
      onAction,
    });

    controller.open({}, document.getElementById("trigger"));
    const unavailable = controller.element.querySelector(
      '[data-action="unavailable"]',
    );
    expect(unavailable.hidden).toBe(true);
    expect(document.activeElement.dataset.action).toBe("available");

    unavailable.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onAction).not.toHaveBeenCalled();
    controller.dispose();
  });

  test("hides queue moves that cannot change the current position", () => {
    document.body.innerHTML = '<main id="root"><button id="trigger">Menu</button></main>';
    const root = document.getElementById("root");
    root.getBoundingClientRect = () => ({ left: 0, top: 0, width: 500, height: 400 });
    const controller = createQueueActionMenu({ root, onAction: jest.fn() });

    controller.open(
      { title: "Example video", isFirst: true, isLast: false },
      document.getElementById("trigger"),
    );
    expect(
      controller.element.querySelector(".action-menu__header-label").textContent,
    ).toBe("Example video");
    expect(
      controller.element.querySelector('[data-action="move-top"]').hidden,
    ).toBe(true);
    expect(
      controller.element.querySelector('[data-action="move-bottom"]').hidden,
    ).toBe(false);

    controller.open(
      { title: "Second video", isFirst: false, isLast: true },
      document.getElementById("trigger"),
    );
    expect(
      controller.element.querySelector(".action-menu__header-label").textContent,
    ).toBe("Second video");
    expect(
      controller.element.querySelector('[data-action="move-top"]').hidden,
    ).toBe(false);
    expect(
      controller.element.querySelector('[data-action="move-bottom"]').hidden,
    ).toBe(true);
    controller.dispose();
  });

  test("renders an optional header and item descriptions", () => {
    document.body.innerHTML = '<main id="root"></main>';
    const root = document.getElementById("root");
    const controller = createActionMenu({
      root,
      dataUi: "test-menu",
      header: "Actions",
      items: [{ id: "open", label: "Open", description: "Open the item" }],
    });
    const menu = controller.element;
    const header = menu.querySelector(".action-menu__header");
    const item = menu.querySelector('[data-action="open"]');
    const description = item.querySelector(".action-menu__description");

    expect(header.textContent).toBe("Actions");
    expect(menu.getAttribute("aria-labelledby")).toBe(header.id);
    expect(description.textContent).toBe("Open the item");
    expect(item.getAttribute("aria-describedby")).toBe(description.id);
    controller.dispose();
  });

  test("dispatches an enabled action", () => {
    document.body.innerHTML = '<main id="root"><button id="trigger">Menu</button></main>';
    const root = document.getElementById("root");
    root.getBoundingClientRect = () => ({ left: 0, top: 0, width: 500, height: 400 });
    const onAction = jest.fn();
    const controller = createActionMenu({
      root,
      items: [{ id: "open", label: "Open" }],
      onAction,
    });
    const context = { id: 7 };
    controller.open(context, document.getElementById("trigger"));
    controller.element
      .querySelector('[data-action="open"]')
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onAction).toHaveBeenCalledWith("open", context);
  });

  test("does not close when the opening click icon is replaced during bubbling", () => {
    document.body.innerHTML = '<main id="root"><button id="trigger"><span id="icon">Menu</span></button></main>';
    const root = document.getElementById("root");
    root.getBoundingClientRect = () => ({ left: 0, top: 0, width: 500, height: 400 });
    const controller = createActionMenu({
      root,
      items: [{ id: "open", label: "Open" }],
    });
    const trigger = document.getElementById("trigger");
    controller.open({}, trigger);
    root.addEventListener(
      "click",
      () => trigger.replaceChildren(document.createElement("svg")),
      { once: true },
    );
    document.getElementById("icon").dispatchEvent(
      new MouseEvent("click", { bubbles: true, composed: true }),
    );
    expect(controller.element.hidden).toBe(false);
    controller.dispose();
  });
});
