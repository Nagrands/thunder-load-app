jest.mock("../i18n.js", () => ({
  t: (key) => key,
}));

import { createPlayerContextMenu } from "../nowPlaying/playerContextMenu.js";

describe("Now Playing context menu", () => {
  test("keeps an icon beside every translated action label", () => {
    const root = document.createElement("section");
    document.body.appendChild(root);
    const menu = createPlayerContextMenu({ root, onAction: jest.fn() });
    const items = Array.from(
      root.querySelectorAll('[data-ui="player-context-menu"] [role="menuitem"]'),
    );

    expect(items).toHaveLength(11);
    items.forEach((item) => {
      expect(item.dataset.i18n).toBeUndefined();
      expect(item.querySelector("[data-lucide]")).not.toBeNull();
      expect(item.querySelector("span[data-i18n]")).not.toBeNull();
    });
    expect(
      root.querySelector('[data-context-action="play"] [data-lucide]').dataset
        .lucide,
    ).toBe("play");
    expect(
      root.querySelector('[data-context-action="delete"] [data-lucide]').dataset
        .lucide,
    ).toBe("trash-2");
    expect(
      root.querySelector('[data-context-action="favorite"] [data-lucide]').dataset
        .lucide,
    ).toBe("star");
    menu.dispose();
  });

  test("hides local-only actions for remote tracks and restores focus", () => {
    const root = document.createElement("section");
    const trigger = document.createElement("button");
    root.appendChild(trigger);
    document.body.appendChild(root);
    const menu = createPlayerContextMenu({ root, onAction: jest.fn() });

    menu.open(
      {
        track: { id: "remote", providerId: "youtube" },
        isSystemPlaylist: true,
      },
      trigger,
      { x: 10, y: 10 },
    );

    const element = root.querySelector('[data-ui="player-context-menu"]');
    expect(element.hidden).toBe(false);
    expect(element.querySelector('[data-context-action="reveal"]').hidden).toBe(
      true,
    );
    element.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(element.hidden).toBe(true);
    expect(document.activeElement).toBe(trigger);
    menu.dispose();
  });

  test("dispatches the selected action with track context", () => {
    const root = document.createElement("section");
    const trigger = document.createElement("button");
    root.appendChild(trigger);
    document.body.appendChild(root);
    const onAction = jest.fn();
    const menu = createPlayerContextMenu({ root, onAction });
    const context = {
      track: { id: "local", providerId: "local" },
      isSystemPlaylist: false,
    };
    menu.open(context, trigger, { x: 10, y: 10 });
    root.querySelector('[data-context-action="queue"]').click();
    expect(onAction).toHaveBeenCalledWith("queue", context);
    menu.dispose();
  });

  test("disables playback and file actions for a missing local track", () => {
    const root = document.createElement("section");
    const trigger = document.createElement("button");
    root.appendChild(trigger);
    document.body.appendChild(root);
    const menu = createPlayerContextMenu({ root, onAction: jest.fn() });

    menu.open(
      {
        track: {
          id: "missing",
          providerId: "local",
          availability: "missing",
        },
        isSystemPlaylist: true,
      },
      trigger,
    );

    ["play", "reveal", "open-location"].forEach((action) => {
      expect(
        root.querySelector(`[data-context-action="${action}"]`).disabled,
      ).toBe(true);
    });
    menu.dispose();
  });
});
