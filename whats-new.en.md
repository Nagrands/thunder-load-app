<!-- version: 1.6.0 -->

# 1.6.0

| What changed                       | What you get                                                                                                              |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Thunder Spark foundation was added | Version 1.6.0 now has the official Thunder Spark release codename and the `Spark ignites the future of downloads.` slogan |
| Video preview was refined          | Duration now sits on the thumbnail, and the live player has a title, metadata, and a more compact layout                  |
| Subtitle downloads were added      | Quality selection now has a Subtitles tab that saves RU/EN subtitle tracks as SRT files                                  |
| YouTube cookies were added         | Downloader settings can pass cookies from a browser or cookies.txt file for videos that require sign-in or verification  |
| YouTube cookies were refined       | Browser cookies are applied only to YouTube links to avoid unnecessary Keychain prompts on other sources                  |
| Subtitle downloads were fixed      | Case-sensitive language codes such as `pt-BR` and `zh-Hans` stay unchanged, and found VTT/TTML files convert to SRT      |
| Subtitle downloads were fixed      | Thunder now finds subtitle files more reliably when yt-dlp saves converted files or automatic caption artifacts           |
| Subtitle downloads were fixed      | Translated automatic captions now download only the selected track instead of mixing it with original subtitles           |
| Download queue was simplified      | Queue filters moved into the header, zero-count statuses no longer take space, and extra bulk buttons were removed        |
| Download queue was refined         | The All button was removed, and the total task count now appears beside the Queue title                                  |
| Download history was redesigned    | Expanded entries now show a larger preview and clean detail rows for source, file, quality, size, and date                |
| Download history was fixed         | Preview images no longer cover details, and Play now opens the downloaded file instead of the image preview               |
| macOS yt-dlp checks were fixed     | Thunder no longer launches Python-backed `yt-dlp`, preventing repeated `Python.framework` verification prompts            |
