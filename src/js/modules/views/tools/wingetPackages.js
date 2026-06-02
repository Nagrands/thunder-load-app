const WINGET_PACKAGE_GROUPS = Object.freeze([
  {
    id: "7zip",
    label: "7-Zip",
    packageIds: ["7zip.7zip"],
  },
  {
    id: "firefox",
    label: "Firefox",
    packageIds: ["Mozilla.Firefox"],
  },
  {
    id: "git",
    label: "Git",
    packageIds: ["Git.Git"],
  },
  {
    id: "chrome",
    label: "Google Chrome",
    packageIds: ["Google.Chrome"],
  },
  {
    id: "klite",
    label: "K-Lite Codec Pack Full",
    packageIds: ["CodecGuide.K-LiteCodecPack.Full"],
  },
  {
    id: "afterburner",
    label: "MSI Afterburner (+ RTSS)",
    packageIds: ["Guru3D.Afterburner", "Guru3D.RTSS"],
  },
  {
    id: "node",
    label: "Node.js",
    packageIds: ["OpenJS.NodeJS.LTS"],
  },
  {
    id: "obs",
    label: "OBS Studio",
    packageIds: ["OBSProject.OBSStudio"],
  },
  {
    id: "obsidian",
    label: "Obsidian",
    packageIds: ["Obsidian.Obsidian"],
  },
  {
    id: "opera",
    label: "Opera",
    packageIds: ["Opera.Opera"],
  },
  {
    id: "powershell",
    label: "PowerShell 7",
    packageIds: ["Microsoft.PowerShell"],
  },
  {
    id: "powertoys",
    label: "PowerToys",
    packageIds: ["Microsoft.PowerToys"],
  },
  {
    id: "python",
    label: "Python 3.14",
    packageIds: ["Python.Python.3.14"],
  },
  {
    id: "qbittorrent",
    label: "qBittorrent",
    packageIds: ["qBittorrent.qBittorrent"],
  },
  {
    id: "steam",
    label: "Steam",
    packageIds: ["Valve.Steam"],
  },
  {
    id: "vlc",
    label: "VLC",
    packageIds: ["VideoLAN.VLC"],
  },
  {
    id: "raycast",
    label: "Raycast",
    packageIds: ["Raycast.Raycast"],
  },
  {
    id: "vscode",
    label: "Visual Studio Code",
    packageIds: ["Microsoft.VisualStudioCode"],
  },
  {
    id: "terminal",
    label: "Windows Terminal",
    packageIds: ["Microsoft.WindowsTerminal"],
  },
  {
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

function escapePowerShellSingleQuotedString(value) {
  return String(value).replaceAll("'", "''");
}

function buildWingetScript(packageIds = [], mode = "install") {
  const command = mode === "upgrade" ? "upgrade" : "install";
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
    `  winget ${command} --id $packageId --exact --source winget --accept-package-agreements --accept-source-agreements --disable-interactivity`,
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
  WINGET_PACKAGE_GROUPS,
  buildWingetScript,
  getWingetPackageIdsFromSelection,
  isValidWingetPackageId,
  parseCustomWingetPackageIds,
  uniqueWingetPackageIds,
};
