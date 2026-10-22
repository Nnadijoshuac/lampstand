# Changelog

Lampstand uses [semantic versioning](https://semver.org): 1.0.x releases fix and improve without changing how the app is used.

## 1.0.3 (2026-10-22)

- Updates itself. When a new version is out, "Update to x.y.z" appears in the top bar. One click downloads about 60 MB and restarts. It's never offered mid-sermon, and only files signed by the project are installed.
- A small download. `Lampstand.exe` on its own (about 60 MB) fetches the speech and AI models on first start, and the download resumes if the connection drops. The full zip is still there for churches that prefer one download.
- Every translation Bible Show offers, 401 in 161 languages, is listed under Bibles, Add translation, Get online. 39 public-domain ones are added in one click.
- The AI server closes with Lampstand even if Lampstand crashes, so it never lingers in memory.
- The preview is the projector, pixel for pixel. Slides are made once at 1920 × 1080 and scaled, down for the preview and up for the projector, so lines break in the same places and no display can upset the layout. On a 16:10 or 4:3 projector, Fill covers the screen and Fit keeps the shape (Settings, Projector).
- `/` jumps to Go to reference and `.` (full stop) to Find. F5 and F6 still work, and the search boxes show their keys.

## 1.0.2 (2026-10-22)

- The window fits on 1080p screens at 150% scaling.
- Add translation: get free translations online or upload a file.

## 1.0.1 (2026-10-22)

- Fewer false moves from quotes.

## 1.0.0 (2026-10-21)

- First release: listens to the sermon and puts each verse on the projector as it's preached.
