const path = require("path");

const LEGACY_USER_DATA_APP_NAME = "Thunder Load";

function configureLegacyUserDataPath(app, fsModule) {
  try {
    const legacyUserDataPath = path.join(
      app.getPath("appData"),
      LEGACY_USER_DATA_APP_NAME,
    );
    fsModule.mkdirSync(legacyUserDataPath, { recursive: true });
    app.setPath("userData", legacyUserDataPath);
    return legacyUserDataPath;
  } catch (error) {
    console.error("Failed to configure legacy user data path:", error);
    return null;
  }
}

module.exports = {
  LEGACY_USER_DATA_APP_NAME,
  configureLegacyUserDataPath,
};
