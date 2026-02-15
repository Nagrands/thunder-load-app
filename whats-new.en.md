<!-- version: 1.3.6 -->

### Interface and localization

- **Updated app icons** with a new glossy style and a clearer download symbol across the app window, notifications, and tray.
- **Refined the new icon style** with improved contrast and readability at small sizes, including tray icons.
- **Updated the icon symbol** to a circle with a download arrow in a cool blue palette, making it easier to recognize in the app window, notifications, and tray.
- **Fully redesigned the icon mark** by removing the circle and keeping only a lightning-shaped arrow for a cleaner look and better small-size readability.
- **Redrew the lightning shape** with a fully filled, denser silhouette to remove the “unfilled” look.
- **Replaced the icon symbol with a T monogram** across the app, notifications, and tray while keeping the current blue visual style.
- **Aligned the remaining app icons to the same style**: menu and notification PNG icons plus SVG asset icons were refreshed for a consistent visual look.
- **Removed unused icons from the project**: the assets folder now keeps only icon files that are actually used by the app.
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
- **Added profile-list virtualization in the Backup tab**: for larger pages, only visible items are rendered, making scrolling and filtering much smoother.
- **Added History-list virtualization**: on larger pages, only visible entries are rendered, which makes scrolling and history interactions smoother with lower system load.
- **Improved History virtualization accuracy**: item heights are now auto-calibrated from real rendered sizes, keeping scrolling steadier across different density modes and expanded details.
- **Reduced background UI load**: heavy blur and large shadows were removed from always-visible containers, helping the app run cooler and smoother during long sessions.
- **Optimized tooltips across the app**: tooltips now initialize lazily and reuse existing instances instead of being recreated on every rerender, reducing unnecessary UI overhead.
- **Improved popup/menu handling**: a shared overlay manager now closes menus and context panels centrally, avoiding duplicate global listeners.
