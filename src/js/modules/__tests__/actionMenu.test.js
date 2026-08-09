import { createActionMenu } from "../actionMenu.js";

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
});
