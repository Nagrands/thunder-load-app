import { t } from "../i18n.js";
import createPlayerDialog from "./playerDialog.js";
import {
  createPlayerIcon,
  refreshPlayerIcons,
  setPlayerIcon,
} from "./playerIcons.js";
import {
  formatMediaCodec,
  formatMediaResolution,
  formatMediaSize,
  formatPlaybackTime,
} from "./viewUtils.js";

const SYSTEM_PLAYLIST_IDS = new Set([
  "library",
  "media-library",
  "local-library",
]);
const LIBRARY_FILTERS = new Set(["all", "video", "audio", "missing"]);

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

const ICONS = Object.freeze({
  "fa-solid fa-photo-film": "library",
  "fa-solid fa-list": "list-video",
  "fa-solid fa-volume-high": "volume-2",
  "fa-solid fa-play": "play",
  "fa-solid fa-film": "film",
  "fa-solid fa-music": "music-2",
  "fa-solid fa-ellipsis": "ellipsis",
});

function createIcon(name) {
  return createPlayerIcon(ICONS[name] || name);
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

function setTrackPlaybackLabel(button, trackTitle, {
  current = false,
  loading = false,
  playing = false,
} = {}) {
  const label = `${t(
    loading
      ? "nowPlaying.playback.preparing"
      : current && playing
        ? "nowPlaying.pause"
        : "nowPlaying.play",
  )} ${trackTitle}`;
  ["aria-label", "title", "data-bs-original-title"].forEach((attribute) => {
    button.setAttribute(attribute, label);
  });
}

function normalizeSearchText(value) {
  return String(value || "").trim().toLocaleLowerCase();
}

function matchesSearch(track, query) {
  if (!query) return true;
  return [track.displayTitle, track.title, track.artist, track.album]
    .some((value) => normalizeSearchText(value).includes(query));
}

function matchesFilter(track, filter) {
  if (filter === "missing") return track.availability === "missing";
  if (filter === "video" || filter === "audio") return track.kind === filter;
  return true;
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
  const loading = track.id === snapshot?.loadingTrackId;
  const missing = track.availability === "missing";
  row.className = "player-library__track";
  row.dataset.trackId = track.id;
  row.setAttribute("role", "option");
  row.setAttribute("tabindex", missing ? "-1" : "0");
  row.setAttribute("aria-selected", String(current));
  row.setAttribute("aria-busy", String(loading));
  row.classList.toggle("is-current", current);
  row.classList.toggle("is-loading", loading);
  row.classList.toggle("is-missing", missing);
  if (current) row.setAttribute("aria-current", "true");

  const trackTitle = track.displayTitle || track.title;
  const play = createIconButton(
    "select-library-track",
    loading
      ? "loader-circle"
      : current && snapshot?.isPlaying
        ? "fa-solid fa-volume-high"
        : "fa-solid fa-play",
    "",
    { trackId: track.id },
  );
  setTrackPlaybackLabel(play, trackTitle, {
    current,
    loading,
    playing: snapshot?.isPlaying,
  });
  play.disabled = missing || loading;
  if (loading) {
    play.querySelector("[data-player-icon]")?.classList.add("is-spinning");
  }
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
  title.textContent = trackTitle;
  const secondary = document.createElement("span");
  secondary.className = "player-library__track-secondary";
  secondary.textContent = [track.artist, track.album].filter(Boolean).join(" · ");
  secondary.hidden = !secondary.textContent;
  const badges = document.createElement("span");
  badges.className = "player-library__track-badges";
  [
    formatMediaResolution(track.mediaInfo),
    formatMediaCodec(track.mediaInfo?.videoCodec),
    formatMediaCodec(track.mediaInfo?.audioCodec),
  ]
    .filter(Boolean)
    .forEach((label) => {
      const badge = document.createElement("span");
      badge.textContent = label;
      badges.appendChild(badge);
    });
  badges.hidden = badges.childElementCount === 0;
  const details = document.createElement("span");
  details.className = "player-library__track-details";
  details.append(secondary, badges);
  metadata.append(title, details);

  const duration = document.createElement("span");
  duration.className = "player-library__track-time";
  duration.textContent = formatPlaybackTime(track.duration);

  const size = document.createElement("span");
  size.className = "player-library__track-size";
  size.textContent = formatMediaSize(track.sizeBytes);
  size.hidden = !size.textContent;

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
  const searchInput = root.querySelector('[data-ui="library-search"]');
  const searchClear = root.querySelector('[data-ui="library-search-clear"]');
  const filterButtons = [
    ...root.querySelectorAll('[data-action="set-library-filter"]'),
  ];
  const resultsCount = root.querySelector(
    '[data-ui="library-results-count"]',
  );
  const noResults = root.querySelector('[data-ui="library-no-results"]');
  let trackRowsById = new Map();
  let previousPlaybackTrackId = null;
  let previousLoadingTrackId = null;
  let latestState = {};
  let latestSnapshot = {};
  let searchQuery = "";
  let activeFilter = "all";
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
    latestSnapshot = snapshot || {};
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
    renderTrackList(activeTracks, activePlaylist, latestSnapshot);
    renderSearchControls();
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
    renderPlayback(latestSnapshot);
    refreshPlayerIcons(element);
  }

  function getVisibleTracks(tracks) {
    return tracks
      .map((track, index) => ({ track, index }))
      .filter(({ track }) => matchesSearch(track, searchQuery))
      .filter(({ track }) => matchesFilter(track, activeFilter));
  }

  function renderTrackList(activeTracks, activePlaylist, snapshot) {
    const visibleTracks = getVisibleTracks(activeTracks);
    trackList.replaceChildren(
      ...visibleTracks.map(({ track, index }) =>
        createTrackRow(track, index, activePlaylist, snapshot),
      ),
    );
    trackRowsById = new Map(
      [...trackList.querySelectorAll(".player-library__track")].map((row) => [
        row.dataset.trackId,
        row,
      ]),
    );
    const hasTracks = activeTracks.length > 0;
    const hasResults = visibleTracks.length > 0;
    empty.hidden = hasTracks;
    noResults.hidden = !hasTracks || hasResults;
    trackList.hidden = !hasResults;
    root
      .querySelector(".player-library__column-header")
      ?.toggleAttribute("hidden", !hasResults);
    resultsCount.textContent = t("nowPlaying.library.results", {
      visible: visibleTracks.length,
      total: activeTracks.length,
    });
  }

  function renderSearchControls() {
    searchInput.value = searchQuery;
    searchClear.hidden = !searchQuery;
    filterButtons.forEach((button) => {
      const pressed = button.dataset.filter === activeFilter;
      button.classList.toggle("is-active", pressed);
      button.setAttribute("aria-pressed", String(pressed));
    });
  }

  function rerenderTrackList() {
    const activePlaylist = getActivePlaylist(latestState);
    const activeTracks = getPlaylistTracks(latestState, activePlaylist);
    renderTrackList(activeTracks, activePlaylist, latestSnapshot);
    renderSearchControls();
    refreshPlayerIcons(element);
  }

  function setSearchQuery(value) {
    const nextQuery = normalizeSearchText(value);
    if (nextQuery === searchQuery) return;
    searchQuery = nextQuery;
    rerenderTrackList();
  }

  function setFilter(value) {
    const nextFilter = LIBRARY_FILTERS.has(value) ? value : "all";
    if (nextFilter === activeFilter) return;
    activeFilter = nextFilter;
    rerenderTrackList();
  }

  function clearSearch() {
    if (!searchQuery && activeFilter === "all") return;
    searchQuery = "";
    activeFilter = "all";
    rerenderTrackList();
    searchInput.focus();
  }

  function renderPlayback(snapshot = {}) {
    latestSnapshot = snapshot;
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
      if (!button) return;
      button.disabled = loading || row.classList.contains("is-missing");
      setTrackPlaybackLabel(
        button,
        row.querySelector(".player-library__track-copy strong")?.textContent ||
          "",
        {
          current,
          loading,
          playing: snapshot.isPlaying,
        },
      );
      setPlayerIcon(
        button,
        loading
          ? "loader-circle"
          : current && snapshot.isPlaying
            ? "volume-2"
            : "play",
        { spinning: loading },
      );
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
    setPlayerIcon(
      playButton,
      snapshot.isLoading
        ? "loader-circle"
        : snapshot.isPlaying
          ? "pause"
          : "play",
      { spinning: snapshot.isLoading },
    );
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
    setPlayerIcon(
      muteButton,
      muted ? "volume-x" : volumeValue < 0.5 ? "volume-1" : "volume-2",
    );
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
    setPlayerIcon(
      operationStatus,
      error ? "triangle-alert" : loading ? "loader-circle" : "circle-check",
      { spinning: loading },
    );
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
    clearSearch,
    setFilter,
    setOperationStatus,
    setSearchQuery,
    showYouTubeQualities(payload) {
      return getPlayerDialog().showYouTubeQualities(payload);
    },
    show,
    showDialogError,
  };
}

export default createMediaLibraryView;
