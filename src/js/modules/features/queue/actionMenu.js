import { createActionMenu } from "../../actionMenu.js";

const ITEMS = [
  ["download-next", "list-start", "queue.menu.downloadNext"],
  ["move-top", "arrow-up-to-line", "queue.menu.moveTop"],
  ["move-bottom", "arrow-down-to-line", "queue.menu.moveBottom"],
  ["remove", "trash-2", "queue.menu.remove"],
];

function createQueueActionMenu({ root, onAction }) {
  return createActionMenu({
    root,
    className: "queue-action-menu action-menu",
    dataUi: "queue-action-menu",
    items: ITEMS.map(([id, icon, labelKey]) => ({
      id,
      icon,
      labelKey,
      danger: id === "remove",
      dataAttribute: "data-queue-menu-action",
    })),
    renderIcon: (item) =>
      `<i data-lucide="${item.icon}" aria-hidden="true"></i>`,
    resolveItemState: (item, context) => ({
      disabled:
        (item.id === "move-top" && context?.isFirst) ||
        (item.id === "move-bottom" && context?.isLast),
    }),
    onAction,
  });
}

export { createQueueActionMenu };
