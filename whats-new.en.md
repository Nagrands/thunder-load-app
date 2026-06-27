<!-- version: 1.6.0 -->

# New in version 1.6.0

| What changed                       | What you get                                                                                                              |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Subtitle downloads were added      | Quality selection now has a Subtitles tab that saves RU/EN subtitle tracks as SRT files                                   |
| YouTube cookies were added         | Downloader settings can pass cookies from a browser or cookies.txt file for videos that require sign-in or verification   |
| Settings accessibility improved    | Sections, language, theme, and text-size controls now support keyboard navigation and expose correct screen-reader states  |
| Settings modal behavior was fixed  | Escape, close actions, and Ctrl/Cmd+, now share one lifecycle without reopening the modal or losing focus                  |
| Downloader settings were simplified | YouTube cookies moved into a compact advanced section that still shows the currently selected mode                         |
| Settings architecture was refined  | YouTube cookies logic moved out of the shared settings module into a focused, tested component                             |
| Web interface settings were fixed   | Web-control settings show localized labels again, control the server, and restart it after app relaunch                   |
| Settings architecture was refined  | Web-control settings moved into a focused module with repeated-initialization protection                                  |
| Settings architecture was refined  | Download quality profile settings moved into a focused module with stable keyboard state                                  |
| Settings were compacted            | App information moved to the top of General settings, and download quality selection is more compact                      |
| Quality selection was compacted     | The active format tab shows its full label, while inactive tabs stay compact icons with tooltip labels                   |
| Quality selection was refined       | Added smooth animations for modal opening, tab switching, and preview reveal after loading                               |
| Settings were refined               | The Web interface section now starts collapsed and shows its current status in the header                                |
| App startup was refined            | Download history storage IPC moved into a separate module with focused load/save/clear/count coverage                     |
| App startup was refined            | Download history preview cache IPC moved into a separate module with focused cache/delete coverage                        |
| App startup was refined            | Hash check IPC moved into a separate module with focused pick, inspect, calculate, and progress coverage                  |
| Tools were reorganized             | yt-dlp, ffmpeg, and Deno dependency management moved from Downloader settings into its own tool                           |
| Tools were reorganized             | Tool cards now show a version badge, and Downloader Dependencies is pinned first with a New label                         |
| Download history was fixed         | Preview images no longer cover details, and Play now opens the downloaded file instead of the image preview               |
| macOS yt-dlp checks were fixed     | Thunder no longer launches Python-backed `yt-dlp`, preventing repeated `Python.framework` verification prompts            |
