import { t } from "../i18n.js";
import {
  closeRegisteredModal,
  openRegisteredModal,
  registerModal,
} from "../modalManager.js";
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
  button.appendChild(createIcon(icon));
  return button;
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
  row.setAttribute("aria-selected", String(current));
  row.classList.toggle("is-current", current);
  if (current) row.setAttribute("aria-current", "true");

  const play = createIconButton(
    "select-library-track",
    current && snapshot?.isPlaying
      ? "fa-solid fa-volume-high"
      : "fa-solid fa-play",
    `${t("nowPlaying.play")} ${track.title}`,
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
  title.textContent = track.title;
  const artist = document.createElement("span");
  artist.textContent =
    track.artist || track.album || t("nowPlaying.unknownArtist");
  metadata.append(title, artist);

  const source = document.createElement("span");
  source.className = "player-library__track-source";
  source.append(
    createIcon(
      track.providerId === "youtube"
        ? "fa-brands fa-youtube"
        : track.kind === "video"
          ? "fa-solid fa-film"
          : "fa-solid fa-wave-square",
    ),
    document.createTextNode(
      track.providerId === "youtube"
        ? "YouTube"
        : t(track.kind === "video" ? "nowPlaying.video" : "nowPlaying.audio"),
    ),
  );

  const duration = document.createElement("span");
  duration.className = "player-library__track-time";
  duration.textContent = formatPlaybackTime(track.duration);

  const actions = document.createElement("span");
  actions.className = "player-library__track-actions";
  if (isSystemPlaylist(playlist)) {
    actions.append(
      createIconButton(
        "open-add-to-playlist-dialog",
        "fa-solid fa-plus",
        t("nowPlaying.playlists.addItem"),
        { trackId: track.id },
      ),
    );
  } else {
    actions.append(
      createIconButton(
        "move-library-track-up",
        "fa-solid fa-arrow-up",
        t("nowPlaying.playlists.moveUp"),
        { trackId: track.id, trackIndex: index },
      ),
      createIconButton(
        "move-library-track-down",
        "fa-solid fa-arrow-down",
        t("nowPlaying.playlists.moveDown"),
        { trackId: track.id, trackIndex: index },
      ),
    );
  }
  actions.append(
    createIconButton(
      isSystemPlaylist(playlist)
        ? "delete-from-catalog"
        : "remove-from-playlist",
      "fa-solid fa-xmark",
      isSystemPlaylist(playlist)
        ? t("nowPlaying.library.deleteItem")
        : t("nowPlaying.playlists.removeItem"),
      { trackId: track.id },
    ),
  );

  row.append(play, artwork, metadata, source, duration, actions);
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
  const dialog = root.querySelector('[data-ui="library-dialog"]');
  const dialogForm = root.querySelector('[data-ui="library-dialog-form"]');
  const dialogTitle = root.querySelector('[data-ui="library-dialog-title"]');
  const dialogEyebrow = root.querySelector(
    '[data-ui="library-dialog-eyebrow"]',
  );
  const dialogHint = root.querySelector('[data-ui="library-dialog-hint"]');
  const dialogLabel = root.querySelector('[data-ui="library-dialog-label"]');
  const dialogInput = root.querySelector('[data-ui="library-dialog-input"]');
  const dialogSelect = root.querySelector('[data-ui="library-dialog-select"]');
  const dialogSubmit = root.querySelector('[data-ui="library-dialog-submit"]');
  const dialogError = root.querySelector('[data-ui="library-dialog-error"]');
  const unregisterModal = registerModal(dialog);
  let mode = "";
  let dialogContext = {};
  let latestState = {};
  let submitting = false;

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
    trackList.querySelectorAll(".player-library__track").forEach((row) => {
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
  }

  function renderMiniPlayer(snapshot = {}) {
    const track = snapshot.currentTrack;
    miniPlayer.hidden = !track;
    if (!track) return;
    root.querySelector('[data-ui="mini-title"]').textContent = track.title;
    root.querySelector('[data-ui="mini-artist"]').textContent =
      track.artist || track.album || t("nowPlaying.unknownArtist");
    const image = root.querySelector('[data-ui="mini-artwork"]');
    image.src = track.artworkUrl || "";
    image.hidden = !track.artworkUrl;
    const playIcons = miniPlayer.querySelectorAll(
      '[data-action="play-pause"] i',
    );
    playIcons.forEach((icon) => {
      icon.classList.toggle(
        "fa-play",
        !snapshot.isPlaying && !snapshot.isLoading,
      );
      icon.classList.toggle("fa-pause", snapshot.isPlaying);
      icon.classList.toggle("fa-spinner", snapshot.isLoading);
      icon.classList.toggle("fa-spin", snapshot.isLoading);
      const button = icon.closest("button");
      if (button) {
        button.disabled = snapshot.isLoading;
        button.setAttribute("aria-busy", String(snapshot.isLoading));
      }
      icon
        .closest("button")
        ?.setAttribute(
          "aria-label",
          t(
            snapshot.isLoading
              ? "nowPlaying.playback.preparing"
              : snapshot.isPlaying
                ? "nowPlaying.pause"
                : "nowPlaying.play",
          ),
        );
    });
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
    const config = {
      create: {
        title: "nowPlaying.playlists.create",
        hint: "nowPlaying.playlists.createHint",
        label: "nowPlaying.playlists.name",
        submit: "nowPlaying.playlists.createAction",
        value: "",
        type: "text",
        maxLength: 80,
      },
      rename: {
        title: "nowPlaying.playlists.rename",
        hint: "nowPlaying.playlists.renameHint",
        label: "nowPlaying.playlists.name",
        submit: "nowPlaying.playlists.save",
        value: activePlaylist?.title || "",
        type: "text",
        maxLength: 80,
      },
      youtube: {
        title: "nowPlaying.youtube.add",
        hint: "nowPlaying.youtube.hint",
        label: "nowPlaying.youtube.url",
        submit: "nowPlaying.youtube.addAction",
        value: "",
        type: "url",
        maxLength: 2048,
      },
      addTrack: {
        title: "nowPlaying.playlists.addItem",
        hint: "nowPlaying.playlists.addItemHint",
        label: "nowPlaying.playlists.target",
        submit: "nowPlaying.playlists.addItemAction",
        value: "",
        type: "select",
      },
    }[nextMode];
    if (!config) return;
    mode = nextMode;
    dialogContext = context;
    dialogTitle.textContent = t(config.title);
    dialogEyebrow.textContent = t("tabs.nowPlaying");
    dialogHint.textContent = t(config.hint);
    dialogLabel.textContent = t(config.label);
    dialogSubmit.textContent = t(config.submit);
    const isSelect = config.type === "select";
    dialogInput.hidden = isSelect;
    dialogSelect.hidden = !isSelect;
    if (isSelect) {
      const userPlaylists = getPlaylists(latestState).filter(
        (playlist) => !isSystemPlaylist(playlist),
      );
      dialogSelect.replaceChildren(
        ...userPlaylists.map((playlist) => {
          const option = document.createElement("option");
          option.value = playlist.id;
          option.textContent = playlist.title;
          return option;
        }),
      );
    } else {
      dialogInput.type = config.type;
      dialogInput.maxLength = config.maxLength;
      dialogInput.value = config.value;
    }
    dialogError.hidden = true;
    dialogError.textContent = "";
    openRegisteredModal(dialog, { blocking: false });
    queueMicrotask(() => {
      const field = isSelect ? dialogSelect : dialogInput;
      field.focus();
      if (!isSelect) field.select();
    });
  }

  function closeDialog() {
    closeRegisteredModal(dialog);
    submitting = false;
    dialogSubmit.disabled = false;
    dialogForm.removeAttribute("aria-busy");
    mode = "";
    dialogContext = {};
  }

  function showDialogError(message) {
    dialogError.textContent = message || t("nowPlaying.error");
    dialogError.hidden = false;
    if (dialog.open) dialogInput.focus();
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

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;
    const value =
      mode === "addTrack" ? dialogSelect.value : dialogInput.value.trim();
    if (!value) {
      showDialogError(t("nowPlaying.library.required"));
      return;
    }
    submitting = true;
    const submitLabel = dialogSubmit.textContent;
    dialogSubmit.disabled = true;
    dialogForm.setAttribute("aria-busy", "true");
    if (mode === "youtube") {
      dialogSubmit.textContent = t("nowPlaying.youtube.fetching");
    }
    try {
      const success = await onDialogSubmit?.(mode, value, dialogContext);
      if (success === false) return;
      closeDialog();
    } catch (error) {
      showDialogError(error?.message || t("nowPlaying.error"));
    } finally {
      if (dialog.open) {
        submitting = false;
        dialogSubmit.disabled = false;
        dialogSubmit.textContent = submitLabel;
        dialogForm.removeAttribute("aria-busy");
      }
    }
  }

  function onWindowKeydown(event) {
    if (event.key !== "Escape" || !dialog.open) return;
    event.preventDefault();
    closeDialog();
  }

  dialogForm.addEventListener("submit", handleSubmit);
  dialog.addEventListener("cancel", closeDialog);
  window.addEventListener("keydown", onWindowKeydown);

  return {
    closeDialog,
    dispose() {
      closeDialog();
      dialogForm.removeEventListener("submit", handleSubmit);
      dialog.removeEventListener("cancel", closeDialog);
      window.removeEventListener("keydown", onWindowKeydown);
      unregisterModal();
    },
    getActivePlaylist: () => getActivePlaylist(latestState),
    hide,
    openDialog,
    render,
    renderPlayback,
    setOperationStatus,
    show,
    showDialogError,
  };
}

export default createMediaLibraryView;
