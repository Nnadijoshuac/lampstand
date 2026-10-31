# Lampstand journal

What we set out to build, what we tried, what worked and what didn't. Newest at the bottom. The changelog lists what changed for users. This explains the reasons.

## What Lampstand is

Church software that listens to the sermon and puts each scripture on the screen as it is preached, so the media team does not have to chase the preacher. It runs entirely on the church computer.

Two models do the work, and they do different jobs:
- **Ears: Underdog Bark 3.0 Plus.** Speech to text. It turns the preacher's voice into words. About 900 MB, already stored at 8-bit.
- **Brain: Qwen2.5 1.5B Instruct.** Understanding. It handles loose instructions ("show it to us in king james") and finds a verse from a description ("the camel and the needle"). About 1.1 GB, at 4-bit (Q4_K_M).

Most of the work is done by fast rules, not by either model. The rules read references, numbers, translation names and commands, and follow the reading word by word. The brain is the fallback for what the rules don't catch.

## Versions

| Version | Date | In short |
|---|---|---|
| 1.0.0 | 21 Oct 2026 | First release |
| 1.0.1 | 22 Oct 2026 | Fewer false moves from quotes |
| 1.0.2 | 22 Oct 2026 | Fits 1080p screens at 150% scaling, Add translation |
| 1.0.3 | 22 Oct 2026 | Updates itself, a small download, every Bible Show translation, preview is the projector |
| 1.0.4 | 31 Oct 2026 | Read ahead, audio gain, livestream feed, a 37 MB installer, better hearing of references |

Every version stays downloadable from GitHub Releases. 1.0.2's original files were overwritten when 1.0.3 was made, so 1.0.2 was rebuilt from its saved code on 31 Oct.

## 31 October 2026

**Feedback from people who tried it, and what we did:**
- *"People say John 1:10, not John chapter one verse ten."* "John one ten" already worked. The recogniser sometimes writes it as "John Wanton" or "John 1010", and both are now read as John 1:10.
- *"KJV doesn't work, and it heard no no no."* Spelled codes work ("give us K J V"), and so do codes with one misheard letter ("kg v"). We could not reproduce the "no no no" with a clear voice. It is likely the recogniser inventing words in noise. Invented words ("Okay.", "Kupak Gupak", empty lines) are now ignored.
- *"Reading along needs 'next verse' after every verse."* Read ahead: the next verse goes up 3 to 5 syllables before the current one ends, like a reader's eye. If they stop to explain, the verse comes back. Measured on spoken John 1:1-5: verses moved 0.9 to 2.3 s early, and came back when the reader commented.
- *"At church the sound card was too quiet for Lampstand, and turning it up made vMix peak."* Settings, Audio: gain up to +30 dB for Lampstand only, with a limiter, Auto gain and a level meter. The livestream is untouched.
- *"It isn't truly offline."* Search by meaning was loading its runtime from the internet (cdn.jsdelivr.net). It now ships inside the app. Not yet tested with Wi-Fi off.
- *"Never show a raw error."* Every error goes to the log in full, and the screen shows a plain sentence.
- *"Windows blocks the installer."* There is now a real installer (37 MB, no admin rights). Removing the SmartScreen warning needs code signing. SignPath Foundation signs open-source projects for free, but someone has to apply.
- *"A mobile version."* Noted for later.

**Livestream feed.** vMix or OBS can show Lampstand's scripture directly: Settings, Livestream gives an address on the church network. It is the projector page, kept live through the app. There is a transparent version for laying over video. NDI output is possible later.

**Quantization, and the rule that performance never drops.** The plan was to shrink the models. What we found:
- Both models were already compressed (speech at 8-bit, brain at 4-bit). Squeezing the speech model again saved 12 MB, and it was thrown away.
- A smaller brain (Qwen2.5 0.5B, 490 MB) was tested against the current one on 60 sermon-style cases. It scored worse, so it was rejected.
- The test exposed a bigger problem: our instructions to the brain were poor. The old recall prompt showed the format as "Book C:V", and the model copied it literally. Rewriting the instructions with real examples took recall from 6/30 to 14/30, and routing from 8/20 to 14/20, on the same model, at no cost in size or speed.
- Next: try newer models of the same size, and keep one only if it scores higher. The test is kept so any model can be measured the same way.

**The installer and models.** The installer carries only the app. The speech and AI models (1.5 GB) download once on first start and resume if the connection drops. They come from the 1.0.3 release, which also offers everything in one zip for churches with slow internet.
