/** Privacy, terms and credits. Plain words, one page. Updated whenever what Lampstand does changes. */
const UPDATED = '31 October 2026'

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-28 border-t border-[var(--line)] py-12">
      <h2 className="text-2xl font-semibold tracking-[-0.02em]">{title}</h2>
      <div className="mt-5 space-y-4 text-[var(--dim)] [&_b]:text-[var(--fg)] [&_li]:ml-5 [&_li]:list-disc [&_a]:underline">{children}</div>
    </section>
  )
}

export default function Legal() {
  return (
    <section className="mx-auto max-w-3xl px-5 pb-32 pt-36 sm:px-10">
      <p className="text-[13px] font-medium uppercase tracking-[0.2em] text-[var(--muted)]">Legal</p>
      <h1 className="mt-5 text-4xl font-semibold leading-[1.05] tracking-[-0.035em] sm:text-5xl">Privacy, terms and credits.</h1>
      <p className="mt-6 text-[var(--dim)]">The short version: Lampstand runs on your computer, keeps what it hears to itself, and is free, with no warranty. Last updated {UPDATED}.</p>
      <nav className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <a href="#/legal" onClick={(e) => { e.preventDefault(); document.getElementById('privacy')?.scrollIntoView({ behavior: 'smooth' }) }} className="underline">Privacy</a>
        <a href="#/legal" onClick={(e) => { e.preventDefault(); document.getElementById('terms')?.scrollIntoView({ behavior: 'smooth' }) }} className="underline">Terms of use</a>
        <a href="#/legal" onClick={(e) => { e.preventDefault(); document.getElementById('credits')?.scrollIntoView({ behavior: 'smooth' }) }} className="underline">Credits and licences</a>
      </nav>

      <Section id="privacy" title="Privacy">
        <p><b>The app.</b> Lampstand listens only while Listen is on, and only after you allow the microphone. The sound is turned into words on your computer and is not recorded, stored or sent anywhere. The speech recognition and the AI run on your computer too. Nobody, including us, can hear or see what is said.</p>
        <p>Lampstand connects to the internet only to:</p>
        <ul>
          <li>check for a new version of itself, by reading a small file on this website</li>
          <li>download its listening pack once, and updates when you choose to install them, from GitHub</li>
          <li>download a translation when you choose one under Add translation</li>
        </ul>
        <p>None of these send anything about you, your church or what was said. Settings and your Bibles stay on the computer. A diagnostic log of what was recognised stays in the computer's temporary folder, and is never sent.</p>
        <p><b>This website.</b> We count visits with GoatCounter, which uses no cookies and collects no personal information: only the page, the country, the browser and the site you came from, counted together. Downloads are served by GitHub, which keeps its own logs under its <a href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement" target="_blank" rel="noreferrer">privacy statement</a>. The website is hosted on GitHub Pages.</p>
        <p><b>Children.</b> Lampstand is a tool for church media teams and is not directed at children.</p>
        <p><b>Questions.</b> Open an issue on <a href="https://github.com/Nnadijoshuac/lampstand/issues" target="_blank" rel="noreferrer">GitHub</a>.</p>
      </Section>

      <Section id="terms" title="Terms of use">
        <p>Lampstand is free and open-source software, released under the <a href="https://github.com/Nnadijoshuac/lampstand/blob/main/LICENSE" target="_blank" rel="noreferrer">MIT licence</a>. By downloading or using it, you agree to these terms.</p>
        <p><b>No warranty.</b> Lampstand is provided "as is", without warranty of any kind, express or implied, including fitness for a particular purpose. It recognises speech and chooses verses automatically, and it can be wrong. A person should always watch what goes on the screen.</p>
        <p><b>No liability.</b> To the fullest extent the law allows, the author and contributors are not liable for any claim, damages or other liability arising from the use of Lampstand, including anything shown on a screen or livestream, lost data, or service interruptions.</p>
        <p><b>Your responsibility.</b> You are responsible for having the right to use the Bible translations and any other material you add, for the content you show, and for using Lampstand within the law where you are, including any permission needed to use a microphone in your setting.</p>
        <p><b>Changes.</b> These terms may change with new versions. The version on this page applies.</p>
      </Section>

      <Section id="credits" title="Credits and licences">
        <ul>
          <li><b>Speech recognition:</b> Underdog Bark 3.0 Plus by Conway Research (CC BY 4.0), derived from NVIDIA Parakeet TDT 0.6B v3 and Moondream Parakeet Ultra (CC BY 4.0).</li>
          <li><b>AI:</b> Qwen2.5 1.5B Instruct by Alibaba Cloud (Apache 2.0), run with llama.cpp (MIT).</li>
          <li><b>Search by meaning:</b> all-MiniLM-L6-v2 (Apache 2.0), with ONNX Runtime (MIT).</li>
          <li><b>Cross references:</b> OpenBible.info (CC BY).</li>
          <li><b>Bible text:</b> the King James Version is public domain. Translations hosted on this website are public domain. Translations from Bible Show belong to their publishers and are downloaded from Bible Show under its terms.</li>
          <li><b>App framework:</b> Tauri (MIT / Apache 2.0).</li>
        </ul>
        <p>Lampstand is not affiliated with, endorsed by or sponsored by Bible Show, Microsoft, GitHub, vMix or OBS. Their names are trademarks of their owners and are used only to describe compatibility.</p>
      </Section>
    </section>
  )
}
