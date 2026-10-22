//! Updates and the small download. The website's update.json names the newest version and the zip that carries the
//! speech and AI models. Most releases change only Lampstand.exe, so the app downloads the new exe from the GitHub
//! release, installs it only if it's signed with the release key, swaps it in and restarts. Someone who downloaded
//! just the exe gets the models the same way, into %LOCALAPPDATA%\Lampstand, and the download resumes if it stops.
//! Signatures are ed25519 over the file's SHA-256. scripts/sign-update.mjs signs a release.
use ed25519_dalek::{Signature, Verifier, VerifyingKey};
use sha2::{Digest, Sha256};
use std::os::windows::process::CommandExt;
use std::path::{Path, PathBuf};
use std::process::Command;

/// The public half of the release key. Only files signed with its private half (kept off GitHub) are installed.
const KEY: &str = "f7066cf5035f32b08e58df9c15fb28050f4705e6a62d2c13043d67744220b1c8";
const RELEASES: &str = "https://github.com/Nnadijoshuac/lampstand/releases/download/";
const NO_WINDOW: u32 = 0x0800_0000;

fn hex(s: &str) -> Option<Vec<u8>> {
    (0..s.len()).step_by(2).map(|i| u8::from_str_radix(s.get(i..i + 2)?, 16).ok()).collect()
}

fn verify(file: &Path, signature: &str) -> Result<(), String> {
    let mut hasher = Sha256::new();
    let mut f = std::fs::File::open(file).map_err(|e| e.to_string())?;
    std::io::copy(&mut f, &mut hasher).map_err(|e| e.to_string())?;
    let digest = hasher.finalize();
    let key: [u8; 32] = hex(KEY).and_then(|k| k.try_into().ok()).ok_or("bad release key")?;
    let sig: [u8; 64] = hex(signature).and_then(|s| s.try_into().ok()).ok_or("The signature is malformed")?;
    VerifyingKey::from_bytes(&key)
        .map_err(|e| e.to_string())?
        .verify(&digest, &Signature::from_bytes(&sig))
        .map_err(|_| "The download isn't signed by Lampstand, so it wasn't installed".to_string())
}

fn system32(exe: &str) -> PathBuf {
    PathBuf::from(std::env::var("SystemRoot").unwrap_or_else(|_| "C:\\Windows".into())).join("System32").join(exe)
}

/// curl comes with Windows 10 and 11, follows GitHub's redirect and never serves a cached copy.
fn download(url: &str, to: &Path, resume: bool) -> bool {
    let mut cmd = Command::new(system32("curl.exe"));
    cmd.args(["-fsSL", "--retry", "3"]);
    if resume {
        cmd.args(["-C", "-"]);
    }
    cmd.arg("-o").arg(to).arg(url).creation_flags(NO_WINDOW).status().map_or(false, |s| s.success())
}

fn ours(url: &str) -> Result<(), String> {
    if url.starts_with(RELEASES) && !url.contains('"') { Ok(()) } else { Err("Not a Lampstand release".into()) }
}

/// Downloads the new exe, checks it and puts it in place of this one. Returns the exe to start.
pub fn install(url: &str, signature: &str) -> Result<PathBuf, String> {
    ours(url)?;
    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    let dir = exe.parent().ok_or("Lampstand's folder is missing")?;
    let tmp = dir.join("Lampstand.update");
    let _ = std::fs::remove_file(&tmp);
    let checked = if download(url, &tmp, false) { verify(&tmp, signature) } else { Err("The download failed. Check the internet connection".into()) };
    if let Err(e) = checked {
        let _ = std::fs::remove_file(&tmp);
        return Err(e);
    }
    // Windows lets a running exe be renamed, not overwritten.
    let old = dir.join("Lampstand.old");
    let _ = std::fs::remove_file(&old);
    std::fs::rename(&exe, &old).map_err(|e| format!("Could not replace Lampstand ({e}). Is its folder read-only?"))?;
    if let Err(e) = std::fs::rename(&tmp, &exe) {
        let _ = std::fs::rename(&old, &exe);
        return Err(format!("Could not replace Lampstand ({e})"));
    }
    Ok(exe)
}

/// Starts the new exe, which waits for this one to close.
pub fn relaunch(exe: &Path) -> Result<(), String> {
    let mut cmd = Command::new(exe);
    cmd.arg("--after-update");
    if let Some(dir) = exe.parent() {
        cmd.current_dir(dir);
    }
    cmd.spawn().map(|_| ()).map_err(|e| format!("Updated, but could not restart: {e}. Open Lampstand again"))
}

/// After an update: give the old copy a moment to close, then clear what it left behind.
pub fn tidy() {
    if std::env::args().any(|a| a == "--after-update") {
        std::thread::sleep(std::time::Duration::from_millis(1500));
    }
    if let Some(dir) = std::env::current_exe().ok().and_then(|e| e.parent().map(PathBuf::from)) {
        let _ = std::fs::remove_file(dir.join("Lampstand.old"));
        let _ = std::fs::remove_file(dir.join("Lampstand.update"));
    }
}

/// Where the small download keeps the models it fetches.
pub fn data_dir() -> Option<PathBuf> {
    std::env::var_os("LOCALAPPDATA").map(|d| PathBuf::from(d).join("Lampstand"))
}

fn part() -> Option<PathBuf> {
    data_dir().map(|d| d.join("models.zip.part"))
}

/// Bytes of the models download so far.
pub fn progress() -> u64 {
    part().and_then(|p| std::fs::metadata(p).ok()).map_or(0, |m| m.len())
}

/// Downloads the release zip (resuming a stopped download), checks it and unpacks the models and AI server from it.
pub fn fetch_models(url: &str, signature: &str, size: u64) -> Result<(), String> {
    ours(url)?;
    let dir = data_dir().ok_or("No local app data folder")?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let zip = part().unwrap();
    if progress() > size {
        let _ = std::fs::remove_file(&zip);
    }
    if progress() < size && !download(url, &zip, true) {
        return Err("The download stopped. Press Download again and it continues where it left off".into());
    }
    if let Err(e) = verify(&zip, signature) {
        let _ = std::fs::remove_file(&zip);
        return Err(e);
    }
    // The zip holds one folder (Lampstand-x.y.z/): take its models and llm folders.
    let ok = Command::new(system32("tar.exe"))
        .args(["--strip-components", "1", "-xf"]).arg(&zip).arg("-C").arg(&dir).args(["*/models", "*/llm"])
        .creation_flags(NO_WINDOW)
        .status()
        .map_or(false, |s| s.success());
    if !ok {
        return Err("Could not unpack the models. Is the disk full?".into());
    }
    let _ = std::fs::remove_file(&zip);
    Ok(())
}
