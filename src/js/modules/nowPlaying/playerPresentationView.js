import { t } from "../i18n.js";
import { refreshPlayerIcons, setPlayerIcon } from "./playerIcons.js";
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
  const artworkFallback = root.querySelector(
    ".now-playing__artwork-fallback",
  );
  let trackId = "";
  let generatedPosterTrackId = "";
  let generatedPosterSource = "";

  function clearGeneratedPoster() {
    if (!generatedPoster) return;
    generatedPosterTrackId = "";
    generatedPosterSource = "";
    generatedPoster.hidden = true;
    generatedPoster.removeAttribute("src");
    root.classList.remove("has-generated-poster");
  }

  function onGeneratedPosterLoad() {
    if (
      !generatedPoster ||
      generatedPosterTrackId !== trackId ||
      generatedPoster.getAttribute("src") !== generatedPosterSource
    ) {
      return;
    }
    generatedPoster.hidden = false;
    generatedPoster.closest(".now-playing__artwork-stack").hidden = false;
    root.classList.add("has-generated-poster");
  }

  function onGeneratedPosterError() {
    if (
      generatedPoster?.getAttribute("src") === generatedPosterSource
    ) {
      clearGeneratedPoster();
    }
  }

  generatedPoster?.addEventListener("load", onGeneratedPosterLoad);
  generatedPoster?.addEventListener("error", onGeneratedPosterError);

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
      setPlayerIcon(
        artworkFallback,
        track?.kind === "audio" ? "music-2" : "clapperboard",
      );
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
      generatedPosterTrackId = String(sourceTrackId);
      generatedPosterSource = dataUrl;
      generatedPoster.hidden = true;
      root.classList.remove("has-generated-poster");
      generatedPoster.src = dataUrl;
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
    dispose() {
      generatedPoster?.removeEventListener("load", onGeneratedPosterLoad);
      generatedPoster?.removeEventListener("error", onGeneratedPosterError);
      clearGeneratedPoster();
    },
  };
}

export default createPlayerPresentationView;
