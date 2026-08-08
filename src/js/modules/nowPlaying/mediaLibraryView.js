import { t } from "../i18n.js";
import {
  FAVORITES_ID,
  getSmartCollectionTrackIds,
  MEDIA_LIBRARY_ID,
  RECENTLY_ADDED_ID,
} from "./mediaLibraryModel.js";
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
  MEDIA_LIBRARY_ID,
  "local-library",
  RECENTLY_ADDED_ID,
  FAVORITES_ID,
]);
const LIBRARY_FILTERS = new Set([
  "all",
  "video",
  "audio",
  "playlists",
  "missing",
]);

function getCatalogTracks(state = {}) {
  if (Array.isArray(state.catalog?.tracks)) return state.catalog.tracks;
  if (Array.isArray(state.playlist?.tracks)) return state.playlist.tracks;
  return [];
}

const logMediaLibrary = (level, event, context = {}) =>
  window.electron?.diagnostics?.log?.(
    "MediaLibrary",
    level,
    event,
    context,
  );

function getSystemCollections(state = {}) {
  const tracks = getCatalogTracks(state);
  return [
    {
      id: MEDIA_LIBRARY_ID,
      title: t("nowPlaying.library.title"),
      icon: "library",
      trackIds: tracks.map((track) => track.id),
      isSystem: true,
    },
    {
      id: RECENTLY_ADDED_ID,
      title: t("nowPlaying.library.recent"),
      icon: "clock-3",
      trackIds: getSmartCollectionTrackIds(tracks, RECENTLY_ADDED_ID),
      isSystem: true,
    },
    {
      id: FAVORITES_ID,
      title: t("nowPlaying.library.favorites"),
      icon: "star",
      trackIds: getSmartCollectionTrackIds(tracks, FAVORITES_ID),
      isSystem: true,
    },
  ];
}

function getUserPlaylists(state = {}) {
  return Array.isArray(state.playlists) ? state.playlists : [];
}

