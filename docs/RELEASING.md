# Releasing Lampstand

Installed copies update themselves from `website/public/update.json`. They install a file only if its signature matches the public key in `src-tauri/src/update.rs`. The private key is kept off GitHub (default `~/.lampstand/update-key.pem`). Keep a backup of it. Without it, no installed copy can be updated again.

## Steps

1. Bump `version` in `src-tauri/tauri.conf.json` and add the release to `CHANGELOG.md`.
2. `npm test`, then `npx tauri build --no-bundle`.
3. Copy `src-tauri/target/release/lampstand.exe` to `release/Lampstand-x.y.z/Lampstand.exe`. The folder also holds `models/`, `llm/`, `README.txt` and `LICENSE.txt`.
4. Only if the models or the AI server changed, zip the folder as `Lampstand-x.y.z-windows.zip`, keeping the `Lampstand-x.y.z/` folder inside it.
5. Sign:
   ```
   node scripts/sign-update.mjs x.y.z --exe release/Lampstand-x.y.z/Lampstand.exe [--zip release/Lampstand-x.y.z-windows.zip] [--full] "What changed"
   ```
   Without `--zip`, copies that came as the exe alone keep fetching their models from the last zip. `--full` sends people to the website instead of updating in place. Use it when the exe alone isn't enough.
6. Create the GitHub release `vx.y.z` with `Lampstand.exe` (and the zip, if there is one).
7. Only after the release files are up, deploy the website with the new `update.json`. Installed copies see the update from then on.

## Versions

- Patch (1.0.x): fixes and improvements, same use.
- Minor (1.x.0): new features.
- Major (x.0.0): a change in how Lampstand is used or in its files.

The app identifier (`org.scriptureflow.app`) and the IndexedDB name (`scriptureflow`) keep the old name on purpose. Changing either would lose every church's saved Bibles and settings.
