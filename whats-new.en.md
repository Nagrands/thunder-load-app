<!-- version: 1.6.0 -->

# New in version 1.6.0

| What changed                       | What you get                                                                                                              |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Subtitle downloads were added      | Quality selection now has a Subtitles tab that saves RU/EN subtitle tracks as SRT files                                   |
| YouTube cookies were added         | Downloader settings can pass cookies from a browser or cookies.txt file for videos that require sign-in or verification   |
| Settings accessibility improved    | Sections, language, theme, and text-size controls now support keyboard navigation and expose correct screen-reader states  |
| Settings modal behavior was fixed  | Escape, close actions, and Ctrl/Cmd+, now share one lifecycle without reopening the modal or losing focus                  |
| App startup was refined            | Download history storage IPC moved into a separate module with focused load/save/clear/count coverage                     |
| App startup was refined            | Download history preview cache IPC moved into a separate module with focused cache/delete coverage                        |
| App startup was refined            | Hash check IPC moved into a separate module with focused pick, inspect, calculate, and progress coverage                  |
| Tools were reorganized             | yt-dlp, ffmpeg, and Deno dependency management moved from Downloader settings into its own tool                           |
| Tools were reorganized             | Tool cards now show a version badge, and Downloader Dependencies is pinned first with a New label                         |
| Download history was fixed         | Preview images no longer cover details, and Play now opens the downloaded file instead of the image preview               |
| macOS yt-dlp checks were fixed     | Thunder no longer launches Python-backed `yt-dlp`, preventing repeated `Python.framework` verification prompts            |
