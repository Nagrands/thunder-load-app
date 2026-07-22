# Thunder Brand Assets

This folder contains the canonical reusable Thunder Spark brand kit.

- `svg/` contains the symbol, favicon, logo lockups, and campaign templates.
  Every full-color asset uses the same master bolt, open energy ring, and blue
  palette; monochrome output preserves the same geometry without effects.
- `tokens/` is the source of truth for identity colors, typography, geometry,
  spacing, radii, shadows, and motion values.
- `src/assets/webfonts/orbitron/` contains self-hosted Orbitron WOFF2
  files used by Thunder Spark wordmarks and brand UI.

Runtime app icon outputs remain in `assets/icons/` and are generated with
`scripts/generate_brand_icons.py`.

Do not edit the symbol geometry independently in a single lockup. Update the
master path and all derivatives together, then validate every SVG as XML.