function getPlaylists(state = {}) {
  return [...getSystemCollections(state), ...getUserPlaylists(state)];
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

function setTrackPlaybackLabel(
  button,
  trackTitle,
  { current = false, loading = false, playing = false } = {},
) {
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
  return String(value || "")
    .trim()
    .toLocaleLowerCase();
}

function matchesSearch(track, query) {
  if (!query) return true;
  return [track.displayTitle, track.title, track.artist, track.album].some(
    (value) => normalizeSearchText(value).includes(query),
  );
}

function matchesFilter(track, filter) {
  if (filter === "missing") return track.availability === "missing";
  if (filter === "video" || filter === "audio") return track.kind === filter;
  return true;
}

function createPlaylistButton(playlist, tracks, active, className) {
  const card = document.createElement("button");
  card.type = "button";
  card.className = className;
  card.dataset.action = "select-playlist";
  card.dataset.playlistId = playlist.id;
  card.classList.toggle("is-active", active);
  card.setAttribute("aria-current", active ? "true" : "false");

  const artwork = document.createElement("span");
  artwork.className = "player-library__playlist-artwork";
  const firstArtwork = !isSystemPlaylist(playlist)
    ? tracks.find((track) => track.artworkUrl)?.artworkUrl
    : "";
  if (firstArtwork) {
    const image = document.createElement("img");
    image.src = firstArtwork;
    image.alt = "";
    image.addEventListener(
      "error",
      () => {
        image.replaceWith(createIcon(playlist.icon || "fa-solid fa-list"));
      },
      { once: true },
    );
    artwork.appendChild(image);
  } else {
    artwork.appendChild(
      createIcon(
        playlist.icon ||
          (isSystemPlaylist(playlist)
            ? "fa-solid fa-photo-film"
            : "fa-solid fa-list"),
      ),
    );
  }

  const copy = document.createElement("span");
  copy.className = "player-library__playlist-copy";
  const title = document.createElement("strong");
  title.textContent = playlist.title;
  const count = document.createElement("span");
  count.textContent = t("nowPlaying.library.itemsCount", {
    count: tracks.length,
  });
  copy.append(title, count);
  card.append(artwork, copy);
  return card;
}

function createSidebarPlaylistItem(playlist, tracks, active) {
  const item = document.createElement("div");
  item.className = "player-library__playlist-item";
  item.classList.toggle("is-active", active);
  item.appendChild(
    createPlaylistButton(
      playlist,
      tracks,
      active,
      "player-library__playlist-card",
    ),
  );
  if (isSystemPlaylist(playlist)) return item;

  const menu = document.createElement("details");
  menu.className = "player-library__playlist-actions";
  const summary = document.createElement("summary");
  summary.setAttribute("aria-label", t("nowPlaying.context.open"));
  summary.setAttribute("aria-haspopup", "menu");
  summary.setAttribute("aria-expanded", "false");
  summary.appendChild(createIcon("ellipsis"));
  const popup = document.createElement("div");
  popup.id = `player-library-playlist-actions-${encodeURIComponent(
    String(playlist.id),
  )}`;
  popup.setAttribute("role", "menu");
  summary.setAttribute("aria-controls", popup.id);
  if (typeof popup.showPopover === "function") popup.popover = "manual";
  [
    ["rename", "pencil", "nowPlaying.playlists.rename"],
    ["delete", "trash-2", "nowPlaying.playlists.delete"],
  ].forEach(([mode, icon, labelKey]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.action = "manage-playlist";
    button.dataset.playlistId = playlist.id;
    button.dataset.playlistMode = mode;
    button.setAttribute("role", "menuitem");
    button.append(createIcon(icon), document.createTextNode(t(labelKey)));
    popup.appendChild(button);
  });
  menu.append(summary, popup);
  item.appendChild(menu);
  return item;
}

function createPlaylistBrowserCard(playlist, tracks, active) {
  return createPlaylistButton(
    playlist,
    tracks,
    active,
    "player-library__browser-card",
  );
}

function createSidebarPlaylistOption(playlist, tracks, active) {
  const option = document.createElement("button");
  option.type = "button";
  option.className = "now-playing__playlist-menu-option";
  option.dataset.action = "select-sidebar-playlist";
  option.dataset.playlistId = playlist.id;
  option.dataset.value = playlist.id;
  option.setAttribute("role", "option");
  option.setAttribute("aria-selected", String(active));
  option.tabIndex = -1;
  option.classList.toggle("is-active", active);
  option.appendChild(
    createIcon(isSystemPlaylist(playlist) ? "library" : "list-video"),
  );

  const copy = document.createElement("span");
  const title = document.createElement("strong");
  title.textContent = playlist.title;
  const count = document.createElement("small");
  count.textContent = t("nowPlaying.library.itemsCount", {
    count: tracks.length,
  });
  copy.append(title, count);

  const check = createIcon("check");
  check.classList.add("now-playing__playlist-menu-check");
  option.append(copy, check);
  return option;
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
    image.addEventListener(
      "error",
      () => {
        image.replaceWith(
          createIcon(
            track.kind === "video" ? "fa-solid fa-film" : "fa-solid fa-music",
          ),
        );
      },
      { once: true },
    );
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
  secondary.textContent = [track.artist, track.album]
    .filter(Boolean)
    .join(" · ");
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
  const collectionGrid = root.querySelector('[data-ui="library-collections"]');
  const playlistGrid = root.querySelector('[data-ui="library-playlists"]');
  const playlistBrowser = root.querySelector(
    '[data-ui="library-playlist-browser"]',
  );
  const trackList = root.querySelector('[data-ui="library-tracks"]');
  const empty = root.querySelector('[data-ui="library-empty"]');
  const emptyTitle = root.querySelector('[data-ui="library-empty-title"]');
  const noPlaylists = root.querySelector('[data-ui="library-no-playlists"]');
  const librarySidebar = root.querySelector('[data-ui="library-sidebar"]');
  const librarySidebarScrim = root.querySelector(
    '[data-ui="library-sidebar-scrim"]',
  );
  const librarySidebarToggle = root.querySelector(
    '[data-action="toggle-library-sidebar"]',
  );
  const sidebarPlaylistSwitcher = root.querySelector(
    '[data-ui="sidebar-playlist-switcher"]',
  );
  const sidebarPlaylistLabel = root.querySelector(
    '[data-ui="sidebar-playlist-label"]',
  );
  const sidebarPlaylistMenu = root.querySelector(
    '[data-ui="sidebar-playlist-menu"]',
  );
  const activeType = root.querySelector('[data-ui="active-playlist-type"]');
  const activeTitle = root.querySelector('[data-ui="active-playlist-title"]');
  const activeSummary = root.querySelector(
    '[data-ui="active-playlist-summary"]',
  );
  const managementActions = root.querySelector(
    '[data-ui="playlist-management-actions"]',
  );
  const clearMediaLibraryAction = managementActions.querySelector(
    '[data-action="clear-media-library"]',
  );
  const userPlaylistActions = [
    ...managementActions.querySelectorAll(
      '[data-action="open-rename-playlist-dialog"], [data-action="delete-playlist"]',
    ),
  ];
  const miniPlayer = root.querySelector('[data-ui="mini-player"]');
  const operationStatus = root.querySelector(
    '[data-ui="library-operation-status"]',
  );
  const searchInput = root.querySelector('[data-ui="library-search"]');
  const searchClear = root.querySelector('[data-ui="library-search-clear"]');
  const filterButtons = [
    ...root.querySelectorAll('[data-action="set-library-filter"]'),
  ];
  const moreFilters = root.querySelector(
    '[data-ui="library-more-filters"]',
  );
  const resultsCount = root.querySelector('[data-ui="library-results-count"]');
  const noResults = root.querySelector('[data-ui="library-no-results"]');
  const columnHeader = root.querySelector(".player-library__column-header");
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
  let transientPosterTrackId = "";
  let transientPosterUrl = "";
  let sidebarOpen = false;
  let sidebarReturnFocus = null;
  const failedArtworkSources = new Set();
  const compactSidebarQuery = window.matchMedia?.("(max-width: 1039px)");

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
    syncFilterAvailability(getCatalogTracks(latestState));
    const collections = getSystemCollections(latestState);
    const userPlaylists = getUserPlaylists(latestState);
    const playlists = [...collections, ...userPlaylists];
    const activePlaylist = getActivePlaylist(latestState);
    const activeTracks = getPlaylistTracks(latestState, activePlaylist);
    collectionGrid.replaceChildren(
      ...collections.map((playlist) =>
        createSidebarPlaylistItem(
          playlist,
          getPlaylistTracks(latestState, playlist),
          playlist.id === activePlaylist?.id,
        ),
      ),
    );
    playlistGrid.replaceChildren(
      ...userPlaylists.map((playlist) =>
        createSidebarPlaylistItem(
          playlist,
          getPlaylistTracks(latestState, playlist),
          playlist.id === activePlaylist?.id,
        ),
      ),
    );
    sidebarPlaylistMenu.replaceChildren(
      ...playlists.map((playlist) =>
        createSidebarPlaylistOption(
          playlist,
          getPlaylistTracks(latestState, playlist),
          playlist.id === activePlaylist?.id,
        ),
      ),
    );
    sidebarPlaylistSwitcher.dataset.playlistId =
      activePlaylist?.id || MEDIA_LIBRARY_ID;
    sidebarPlaylistLabel.textContent = activePlaylist?.title || "";
    closeSidebarPlaylistMenu();
    renderContent(activeTracks, activePlaylist, latestSnapshot);
    renderSearchControls();
    previousPlaybackTrackId = null;
    previousLoadingTrackId = null;
    activeType.textContent = t(
      activeFilter === "playlists"
        ? "nowPlaying.playlists.kicker"
        : isSystemPlaylist(activePlaylist)
          ? "nowPlaying.library.system"
          : "nowPlaying.playlists.user",
    );
    activeTitle.textContent =
      activeFilter === "playlists"
        ? t("nowPlaying.playlists.title")
        : activePlaylist?.title || "";
    activeType.textContent = t(
      activeFilter === "playlists"
        ? "nowPlaying.playlists.kicker"
        : isSystemPlaylist(activePlaylist)
          ? "nowPlaying.library.system"
          : "nowPlaying.playlists.user",
    );
    activeSummary.textContent = t("nowPlaying.library.itemsCount", {
      count:
        activeFilter === "playlists"
          ? userPlaylists.length
          : activeTracks.length,
    });
    const systemPlaylistActive = isSystemPlaylist(activePlaylist);
    managementActions.hidden = activeFilter === "playlists";
    clearMediaLibraryAction.hidden = activePlaylist?.id !== MEDIA_LIBRARY_ID;
    clearMediaLibraryAction.disabled =
      activePlaylist?.id !== MEDIA_LIBRARY_ID || activeTracks.length === 0;
    userPlaylistActions.forEach((button) => {
      button.hidden = systemPlaylistActive;
    });
    renderPlayback(latestSnapshot);
    refreshPlayerIcons(element);
  }

  function renderContent(activeTracks, activePlaylist, snapshot) {
    if (activeFilter === "playlists") {
      renderPlaylistBrowser();
      return;
    }
    renderTrackList(activeTracks, activePlaylist, snapshot);
  }

  function renderPlaylistBrowser() {
    const playlists = getUserPlaylists(latestState).filter((playlist) =>
      normalizeSearchText(playlist.title).includes(searchQuery),
    );
    playlistBrowser.replaceChildren(
      ...playlists.map((playlist) =>
        createPlaylistBrowserCard(
          playlist,
          getPlaylistTracks(latestState, playlist),
          playlist.id === latestState.activePlaylistId,
        ),
      ),
    );
    playlistBrowser.hidden = playlists.length === 0;
    trackList.hidden = true;
    columnHeader.hidden = true;
    empty.hidden = true;
    noResults.hidden = true;
    noPlaylists.hidden = playlists.length > 0 || Boolean(searchQuery);
    if (searchQuery && playlists.length === 0) noResults.hidden = false;
    resultsCount.textContent = t("nowPlaying.library.results", {
      visible: playlists.length,
      total: getUserPlaylists(latestState).length,
    });
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
    emptyTitle.textContent = t(
      isSystemPlaylist(activePlaylist)
        ? "nowPlaying.library.empty.title"
        : "nowPlaying.library.empty.playlistTitle",
    );
    noResults.hidden = !hasTracks || hasResults;
    noPlaylists.hidden = true;
    playlistBrowser.hidden = true;
    trackList.hidden = !hasResults;
    columnHeader.toggleAttribute("hidden", !hasResults);
    resultsCount.textContent = t("nowPlaying.library.results", {
      visible: visibleTracks.length,
      total: activeTracks.length,
    });
  }

  function renderSearchControls() {
    searchInput.value = searchQuery;
    searchClear.hidden = !searchQuery;
    if (searchQuery) setPlayerIcon(searchClear, "x");
    filterButtons.forEach((button) => {
      const pressed = button.dataset.filter === activeFilter;
      button.classList.toggle("is-active", pressed);
      button.setAttribute("aria-pressed", String(pressed));
    });
  }

  function syncFilterAvailability(tracks) {
    const availableFilters = new Set(["all", "playlists"]);
    tracks.forEach((track) => {
      if (track.kind === "video" || track.kind === "audio") {
        availableFilters.add(track.kind);
      }
      if (track.availability === "missing") {
        availableFilters.add("missing");
      }
    });
    filterButtons.forEach((button) => {
      button.hidden = !availableFilters.has(button.dataset.filter);
    });
    const hasMissingTracks = availableFilters.has("missing");
    moreFilters.hidden = !hasMissingTracks;
    if (!hasMissingTracks) moreFilters.open = false;
    if (!availableFilters.has(activeFilter)) {
      activeFilter = "all";
    }
  }

  function rerenderTrackList() {
    const activePlaylist = getActivePlaylist(latestState);
    const activeTracks = getPlaylistTracks(latestState, activePlaylist);
    renderContent(activeTracks, activePlaylist, latestSnapshot);
    activeTitle.textContent =
      activeFilter === "playlists"
        ? t("nowPlaying.playlists.title")
        : activePlaylist?.title || "";
    activeSummary.textContent = t("nowPlaying.library.itemsCount", {
      count:
        activeFilter === "playlists"
          ? getUserPlaylists(latestState).length
          : activeTracks.length,
    });
    managementActions.hidden = activeFilter === "playlists";
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
    root
      .querySelector('[data-ui="library-more-filters"]')
      ?.removeAttribute("open");
    rerenderTrackList();
  }

  function leavePlaylistBrowser() {
    if (activeFilter !== "playlists") return false;
    setFilter("all");
    return true;
  }

  function clearSearch() {
    if (!searchQuery && activeFilter === "all") return;
    searchQuery = "";
    activeFilter = "all";
    rerenderTrackList();
    searchInput.focus();
  }

  function isCompactSidebar() {
    return compactSidebarQuery?.matches === true;
  }

  function syncSidebarMode() {
    const compact = isCompactSidebar();
    element.classList.toggle("is-sidebar-open", compact && sidebarOpen);
    librarySidebarScrim.hidden = !compact || !sidebarOpen;
    librarySidebar.inert = compact && !sidebarOpen;
    librarySidebarToggle.setAttribute(
      "aria-expanded",
      String(compact && sidebarOpen),
    );
    librarySidebarToggle.setAttribute(
      "aria-controls",
      "player-library-sidebar",
    );
    librarySidebar.id = "player-library-sidebar";
    if (!compact) sidebarOpen = false;
  }

  function openLibrarySidebar(trigger = librarySidebarToggle) {
    if (!isCompactSidebar()) return false;
    sidebarOpen = true;
    sidebarReturnFocus = trigger;
    syncSidebarMode();
    librarySidebar.querySelector("button:not([disabled]), summary")?.focus();
    return true;
  }

  function closeLibrarySidebar({ restoreFocus = true } = {}) {
    if (!sidebarOpen) return false;
    sidebarOpen = false;
    syncSidebarMode();
    if (restoreFocus) sidebarReturnFocus?.focus?.();
    sidebarReturnFocus = null;
    return true;
  }

  function toggleLibrarySidebar(trigger) {
    return sidebarOpen ? closeLibrarySidebar() : openLibrarySidebar(trigger);
  }

  function handleLibraryKeydown(event) {
    const openMenu = event.target.closest(
      ".player-library__playlist-actions[open]",
    );
    if (event.key === "Escape" && openMenu) {
      event.preventDefault();
      openMenu.open = false;
      openMenu.querySelector("summary")?.focus();
      return;
    }
    if (!sidebarOpen || !isCompactSidebar()) return;
    if (event.key === "Escape") {
      event.preventDefault();
      closeLibrarySidebar();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = [
      ...librarySidebar.querySelectorAll(
        'button:not([disabled]), summary, [href], [tabindex]:not([tabindex="-1"])',
      ),
    ].filter((item) => !item.closest("[hidden]"));
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function handleLibraryClick(event) {
    const activeMenu = event.target.closest(
      ".player-library__playlist-actions",
    );
    element
      .querySelectorAll(".player-library__playlist-actions[open]")
      .forEach((menu) => {
        if (menu !== activeMenu || event.target.closest('[role="menuitem"]')) {
          menu.open = false;
        }
      });
  }

  function positionPlaylistActions(menu) {
    const summary = menu.querySelector("summary");
    const popup = menu.querySelector(':scope > [role="menu"]');
    if (!summary || !popup) return;
    const triggerRect = summary.getBoundingClientRect();
    const popupRect = popup.getBoundingClientRect();
    const viewportWidth =
      document.documentElement.clientWidth || window.innerWidth;
    const viewportHeight =
      document.documentElement.clientHeight || window.innerHeight;
    const viewportGap = 8;
    const popupWidth = Math.max(210, popupRect.width);
    const popupHeight = Math.max(82, popupRect.height);
    const left = Math.min(
      Math.max(viewportGap, triggerRect.right - popupWidth),
      Math.max(viewportGap, viewportWidth - popupWidth - viewportGap),
    );
    const fitsBelow =
      triggerRect.bottom + 6 + popupHeight <= viewportHeight - viewportGap;
    const top = fitsBelow
      ? triggerRect.bottom + 6
      : Math.max(viewportGap, triggerRect.top - popupHeight - 6);
    popup.style.left = `${Math.round(left)}px`;
    popup.style.top = `${Math.round(top)}px`;
    popup.dataset.placement = fitsBelow ? "bottom" : "top";
  }

  function hidePlaylistActionsPopover(menu) {
    const popup = menu.querySelector(':scope > [role="menu"]');
    if (!popup || popup.dataset.popoverOpen !== "true") return;
    popup.hidePopover();
    delete popup.dataset.popoverOpen;
  }

  function handlePlaylistActionsToggle(event) {
    const menu = event.target;
    if (!menu.matches?.(".player-library__playlist-actions")) return;
    const summary = menu.querySelector("summary");
    const popup = menu.querySelector(':scope > [role="menu"]');
    summary?.setAttribute("aria-expanded", String(menu.open));
    if (!menu.open) {
      hidePlaylistActionsPopover(menu);
      return;
    }
    element
      .querySelectorAll(".player-library__playlist-actions[open]")
      .forEach((candidate) => {
        if (candidate !== menu) candidate.open = false;
      });
    if (typeof popup?.showPopover === "function") {
      popup.showPopover();
      popup.dataset.popoverOpen = "true";
    }
    positionPlaylistActions(menu);
  }

  function closePlaylistActionsOverlays() {
    element
      .querySelectorAll(".player-library__playlist-actions[open]")
      .forEach((menu) => {
        menu.open = false;
      });
  }

  function closeSidebarPlaylistMenu({ restoreFocus = false } = {}) {
    sidebarPlaylistMenu.hidden = true;
    sidebarPlaylistSwitcher.setAttribute("aria-expanded", "false");
    sidebarPlaylistSwitcher.classList.remove("is-open");
    if (restoreFocus) sidebarPlaylistSwitcher.focus();
  }

  function toggleSidebarPlaylistMenu(force) {
    const open =
      typeof force === "boolean" ? force : sidebarPlaylistMenu.hidden;
    sidebarPlaylistMenu.hidden = !open;
    sidebarPlaylistSwitcher.setAttribute("aria-expanded", String(open));
    sidebarPlaylistSwitcher.classList.toggle("is-open", open);
    if (open) {
      const selected = sidebarPlaylistMenu.querySelector(
        '[aria-selected="true"]',
      );
      (
        selected || sidebarPlaylistMenu.querySelector('[role="option"]')
      )?.focus();
    }
    return open;
  }

  function moveSidebarPlaylistFocus(option, key) {
    const options = [
      ...sidebarPlaylistMenu.querySelectorAll('[role="option"]'),
    ];
    if (!options.length) return;
    const index = Math.max(0, options.indexOf(option));
    const nextIndexByKey = {
      ArrowDown: (index + 1) % options.length,
      ArrowUp: (index - 1 + options.length) % options.length,
      Home: 0,
      End: options.length - 1,
    };
    options[nextIndexByKey[key]]?.focus();
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
      if (transientPosterTrackId !== track.id) {
        transientPosterTrackId = "";
        transientPosterUrl = "";
      }
    }
    root.querySelector('[data-ui="mini-title"]').textContent =
      track.displayTitle || track.title;
    root.querySelector('[data-ui="mini-artist"]').textContent =
      track.artist || t("nowPlaying.unknownArtist");
    root.querySelector('[data-ui="mini-album"]').textContent =
      track.album || "";
    root.querySelector('[data-ui="mini-kind"]').textContent = t(
      track.kind === "video" ? "nowPlaying.video" : "nowPlaying.audio",
    );
    renderMiniArtwork(track);

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
        button.disabled = Boolean(
          snapshot.isLoading || !snapshot.queue?.length,
        );
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

  function getArtworkSource(track) {
    const source =
      track?.artworkUrl ||
      (track?.id === transientPosterTrackId ? transientPosterUrl : "");
    return failedArtworkSources.has(source) ? "" : source;
  }

  function renderMiniArtwork(track) {
    const image = root.querySelector('[data-ui="mini-artwork"]');
    const artwork = image.closest(".player-library__mini-artwork");
    const source = getArtworkSource(track);
    image.src = source;
    image.hidden = !source;
    artwork.classList.toggle("has-artwork", Boolean(source));
  }

  function handleArtworkError(event) {
    const image = event.currentTarget;
    const source = image.getAttribute("src") || "";
    if (source) failedArtworkSources.add(source);
    image.hidden = true;
    image.removeAttribute("src");
    if (image.matches('[data-ui="mini-artwork"]')) {
      image
        .closest(".player-library__mini-artwork")
        ?.classList.remove("has-artwork");
    }
  }

  const miniArtwork = root.querySelector('[data-ui="mini-artwork"]');
  miniArtwork?.addEventListener("error", handleArtworkError);

  function useGeneratedPoster(trackId, dataUrl) {
    if (!trackId || !dataUrl) return;
    transientPosterTrackId = String(trackId);
    transientPosterUrl = dataUrl;
    if (miniTrackId === transientPosterTrackId) {
      renderMiniArtwork(
        latestSnapshot.currentTrack || { id: transientPosterTrackId },
      );
    }
  }

  function clearGeneratedPoster(trackId) {
    if (
      trackId &&
      transientPosterTrackId &&
      String(trackId) !== transientPosterTrackId
    ) {
      return;
    }
    transientPosterTrackId = "";
    transientPosterUrl = "";
    if (latestSnapshot.currentTrack) {
      renderMiniArtwork(latestSnapshot.currentTrack);
    }
  }

  function show() {
    element.hidden = false;
    root.classList.add("is-library-view");
    syncSidebarMode();
    element.querySelector("h1")?.focus?.();
  }

  function hide() {
    closeLibrarySidebar({ restoreFocus: false });
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

  element.addEventListener("click", handleLibraryClick);
  element.addEventListener("keydown", handleLibraryKeydown);
  element.addEventListener("toggle", handlePlaylistActionsToggle, true);
  playlistGrid.addEventListener("scroll", closePlaylistActionsOverlays, {
    passive: true,
  });
  window.addEventListener("resize", closePlaylistActionsOverlays);
  compactSidebarQuery?.addEventListener?.("change", syncSidebarMode);
  syncSidebarMode();
  logMediaLibrary("debug", "view-created");

  return {
    closeDialog,
    closeSidebarPlaylistMenu,
    dispose() {
      logMediaLibrary("debug", "view-disposed");
      closeDialog();
      playerDialog?.dispose();
      miniArtwork?.removeEventListener("error", handleArtworkError);
      element.removeEventListener("click", handleLibraryClick);
      element.removeEventListener("keydown", handleLibraryKeydown);
      element.removeEventListener("toggle", handlePlaylistActionsToggle, true);
      playlistGrid.removeEventListener("scroll", closePlaylistActionsOverlays);
      window.removeEventListener("resize", closePlaylistActionsOverlays);
      compactSidebarQuery?.removeEventListener?.("change", syncSidebarMode);
      playerDialog = null;
    },
    getActivePlaylist: () => getActivePlaylist(latestState),
    getFilteredTracks: () => {
      const activePlaylist = getActivePlaylist(latestState);
      return getPlaylistTracks(latestState, activePlaylist).filter((track) =>
        matchesFilter(track, activeFilter),
      );
    },
    getTrackContext,
    hide,
    openDialog,
    render,
    renderPlayback,
    clearSearch,
    clearGeneratedPoster,
    setFilter,
    setOperationStatus,
    setSearchQuery,
    showYouTubeQualities(payload) {
      return getPlayerDialog().showYouTubeQualities(payload);
    },
    show,
    showDialogError,
    toggleSidebarPlaylistMenu,
    moveSidebarPlaylistFocus,
    leavePlaylistBrowser,
    closeLibrarySidebar,
    toggleLibrarySidebar,
    useGeneratedPoster,
  };
}

export default createMediaLibraryView;
