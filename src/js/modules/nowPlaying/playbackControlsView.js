import { t } from "../i18n.js";
import { formatPlaybackTime, setPressedState } from "./viewUtils.js";

export function createPlaybackControlsView({
  root,
  controlsVisibility,
  brandLabel,
  playButton,
  muteButton,
  shuffleButton,
  repeatButton,
  progress,
  volume,
  volumePercent,
  currentTime,
  duration,
}) {
  return (snapshot) => {
    const playIcon = playButton?.querySelector("i");
    playIcon?.classList.toggle(
      "fa-play",
      !snapshot.isPlaying && !snapshot.isLoading,
    );
    playIcon?.classList.toggle("fa-pause", snapshot.isPlaying);
    playIcon?.classList.toggle("fa-spinner", snapshot.isLoading);
    playIcon?.classList.toggle("fa-spin", snapshot.isLoading);
    if (playButton) {
      playButton.disabled = snapshot.isLoading;
      playButton.setAttribute("aria-busy", String(snapshot.isLoading));
    }
    playButton?.setAttribute(
      "aria-label",
      t(
        snapshot.isLoading
          ? "nowPlaying.playback.preparing"
          : snapshot.isPlaying
            ? "nowPlaying.pause"
            : "nowPlaying.play",
      ),
    );
    setPressedState(shuffleButton, snapshot.shuffle);
    setPressedState(repeatButton, snapshot.repeat !== "off");
    if (repeatButton) {
      repeatButton.dataset.mode = snapshot.repeat;
      repeatButton.setAttribute(
        "aria-label",
        t(`nowPlaying.repeat.${snapshot.repeat}`),
      );
    }
    if (progress) {
      progress.max = String(snapshot.duration || 0);
      progress.value = String(
        Math.min(snapshot.currentTime, snapshot.duration || 0),
      );
      const progressPercent = snapshot.duration
        ? (snapshot.currentTime / snapshot.duration) * 100
        : 0;
      progress.style.setProperty(
        "--range-progress",
        `${Math.min(100, progressPercent)}%`,
      );
      progress.setAttribute(
        "aria-valuetext",
        `${formatPlaybackTime(snapshot.currentTime)} / ${formatPlaybackTime(snapshot.duration)}`,
      );
    }
    if (volume) {
      const effectiveVolume = snapshot.muted ? 0 : snapshot.volume;
      const effectivePercent = Math.round(effectiveVolume * 100);
      volume.value = String(effectiveVolume);
      volume.style.setProperty("--range-progress", `${effectiveVolume * 100}%`);
      volume.setAttribute("aria-valuetext", `${effectivePercent}%`);
      if (volumePercent) volumePercent.textContent = `${effectivePercent}%`;
    }
    if (currentTime) {
      currentTime.textContent = formatPlaybackTime(snapshot.currentTime);
    }
    if (duration) duration.textContent = formatPlaybackTime(snapshot.duration);
    const muted = snapshot.muted || snapshot.volume === 0;
    setPressedState(muteButton, muted);
    muteButton?.setAttribute(
      "aria-label",
      t(muted ? "nowPlaying.unmute" : "nowPlaying.mute"),
    );
    muteButton?.querySelector("i")?.classList.toggle("fa-volume-high", !muted);
    muteButton?.querySelector("i")?.classList.toggle("fa-volume-xmark", muted);
    root.classList.toggle("is-playing", snapshot.isPlaying);
    root.classList.toggle("is-loading", snapshot.isLoading);
    brandLabel.textContent = t(
      snapshot.isLoading
        ? "nowPlaying.playback.preparing"
        : snapshot.currentTrack && !snapshot.isPlaying
          ? "nowPlaying.paused"
          : "nowPlaying.label",
    );
    controlsVisibility.setPlaybackState(snapshot.isPlaying);
  };
}

export default createPlaybackControlsView;
