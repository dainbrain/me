# dainkennison.com

Source for my personal site — hand-coded, no page builder, no front-end framework.

**Live:** https://dainkennison.com

## Stack

- **Vite** (multi-page) + vanilla **TypeScript / JS** — no React or Angular here, just the platform.
- **Three.js** WebGL point-cloud portrait: a depth-map-driven `Points` cloud with a custom `ShaderMaterial` and `Raycaster` interaction. It's **lazy-booted** via `IntersectionObserver` + `requestIdleCallback`, so it never blocks first paint.
- **Variable fonts** (Inter + Unbounded), self-hosted and preloaded.
- **Hardened security headers** — strict Content-Security-Policy, HSTS preload, Permissions-Policy, `X-Frame-Options: DENY`, and more (see [`netlify.toml`](netlify.toml)).
- **sharp** for build-time image processing; deployed on **Netlify**.

## Run it

```bash
npm install
npm run dev      # local dev server
npm run build    # production build -> dist/
npm run preview  # serve the build
```

## Structure

```
index.html                   # the site
src/main.js                  # entry; lazy-boots the WebGL scene when it scrolls into view
src/webgl/portraitScene.js   # Three.js point-cloud portrait + custom shaders
src/styles.css               # design tokens + layout
public/                      # fonts, client/award logos, og-image, email signature
netlify.toml                 # build + security headers (CSP)
```

Built and maintained by Dain Kennison · [dainkennison.com](https://dainkennison.com)
