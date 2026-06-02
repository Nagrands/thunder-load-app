const WINGET_PACKAGE_CATEGORIES = Object.freeze([
  {
    id: "browsers",
    icon: "fa-solid fa-globe",
    titleKey: "tools.winget.category.browsers",
  },
  {
    id: "media",
    icon: "fa-solid fa-photo-film",
    titleKey: "tools.winget.category.media",
  },
  {
    id: "archives",
    icon: "fa-solid fa-file-zipper",
    titleKey: "tools.winget.category.archives",
  },
  {
    id: "develop",
    icon: "fa-solid fa-code",
    titleKey: "tools.winget.category.develop",
  },
  {
    id: "system",
    icon: "fa-solid fa-screwdriver-wrench",
    titleKey: "tools.winget.category.system",
  },
  {
    id: "productivity",
    icon: "fa-solid fa-pen-nib",
    titleKey: "tools.winget.category.productivity",
  },
  {
    id: "network",
    icon: "fa-solid fa-shield-halved",
    titleKey: "tools.winget.category.network",
  },
  {
    id: "games",
    icon: "fa-solid fa-gamepad",
    titleKey: "tools.winget.category.games",
  },
]);

const WINGET_PACKAGE_GROUPS = Object.freeze([
  {
    category: "archives",
    descriptionKey: "tools.winget.package.7zip.desc",
    icon: "fa-solid fa-file-zipper",
    id: "7zip",
    label: "7-Zip",
    packageIds: ["7zip.7zip"],
  },
  {
    category: "browsers",
    descriptionKey: "tools.winget.package.firefox.desc",
    icon: "fa-brands fa-firefox-browser",
    id: "firefox",
    label: "Firefox",
    packageIds: ["Mozilla.Firefox"],
  },
  {
    category: "develop",
    descriptionKey: "tools.winget.package.git.desc",
    icon: "fa-brands fa-git-alt",
    id: "git",
    label: "Git",
    packageIds: ["Git.Git"],
  },
  {
    category: "browsers",
    descriptionKey: "tools.winget.package.chrome.desc",
    icon: "fa-brands fa-chrome",
    id: "chrome",
    label: "Google Chrome",
    packageIds: ["Google.Chrome"],
  },
  {
    category: "media",
    descriptionKey: "tools.winget.package.klite.desc",
    icon: "fa-solid fa-clapperboard",
    id: "klite",
    label: "K-Lite Codec Pack Full",
    packageIds: ["CodecGuide.K-LiteCodecPack.Full"],
  },
  {
    category: "system",
    descriptionKey: "tools.winget.package.afterburner.desc",
    icon: "fa-solid fa-gauge-high",
    id: "afterburner",
    label: "MSI Afterburner (+ RTSS)",
    packageIds: ["Guru3D.Afterburner", "Guru3D.RTSS"],
  },
  {
    category: "develop",
    descriptionKey: "tools.winget.package.node.desc",
    icon: "fa-brands fa-node-js",
    id: "node",
    label: "Node.js",
    packageIds: ["OpenJS.NodeJS.LTS"],
  },
  {
    category: "media",
    descriptionKey: "tools.winget.package.obs.desc",
    icon: "fa-solid fa-video",
    id: "obs",
    label: "OBS Studio",
    packageIds: ["OBSProject.OBSStudio"],
  },
  {
    category: "productivity",
    descriptionKey: "tools.winget.package.obsidian.desc",
    icon: "fa-solid fa-book",
    id: "obsidian",
    label: "Obsidian",
    packageIds: ["Obsidian.Obsidian"],
  },
  {
    category: "browsers",
    descriptionKey: "tools.winget.package.opera.desc",
    icon: "fa-brands fa-opera",
    id: "opera",
    label: "Opera",
    packageIds: ["Opera.Opera"],
  },
  {
    category: "develop",
    descriptionKey: "tools.winget.package.powershell.desc",
    icon: "fa-solid fa-terminal",
    id: "powershell",
    label: "PowerShell 7",
    packageIds: ["Microsoft.PowerShell"],
  },
  {
    category: "system",
    descriptionKey: "tools.winget.package.powertoys.desc",
    icon: "fa-solid fa-wand-magic-sparkles",
    id: "powertoys",
    label: "PowerToys",
    packageIds: ["Microsoft.PowerToys"],
  },
  {
    category: "develop",
    descriptionKey: "tools.winget.package.python.desc",
    icon: "fa-brands fa-python",
    id: "python",
    label: "Python 3.14",
    packageIds: ["Python.Python.3.14"],
  },
  {
    category: "network",
    descriptionKey: "tools.winget.package.qbittorrent.desc",
    icon: "fa-solid fa-cloud-arrow-down",
    id: "qbittorrent",
    label: "qBittorrent",
    packageIds: ["qBittorrent.qBittorrent"],
  },
  {
    category: "games",
    descriptionKey: "tools.winget.package.steam.desc",
    icon: "fa-brands fa-steam",
    id: "steam",
    label: "Steam",
    packageIds: ["Valve.Steam"],
  },
  {
    category: "media",
    descriptionKey: "tools.winget.package.vlc.desc",
    icon: "fa-solid fa-play",
    id: "vlc",
    label: "VLC",
    packageIds: ["VideoLAN.VLC"],
  },
  {
    category: "productivity",
    descriptionKey: "tools.winget.package.raycast.desc",
    icon: "fa-solid fa-bolt",
    id: "raycast",
    label: "Raycast",
    packageIds: ["Raycast.Raycast"],
  },
  {
    category: "develop",
    descriptionKey: "tools.winget.package.vscode.desc",
    icon: "fa-solid fa-code",
    id: "vscode",
    label: "Visual Studio Code",
    packageIds: ["Microsoft.VisualStudioCode"],
  },
  {
    category: "develop",
    descriptionKey: "tools.winget.package.terminal.desc",
    icon: "fa-solid fa-window-maximize",
    id: "terminal",
    label: "Windows Terminal",
    packageIds: ["Microsoft.WindowsTerminal"],
  },
  {
    category: "network",
    descriptionKey: "tools.winget.package.wireguard.desc",
    icon: "fa-solid fa-shield-halved",
    id: "wireguard",
    label: "WireGuard",
    packageIds: ["WireGuard.WireGuard"],
  },
]);

