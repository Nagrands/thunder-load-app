import { t } from "../i18n.js";

function formatTime(value) {
  const seconds = Math.max(0, Math.floor(Number(value) || 0));
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

function createTrackRow(track, index, currentTrackId, isPlaying) {
  const row = document.createElement("div");
  const unavailable = track.availability !== "available";
  row.className = "now-playing__track";
  row.dataset.trackId = track.id;
  row.setAttribute("role", "option");
  row.setAttribute("tabindex", unavailable ? "-1" : "0");
  row.setAttribute("aria-selected", String(track.id === currentTrackId));
  if (track.id === currentTrackId) row.setAttribute("aria-current", "true");
  row.classList.toggle("is-current", track.id === currentTrackId);
  row.classList.toggle("is-playing", track.id === currentTrackId && isPlaying);
  row.classList.toggle("is-unavailable", unavailable);

  const indexLabel = document.createElement("span");
  indexLabel.className = "now-playing__track-index";
  indexLabel.textContent = String(index + 1).padStart(2, "0");

  const play = document.createElement("button");
  play.type = "button";
  play.className = "now-playing__track-play";
  play.dataset.action = "select-track";
  play.setAttribute("aria-label", `${t("nowPlaying.play")} ${track.title}`);
  play.disabled = unavailable;
  play.innerHTML = '<i class="fa-solid fa-play" aria-hidden="true"></i>';

  const name = document.createElement("span");
  name.className = "now-playing__track-name";
  name.textContent = track.title;

  const duration = document.createElement("span");
  duration.className = "now-playing__track-duration";
  duration.textContent = formatTime(track.duration);

  const waveform = document.createElement("span");
  waveform.className = "now-playing__waveform";
  waveform.setAttribute("aria-hidden", "true");
  waveform.append(
    ...Array.from({ length: 4 }, () => document.createElement("span")),
  );

  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "now-playing__track-remove";
  remove.dataset.action = "remove-track";
  remove.setAttribute("aria-label", `${t("nowPlaying.remove")} ${track.title}`);
  remove.innerHTML = '<i class="fa-solid fa-xmark" aria-hidden="true"></i>';

  const leading = document.createElement("span");
  leading.className = "now-playing__track-leading";
  leading.append(indexLabel, play);
  row.append(leading, name, waveform, duration, remove);
  return row;
}

export function createPlaylistRenderer(playlist) {
  let signature = "";
  return (snapshot) => {
    const nextSignature = snapshot.queue
      .map((track) => `${track.id}:${track.availability}`)
      .join("|");
    if (nextSignature !== signature) {
      signature = nextSignature;
      playlist.replaceChildren(
        ...snapshot.queue.map((track, index) =>
          createTrackRow(
            track,
            index,
            snapshot.currentTrack?.id,
            snapshot.isPlaying,
          ),
        ),
      );
      return;
    }
    playlist.querySelectorAll(".now-playing__track").forEach((row) => {
      const current = row.dataset.trackId === snapshot.currentTrack?.id;
      row.classList.toggle("is-current", current);
      row.classList.toggle("is-playing", current && snapshot.isPlaying);
      row.setAttribute("aria-selected", String(current));
      if (current) row.setAttribute("aria-current", "true");
      else row.removeAttribute("aria-current");
    });
  };
}

export default createPlaylistRenderer;
