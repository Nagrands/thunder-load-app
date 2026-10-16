// Single source of truth for the public site URL and the deploy base path.
// Override SITE_URL / BASE_PATH to preview a custom domain.
const repository = "thunder-load-app";

export const site = process.env.SITE_URL ?? "https://nagrands.github.io";
export const base = process.env.BASE_PATH ?? `/${repository}`;
export const basePath = base.replace(/\/+$/, "");
