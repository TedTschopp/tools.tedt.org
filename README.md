# Ted’s Tools

The maintained source for **https://tools.tedt.org/**. An Astro catalog surrounds
standalone browser tools imported from TedT.org. Traveller tools and projects on
their own domains remain linked at their original addresses.
Traveller's original description pages also remain on TedT.org. Every migration
redirect explicitly excludes Traveller paths.

## Develop and verify

Use Node 26 and the committed lockfiles.

```sh
npm ci
npm run build
npm test
npm ci --prefix worker
npm run test:worker
npx playwright install chromium
npm run test:browser
npm run preview -- --port 4322
```

`npm run build` prepares the standalone tools, compiles their original Sass,
converts the learning pages to the Astro shells, builds the catalog, and checks
every launch URL and directly referenced local page asset. Browser tests cover
the catalog, each migrated tool page, and representative working operations.

## Maintained source

- `tool-src/tools/`: standalone HTML tools and their scripts, data, WASM, and assets.
- `tool-src/_tools/`: Markdown descriptions, launch URLs, tags, and existing status.
- `tool-src/game-theory/`, `math-guide/`, and `_includes/game-theory/`: learning content.
- `tool-src/js/`, `css/`, `_sass/`, `RPG/`, `fonts/`, and `img/`: imported runtime dependencies.
- `tool-src/_apps/inside-ai/`: original Svelte/Vite application and tests.
- `tool-src/inside-ai/assets/`: the preserved, previously published application build,
  tokenizer data, and browser runtime. The upstream build scripts and lockfile are
  retained alongside the application source. Rebuilding the model application is
  a separate operation from rebuilding its catalog and page shell; preserve its
  model/tokenizer assets when using the upstream Vite build, which empties its output.
- `src/`: catalog, shared navigation, themes, and Astro learning-page layouts.
- `worker/`: account-specific Social Bot Check link previews.

Generated `public/` and `dist/` are ignored. Edit the maintained source, then build.
New entries can use the existing `_tools` Markdown format. Previously unlisted
HTML tools are included as prototypes; support fragments are preserved with their
parent tool. No scheduled import overwrites these files.

## Publication

GitHub Actions validates and deploys `main` to GitHub Pages. The custom domain is
`tools.tedt.org`; Cloudflare's CNAME points to `tedtschopp.github.io`. Proxying is
enabled after GitHub has issued its HTTPS certificate, so the preview Worker can
run at `/social-bot-check.html*`. The Worker source and locked tests are in this
repository. Deploy the tested bundle through the authenticated Cloudflare connector
or a scoped Wrangler credential; never store credentials in source or reports.

`version.json` identifies the deployed commit and original source snapshot.

## Migration and rollback

`reports/source-inventory.json` records the original source commit, every imported
file, and its original SHA-256. `reports/migration-routes.json` records short launch
URLs, old detail URLs, supporting files, and the launch addresses retained elsewhere.
`reports/rollback/` preserves the previous preview routing configuration. Deployment
and cutover evidence is recorded in the reports directory.

Old paths on TedT.org redirect only after the new site is verified. To roll back,
disable the Tools redirect rules by their recorded Cloudflare IDs and revert the
TedT.org cutover commit. The original preview Worker remains available for that
rollback. Other Cloudflare rules, Traveller URLs, and separately hosted projects
are unchanged.

Saved drafts, preferences, model caches, and API keys are origin-specific. The new
domain starts fresh and does not copy or erase browser data from TedT.org.

## Attribution

Original notices and individual licenses remain with the imported files. This
repository does not apply a new blanket license to third-party tools. The catalog
uses Ted Tschopp's Public Workbench design, matching AI.Tedt.org and BUSY.Tedt.org.
