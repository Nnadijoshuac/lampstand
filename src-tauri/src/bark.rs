//! Underdog Bark 3.0 Plus speech recognition, run natively with ONNX Runtime.
//!
//! Bark is a fine-tune of NVIDIA Parakeet TDT 0.6B v3. Its weights were moved into the
//! Parakeet ONNX graph (encoder + decoder/joint) and quantised to 8 bits, so no Python is needed.
//! Pipeline: 16 kHz mono audio -> log-mel features -> FastConformer encoder -> greedy TDT decoding.

use ort::session::{builder::GraphOptimizationLevel, Session};
use ort::value::Tensor;
use std::path::Path;

const SAMPLE_RATE: usize = 16_000;
/// Silence added before each clip; the setting Bark's published accuracy was measured with.
const LEAD_IN: usize = SAMPLE_RATE / 4;
const HIDDEN: usize = 640;
const MAX_SYMBOLS_PER_STEP: usize = 10;

pub struct Bark {
    _env: ort::environment::Environment,
    pre: Session,
    enc: Session,
    dec: Session,
    vocab: Vec<String>,
    blank: i32,
}

fn session(env: &ort::environment::Environment, path: &Path) -> Result<Session, String> {
    // Physical cores only: hyper-threads slow ONNX Runtime down and starve the assistant.
    let threads = (std::thread::available_parallelism().map(|n| n.get()).unwrap_or(4) / 2).clamp(2, 8);
    let err = |e: String| format!("{}: {e}", path.display());
    Session::builder(env)
        .map_err(|e| err(e.to_string()))?
        .with_optimization_level(GraphOptimizationLevel::Level3)
        .map_err(|e| err(e.to_string()))?
        .with_intra_threads(threads)
        .map_err(|e| err(e.to_string()))?
        .commit_from_file(path)
        .map_err(|e| err(e.to_string()))
}

impl Bark {
    pub fn load(dir: &Path) -> Result<Self, String> {
        let vocab: Vec<String> = std::fs::read_to_string(dir.join("vocab.txt"))
            .map_err(|e| e.to_string())?
            .lines()
            .map(|l| l.rsplit_once(' ').map(|(t, _)| t).unwrap_or(l).replace('\u{2581}', " "))
            .collect();
        let blank = vocab.iter().position(|t| t == "<blk>").ok_or("vocab has no <blk>")? as i32;
        let env = ort::init().with_name("scriptureflow").build().map_err(|e| e.to_string())?;
        let mut me = Self {
            pre: session(&env, &dir.join("preprocessor.onnx"))?,
            enc: session(&env, &dir.join("encoder.onnx"))?,
            dec: session(&env, &dir.join("decoder_joint.onnx"))?,
            _env: env,
            vocab,
            blank,
        };
        // Warm up so the first real phrase is not slowed by kernel selection.
        let _ = me.transcribe(&vec![0.0; SAMPLE_RATE / 2]);
        Ok(me)
    }

