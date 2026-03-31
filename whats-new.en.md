<!-- version: 1.4.4 -->

# What's New

---

| What changed | What you get |
|---|---|
| The Products tab diagnostics are now faster and more useful during manual cleanup | Search and local result filters no longer rerender unrelated blocks or collapse an already opened normalization panel, and diagnostics and diff rows now let you jump straight back to the original input line with `Reveal in input` |
| The Products tab formatter now uses a sturdier data-driven normalization layer and section parser | Alias and qualifier normalization now runs through a shared lexicon, while complex heading and grouped-section heuristics moved into a dedicated classifier and are locked down with fixture tests, so noisy lists and borderline section cases should regress less often |
| The Products tab formatter now expands its alias dictionary and splits size qualifiers between sections and Summary | New aliases such as `цв капуста`, `ялта`, `огурец сол`, `киш-миш`, `брокколи`, `пекинка`, `белозерка`, and `перец крым` now normalize into the expected items, plural forms like `лимоны` are reduced to singular names, and size notes such as `крупное`, `мелкое`, and `среднее` no longer clutter section lines and appear only in the aggregate `Summary` block |
| The Products tab formatter now handles heading-free greens lists more reliably | Lines such as `фризе зел`, `дубок кр`, `тимьян`, and `лук зел` are no longer misread as section titles, normalize into the expected greens items, and render without a fake `Без раздела` heading |
