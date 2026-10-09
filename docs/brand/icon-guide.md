# Thunder Icon Guide

## App Icon Geometry

- Master canvas: 1024×1024 RGBA with a deep navy rounded tile.
- App mark: a bold geometric T that flows into a downward download arrow, with
  a small diagonal energy cut through its stem.
- Keep the mark front-facing, high-contrast, and legible at 16 px; use the
  Thunder blue/cyan palette without fine gradients or thin outlines.
- Tray and brand-wordmark symbols remain separate assets and keep their own
  platform-specific rendering rules.

## Style

- Use outline icons for default controls.
- Use filled icons only for brand symbols, status dots, and selected emphasis.
- Keep icon weight visually aligned with adjacent text.
- Active icons may use `thunder-blue-500`.
- Disabled icons should use muted neutral text color with reduced opacity.
- Windows system surfaces may use Fluent-style outline SVG icons instead of
  Thunder brand pictograms. They inherit the system-theme color and keep one
  consistent visual weight across hover, disabled, and focus states.

## Interaction

- Hover: color or surface change, no geometry change.
- Active: stronger color and explicit selected state.
- Focus: visible focus ring from the focus color system.
- Motion: use short transitions for state changes only; do not animate icons
  decoratively.

## Brand Pictograms

The Phase 1 brand board defines four supporting pictograms:

- Fast: lightning icon, maximum download speed.
- Smart: shield/processor icon, intelligent link processing.
- Reliable: check icon, stable downloads.
- Future: rocket icon, technology today and capability tomorrow.
