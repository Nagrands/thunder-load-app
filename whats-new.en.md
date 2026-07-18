<!-- version: 1.6.0 -->

# New in version 1.6.0

| What changed                             | What you get                                                                                                                                                                                        |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Player and media library were added      | The Music tab is now a universal **Player** whose media library keeps a stable height between playlists, scrolls long lists inside their panels, and keeps the mini-player compact                  |
| Now Playing music mode was added         | A full-window media scene plays local audio and video files, preserves the queue, keeps playing in the background, and provides a pinnable hover panel, native fullscreen, and auto-hiding controls |
| Subtitle downloads were added            | Quality selection now has a Subtitles tab that saves RU/EN subtitle tracks as SRT files                                                                                                             |
| App settings were simplified             | The version block now shows only Thunder and Electron, with compact icon actions and accessible tooltips                                                                                            |
| Shortcut management was redesigned       | All 16 shortcuts now live in Settings, where they can be searched, reassigned with conflict checks, reset, and transferred through configuration export/import                                      |
| URL source recognition was improved      | The source icon now switches instantly to YouTube, Twitch, VK Video, or Coub as a link is recognized and returns to the globe when the field is cleared                                             |
| Compact quality selection was simplified | Compact mode now shows only video and audio options; subtitle selection remains available in the full quality dialog                                                                                |
| Interface diagnostics were refined       | Required DOM elements are now validated once during renderer startup without false errors when individual modules load                                                                              |
| Rapid tab switching was stabilized       | Rapid hotkey switching no longer hides the active tab content when a previous transition finishes                                                                                                   |
| The Tools tab now opens more smoothly    | Its header and tool cards appear in a quick sequence on every visit, while the system reduced-motion preference is fully respected                                                                  |
| The Tools set was simplified             | WinGet Installer and all of its related application components were removed                                                                                                                         |
| Release workflow was stabilized          | macOS and Windows builds now publish sequentially so GitHub Releases are not duplicated for the same tag                                                                                            |
| Release artifacts were simplified        | macOS publishes only Intel and Apple Silicon DMG installers without auto-update files, while the Windows build still runs after a macOS job failure                                                 |
