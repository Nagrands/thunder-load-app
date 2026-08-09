import { createActionMenu } from "../actionMenu.js";

const MENU_ITEMS = [
  ["play", "play", "nowPlaying.context.play"],
  ["queue", "list-end", "nowPlaying.context.queue"],
  ["playlist", "list-plus", "nowPlaying.playlists.addItem"],
  ["favorite", "star", "nowPlaying.library.favorite.add"],
  ["move-up", "arrow-up", "nowPlaying.playlists.moveUp"],
  ["move-down", "arrow-down", "nowPlaying.playlists.moveDown"],
  ["reveal", "folder-search", "nowPlaying.context.reveal"],
  ["open-location", "folder-open", "nowPlaying.context.openLocation"],
  ["info", "info", "nowPlaying.context.info"],
  ["rename", "pencil", "nowPlaying.context.rename"],
  ["delete", "trash-2", "nowPlaying.library.deleteItem"],
];

export function createPlayerContextMenu({ root, onAction }) {
  return createActionMenu({
    root,
    items: MENU_ITEMS.map(([id, icon, labelKey]) => ({
      id,
      icon,
      labelKey,
      danger: id === "delete",
      dataAttribute: "data-context-action",
    })),
    className: "player-context-menu action-menu",
    dataUi: "player-context-menu",
    renderIcon: (item) =>
      `<i data-lucide="${item.icon}" aria-hidden="true"></i>`,
    resolveItemState: (item, context) => {
      const local = context?.track?.providerId === "local";
      const available = context?.track?.availability !== "missing";
      const customPlaylist = context?.isSystemPlaylist === false;
      return {
        hidden:
          (["reveal", "open-location"].includes(item.id) && !local) ||
          (["move-up", "move-down"].includes(item.id) && !customPlaylist),
        disabled:
          !available && ["play", "reveal", "open-location"].includes(item.id),
        labelKey:
          item.id === "favorite"
            ? context?.track?.favorite
              ? "nowPlaying.library.favorite.remove"
              : "nowPlaying.library.favorite.add"
            : item.labelKey,
      };
    },
    onAction,
  });
}

export default createPlayerContextMenu;
