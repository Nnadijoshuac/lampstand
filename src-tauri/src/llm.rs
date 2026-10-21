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
        Ok(Self { port, child })
    }
}

impl Drop for Llm {
    fn drop(&mut self) {
        let _ = self.child.kill();
    }
}
