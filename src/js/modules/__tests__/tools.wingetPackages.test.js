import {
  WINGET_PACKAGE_CATEGORIES,
  WINGET_PACKAGE_GROUPS,
  aggregateWingetPackageStatus,
  buildWingetScript,
  getWingetPackageIdsFromSelection,
  isValidWingetPackageId,
  parseCustomWingetPackageIds,
} from "../views/tools/wingetPackages";

describe("wingetPackages", () => {
  test("catalog includes Afterburner with RTSS and Node.js LTS", () => {
    const afterburner = WINGET_PACKAGE_GROUPS.find(
      (group) => group.id === "afterburner",
    );
    const node = WINGET_PACKAGE_GROUPS.find((group) => group.id === "node");

    expect(afterburner.packageIds).toEqual([
      "Guru3D.Afterburner",
      "Guru3D.RTSS",
    ]);
    expect(node.packageIds).toEqual(["OpenJS.NodeJS.LTS"]);
    expect(afterburner.category).toBe("system");
    expect(afterburner.descriptionKey).toBe(
      "tools.winget.package.afterburner.desc",
    );
    expect(WINGET_PACKAGE_CATEGORIES.map((category) => category.id)).toContain(
      "media",
    );
  });

  test("validates custom package IDs conservatively", () => {
    expect(isValidWingetPackageId("Microsoft.VisualStudioCode")).toBe(true);
    expect(isValidWingetPackageId("Notepad++.Notepad++")).toBe(true);
    expect(isValidWingetPackageId("bad id")).toBe(false);
    expect(isValidWingetPackageId("; winget install Evil")).toBe(false);
  });

  test("parses custom IDs and deduplicates selected package IDs", () => {
    const packageIds = getWingetPackageIdsFromSelection({
      customPackageIds: parseCustomWingetPackageIds(
        "Git.Git, Microsoft.PowerToys\nGit.Git",
      ),
      selectedGroupIds: ["git", "powertoys"],
    });

    expect(packageIds).toEqual(["Git.Git", "Microsoft.PowerToys"]);
  });

  test("aggregates package status for single and multi-id groups", () => {
    expect(
      aggregateWingetPackageStatus(
        ["Git.Git"],
        [
          {
            currentVersion: "2.50.0",
            packageId: "Git.Git",
            status: "installed",
          },
        ],
      ),
    ).toMatchObject({
      currentVersion: "2.50.0",
      status: "installed",
    });

    expect(
      aggregateWingetPackageStatus(
        ["Guru3D.Afterburner", "Guru3D.RTSS"],
        [
          {
            currentVersion: "4.6.6",
            packageId: "Guru3D.Afterburner",
            status: "installed",
          },
          {
            packageId: "Guru3D.RTSS",
            status: "notInstalled",
          },
        ],
      ),
    ).toMatchObject({
      currentVersion: "4.6.6",
      status: "partial",
    });

    expect(
      aggregateWingetPackageStatus(
        ["Guru3D.Afterburner", "Guru3D.RTSS"],
        [
          {
            availableVersion: "4.6.7",
            currentVersion: "4.6.6",
            packageId: "Guru3D.Afterburner",
            status: "updateAvailable",
          },
          {
            currentVersion: "7.3.6",
            packageId: "Guru3D.RTSS",
            status: "installed",
          },
        ],
      ),
    ).toMatchObject({
      availableVersion: "4.6.7",
      status: "updateAvailable",
    });
  });

  test("builds install, upgrade, and uninstall scripts with winget version preflight", () => {
    const installScript = buildWingetScript(["Git.Git"], "install");
    const upgradeScript = buildWingetScript(["Git.Git"], "upgrade");
    const uninstallScript = buildWingetScript(["Git.Git"], "uninstall");

    expect(installScript).toContain("winget --version");
    expect(installScript).toContain("winget install --id $packageId --exact");
    expect(upgradeScript).toContain("winget upgrade --id $packageId --exact");
    expect(upgradeScript).toContain("--include-unknown");
    expect(uninstallScript).toContain(
      "winget uninstall --id $packageId --exact --source winget --disable-interactivity",
    );
    expect(uninstallScript).not.toContain("--accept-package-agreements");
  });
});
