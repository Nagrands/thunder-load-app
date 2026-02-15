<!-- version: 1.3.6 -->

### Interface and localization

- **Added** a new **Tools** tab with quick actions in one place (WG Unlock, hash check, system tools).
- **Added** file hash verification (MD5, SHA-1, SHA-256, SHA-512) with expected-value matching.
- **Added** a one-click action to create a Windows restart shortcut on the desktop.
- **Added** a placeholder card for **Format Converter** for an upcoming release.
- **Redesigned** the **Tools** tab into a compact dashboard with equal quick-action cards.
- **Moved** advanced WireGuard controls behind an **Advanced** toggle to keep the first screen clean.
- **Improved** buttons, input fields, and dropdowns in the **Tools** tab with clearer hover/focus states and cleaner visual consistency.
- **Kept** the restart-shortcut card visible on macOS/Linux, with the action disabled outside Windows.
- **Added** a separate Windows shutdown shortcut action in the **Tools** tab (next to restart shortcut).
- **Improved** the power-shortcuts block: restart and shutdown are now split into two clear mini-cards with short descriptions and a confirmation step before creating each shortcut.
- **Updated** the **Hash Check** card: a more compact layout, a dedicated status badge, and a one-click action to copy the calculated hash.
- **Fixed** a visual shift in the **Hash Check** block: long values and action buttons now shrink correctly and stay inside the card bounds.
- **Fixed** top‑bar button overlap with the tab menu on smaller window widths.
- **Fixed** window controls positioning when resizing the window.
- **Added** first-run setup to choose language, tabs, and theme.
- **Optimized** rendering in the **Tools** and **Randomizer** tabs: reduced constant GPU load, trimmed unnecessary animations, and made visual status updates lighter, so the app runs cooler during longer sessions.
- **Improved Backup tab performance**: background hints now pause when the tab is not active, profile list rerenders are lighter during frequent filtering, and row animations are limited for large lists.