    /// `audio`: mono f32 samples at 16 kHz.
    pub fn transcribe(&mut self, audio: &[f32]) -> Result<String, String> {
        let e = |e: ort::Error| e.to_string();
        // Level the clip: quiet or distant microphones are lifted to a steady loudness (up to 30x).
        let peak = audio.iter().fold(0.0f32, |m, &x| m.max(x.abs()));
        let gain = if peak > 1e-4 { (0.7 / peak).min(30.0) } else { 1.0 };
        let mut wave = vec![0.0f32; LEAD_IN];
        wave.extend(audio.iter().map(|&x| x * gain));
        let n = wave.len();

        let (feats_shape, feats, feat_len) = {
            let out = self
                .pre
                .run(ort::inputs![
                    "waveforms" => Tensor::from_array(([1usize, n], wave)).map_err(e)?,
                    "waveforms_lens" => Tensor::from_array(([1usize], vec![n as i64])).map_err(e)?,
                ])
                .map_err(e)?;
            let (shape, data) = out["features"].try_extract_tensor::<f32>().map_err(e)?;
            let (_, len) = out["features_lens"].try_extract_tensor::<i64>().map_err(e)?;
            (shape.iter().map(|&d| d as usize).collect::<Vec<_>>(), data.to_vec(), len[0])
        };

        // Encoder output is [1, 1024, T]; frames are read column by column.
        let (dim, frames, enc) = {
            let out = self
                .enc
                .run(ort::inputs![
                    "audio_signal" => Tensor::from_array((feats_shape, feats)).map_err(e)?,
                    "length" => Tensor::from_array(([1usize], vec![feat_len])).map_err(e)?,
                ])
                .map_err(e)?;
            let (shape, data) = out["outputs"].try_extract_tensor::<f32>().map_err(e)?;
            let (_, lens) = out["encoded_lengths"].try_extract_tensor::<i64>().map_err(e)?;
            (shape[1] as usize, (lens[0] as usize).min(shape[2] as usize), data.to_vec())
        };
        let stride = enc.len() / dim;

        let mut s1 = vec![0.0f32; 2 * HIDDEN];
        let mut s2 = vec![0.0f32; 2 * HIDDEN];
        let mut last = self.blank;
        let mut text = String::new();
        let (mut t, mut emitted) = (0usize, 0usize);
        let vocab_len = self.vocab.len();
        let mut frame = vec![0.0f32; dim];
        while t < frames {
            for (d, f) in frame.iter_mut().enumerate() {
                *f = enc[d * stride + t];
            }
            let out = self
                .dec
                .run(ort::inputs![
                    "encoder_outputs" => Tensor::from_array(([1usize, dim, 1], frame.clone())).map_err(e)?,
                    "targets" => Tensor::from_array(([1usize, 1], vec![last])).map_err(e)?,
                    "target_length" => Tensor::from_array(([1usize], vec![1i32])).map_err(e)?,
                    "input_states_1" => Tensor::from_array(([2usize, 1, HIDDEN], s1.clone())).map_err(e)?,
                    "input_states_2" => Tensor::from_array(([2usize, 1, HIDDEN], s2.clone())).map_err(e)?,
                ])
                .map_err(e)?;
            let (_, logits) = out["outputs"].try_extract_tensor::<f32>().map_err(e)?;
            let argmax = |xs: &[f32]| xs.iter().enumerate().fold((0, f32::MIN), |b, (i, &x)| if x > b.1 { (i, x) } else { b }).0;
            let tok = argmax(&logits[..vocab_len]) as i32;
            let dur = argmax(&logits[vocab_len..]);
            if tok != self.blank {
                // Special tokens such as <unk> (Bark has no quotation mark) never belong in the transcript.
                let piece = &self.vocab[tok as usize];
                if !(piece.trim_start().starts_with('<') && piece.ends_with('>')) {
                    text.push_str(piece);
                }
                last = tok;
                s1 = out["output_states_1"].try_extract_tensor::<f32>().map_err(e)?.1.to_vec();
                s2 = out["output_states_2"].try_extract_tensor::<f32>().map_err(e)?.1.to_vec();
                emitted += 1;
            }
            if dur > 0 {
                t += dur;
                emitted = 0;
            } else if tok == self.blank || emitted >= MAX_SYMBOLS_PER_STEP {
                t += 1;
                emitted = 0;
            }
        }
        Ok(text.trim().to_string())
    }
}

#[cfg(test)]
mod tests {
    /// Run with BARK_WAV=<16 kHz mono 16-bit wav>: cargo test --release -- --nocapture
    #[test]
    fn transcribes_wav() {
        let Ok(path) = std::env::var("BARK_WAV") else { return };
        let bytes = std::fs::read(path).unwrap();
        let samples: Vec<f32> = bytes[44..].chunks_exact(2).map(|c| i16::from_le_bytes([c[0], c[1]]) as f32 / 32768.0).collect();
        let dir = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("models").join("bark");
        let t = std::time::Instant::now();
        let mut b = super::Bark::load(&dir).unwrap();
        println!("load {:?}", t.elapsed());
        for _ in 0..2 {
            let t = std::time::Instant::now();
            let text = b.transcribe(&samples).unwrap();
            println!("{:.2}s audio in {:?}: {text}", samples.len() as f32 / 16000.0, t.elapsed());
        }
    }
}
