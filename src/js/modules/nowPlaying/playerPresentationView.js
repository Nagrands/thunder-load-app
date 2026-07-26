import { t } from "../i18n.js";
import { refreshPlayerIcons } from "./playerIcons.js";
import {
  formatMediaCodec,
  formatMediaResolution,
  formatMediaSize,
} from "./viewUtils.js";

export function createPlayerPresentationView({ root }) {
  const floatingTitle = root.querySelector('[data-ui="floating-title"]');
  const floatingButton = floatingTitle?.closest("button");
  const badges = root.querySelector('[data-ui="media-badges"]');
  const size = root.querySelector('[data-ui="media-size"]');
  const caption = root.querySelector('[data-ui="playlist-caption"]');
  const generatedPoster = root.querySelector('[data-ui="generated-poster"]');
  let trackId = "";

  function clearGeneratedPoster() {
    if (!generatedPoster) return;
    generatedPoster.hidden = true;
    generatedPoster.removeAttribute("src");
    root.classList.remove("has-generated-poster");
  }

  function renderBadges(track) {
    if (!badges) return;
    const info = track?.mediaInfo || {};
    const labels = [
      formatMediaResolution(info),
      formatMediaCodec(info.videoCodec),
      formatMediaCodec(info.audioCodec),
    ].filter(Boolean);
    badges.replaceChildren(
      ...labels.map((label) => {
        const badge = document.createElement("span");
        badge.textContent = label;
        return badge;
      }),
    );
    badges.hidden = labels.length === 0;
  }

  return {
    update(snapshot) {
      const track = snapshot.currentTrack;
      const nextTrackId = String(track?.id || "");
      if (trackId !== nextTrackId) {
        trackId = nextTrackId;
        clearGeneratedPoster();
      }
      if (floatingTitle) {
        floatingTitle.textContent =
          track?.displayTitle || track?.title || t("nowPlaying.label");
      }
      if (floatingButton) floatingButton.disabled = !track;
      renderBadges(track);
      if (size) {
        size.textContent = formatMediaSize(track?.sizeBytes);
        size.hidden = !size.textContent;
      }
      if (caption) {
        caption.textContent = t("nowPlaying.playlist.count", {
          count: snapshot.queue.length,
        });
      }
    },
    useGeneratedPoster(sourceTrackId, dataUrl) {
      if (
        !generatedPoster ||
        !dataUrl ||
        String(sourceTrackId || "") !== trackId
      ) {
        return;
      }
      generatedPoster.src = dataUrl;
      generatedPoster.hidden = false;
      generatedPoster.closest(".now-playing__artwork-stack").hidden = false;
      root.classList.add("has-generated-poster");
    },
    getPosterUrl(track) {
      if (!generatedPoster?.hidden) {
        return generatedPoster.currentSrc || generatedPoster.src || "";
      }
      return String(track?.artworkUrl || "");
    },
    refreshIcons() {
      refreshPlayerIcons(root);
    },
  };
}

export default createPlayerPresentationView;
