import { t } from "../i18n.js";
import createPlayerDialog from "./playerDialog.js";
import { formatPlaybackTime } from "./viewUtils.js";

const SYSTEM_PLAYLIST_IDS = new Set([
  "library",
  "media-library",
  "local-library",
]);

function getCatalogTracks(state = {}) {
  if (Array.isArray(state.catalog?.tracks)) return state.catalog.tracks;
  if (Array.isArray(state.playlist?.tracks)) return state.playlist.tracks;
  return [];
}

function getPlaylists(state = {}) {
  const tracks = getCatalogTracks(state);
  const library = {
    id: "media-library",
    title: t("nowPlaying.library.title"),
    trackIds: tracks.map((track) => track.id),
    isSystem: true,
  };
  return [library, ...(Array.isArray(state.playlists) ? state.playlists : [])];
}

function isSystemPlaylist(playlist) {
  return (
    playlist?.isSystem === true ||
    playlist?.system === true ||
    SYSTEM_PLAYLIST_IDS.has(playlist?.id)
  );
}

function getActivePlaylist(state) {
  const playlists = getPlaylists(state);
  return (
    playlists.find((playlist) => playlist.id === state.activePlaylistId) ||
    playlists[0]
  );
}

function getPlaylistTracks(state, playlist) {
  const catalog = getCatalogTracks(state);
  if (isSystemPlaylist(playlist)) return catalog;
  const tracksById = new Map(catalog.map((track) => [track.id, track]));
  return (playlist?.trackIds || [])
    .map((trackId) => tracksById.get(trackId))
    .filter(Boolean);
}

function createIcon(className) {
  const icon = document.createElement("i");
  icon.className = className;
  icon.setAttribute("aria-hidden", "true");
  return icon;
}

function createIconButton(action, icon, label, dataset = {}) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "player-library__track-action";
  button.dataset.action = action;
  Object.entries(dataset).forEach(([key, value]) => {
    button.dataset[key] = String(value);
  });
  button.setAttribute("aria-label", label);
  button.setAttribute("title", label);
  button.setAttribute("data-bs-toggle", "tooltip");
  button.setAttribute("data-bs-placement", "top");
  button.appendChild(createIcon(icon));
  return button;
}

function formatFileSize(value) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes <= 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(
    units.length - 1,
    Math.floor(Math.log(bytes) / Math.log(1024)),
  );
  const amount = bytes / 1024 ** exponent;
  return `${amount >= 10 || exponent === 0 ? Math.round(amount) : amount.toFixed(1)} ${units[exponent]}`;
}

function createPlaylistCard(playlist, tracks, active) {
  const card = document.createElement("button");
  card.type = "button";
  card.className = "player-library__playlist-card";
  card.dataset.action = "select-playlist";
  card.dataset.playlistId = playlist.id;
  card.classList.toggle("is-active", active);
  card.setAttribute("aria-current", active ? "true" : "false");

  const artwork = document.createElement("span");
  artwork.className = "player-library__playlist-artwork";
  const firstArtwork = tracks.find((track) => track.artworkUrl)?.artworkUrl;
  if (firstArtwork) {
    const image = document.createElement("img");
    image.src = firstArtwork;
    image.alt = "";
    artwork.appendChild(image);
  } else {
    artwork.appendChild(
      createIcon(
        isSystemPlaylist(playlist)
          ? "fa-solid fa-photo-film"
          : "fa-solid fa-list",
      ),
    );
  }

  const copy = document.createElement("span");
  copy.className = "player-library__playlist-copy";
  const title = document.createElement("strong");
  title.textContent = isSystemPlaylist(playlist)
    ? t("nowPlaying.library.title")
    : playlist.title;
  const count = document.createElement("span");
  count.textContent = t("nowPlaying.library.itemsCount", {
    count: tracks.length,
  });
  copy.append(title, count);
  card.append(artwork, copy);
  return card;
}

