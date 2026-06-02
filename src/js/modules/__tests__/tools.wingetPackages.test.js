import {
  WINGET_PACKAGE_GROUPS,
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

  test("builds install and upgrade scripts with winget version preflight", () => {
    const installScript = buildWingetScript(["Git.Git"], "install");
    const upgradeScript = buildWingetScript(["Git.Git"], "upgrade");

    expect(installScript).toContain("winget --version");
    expect(installScript).toContain("winget install --id $packageId --exact");
    expect(upgradeScript).toContain("winget upgrade --id $packageId --exact");
  });
});
