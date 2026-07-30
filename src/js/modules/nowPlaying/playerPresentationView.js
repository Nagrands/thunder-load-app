import { t } from "../i18n.js";
import { refreshPlayerIcons, setPlayerIcon } from "./playerIcons.js";
import {
  formatMediaCodec,
  formatMediaResolution,
  formatMediaSize,
} from "./viewUtils.js";

export function createPlayerPresentationView({ root }) {
  const topbarTitle = root.querySelector('[data-ui="topbar-title"]');
  const topbarArtist = root.querySelector('[data-ui="topbar-artist"]');
  const topbarMetadata = root.querySelector(".now-playing__topbar-metadata");
  const topbarArtwork = root.querySelector('[data-ui="topbar-artwork"]');
  const topbarArtworkFallback = root.querySelector(
    '[data-ui="topbar-artwork-fallback"]',
  );
  const badges = root.querySelector('[data-ui="media-badges"]');
  const size = root.querySelector('[data-ui="media-size"]');
  const caption = root.querySelector('[data-ui="playlist-caption"]');
  const generatedPoster = root.querySelector('[data-ui="generated-poster"]');
  const artworkFallback = root.querySelector(".now-playing__artwork-fallback");
  let trackId = "";
  let generatedPosterTrackId = "";
  let generatedPosterSource = "";
  let currentArtworkSource = "";
  let topbarArtworkSource = "";

  function setTopbarArtwork(source) {
    if (!topbarArtwork) return;
    const nextSource = String(source || "");
    if (topbarArtworkSource === nextSource) return;
    topbarArtworkSource = nextSource;
    topbarArtwork.hidden = true;
    topbarArtwork
      .closest(".now-playing__topbar-artwork")
      ?.classList.remove("has-image");
    topbarArtwork.removeAttribute("src");
    if (nextSource) topbarArtwork.src = nextSource;
  }

  function onTopbarArtworkLoad() {
    if (
      !topbarArtwork ||
      !topbarArtworkSource ||
      topbarArtwork.getAttribute("src") !== topbarArtworkSource
    ) {
      return;
    }
    topbarArtwork.hidden = false;
    topbarArtwork
      .closest(".now-playing__topbar-artwork")
      ?.classList.add("has-image");
  }

  function onTopbarArtworkError() {
    if (!topbarArtwork) return;
    topbarArtwork.hidden = true;
    topbarArtwork.removeAttribute("src");
    topbarArtwork
      .closest(".now-playing__topbar-artwork")
      ?.classList.remove("has-image");
  }

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
    if (generatedPoster?.getAttribute("src") === generatedPosterSource) {
      clearGeneratedPoster();
      setTopbarArtwork(currentArtworkSource);
    }
  }

  generatedPoster?.addEventListener("load", onGeneratedPosterLoad);
  generatedPoster?.addEventListener("error", onGeneratedPosterError);
  topbarArtwork?.addEventListener("load", onTopbarArtworkLoad);
  topbarArtwork?.addEventListener("error", onTopbarArtworkError);

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
      currentArtworkSource = String(track?.artworkUrl || "");
      if (topbarTitle) {
        topbarTitle.textContent =
          track?.displayTitle || track?.title || t("nowPlaying.label");
      }
      if (topbarArtist) {
        topbarArtist.textContent = String(track?.artist || "");
        topbarArtist.hidden = !topbarArtist.textContent;
      }
      if (topbarMetadata) topbarMetadata.disabled = !track;
      setTopbarArtwork(
        generatedPosterTrackId === trackId && generatedPosterSource
          ? generatedPosterSource
          : currentArtworkSource,
      );
      setPlayerIcon(
        topbarArtworkFallback,
        track?.kind === "audio" ? "music-2" : "clapperboard",
      );
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
      setTopbarArtwork(dataUrl);
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
      topbarArtwork?.removeEventListener("load", onTopbarArtworkLoad);
      topbarArtwork?.removeEventListener("error", onTopbarArtworkError);
      setTopbarArtwork("");
      clearGeneratedPoster();
    },
  };
}

export default createPlayerPresentationView;
