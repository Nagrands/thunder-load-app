export const PLAYER_COMMANDS = Object.freeze({
  TOGGLE_PLAYBACK: "player.togglePlayback",
  STOP: "player.stop",
  PREVIOUS: "player.previous",
  NEXT: "player.next",
  SEEK_BACKWARD: "player.seekBackward",
  SEEK_FORWARD: "player.seekForward",
  TOGGLE_MUTE: "player.toggleMute",
  VOLUME_DOWN: "player.volumeDown",
  VOLUME_UP: "player.volumeUp",
  TOGGLE_FULLSCREEN: "player.toggleFullscreen",
  OPEN: "player.open",
  OPEN_LIBRARY: "player.openLibrary",
  TOGGLE_SHUFFLE: "player.toggleShuffle",
  CYCLE_REPEAT: "player.cycleRepeat",
  SHOW_CURRENT_MEDIA_INFO: "player.showCurrentMediaInfo",
  PLAY: "player.play",
  PAUSE: "player.pause",
});

export const PLAYER_SHORTCUT_COMMANDS = Object.freeze(
  Object.values(PLAYER_COMMANDS).filter(
    (commandId) =>
      commandId !== PLAYER_COMMANDS.PLAY &&
      commandId !== PLAYER_COMMANDS.PAUSE,
  ),
);

export const REPEATING_PLAYER_COMMANDS = new Set([
  PLAYER_COMMANDS.SEEK_BACKWARD,
  PLAYER_COMMANDS.SEEK_FORWARD,
  PLAYER_COMMANDS.VOLUME_DOWN,
  PLAYER_COMMANDS.VOLUME_UP,
]);

export const PLAYER_UI_ACTIONS = Object.freeze({
  "play-pause": PLAYER_COMMANDS.TOGGLE_PLAYBACK,
  previous: PLAYER_COMMANDS.PREVIOUS,
  next: PLAYER_COMMANDS.NEXT,
  shuffle: PLAYER_COMMANDS.TOGGLE_SHUFFLE,
  repeat: PLAYER_COMMANDS.CYCLE_REPEAT,
  mute: PLAYER_COMMANDS.TOGGLE_MUTE,
  fullscreen: PLAYER_COMMANDS.TOGGLE_FULLSCREEN,
  "show-library": PLAYER_COMMANDS.OPEN_LIBRARY,
  "show-player": PLAYER_COMMANDS.OPEN,
  "current-track-info": PLAYER_COMMANDS.SHOW_CURRENT_MEDIA_INFO,
});

export const SYSTEM_MEDIA_COMMANDS = Object.freeze({
  play: PLAYER_COMMANDS.PLAY,
  pause: PLAYER_COMMANDS.PAUSE,
  next: PLAYER_COMMANDS.NEXT,
  previous: PLAYER_COMMANDS.PREVIOUS,
});
