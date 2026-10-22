//! Local language model (Qwen2.5 1.5B Instruct, 4-bit) served by llama.cpp's llama-server.
//! It runs on 127.0.0.1 only and never touches the network. The UI calls its OpenAI-style API.

use std::net::TcpListener;
use std::path::Path;
use std::process::{Child, Command};

pub struct Llm {
    pub port: u16,
    child: Child,
}

impl Llm {
    pub fn start(dir: &Path) -> Result<Self, String> {
        let port = TcpListener::bind("127.0.0.1:0").and_then(|l| l.local_addr()).map_err(|e| e.to_string())?.port();
        // One thread per physical core (logical / 2). Speech and the assistant rarely run at the same moment.
        let threads = (std::thread::available_parallelism().map(|n| n.get()).unwrap_or(4) / 2).max(2);
        let mut cmd = Command::new(dir.join("llama-server.exe"));
        cmd.current_dir(dir).args([
            "-m", "model.gguf",
            "--host", "127.0.0.1",
            "--port", &port.to_string(),
            "-c", "6144",
            // Three slots: recall, rerank and routing each keep their own cached instructions.
            "-np", "3",
            "-t", &threads.to_string(),
            "--no-webui",
        ]);
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            // No console window, and below-normal priority: listening must never wait on the assistant.
            // Speech recognition always gets the processor first; the AI uses what is left.
            cmd.creation_flags(0x0800_0000 | 0x0000_4000);
        }
        let child = cmd.spawn().map_err(|e| format!("Could not start the AI: {e}"))?;
        #[cfg(windows)]
        close_with_app(&child);
        Ok(Self { port, child })
    }
}

/// Puts the AI server in a job that Windows closes when Lampstand exits, even if Lampstand crashes or is ended from
/// Task Manager, so it never lingers holding 1.5 GB of memory.
#[cfg(windows)]
fn close_with_app(child: &Child) {
    use std::os::windows::io::AsRawHandle;
    use windows::Win32::Foundation::HANDLE;
    use windows::Win32::System::JobObjects::*;
    unsafe {
        let Ok(job) = CreateJobObjectW(None, windows::core::PCWSTR::null()) else { return };
        let mut info = JOBOBJECT_EXTENDED_LIMIT_INFORMATION::default();
        info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
        let set = SetInformationJobObject(
            job,
            JobObjectExtendedLimitInformation,
            &info as *const _ as *const std::ffi::c_void,
            std::mem::size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
        );
        // The job handle stays open for Lampstand's lifetime; Windows closes it, and the server, on exit.
        if set.is_ok() {
            let _ = AssignProcessToJobObject(job, HANDLE(child.as_raw_handle()));
        }
    }
}

/// Physical memory installed, in GB.
#[cfg(windows)]
pub fn total_memory_gb() -> Option<f64> {
    use windows::Win32::System::SystemInformation::{GlobalMemoryStatusEx, MEMORYSTATUSEX};
    let mut m = MEMORYSTATUSEX { dwLength: std::mem::size_of::<MEMORYSTATUSEX>() as u32, ..Default::default() };
    unsafe { GlobalMemoryStatusEx(&mut m) }.ok()?;
    Some(m.ullTotalPhys as f64 / 1_073_741_824.0)
}

#[cfg(not(windows))]
pub fn total_memory_gb() -> Option<f64> {
    None
}

impl Drop for Llm {
    fn drop(&mut self) {
        let _ = self.child.kill();
    }
}
