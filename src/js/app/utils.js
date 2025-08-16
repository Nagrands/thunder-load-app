// utils.js (src/js/app/utils.js)

const tldjs = require("tldjs");
const { supportedDomains } = require("./domains.js");

function isValidUrl(string) {
  try {
    new URL(string);
    return true;
  } catch {
    return false;
  }
}

function isSupportedUrl(string) {
  try {
    const url = new URL(string);
    const domain = tldjs.getDomain(url.hostname);
    return supportedDomains.includes(domain);
  } catch {
    return false;
  }
}

module.exports = {
  isValidUrl,
  isSupportedUrl,
};