function createTrackRow(track, index, playlist, snapshot) {
  const row = document.createElement("div");
  const current = track.id === snapshot?.currentTrack?.id;
  row.className = "player-library__track";
  row.dataset.trackId = track.id;
  row.setAttribute("role", "option");
  row.setAttribute("tabindex", track.availability === "missing" ? "-1" : "0");
  row.setAttribute("aria-selected", String(current));
  row.classList.toggle("is-current", current);
  if (current) row.setAttribute("aria-current", "true");

  const play = createIconButton(
    "select-library-track",
    current && snapshot?.isPlaying
      ? "fa-solid fa-volume-high"
      : "fa-solid fa-play",
    `${t("nowPlaying.play")} ${track.displayTitle || track.title}`,
    { trackId: track.id },
  );
  play.classList.add("player-library__track-play");

  const artwork = document.createElement("span");
  artwork.className = "player-library__track-artwork";
  if (track.artworkUrl) {
    const image = document.createElement("img");
    image.src = track.artworkUrl;
    image.alt = "";
    artwork.appendChild(image);
  } else {
    artwork.appendChild(
      createIcon(
        track.kind === "video" ? "fa-solid fa-film" : "fa-solid fa-music",
      ),
    );
  }

  const metadata = document.createElement("span");
  metadata.className = "player-library__track-copy";
  const title = document.createElement("strong");
  title.textContent = track.displayTitle || track.title;
  const artist = document.createElement("span");
  artist.textContent =
    track.artist || track.album || t("nowPlaying.unknownArtist");
  metadata.append(title, artist);

  const duration = document.createElement("span");
  duration.className = "player-library__track-time";
  duration.textContent = formatPlaybackTime(track.duration);

  const size = document.createElement("span");
  size.className = "player-library__track-size";
  size.textContent = formatFileSize(track.sizeBytes);

  const state = document.createElement("span");
  state.className = "player-library__track-status";
  state.textContent = t(
    track.availability === "missing"
      ? "nowPlaying.library.status.missing"
      : "nowPlaying.library.status.ready",
  );
  state.classList.toggle("is-missing", track.availability === "missing");

  const menu = createIconButton(
    "open-track-context-menu",
    "fa-solid fa-ellipsis",
    t("nowPlaying.context.open"),
    { trackId: track.id, trackIndex: index },
  );
  menu.classList.add("player-library__track-menu");

  row.append(play, artwork, metadata, duration, size, state, menu);
  return row;
}

