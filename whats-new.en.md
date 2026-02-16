<!-- version: 1.3.6 -->

### Tools tab

- **Redesigned the quality picker in the Downloader tab**: added per-tab format counters, a current-selection panel, and quick best-option selection for the active tab.
- **Simplified the quality picker in Downloader**: removed the separate “Best quality” button to avoid duplicating quick selection in the active tab.
- **Improved quality-selection controls**: added keyboard navigation with ↑/↓ and Enter to start download faster without using the mouse.

- **Added** the **Tools** tab: quick actions in one place (WG Unlock, hash check, system tools).
- **Added** file hash verification (MD5, SHA‑1, SHA‑256, SHA‑512) with expected-value comparison.
- **Added** a button to create Windows restart and shutdown desktop shortcuts.
- **Added** a “Format Converter” block as a placeholder for the next update.
- **Improved** buttons, inputs, and dropdowns in the **Tools** tab: better readability, clearer hover/focus states, and cleaner visual style.
- **Made Enter behavior more predictable in the Tools tab**: WG send now triggers only inside the WG Advanced form and no longer interferes with hash-check inputs.
- **Improved Advanced panel accessibility**: the toggle now reports expanded/collapsed state correctly, and keyboard focus moves into the form on open and back to the toggle on close.
- **Localized the WG Unlock help dialog**: help content in the Tools tab now follows the selected app language.
- **Hid the Windows power shortcuts card on non-Windows systems**: the Tools tab now shows only actions available on your platform.
- **Improved hash verification flow**: controls are now locked while hash calculation is running to prevent accidental duplicate runs.
- **Refined network settings button behavior**: the button now appears only on platforms where opening system network settings is supported.
- **Improved action hierarchy in WG Quick**: the primary “Send” action is now separated from secondary actions under a dedicated “More actions” block.
- **Refreshed the Tools tab in a flatter, more minimal style**: cards and buttons now look cleaner with less visual noise and more consistent spacing.
- **Removed the “Format Converter (Soon)” placeholder card**: the dashboard now focuses on currently available tools only.
- **Improved Tools block composition**: WG Quick is now visually prioritized as the main workflow, while secondary actions are grouped more compactly.
- **Simplified the hash-check presentation**: result states and busy feedback are now easier to read with cleaner visual emphasis.
- **Redesigned Tools tab navigation**: it now opens with a centered launcher screen that shows large buttons for available tools.
- **Added dedicated tool-view mode with a Back button**: use the top-left arrow to return to the launcher at any time.
- **Added last-tool restore behavior**: reopening the Tools tab now returns you to the last tool you used when it is available on your platform.
- **Fixed duplicate hash-check wording**: the result text no longer repeats the “Calculated hash” label.
- **Simplified the hash copy action**: the hash-check panel now uses a compact icon-only copy button with a hover tooltip.
- **Expanded hash verification**: you can now select a second file and compare two files directly by their hashes.
- **Improved expected-hash comparison**: when two files are selected, the check now shows whether the expected hash matches file 1, file 2, or both.
- **Updated hash-check layout**: the second file now uses the same “Pick file” button label, and copy buttons are placed next to each calculated hash.
- **Made two-file verification clearer**: added explicit “File 1/File 2” roles, an expected-hash hint, and a compact per-file status block after verification.
- **Refined hash-check status behavior**: the “Matched” badge now appears only for real matches (between files or against expected hash), while plain calculation without comparison uses a separate status.
- **Improved two-file comparison details**: the result details now show selected file names instead of generic “File 1/File 2” labels.
- **Improved two-file hash-check flow**: added a clear button for the second file, and expected-hash input now compares correctly even when it contains spaces or line breaks.
- **Improved calculated-hash label**: hash results now show which algorithm was used for the calculation.

- **Optimized** UI performance in the **Tools** and **Randomizer** tabs: reduced constant GPU load, cut unnecessary animation, and made visual indicators update more efficiently so the app runs cooler during long sessions.
- **Improved Backup tab performance**: background hints now pause outside the active tab, profile lists render lighter during frequent filtering, and row animations are limited for large lists.
- **Added profile list virtualization in Backup**: on large pages, only visible items are rendered, making scrolling and filtering noticeably smoother.
- **Added History list virtualization**: on large pages, only visible entries are rendered, making scrolling and history interactions smoother with lower system load.
- **Improved History virtualization accuracy**: item heights are now auto-calibrated from real rendered size, making scrolling more stable across different density modes and expanded details.
- **Optimized tooltips across the app**: tooltips now initialize lazily and are reused instead of being recreated on rerenders, reducing unnecessary UI load.
- **Improved popup menu behavior**: added a shared overlay manager so menus and context panels close centrally without duplicate handlers.