const WINGET_PACKAGE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._+-]{1,127}$/;

function normalizeWingetPackageId(value) {
  return String(value || "").trim();
}

function isValidWingetPackageId(value) {
  return WINGET_PACKAGE_ID_PATTERN.test(normalizeWingetPackageId(value));
}

function parseCustomWingetPackageIds(value) {
  return String(value || "")
    .split(/[\s,;]+/)
    .map(normalizeWingetPackageId)
    .filter(Boolean);
}

function uniqueWingetPackageIds(packageIds = []) {
  const seen = new Set();
  return packageIds.reduce((acc, value) => {
    const packageId = normalizeWingetPackageId(value);
    const key = packageId.toLowerCase();
    if (!packageId || seen.has(key)) return acc;
    seen.add(key);
    acc.push(packageId);
    return acc;
  }, []);
}

function getWingetPackageIdsFromSelection({
  selectedGroupIds = [],
  customPackageIds = [],
} = {}) {
  const selected = new Set(selectedGroupIds.map(String));
  const builtInIds = WINGET_PACKAGE_GROUPS.filter((group) =>
    selected.has(group.id),
  ).flatMap((group) => group.packageIds);

  return uniqueWingetPackageIds([...builtInIds, ...customPackageIds]);
}

function getAllBuiltInWingetPackageIds() {
  return uniqueWingetPackageIds(
    WINGET_PACKAGE_GROUPS.flatMap((group) => group.packageIds),
  );
}

function createWingetStatusMap(items = []) {
  return (Array.isArray(items) ? items : []).reduce((acc, item) => {
    const packageId = normalizeWingetPackageId(item?.packageId);
    if (!packageId) return acc;
    acc.set(packageId.toLowerCase(), {
      availableVersion: String(item.availableVersion || ""),
      currentVersion: String(item.currentVersion || ""),
      packageId,
      status: item.status || "unknown",
    });
    return acc;
  }, new Map());
}

