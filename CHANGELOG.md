# Changelog

Lampstand uses [semantic versioning](https://semver.org): 1.0.x releases fix and improve without changing how the app is used.

## 1.0.6 (2026-10-31)

- The first time you press Listen, Lampstand asks for the microphone in its own words, once. The browser-style "tauri.localhost wants to use your microphones" prompt is gone.

## 1.0.5 (2026-10-31)

- After the one-time listening download, the AI joins straight away. Before, it waited for Lampstand to be restarted.
- Turn on listening: a short bar with Download and Not now, and Pause while it downloads.

## 1.0.4 (2026-10-31)

- Read ahead (Settings, AI & Listening). Readers see the end of a verse before they say it, so the next verse goes up 3, 4 or 5 syllables early. If they stop to explain, the verse they are explaining comes back.
- Settings, Audio. Choose the microphone or sound card, and it switches straight away. Gain up to +30 dB lifts a quiet feed for Lampstand only, without touching the livestream. Auto sets the gain from a few seconds of speech. A level meter with peak hold.
- Ctrl + click Listen opens the audio settings.
- Livestream feed for vMix and OBS (Settings, Livestream). The scripture, live, as a web address on the church network, with a transparent version for laying over video.
- "John one ten", "John Wanton", "Romans ate twenty eight" and "chap two" are understood. Spelled-out translation codes are understood even with a misheard letter ("kg v" is KJV).
- Words the recogniser invents in quiet moments are ignored. A short "go back" goes to the verse before.
- No jump further down the chapter while the words still fit the verse being read.
- Search by meaning works with no internet.
- Errors are shown as plain sentences. The details go to the log.
- A 37 MB installer. The speech and AI models download once, on first start.

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
