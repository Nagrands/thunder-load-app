const path = require("path");
const electronLog = require("electron-log");

const LEGACY_USER_DATA_APP_NAME = "Thunder Load";

function configureLegacyUserDataPath(app, fsModule, logger = electronLog) {
  try {
    const legacyUserDataPath = path.join(
      app.getPath("appData"),
      LEGACY_USER_DATA_APP_NAME,
    );
    fsModule.mkdirSync(legacyUserDataPath, { recursive: true });
    app.setPath("userData", legacyUserDataPath);
    return legacyUserDataPath;
  } catch (error) {
    logger.error?.("legacy-user-data-path-failed", { error });
    return null;
  }
}

module.exports = {
  LEGACY_USER_DATA_APP_NAME,
  configureLegacyUserDataPath,
};
