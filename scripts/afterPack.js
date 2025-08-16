// afterPack.js (scripts\afterPack.js)

const fs = require("fs-extra");
const path = require("path");

module.exports = async function (context) {
  const appOutDir = context.appOutDir;
  const binSrcDir = path.join(__dirname, "..", "bin"); // Исходная папка bin с бинарниками
  const binDestDir = path.join(appOutDir, "resources", "bin"); // Куда нужно скопировать бинарники

  console.log(`[afterPack] Copying bin from ${binSrcDir} to ${binDestDir}`);

  // Копируем папку bin
  await fs.copy(binSrcDir, binDestDir);

  console.log("Successfully copied to:", binDestDir);
};
