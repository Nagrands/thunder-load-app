# Thunder Color Guide

The Thunder palette uses electric blue for the lightning energy system, cool
white for the bolt and wordmark, saturated blue for the Spark release tag, and
deep near-black surfaces for contrast.

## Primary

| Token               | Hex       | Use                             |
| ------------------- | --------- | ------------------------------- |
| `thunder-blue-600`  | `#2D9CFF` | Primary action, active state    |
| `thunder-blue-500`  | `#4AA8FF` | Hover, progress, highlights     |
| `thunder-blue-300`  | `#85C9FF` | Links on dark surfaces          |
| `electric-cyan-400` | `#16D8FF` | Lightning edge and release glow |
| `electric-blue-700` | `#0B4DFF` | Ring depth                      |
| `electric-blue-600` | `#087BFF` | Bolt base                       |
| `electric-blue-500` | `#00A8FF` | Ring core                       |
| `electric-blue-200` | `#7BE7FF` | Ring highlight                  |
| `electric-blue-100` | `#BFF7FF` | Bolt highlight                  |

## Electric Accent

| Token            | Hex       | Use                            |
| ---------------- | --------- | ------------------------------ |
| `spark-blue-500` | `#0A8BFF` | Thunder Spark accent           |
| `spark-blue-300` | `#5FCFFF` | Wordmark and ring highlight    |
| `spark-cyan-200` | `#DDF9FF` | Bolt edge highlight            |
| `bolt-white`     | `#F8FBFF` | Bolt core and primary wordmark |

## Neutral

| Token       | Hex       | Use             |
| ----------- | --------- | --------------- |
| `ink-950`   | `#040813` | Deep background |
| `ink-900`   | `#0D1118` | App background  |
| `ink-800`   | `#151D29` | Surface         |
| `ink-700`   | `#223149` | Raised surface  |
| `slate-300` | `#CFE1FA` | Muted text      |
| `slate-100` | `#F4F8FF` | Primary text    |

## Semantic

| Token         | Hex       | Use                           |
| ------------- | --------- | ----------------------------- |
| `success-500` | `#3EE36B` | Success                       |
| `warning-500` | `#FFD43B` | Warning                       |
| `danger-500`  | `#FF5D58` | Error and destructive actions |
| `info-500`    | `#5EC4FF` | Informational state           |

## Hierarchy

- Background: `ink-950`, `ink-900`.
- Surface: `ink-800`, `ink-700`.
- Border: `#2A384C`, `#354965`.
- Text: `slate-100`, `slate-300`, `#667184`.
- Focus: `thunder-blue-500` outline with a soft blue glow.
- Glow: electric blue and cyan for the lightning ring and release accents.
- Semantic colors may appear in status UI, never in the core logo.

## Identity Surfaces

- Full-color marks use `#050914` for the tile and `#03101F` for bolt depth.
- The bolt travels from white through cyan to `#087BFF`; the open ring travels
  from white through `#00A8FF` to `#0B4DFF`.
- Light-background lockups replace the light wordmark with `#07111F` while the
  symbol keeps its blue identity palette.
