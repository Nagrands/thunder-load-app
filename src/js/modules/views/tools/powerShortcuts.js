const POWER_SHORTCUT_GROUPS = Object.freeze([
  {
    id: "power",
    titleKey: "quickActions.power.group.power.title",
    hintKey: "quickActions.power.group.power.hint",
  },
  {
    id: "recovery",
    titleKey: "quickActions.power.group.recovery.title",
    hintKey: "quickActions.power.group.recovery.hint",
  },
  {
    id: "system",
    titleKey: "quickActions.power.group.system.title",
    hintKey: "quickActions.power.group.system.hint",
  },
]);

const POWER_SHORTCUT_ACTIONS = Object.freeze([
  {
    id: "restart",
    groupId: "power",
    icon: "fa-solid fa-rotate-right",
    actionIcon: "fa-solid fa-plug-circle-bolt",
    buttonId: "create-restart-shortcut",
    resultId: "restart-shortcut-result",
    detailId: "restart-shortcut-detail",
    stateId: "restart-shortcut-state",
    invokeMethod: "createWindowsRestartShortcut",
    titleKey: "quickActions.restart.title",
    cardTitleKey: "quickActions.restart.cardTitle",
    cardHintKey: "quickActions.restart.cardHint",
    actionKey: "quickActions.restart.action",
    confirmKey: "quickActions.restart.confirm",
  },
  {
    id: "shutdown",
    groupId: "power",
    icon: "fa-solid fa-power-off",
    actionIcon: "fa-solid fa-power-off",
    buttonId: "create-shutdown-shortcut",
    resultId: "shutdown-shortcut-result",
    detailId: "shutdown-shortcut-detail",
    stateId: "shutdown-shortcut-state",
    invokeMethod: "createWindowsShutdownShortcut",
    titleKey: "quickActions.shutdown.title",
    cardTitleKey: "quickActions.shutdown.cardTitle",
    cardHintKey: "quickActions.shutdown.cardHint",
    actionKey: "quickActions.shutdown.action",
    confirmKey: "quickActions.shutdown.confirm",
  },
  {
    id: "uefi",
    groupId: "recovery",
    icon: "fa-solid fa-microchip",
    actionIcon: "fa-solid fa-microchip",
    buttonId: "create-uefi-shortcut",
    resultId: "uefi-shortcut-result",
    detailId: "uefi-shortcut-detail",
    stateId: "uefi-shortcut-state",
    invokeMethod: "createWindowsUefiRebootShortcut",
    titleKey: "quickActions.uefi.title",
    cardTitleKey: "quickActions.uefi.cardTitle",
    cardHintKey: "quickActions.uefi.cardHint",
    actionKey: "quickActions.uefi.action",
    confirmKey: "quickActions.uefi.confirm",
  },
  {
    id: "advanced-boot",
    groupId: "recovery",
    icon: "fa-solid fa-screwdriver-wrench",
    actionIcon: "fa-solid fa-screwdriver-wrench",
    buttonId: "create-advanced-boot-shortcut",
    resultId: "advanced-boot-shortcut-result",
    detailId: "advanced-boot-shortcut-detail",
    stateId: "advanced-boot-shortcut-state",
    invokeMethod: "createWindowsAdvancedBootShortcut",
    titleKey: "quickActions.advancedBoot.title",
    cardTitleKey: "quickActions.advancedBoot.cardTitle",
    cardHintKey: "quickActions.advancedBoot.cardHint",
    actionKey: "quickActions.advancedBoot.action",
    confirmKey: "quickActions.advancedBoot.confirm",
  },
  {
    id: "device-manager",
    groupId: "system",
    icon: "fa-solid fa-microchip",
    actionIcon: "fa-solid fa-microchip",
    buttonId: "create-device-manager-shortcut",
    resultId: "device-manager-shortcut-result",
    detailId: "device-manager-shortcut-detail",
    stateId: "device-manager-shortcut-state",
    invokeMethod: "createWindowsDeviceManagerShortcut",
    titleKey: "quickActions.deviceManager.title",
    cardTitleKey: "quickActions.deviceManager.cardTitle",
    cardHintKey: "quickActions.deviceManager.cardHint",
    actionKey: "quickActions.deviceManager.action",
    confirmKey: "quickActions.deviceManager.confirm",
  },
  {
    id: "network-settings",
    groupId: "system",
    icon: "fa-solid fa-network-wired",
    actionIcon: "fa-solid fa-network-wired",
    buttonId: "create-network-settings-shortcut",
    resultId: "network-settings-shortcut-result",
    detailId: "network-settings-shortcut-detail",
    stateId: "network-settings-shortcut-state",
    invokeMethod: "createWindowsNetworkSettingsShortcut",
    titleKey: "quickActions.networkSettings.title",
    cardTitleKey: "quickActions.networkSettings.cardTitle",
    cardHintKey: "quickActions.networkSettings.cardHint",
    actionKey: "quickActions.networkSettings.action",
    confirmKey: "quickActions.networkSettings.confirm",
  },
]);

function isPowerActionEnabled({ isWindows, showTool, busy = false } = {}) {
  return !!showTool && !!isWindows && !busy;
}

function getPowerActionStateTone(state) {
  switch (state) {
    case "creating":
      return "warning";
    case "success":
      return "success";
    case "error":
      return "error";
    default:
      return "muted";
  }
}

export {
  POWER_SHORTCUT_ACTIONS,
  POWER_SHORTCUT_GROUPS,
  getPowerActionStateTone,
  isPowerActionEnabled,
};