function joinWingetVersions(values = []) {
  return uniqueWingetPackageIds(values.filter(Boolean)).join(" / ");
}

function aggregateWingetPackageStatus(packageIds = [], items = []) {
  const ids = uniqueWingetPackageIds(packageIds);
  const map = createWingetStatusMap(items);
  const rows = ids.map((packageId) => map.get(packageId.toLowerCase()));
  const knownRows = rows.filter(Boolean);
  const statuses = knownRows.map((row) => row.status);
  const currentVersion = joinWingetVersions(
    knownRows.map((row) => row.currentVersion),
  );
  const availableVersion = joinWingetVersions(
    knownRows.map((row) => row.availableVersion),
  );

  if (!ids.length || !knownRows.length) {
    return { availableVersion: "", currentVersion: "", status: "unknown" };
  }
  for (const status of [
    "installing",
    "updating",
    "uninstalling",
    "checking",
    "error",
  ]) {
    if (statuses.includes(status)) {
      return { availableVersion, currentVersion, status };
    }
  }
  if (statuses.includes("updateAvailable")) {
    return { availableVersion, currentVersion, status: "updateAvailable" };
  }
  if (
    knownRows.length < ids.length ||
    (statuses.includes("installed") && statuses.includes("notInstalled"))
  ) {
    return { availableVersion, currentVersion, status: "partial" };
  }
  if (statuses.every((status) => status === "installed")) {
    return { availableVersion, currentVersion, status: "installed" };
  }
  if (statuses.every((status) => status === "notInstalled")) {
    return { availableVersion, currentVersion, status: "notInstalled" };
  }
  return { availableVersion, currentVersion, status: "unknown" };
}

function escapePowerShellSingleQuotedString(value) {
  return String(value).replaceAll("'", "''");
}

function buildWingetScript(packageIds = [], mode = "install") {
  const normalizedMode = ["install", "upgrade", "uninstall"].includes(mode)
    ? mode
    : "install";
  const command = normalizedMode;
  const agreementOptions =
    normalizedMode === "install" || normalizedMode === "upgrade"
      ? " --accept-package-agreements --accept-source-agreements"
      : "";
  const commandOptions =
    normalizedMode === "upgrade" ? " --include-unknown" : "";
  const validPackageIds = uniqueWingetPackageIds(packageIds).filter(
    isValidWingetPackageId,
  );
  const lines = [
    "$ErrorActionPreference = 'Stop'",
    "$wingetVersion = winget --version",
    'Write-Host "WinGet version: $wingetVersion"',
    "",
    "$packages = @(",
    ...validPackageIds.map(
      (packageId) => `  '${escapePowerShellSingleQuotedString(packageId)}'`,
    ),
    ")",
    "",
    "$failed = @()",
    "",
    "foreach ($packageId in $packages) {",
    `  Write-Host "Running winget ${command} for $packageId"`,
    `  winget ${command} --id $packageId --exact --source winget${agreementOptions} --disable-interactivity${commandOptions}`,
    "  if ($LASTEXITCODE -ne 0) {",
    `    Write-Warning "winget ${command} failed for $packageId with exit code $LASTEXITCODE"`,
    "    $failed += $packageId",
    "  }",
    "}",
    "",
    "if ($failed.Count -gt 0) {",
    "  Write-Error \"Failed packages: $($failed -join ', ')\"",
    "  exit 1",
    "}",
  ];

  return lines.join("\n");
}

export {
  WINGET_PACKAGE_CATEGORIES,
  WINGET_PACKAGE_GROUPS,
  aggregateWingetPackageStatus,
  buildWingetScript,
  getAllBuiltInWingetPackageIds,
  getWingetPackageIdsFromSelection,
  isValidWingetPackageId,
  parseCustomWingetPackageIds,
  uniqueWingetPackageIds,
};
