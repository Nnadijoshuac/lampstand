mod bark;
mod displays;
mod llm;

use std::path::PathBuf;
use std::sync::Mutex;
use tauri::ipc::{InvokeBody, Request};
use tauri::Manager;

enum Engine {
    Loading,
    Ready(bark::Bark),
    Failed(String),
}

struct Stt(Mutex<Engine>);
struct Ai(Mutex<Option<llm::Llm>>);

/// "ready", "loading", or the load error.
#[tauri::command]
fn stt_status(state: tauri::State<Stt>) -> String {
    match &*state.0.lock().unwrap() {
        Engine::Loading => "loading".into(),
        Engine::Ready(_) => "ready".into(),
        Engine::Failed(e) => e.clone(),
    }
}

/// Body: raw little-endian f32 samples, mono, 16 kHz.
#[tauri::command]
async fn stt_transcribe(state: tauri::State<'_, Stt>, request: Request<'_>) -> Result<String, String> {
    let InvokeBody::Raw(bytes) = request.body() else {
        return Err("Expected raw audio bytes".into());
    };
    let samples: Vec<f32> = bytes.chunks_exact(4).map(|c| f32::from_le_bytes([c[0], c[1], c[2], c[3]])).collect();
    #[cfg(debug_assertions)]
    if samples.len() > 16000 * 6 { save_wav(&std::env::temp_dir().join("scriptureflow-last.wav"), &samples) }
    match &mut *state.0.lock().unwrap() {
        Engine::Ready(b) => b.transcribe(&samples),
        Engine::Loading => Err("Speech model is still loading".into()),
        Engine::Failed(e) => Err(e.clone()),
    }
}

/// Debug builds keep the last clip sent for recognition, to check what the microphone delivers.
#[cfg(debug_assertions)]
fn save_wav(path: &std::path::Path, samples: &[f32]) {
    let mut b = Vec::with_capacity(44 + samples.len() * 2);
    let n = (samples.len() * 2) as u32;
    b.extend_from_slice(b"RIFF"); b.extend_from_slice(&(36 + n).to_le_bytes()); b.extend_from_slice(b"WAVEfmt ");
    b.extend_from_slice(&16u32.to_le_bytes()); b.extend_from_slice(&1u16.to_le_bytes()); b.extend_from_slice(&1u16.to_le_bytes());
    b.extend_from_slice(&16000u32.to_le_bytes()); b.extend_from_slice(&32000u32.to_le_bytes()); b.extend_from_slice(&2u16.to_le_bytes());
    b.extend_from_slice(&16u16.to_le_bytes()); b.extend_from_slice(b"data"); b.extend_from_slice(&n.to_le_bytes());
    for s in samples { b.extend_from_slice(&((s.clamp(-1.0, 1.0) * 32767.0) as i16).to_le_bytes()); }
    let _ = std::fs::write(path, b);
}

/// Appends a timing line to %TEMP%/scriptureflow.log (diagnostics for response speed).
#[tauri::command]
fn log_line(line: String) {
    use std::io::Write;
    // Never grows without end: past 5 MB the log becomes scriptureflow.old.log (replacing the older one) and a
    // fresh one starts, so at most about 10 MB of history is ever kept.
    let path = std::env::temp_dir().join("scriptureflow.log");
    if std::fs::metadata(&path).map(|m| m.len() > 5_000_000).unwrap_or(false) {
        let _ = std::fs::rename(&path, std::env::temp_dir().join("scriptureflow.old.log"));
    }
    if let Ok(mut f) = std::fs::OpenOptions::new().create(true).append(true).open(&path) {
        let _ = writeln!(f, "{line}");
    }
}

/// Opens a Lampstand web page (the translations catalogue) in the default browser. Only our own site.
#[tauri::command]
fn open_site(url: String) -> Result<(), String> {
    if !url.starts_with("https://nnadijoshuac.github.io/lampstand/") || url.contains('"') {
        return Err("not a Lampstand page".into());
    }
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        std::process::Command::new("explorer").arg(&url).creation_flags(0x0800_0000).spawn().map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Testing aid: SF_FEED=<audio url> makes the app listen to that recording instead of the microphone.
#[tauri::command]
fn debug_feed() -> Option<String> {
    std::env::var("SF_FEED").ok().filter(|s| !s.is_empty())
}

/// Port of the local AI server, once started.
#[tauri::command]
fn ai_port(state: tauri::State<Ai>) -> Option<u16> {
    state.0.lock().unwrap().as_ref().map(|l| l.port)
}

/// Bundled resources live next to the exe when installed, or in the crate folder during development.
fn resource(app: &tauri::AppHandle, rel: &str, probe: &str) -> Option<PathBuf> {
    let mut dirs = vec![];
    if let Ok(r) = app.path().resource_dir() {
        dirs.push(r.join(rel));
    }
    dirs.push(std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join(rel));
    dirs.into_iter().find(|d| d.join(probe).exists())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(Stt(Mutex::new(Engine::Loading)))
        .manage(Ai(Mutex::new(None)))
        .setup(|app| {
            displays::watch(app.handle());
            let handle = app.handle().clone();
            // On a computer with less than 8 GB the AI (about 1.5 GB) would starve speech recognition; leave it off.
            // References, reading along and quotes still work without it.
            let roomy = llm::total_memory_gb().map_or(true, |gb| gb >= 7.5);
            if !roomy {
                log_line("ai: off (less than 8 GB of memory)".into());
            }
            if let Some(dir) = resource(&handle, "llm", "llama-server.exe").filter(|_| roomy) {
                match llm::Llm::start(&dir) {
                    Ok(l) => *handle.state::<Ai>().0.lock().unwrap() = Some(l),
                    Err(e) => eprintln!("{e}"),
                }
            }
            std::thread::spawn(move || {
                let result = match resource(&handle, "models/bark", "encoder.onnx") {
                    Some(dir) => bark::Bark::load(&dir),
                    None => Err("Speech model files are missing".into()),
                };
                *handle.state::<Stt>().0.lock().unwrap() = match result {
                    Ok(b) => Engine::Ready(b),
                    Err(e) => Engine::Failed(e),
                };
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![stt_status, stt_transcribe, ai_port, log_line, debug_feed, open_site])
        .build(tauri::generate_context!())
        .expect("error while building Lampstand")
        .run(|app, event| {
            if let tauri::RunEvent::Exit = event {
                // Stop the AI server with the app.
                app.state::<Ai>().0.lock().unwrap().take();
            }
        });
}
