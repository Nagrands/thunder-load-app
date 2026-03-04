<!-- version: 1.4.0 -->

# What's New

> In short: refreshed visuals, improved stability, and better workflows across Downloader, History, Tools, and Backup.

---

## Interface

| What changed | What you get |
|---|---|
| Refreshed overall app visual style | Tabs, section backgrounds, and spacing look cleaner and calmer |
| Redesigned **Settings** window | More compact layout and clearer navigation |
| Improved popup behavior | Unified overlay manager and more reliable menu closing |
| Optimized tooltips | Fewer unnecessary rerenders with lazy initialization |
| Improved macOS window behavior | App comes to the foreground correctly when needed |
| Improved tray and internal handler stability | More predictable UI event behavior |
| Fixed “What’s New” modal rendering | Markdown headings and tables now render correctly and are easier to read |

## Downloader

| What changed | What you get |
|---|---|
| Improved link validation before downloads | Clearer error reasons |
| Better resilience to YouTube limits | Improved handling of temporary limits |
| Added proper download resume (**resume**) | Less progress loss on restart |
| Improved URL input | Better highlight states, drag-and-drop, and faster repeated input |
| Optimized queue start and processing | More stable task execution |
| Fixed task title issues after restart | Correct labels in the list |
| Improved History file handling | Safer deletion through system trash |

## Download Queue

| What changed | What you get |
|---|---|
| Fully redesigned queue interface | Task cards, statuses, and progress are easier to read |
| Added pause/start and clearer controls | Easier task flow control |
| Improved retry flow and error handling | Fewer manual recovery steps |
| Queue block auto-hides when empty | Cleaner interface |
| Added queue clear confirmation | Lower risk of accidental deletion |

## Quality Picker

| What changed | What you get |
|---|---|
| Updated formats list design | More compact and easier to scan |
| Improved keyboard navigation and actions logic | Faster mouse-free workflow |
| Fixed scrolling and close issues | More stable modal behavior |
| Added clear loading states and placeholders | Fewer confusing empty states |

## Download History

| What changed | What you get |
|---|---|
| Fully redesigned list visuals | Better readability |
| Added date-group actions | Faster bulk operations |
| Improved search and filters | Easier record discovery |
| Added list virtualization | Better performance on large histories |
| Improved record details card | Faster understanding of entry details |

## Tools

| What changed | What you get |
|---|---|
| Hardened IPC bridge between UI and core | Safer module interaction |
| Fixed WireGuard compatibility after security changes | Stable WG workflows |
| Improved tools folder handling and discovery | More reliable binary detection |
| Added tools fallback during downloads | Fewer download startup failures |
| Improved dependency install progress indication | Clearer install state feedback |
| Added file hash checks (MD5, SHA-1, SHA-256, SHA-512) | Easier integrity verification |

## Backup

| What changed | What you get |
|---|---|
| Improved ZIP backup reliability on Windows when the standard command is unavailable | Backup does not fail immediately when `Compress-Archive` is unavailable |
