# Thunder official website

Static Astro site for the Thunder product, documentation, downloads, releases, and blog.

## Local development

```sh
pnpm install
pnpm run dev
```

The production build uses `https://nagrands.github.io/thunder-load-app/` as its canonical URL. Set `SITE_URL` and `BASE_PATH` to preview a future custom domain.

## Validation

```sh
pnpm test
pnpm run build
pnpm run test:links
pnpm run test:downloads
pnpm run test:e2e
pnpm run test:lighthouse
```

GitHub Releases are fetched at build time and merged by tag because platform jobs can publish separate release records. If GitHub is unavailable, the bundled latest-release snapshot keeps local builds deterministic.