export function createMediaLibraryView({ root, onDialogSubmit }) {
  const element = root.querySelector('[data-ui="library-view"]');
  const playlistGrid = root.querySelector('[data-ui="library-playlists"]');
  const trackList = root.querySelector('[data-ui="library-tracks"]');
  const empty = root.querySelector('[data-ui="library-empty"]');
  const playlistCount = root.querySelector(
    '[data-ui="library-playlist-count"]',
  );
  const sidebarPlaylistSwitcher = root.querySelector(
    '[data-ui="sidebar-playlist-switcher"]',
  );
  const activeType = root.querySelector('[data-ui="active-playlist-type"]');
  const activeTitle = root.querySelector('[data-ui="active-playlist-title"]');
  const activeSummary = root.querySelector(
    '[data-ui="active-playlist-summary"]',
  );
  const managementActions = root.querySelector(
    '[data-ui="playlist-management-actions"]',
  );
  const miniPlayer = root.querySelector('[data-ui="mini-player"]');
  const operationStatus = root.querySelector(
    '[data-ui="library-operation-status"]',
  );
  let trackRowsById = new Map();
  let previousPlaybackTrackId = null;
  let previousLoadingTrackId = null;
  let latestState = {};
  let playerDialog = null;
  let miniCurrentSecond = -1;
  let miniDurationSecond = -1;
  let miniTrackId = null;

  function getPlayerDialog() {
    if (playerDialog) return playerDialog;
    playerDialog = createPlayerDialog({
      element: document.querySelector('[data-ui="player-form-modal"]'),
      onSubmit: onDialogSubmit,
    });
    return playerDialog;
  }

  function render(state, snapshot) {
    latestState = state || {};
    const playlists = getPlaylists(latestState);
    const activePlaylist = getActivePlaylist(latestState);
    const activeTracks = getPlaylistTracks(latestState, activePlaylist);
    playlistGrid.replaceChildren(
      ...playlists.map((playlist) =>
        createPlaylistCard(
          playlist,
          getPlaylistTracks(latestState, playlist),
          playlist.id === activePlaylist?.id,
        ),
      ),
    );
    sidebarPlaylistSwitcher.replaceChildren(
      ...playlists.map((playlist) => {
        const option = document.createElement("option");
        option.value = playlist.id;
        option.textContent = isSystemPlaylist(playlist)
          ? t("nowPlaying.library.title")
          : playlist.title;
        return option;
      }),
    );
    sidebarPlaylistSwitcher.value = activePlaylist?.id || "media-library";
    trackList.replaceChildren(
      ...activeTracks.map((track, index) =>
        createTrackRow(track, index, activePlaylist, snapshot),
      ),
    );
    trackRowsById = new Map(
      [...trackList.querySelectorAll(".player-library__track")].map((row) => [
        row.dataset.trackId,
        row,
      ]),
    );
    previousPlaybackTrackId = null;
    previousLoadingTrackId = null;
    playlistCount.textContent = String(playlists.length);
    activeType.textContent = t(
      isSystemPlaylist(activePlaylist)
        ? "nowPlaying.library.system"
        : "nowPlaying.playlists.user",
    );
    activeTitle.textContent = isSystemPlaylist(activePlaylist)
      ? t("nowPlaying.library.title")
      : activePlaylist?.title || "";
    activeSummary.textContent = t("nowPlaying.library.itemsCount", {
      count: activeTracks.length,
    });
    managementActions.hidden = isSystemPlaylist(activePlaylist);
    empty.hidden = activeTracks.length > 0;
    trackList.hidden = activeTracks.length === 0;
    renderPlayback(snapshot);
  }

  function renderPlayback(snapshot = {}) {
    renderMiniPlayer(snapshot);
    const affectedIds = new Set([
      previousPlaybackTrackId,
      previousLoadingTrackId,
      snapshot.currentTrack?.id,
      snapshot.loadingTrackId,
    ]);
    affectedIds.forEach((trackId) => {
      const row = trackRowsById.get(trackId);
      if (!row) return;
      const current = row.dataset.trackId === snapshot.currentTrack?.id;
      const loading = row.dataset.trackId === snapshot.loadingTrackId;
      row.classList.toggle("is-current", current);
      row.classList.toggle("is-loading", loading);
      row.setAttribute("aria-busy", String(loading));
      row.setAttribute("aria-selected", String(current));
      if (current) row.setAttribute("aria-current", "true");
      else row.removeAttribute("aria-current");
      const button = row.querySelector('[data-action="select-library-track"]');
      const icon = button?.querySelector("i");
      if (!button || !icon) return;
      button.disabled = loading;
      icon.className = loading
        ? "fa-solid fa-spinner fa-spin"
        : current && snapshot.isPlaying
          ? "fa-solid fa-volume-high"
          : "fa-solid fa-play";
    });
    previousPlaybackTrackId = snapshot.currentTrack?.id || null;
    previousLoadingTrackId = snapshot.loadingTrackId || null;
  }

  function getTrackContext(trackId) {
    const activePlaylist = getActivePlaylist(latestState);
    const tracks = getPlaylistTracks(latestState, activePlaylist);
    const index = tracks.findIndex((track) => track.id === trackId);
    if (index < 0) return null;
    return {
      track: tracks[index],
      index,
      playlist: activePlaylist,
      isSystemPlaylist: isSystemPlaylist(activePlaylist),
    };
  }

  function renderMiniPlayer(snapshot = {}) {
    const track = snapshot.currentTrack;
    miniPlayer.hidden = !track;
    if (!track) {
      miniTrackId = null;
      miniCurrentSecond = -1;
      miniDurationSecond = -1;
      return;
    }
    if (miniTrackId !== track.id) {
      miniTrackId = track.id;
      miniCurrentSecond = -1;
      miniDurationSecond = -1;
    }
    root.querySelector('[data-ui="mini-title"]').textContent =
      track.displayTitle || track.title;
    root.querySelector('[data-ui="mini-artist"]').textContent =
      track.artist || t("nowPlaying.unknownArtist");
    root.querySelector('[data-ui="mini-album"]').textContent = track.album || "";
    const image = root.querySelector('[data-ui="mini-artwork"]');
    const artwork = image.closest(".player-library__mini-artwork");
    image.src = track.artworkUrl || "";
    image.hidden = !track.artworkUrl;
    artwork.classList.toggle("has-artwork", Boolean(track.artworkUrl));

    const playButton = miniPlayer.querySelector('[data-action="play-pause"]');
    const playIcon = playButton.querySelector("i");
    playIcon.className = snapshot.isLoading
      ? "fa-solid fa-spinner fa-spin"
      : snapshot.isPlaying
        ? "fa-solid fa-pause"
        : "fa-solid fa-play";
    playButton.disabled = Boolean(snapshot.isLoading);
    playButton.setAttribute("aria-busy", String(Boolean(snapshot.isLoading)));
    const playLabel = t(
      snapshot.isLoading
        ? "nowPlaying.playback.preparing"
        : snapshot.isPlaying
          ? "nowPlaying.pause"
          : "nowPlaying.play",
    );
    ["aria-label", "title", "data-bs-original-title"].forEach((attribute) =>
      playButton.setAttribute(attribute, playLabel),
    );

    miniPlayer
      .querySelectorAll('[data-action="previous"], [data-action="next"]')
      .forEach((button) => {
        button.disabled = Boolean(snapshot.isLoading || !snapshot.queue?.length);
      });

    const duration = Math.max(0, Number(snapshot.duration) || 0);
    const currentTime = Math.min(
      duration || Number.MAX_SAFE_INTEGER,
      Math.max(0, Number(snapshot.currentTime) || 0),
    );
    const progress = miniPlayer.querySelector('[data-action="seek"]');
    progress.max = String(duration);
    progress.value = String(currentTime);
    progress.disabled = !duration || Boolean(snapshot.isLoading);
    progress.style.setProperty(
      "--range-progress",
      `${duration > 0 ? (currentTime / duration) * 100 : 0}%`,
    );
    progress.setAttribute(
      "aria-valuetext",
      `${formatPlaybackTime(currentTime)} / ${formatPlaybackTime(duration)}`,
    );
    const currentSecond = Math.floor(currentTime);
    const durationSecond = Math.floor(duration);
    if (currentSecond !== miniCurrentSecond) {
      root.querySelector('[data-ui="mini-current-time"]').textContent =
        formatPlaybackTime(currentTime);
      miniCurrentSecond = currentSecond;
    }
    if (durationSecond !== miniDurationSecond) {
      root.querySelector('[data-ui="mini-duration"]').textContent =
        formatPlaybackTime(duration);
      miniDurationSecond = durationSecond;
    }

    const muted = Boolean(snapshot.muted);
    const volumeValue = muted ? 0 : Math.max(0, Number(snapshot.volume) || 0);
    const volume = miniPlayer.querySelector('[data-action="volume"]');
    volume.value = String(volumeValue);
    volume.style.setProperty("--range-progress", `${volumeValue * 100}%`);
    volume.setAttribute("aria-valuetext", `${Math.round(volumeValue * 100)}%`);
    const muteButton = miniPlayer.querySelector('[data-action="mute"]');
    const muteLabel = t(muted ? "nowPlaying.unmute" : "nowPlaying.mute");
    muteButton.setAttribute("aria-pressed", String(muted));
    ["aria-label", "title", "data-bs-original-title"].forEach((attribute) =>
      muteButton.setAttribute(attribute, muteLabel),
    );
    muteButton.querySelector("i").className = muted
      ? "fa-solid fa-volume-xmark"
      : volumeValue < 0.5
        ? "fa-solid fa-volume-low"
        : "fa-solid fa-volume-high";
  }

  function show() {
    element.hidden = false;
    root.classList.add("is-library-view");
    element.querySelector("h1")?.focus?.();
  }

  function hide() {
    element.hidden = true;
    root.classList.remove("is-library-view");
  }

  function openDialog(nextMode, context = {}) {
    const activePlaylist = getActivePlaylist(latestState);
    const userPlaylists = getPlaylists(latestState).filter(
      (playlist) => !isSystemPlaylist(playlist),
    );
    return getPlayerDialog().open(nextMode, {
      ...context,
      activePlaylist,
      userPlaylists,
    });
  }

  function closeDialog() {
    return playerDialog?.close() ?? false;
  }

  function showDialogError(message) {
    getPlayerDialog().showError(message);
  }

  function setOperationStatus(
    message,
    { loading = false, error = false } = {},
  ) {
    operationStatus.hidden = !message;
    operationStatus.classList.toggle("is-loading", loading);
    operationStatus.classList.toggle("is-error", error);
    operationStatus.querySelector("i").className = error
      ? "fa-solid fa-triangle-exclamation"
      : loading
        ? "fa-solid fa-spinner fa-spin"
        : "fa-solid fa-circle-check";
    operationStatus.querySelector("span").textContent = message || "";
  }

  return {
    closeDialog,
    dispose() {
      closeDialog();
      playerDialog?.dispose();
      playerDialog = null;
    },
    getActivePlaylist: () => getActivePlaylist(latestState),
    getTrackContext,
    hide,
    openDialog,
    render,
    renderPlayback,
    setOperationStatus,
    showYouTubeQualities(payload) {
      return getPlayerDialog().showYouTubeQualities(payload);
    },
    show,
    showDialogError,
  };
}

export default createMediaLibraryView;
