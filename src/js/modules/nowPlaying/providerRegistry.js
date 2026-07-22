const REQUIRED_METHODS = ["importSource", "restore", "resolveTrack", "dispose"];

export class MusicProviderRegistry {
  constructor() {
    this.providers = new Map();
  }

  register(provider) {
    if (!provider?.id || typeof provider.id !== "string") {
      throw new TypeError("Music provider must expose a string id");
    }
    const missingMethod = REQUIRED_METHODS.find(
      (method) => typeof provider[method] !== "function",
    );
    if (missingMethod) {
      throw new TypeError(
        `Music provider "${provider.id}" must implement ${missingMethod}()`,
      );
    }
    this.providers.set(provider.id, provider);
    return provider;
  }

  get(providerId) {
    return this.providers.get(providerId) || null;
  }

  async resolveTrack(track, options = {}) {
    const provider = this.get(track?.providerId);
    if (!provider) {
      throw new Error(`Unknown music provider: ${track?.providerId || ""}`);
    }
    return provider.resolveTrack(track, options);
  }

  async releasePlayback(track, playback) {
    const provider = this.get(track?.providerId);
    if (typeof provider?.releasePlayback === "function") {
      await provider.releasePlayback(playback);
    }
  }

  dispose() {
    this.providers.forEach((provider) => provider.dispose());
    this.providers.clear();
  }
}

export default MusicProviderRegistry;
