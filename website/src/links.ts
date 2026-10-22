// Where the site points. Filled in once the GitHub repository and release exist.
export const REPO_URL = 'https://github.com/Nnadijoshuac/lampstand'
export const DOWNLOAD_URL = REPO_URL + '/releases/latest'
/** Every release carries Lampstand.exe, which fetches its models on first start. */
export const EXE_URL = REPO_URL + '/releases/latest/download/Lampstand.exe'
export const EXE_SIZE = '60 MB'
/** The zip with the models in it. Only releases that change the models carry one, so this names it exactly. */
export const ZIP_URL = REPO_URL + '/releases/download/v1.0.3/Lampstand-1.0.3-windows.zip'
export const DOWNLOAD_SIZE = '1.6 GB'
