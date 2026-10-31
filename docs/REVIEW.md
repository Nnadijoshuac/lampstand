# Engineering review, 31 October 2026

A frank look at Lampstand as of 1.0.6: what was done well, what was done badly, and where to go next. Read this with `JOURNAL.md` (what happened) and `RELEASING.md` (how to ship).

## Summary

Lampstand reads like a product built quickly by someone listening closely to real users. The core is sound. The outer layers grew by accretion. It is a strong prototype in production, and the next phase should be about structure rather than features.

## What was done well

- **Local-first by design.** Speech recognition (Bark, ONNX in Rust) and the assistant (Qwen via llama.cpp) run on the computer, and nothing is sent anywhere. This is a real differentiator for churches and made an honest privacy notice possible.
- **Rules first, AI second, and AI verified.** Deterministic rules do most of the work. The AI is a fallback whose answers are checked against the verse text before anything reaches the screen. In a live service a wrong verse is worse than a slow one, so this is the right architecture.
- **Measurement over guesswork.** Sermon replays (6/24 to 19/24, then 14/16 on an unseen sermon) and a 60-case AI evaluation (`scripts/eval/ai-eval.mjs`). The evaluation found the broken prompts and rejected a smaller model that would have made results worse.
- **A properly built updater.** ed25519 signatures over SHA-256, release URLs pinned, resumable downloads, rollback if the swap fails, and the AI server tied to the app's lifetime by a Windows job object.
- **Real clean-install testing.** Removing everything and installing from the website found two bugs no unit test would have found: the AI waiting for a restart, and the browser-style microphone prompt.
- **A paper trail.** Changelog, journal, every version kept, and legal pages.

## What was done badly

1. **A published version was changed.** 1.0.6 was rebuilt twice after it went public (the close fix, then the version label). A version number must mean one build forever. Otherwise "which version are you on?" stops answering anything. Those changes should have been 1.0.7 and 1.0.8. The website can still show one entry per day while the version numbers stay honest. **Rule from now on: never replace files in a published release. Ship a new version.**
2. **Manual, fragile releases.** Uploading through GitHub's web page caused an empty early publish, failed multi-file uploads, and a tag left on the wrong commit (v1.0.6 points at ca94272, before the final fixes). The fix is one GitHub Actions workflow: push a tag, and it builds, signs and publishes. SignPath's free signing also requires this.
3. **`src/app/App.tsx` is too large.** Over 1,500 lines covering listening, tracker wiring, settings, the catalogue, updates and the feed, with many "mirror this state in a ref" patterns. Split it into focused hooks and modules before adding more features.
4. **Recognition is a growing list of special cases.** "Wanton" means 1 10, "kg v" means KJV, "chap" means chapter. Each patch is reasonable, but two recorded sermons is far too small a regression set to stop one fix breaking another.
5. **The AI prompts were untested for weeks.** The model was copying the literal placeholder "Book C:V". Every AI call needs its own evaluation from the day it is written.
6. **The livestream feed is open to the whole network.** Anyone on the church Wi-Fi can read it. It is read-only and low risk, but an access code would be sensible.
7. **Legacy names remain.** The app identifier is still `org.scriptureflow.app` and the IndexedDB is `scriptureflow`. This is deliberate (renaming would wipe users' saved Bibles), but a migration should be planned before it becomes harder.

## Where to go next

- **Automate releases first.** It fixes problems 1 and 2 and unlocks free signing. This is the single most valuable next step.
- **Accuracy in bad rooms is the moat.** Every church has a different microphone, accent, echo and preacher. Build a library of real recorded services, with permission, with the correct verses marked, and run it on every change. Fifty sermons from ten churches would make Lampstand very hard to match.
- **The routing AI is the weakest part** (14/20). A small model fine-tuned on a few thousand real church instructions would likely beat any general model at the same size.
- **An opt-in "Send diagnostics" button.** Copy the log and version for the church to send, with nothing sent automatically. It would transform support.
- **macOS is feasible.** Tauri, ONNX Runtime and llama.cpp all run on Apple Silicon. The main work is projector and display handling, and Apple's own signing.
- **SmartScreen.** The website download still shows the warning. Free options: SignPath Foundation (open source only, needs the automated build) and a Microsoft Store listing (free individual registration). Both need Joshua to apply.
- **Business.** The livestream feed and an after-service report are natural paid features. Decide the licence (MIT, or source-available such as FSL or BSL) before paid features exist, not after.
