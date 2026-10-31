// Where the site points. Filled in once the GitHub repository and release exist.
export const REPO_URL = 'https://github.com/Nnadijoshuac/lampstand'
export const DOWNLOAD_URL = REPO_URL + '/releases/latest'
/** The installer of the newest version. It installs the app, which fetches its models on first start. */
export const VERSION = '1.0.6'
export const EXE_URL = REPO_URL + `/releases/download/v${VERSION}/Lampstand-${VERSION}-setup.exe`
export const EXE_SIZE = '37 MB'

/** Every version, newest first, each still downloadable. */
export const VERSIONS: { v: string; date: string; note: string }[] = [
  { v: '1.0.6', date: '31 October 2026', note: 'Asks for the microphone in its own words' },
  { v: '1.0.5', date: '31 October 2026', note: 'The AI joins straight after the listening download, Pause' },
  { v: '1.0.4', date: '31 October 2026', note: 'Read ahead, audio gain, a livestream feed for vMix and OBS, a small installer' },
  { v: '1.0.3', date: '22 October 2026', note: 'Updates itself, a small download, every Bible Show translation' },
  { v: '1.0.2', date: '22 October 2026', note: 'Fits 1080p screens at 150% scaling, Add translation' },
  { v: '1.0.1', date: '22 October 2026', note: 'Fewer false moves from quotes' },
  { v: '1.0.0', date: '21 October 2026', note: 'First release' },
]
/** The zip with the models in it. Only releases that change the models carry one, so this names it exactly. */
export const ZIP_URL = REPO_URL + '/releases/download/v1.0.3/Lampstand-1.0.3-windows.zip'
export const DOWNLOAD_SIZE = '1.6 GB'
