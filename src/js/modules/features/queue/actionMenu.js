import { createActionMenu } from "../../actionMenu.js";

const ITEMS = [
  [
    "download-next",
    "list-start",
    "queue.menu.downloadNext",
    "queue.menu.downloadNextHint",
  ],
  [
    "move-top",
    "arrow-up-to-line",
    "queue.menu.moveTop",
    "queue.menu.moveTopHint",
  ],
  [
    "move-bottom",
    "arrow-down-to-line",
    "queue.menu.moveBottom",
    "queue.menu.moveBottomHint",
  ],
  ["remove", "trash-2", "queue.menu.remove", "queue.menu.removeHint"],
];

function createQueueActionMenu({ root, onAction }) {
  return createActionMenu({
    root,
    className: "queue-action-menu action-menu",
    dataUi: "queue-action-menu",
    headerKey: "queue.menu.title",
    items: ITEMS.map(([id, icon, labelKey, descriptionKey]) => ({
      id,
      icon,
      labelKey,
      descriptionKey,
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
