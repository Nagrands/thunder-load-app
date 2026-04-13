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
    id: "programs",
    groupId: "system",
    icon: "fa-solid fa-box-archive",
    actionIcon: "fa-solid fa-box-archive",
    buttonId: "create-programs-shortcut",
    resultId: "programs-shortcut-result",
    detailId: "programs-shortcut-detail",
    stateId: "programs-shortcut-state",
    invokeMethod: "createWindowsProgramsShortcut",
    titleKey: "quickActions.programs.title",
    cardTitleKey: "quickActions.programs.cardTitle",
    cardHintKey: "quickActions.programs.cardHint",
    actionKey: "quickActions.programs.action",
    confirmKey: "quickActions.programs.confirm",
  },
  {
    id: "disk-cleanup",
    groupId: "system",
    icon: "fa-solid fa-broom",
    actionIcon: "fa-solid fa-broom",
    buttonId: "create-disk-cleanup-shortcut",
    resultId: "disk-cleanup-shortcut-result",
    detailId: "disk-cleanup-shortcut-detail",
    stateId: "disk-cleanup-shortcut-state",
    invokeMethod: "createWindowsDiskCleanupShortcut",
    titleKey: "quickActions.diskCleanup.title",
    cardTitleKey: "quickActions.diskCleanup.cardTitle",
    cardHintKey: "quickActions.diskCleanup.cardHint",
    actionKey: "quickActions.diskCleanup.action",
    confirmKey: "quickActions.diskCleanup.confirm",
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
