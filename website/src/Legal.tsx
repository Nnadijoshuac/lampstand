/** Privacy notice, terms of use, and credits. Updated whenever what Lampstand does changes. */
const UPDATED = '31 October 2026'

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-28 border-t border-[var(--line)] py-12">
      <h2 className="text-2xl font-semibold tracking-[-0.02em]">{title}</h2>
      <div className="mt-5 space-y-4 text-[var(--dim)] [&_b]:text-[var(--fg)] [&_li]:ml-5 [&_li]:list-disc [&_a]:underline">{children}</div>
    </section>
  )
}

const jump = (id: string) => (e: React.MouseEvent) => { e.preventDefault(); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }) }

export default function Legal() {
  return (
    <section className="mx-auto max-w-3xl px-5 pb-32 pt-36 sm:px-10">
      <p className="text-[13px] font-medium uppercase tracking-[0.2em] text-[var(--muted)]">Legal</p>
      <h1 className="mt-5 text-4xl font-semibold leading-[1.05] tracking-[-0.035em] sm:text-5xl">Privacy, terms and credits.</h1>
      <p className="mt-6 text-[var(--dim)]">This page sets out how Lampstand handles information, the terms on which it is provided, and the work it relies on. Last updated {UPDATED}.</p>
      <nav className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <a href="#/legal" onClick={jump('privacy')} className="underline">Privacy notice</a>
        <a href="#/legal" onClick={jump('terms')} className="underline">Terms of use</a>
        <a href="#/legal" onClick={jump('credits')} className="underline">Credits and licences</a>
      </nav>

      <Section id="privacy" title="Privacy notice">
        <p><b>The application.</b> Lampstand uses the microphone only while Listen is switched on, and only after the user has granted permission. Audio is converted to text on the computer on which Lampstand is installed. It is not recorded, retained, or transmitted. Speech recognition and the assistant also run on that computer. Neither the author nor any other party receives what is said.</p>
        <p>Lampstand connects to the internet for the following purposes only:</p>
        <ul>
          <li>to check whether a newer version is available, by reading a small file published on this website</li>
          <li>to download its listening pack once, and any update the user chooses to install, from GitHub</li>
          <li>to download a Bible translation when the user selects one under Add translation</li>
        </ul>
        <p>None of these connections transmits information about the user, the church, or the content of a service. Settings and Bible translations are stored on the computer. A diagnostic log of recognised speech is kept in the computer's temporary folder for troubleshooting. It is not transmitted.</p>
        <p><b>This website.</b> Visits are counted using GoatCounter, which does not use cookies and does not collect personal information. It records the page visited, the country, the browser, and the referring site, in aggregate. Files are downloaded from GitHub, which keeps its own records under the <a href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement" target="_blank" rel="noreferrer">GitHub General Privacy Statement</a>. The website is hosted on GitHub Pages.</p>
        <p><b>Children.</b> Lampstand is a tool for church media teams and is not directed at children.</p>
        <p><b>Contact.</b> Questions about this notice may be raised as an issue on <a href="https://github.com/Nnadijoshuac/lampstand/issues" target="_blank" rel="noreferrer">GitHub</a>.</p>
      </Section>

      <Section id="terms" title="Terms of use">
        <p>Lampstand is free, open-source software, released under the <a href="https://github.com/Nnadijoshuac/lampstand/blob/main/LICENSE" target="_blank" rel="noreferrer">MIT licence</a>. By downloading, installing, or using Lampstand, you agree to these terms.</p>
        <p><b>No warranty.</b> Lampstand is provided "as is", without warranty of any kind, express or implied, including any warranty of merchantability, fitness for a particular purpose, or non-infringement. Lampstand recognises speech and selects scripture automatically, and may do so incorrectly. An operator should supervise what is displayed at all times.</p>
        <p><b>Limitation of liability.</b> To the fullest extent permitted by law, the author and contributors shall not be liable for any claim, damages, or other liability, whether in contract, tort, or otherwise, arising from or in connection with Lampstand or its use. This includes, without limitation, content shown on a screen or livestream, loss of data, and interruption of a service.</p>
        <p><b>Responsibility of the user.</b> The user is responsible for holding the rights needed to use any Bible translation or other material added to Lampstand, for the content displayed, and for using Lampstand in accordance with the law that applies to them, including any consent required for the use of a microphone.</p>
        <p><b>Changes.</b> These terms may be revised with future versions of Lampstand. The version published on this page applies.</p>
      </Section>

      <Section id="credits" title="Credits and licences">
        <ul>
          <li><b>Speech recognition:</b> Underdog Bark 3.0 Plus by Conway Research (CC BY 4.0), derived from NVIDIA Parakeet TDT 0.6B v3 and Moondream Parakeet Ultra (CC BY 4.0).</li>
          <li><b>Assistant:</b> Qwen2.5 1.5B Instruct by Alibaba Cloud (Apache 2.0), run with llama.cpp (MIT).</li>
          <li><b>Search by meaning:</b> all-MiniLM-L6-v2 (Apache 2.0), with ONNX Runtime (MIT).</li>
          <li><b>Cross references:</b> OpenBible.info (CC BY).</li>
          <li><b>Bible text:</b> the King James Version is in the public domain. Translations hosted on this website are in the public domain. Translations obtained from Bible Show belong to their publishers and are subject to Bible Show's terms.</li>
          <li><b>Application framework:</b> Tauri (MIT and Apache 2.0).</li>
        </ul>
        <p>Lampstand is not affiliated with, endorsed by, or sponsored by Bible Show, Microsoft, GitHub, vMix, or OBS. These names are trademarks of their respective owners and are used only to describe compatibility.</p>
      </Section>
    </section>
  )
}
