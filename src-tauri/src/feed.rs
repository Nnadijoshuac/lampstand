//! The livestream feed: the projector page, served on the church network so vMix (Web Browser input) or OBS
//! (Browser Source) can show the scripture with the same look as the projector, live, with no cables or capture card.
//!
//! GET /          the projector page in feed mode (add ?transparent for a clear background over video)
//! GET /events    Server-Sent Events: the current slide and style, then every change
//! GET /<file>    the app's own built files, read from inside the exe
//!
//! Off until the operator turns it on. Plain HTTP on the local network only, nothing leaves the building.
use std::io::{BufRead, BufReader, Write};
use std::net::{TcpListener, TcpStream, UdpSocket};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Manager, Runtime};

pub const PORT: u16 = 5555;

#[derive(Default)]
pub struct Feed {
    /// Latest {"slide":…,"style":…} the main window sent.
    state: Mutex<String>,
    clients: Mutex<Vec<TcpStream>>,
    running: Mutex<bool>,
}

impl Feed {
    /// Starts the server once. Returns the address to give vMix.
    pub fn start<R: Runtime>(self: &Arc<Self>, app: &AppHandle<R>) -> Result<String, String> {
        let url = format!("http://{}:{}/", lan_ip(), PORT);
        let mut running = self.running.lock().unwrap();
        if *running {
            return Ok(url);
        }
        let listener = TcpListener::bind(("0.0.0.0", PORT)).map_err(|e| format!("port {PORT} is busy ({e})"))?;
        *running = true;
        let feed = self.clone();
        let app = app.clone();
        std::thread::spawn(move || {
            for stream in listener.incoming().flatten() {
                let feed = feed.clone();
                let app = app.clone();
                std::thread::spawn(move || {
                    let _ = feed.serve(stream, &app);
                });
            }
        });
        Ok(url)
    }

    /// New slide or style from the main window: keep it, and send it to every page that is watching.
    pub fn push(&self, json: String) {
        let msg = format!("data: {}\n\n", json.replace('\n', " "));
        *self.state.lock().unwrap() = json;
        self.clients.lock().unwrap().retain_mut(|c| c.write_all(msg.as_bytes()).and_then(|_| c.flush()).is_ok());
    }

    fn serve<R: Runtime>(&self, mut stream: TcpStream, app: &AppHandle<R>) -> std::io::Result<()> {
        let mut line = String::new();
        BufReader::new(stream.try_clone()?).read_line(&mut line)?;
        let path = line.split_whitespace().nth(1).unwrap_or("/").to_string();
        let (route, query) = path.split_once('?').unwrap_or((&path, ""));
        if route == "/events" {
            stream.write_all(b"HTTP/1.1 200 OK\r\nContent-Type: text/event-stream\r\nCache-Control: no-cache\r\nAccess-Control-Allow-Origin: *\r\nConnection: keep-alive\r\n\r\n")?;
            let state = self.state.lock().unwrap().clone();
            if !state.is_empty() {
                stream.write_all(format!("data: {state}\n\n").as_bytes())?;
            }
            self.clients.lock().unwrap().push(stream);
            return Ok(());
        }
        if route == "/" {
            let q = if query.is_empty() { String::new() } else { format!("&{query}") };
            let to = format!("/index.html?view=output&feed=1{q}");
            return stream.write_all(format!("HTTP/1.1 302 Found\r\nLocation: {to}\r\nContent-Length: 0\r\n\r\n").as_bytes());
        }
        match app.asset_resolver().get(route.to_string()) {
            Some(asset) => {
                let head = format!("HTTP/1.1 200 OK\r\nContent-Type: {}\r\nContent-Length: {}\r\nCache-Control: no-cache\r\n\r\n", asset.mime_type, asset.bytes.len());
                stream.write_all(head.as_bytes())?;
                stream.write_all(&asset.bytes)
            }
            None => stream.write_all(b"HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\n\r\n"),
        }
    }
}

/// This computer's address on the church network. Every IPv4 address the machine has, best first: 192.168.x
/// (most church and home networks), then 172.16-31.x, then 10.x. A VPN's 10.x address never beats the real network.
fn lan_ip() -> String {
    use std::net::{IpAddr, ToSocketAddrs};
    let host = std::env::var("COMPUTERNAME").unwrap_or_else(|_| "localhost".into());
    let mut ips: Vec<std::net::Ipv4Addr> = (host.as_str(), 0)
        .to_socket_addrs()
        .map(|it| it.filter_map(|a| match a.ip() { IpAddr::V4(v) if !v.is_loopback() && !v.is_link_local() => Some(v), _ => None }).collect())
        .unwrap_or_default();
    if let Ok(v) = UdpSocket::bind("0.0.0.0:0").and_then(|s| s.connect("192.168.0.1:80").map(|_| s)).and_then(|s| s.local_addr()) {
        if let IpAddr::V4(v) = v.ip() { if !ips.contains(&v) { ips.push(v) } }
    }
    let rank = |ip: &std::net::Ipv4Addr| match ip.octets() { [192, 168, ..] => 0, [172, b, ..] if (16..32).contains(&b) => 1, [10, ..] => 2, _ => 3 };
    ips.sort_by_key(rank);
    ips.first().map(|v| v.to_string()).unwrap_or_else(|| "127.0.0.1".into())
}

pub fn shared() -> Arc<Feed> {
    Arc::new(Feed::default())
}

pub type FeedState = Arc<Feed>;

#[allow(dead_code)]
pub fn state<R: Runtime>(app: &AppHandle<R>) -> FeedState {
    app.state::<FeedState>().inner().clone()
}
