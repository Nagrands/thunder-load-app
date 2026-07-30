import { t } from "../i18n.js";
import { setPlayerIcon } from "./playerIcons.js";
import { formatPlaybackTime, setPressedState } from "./viewUtils.js";

export function createPlaybackControlsView({
  root,
  controlsVisibility,
  playButton,
  muteButton,
  shuffleButton,
  repeatButton,
  progress,
  volume,
  volumePercent,
  currentTime,
  duration,
  controlsSurface,
}) {
  let lastCurrentSecond = null;
  let lastDurationSecond = null;
  let lastRemainingSecond = null;
  let lastVolumeKey = "";
  let controlsHideVersion = 0;
  let hadPlaybackSession = false;
  function setControlLabel(button, label) {
    if (!button) return;
    button.setAttribute("aria-label", label);
    button.setAttribute("title", label);
    button.setAttribute("data-bs-original-title", label);
  }

  return (snapshot) => {
    setPlayerIcon(
      playButton,
      snapshot.isLoading
        ? "loader-circle"
        : snapshot.isPlaying
          ? "pause"
          : "play",
      { spinning: snapshot.isLoading },
    );
    if (playButton) {
      playButton.disabled = snapshot.isLoading;
      playButton.setAttribute("aria-busy", String(snapshot.isLoading));
    }
    setControlLabel(
      playButton,
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
      const repeatLabel = t(`nowPlaying.repeat.${snapshot.repeat}`);
      setControlLabel(repeatButton, repeatLabel);
      const repeatText = repeatButton.querySelector("span:not([aria-hidden])");
      if (repeatText) repeatText.textContent = repeatLabel;
      let indicator = repeatButton.querySelector(
        ".now-playing__repeat-indicator",
      );
      if (!indicator) {
        indicator = document.createElement("span");
        indicator.className = "now-playing__repeat-indicator";
        indicator.setAttribute("aria-hidden", "true");
        repeatButton.appendChild(indicator);
      }
      indicator.textContent = snapshot.repeat === "one" ? "1" : "";
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
      const bufferedPercent = snapshot.duration
        ? (Math.min(snapshot.bufferedEnd || 0, snapshot.duration) /
            snapshot.duration) *
          100
        : 0;
      progress.style.setProperty(
        "--range-buffered",
        `${Math.max(progressPercent, Math.min(100, bufferedPercent))}%`,
      );
      progress.setAttribute(
        "aria-valuetext",
        `${formatPlaybackTime(snapshot.currentTime)} / ${formatPlaybackTime(snapshot.duration)}`,
      );
    }
    if (volume) {
      const effectiveVolume = snapshot.muted ? 0 : snapshot.volume;
      const effectivePercent = Math.round(effectiveVolume * 100);
      const volumeKey = `${effectiveVolume}:${effectivePercent}`;
      if (volumeKey !== lastVolumeKey) {
        lastVolumeKey = volumeKey;
        volume.value = String(effectiveVolume);
        volume.style.setProperty(
          "--range-progress",
          `${effectiveVolume * 100}%`,
        );
        volume.setAttribute("aria-valuetext", `${effectivePercent}%`);
        if (volumePercent) volumePercent.textContent = `${effectivePercent}%`;
      }
    }
    const currentSecond = Math.floor(Number(snapshot.currentTime) || 0);
    if (currentTime && currentSecond !== lastCurrentSecond) {
      lastCurrentSecond = currentSecond;
      currentTime.textContent = formatPlaybackTime(snapshot.currentTime);
    }
    const durationSecond = Math.floor(Number(snapshot.duration) || 0);
    const remainingSecond = Math.max(0, durationSecond - currentSecond);
    if (
      duration &&
      (durationSecond !== lastDurationSecond ||
        remainingSecond !== lastRemainingSecond)
    ) {
      lastDurationSecond = durationSecond;
      lastRemainingSecond = remainingSecond;
      duration.textContent = `-${formatPlaybackTime(remainingSecond)}`;
    }
    const muted = snapshot.muted || snapshot.volume === 0;
    setPressedState(muteButton, muted);
    setControlLabel(
      muteButton,
      t(muted ? "nowPlaying.unmute" : "nowPlaying.mute"),
    );
    setPlayerIcon(muteButton, muted ? "volume-x" : "volume-2");
    root.classList.toggle("is-playing", snapshot.isPlaying);
    root.classList.toggle("is-loading", snapshot.isLoading);
    const hasPlaybackSession = Boolean(
      snapshot.currentTrack &&
      (snapshot.isLoading || snapshot.isPlaying || !snapshot.isStopped),
    );
    root.classList.toggle("has-playback-session", hasPlaybackSession);
    if (controlsSurface) {
      controlsSurface.setAttribute("aria-hidden", String(!hasPlaybackSession));
      if (hasPlaybackSession) {
        controlsHideVersion += 1;
        controlsSurface.removeAttribute("inert");
      } else if (hadPlaybackSession) {
        const hideVersion = ++controlsHideVersion;
        const reducedMotion = window.matchMedia?.(
          "(prefers-reduced-motion: reduce)",
        )?.matches;
        setTimeout(
          () => {
            if (
              hideVersion === controlsHideVersion &&
              !root.classList.contains("has-playback-session")
            ) {
              controlsSurface.setAttribute("inert", "");
            }
          },
          reducedMotion ? 0 : 220,
        );
      } else {
        controlsSurface.setAttribute("inert", "");
      }
    }
    hadPlaybackSession = hasPlaybackSession;
    controlsVisibility.setPlaybackState(snapshot.isPlaying);
  };
}

export default createPlaybackControlsView;
