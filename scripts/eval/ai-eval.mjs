// Measures an AI model on Lampstand's real jobs (recall, route, rerank). Start llama-server with the model, then: node scripts/eval/ai-eval.mjs <port> v2
// usage: node eval.mjs <port>
const PORT = process.argv[2]
const V2 = process.argv[3] === 'v2'
const chat = async (messages, max, schema) => {
  const body = { messages, max_tokens: max, temperature: 0 }
  if (schema) body.response_format = { type: 'json_schema', json_schema: { schema } }
  const t = Date.now()
  const r = await fetch(`http://127.0.0.1:${PORT}/v1/chat/completions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  return { text: (await r.json()).choices?.[0]?.message?.content ?? '', ms: Date.now() - t }
}

// 1. Recall: a description of a passage -> the reference (any of the three answers counts)
const RECALL_SYSTEM = 'You are a Bible scholar. The preacher is quoting, paraphrasing or describing a Bible passage. ' +
  'Reply with the three most likely references, best first, as JSON: {"refs":["Book C:V", ...]}. Use full book names.'
const RECALL_SCHEMA = { type: 'object', properties: { refs: { type: 'array', items: { type: 'string' }, maxItems: 3 } }, required: ['refs'] }
const recall = [
  ['it is easier for a camel to go through the eye of a needle', 'Matthew 19:24'],
  ['the Lord is my shepherd I shall not want', 'Psalms 23:1'],
  ['for God so loved the world', 'John 3:16'],
  ['I can do all things through Christ', 'Philippians 4:13'],
  ['Saul has slain his thousands and David his ten thousands', '1 Samuel 18:7'],
  ['Jesus wept', 'John 11:35'],
  ['faith is the substance of things hoped for', 'Hebrews 11:1'],
  ['love is patient love is kind', '1 Corinthians 13:4'],
  ['the wages of sin is death', 'Romans 6:23'],
  ['be still and know that I am God', 'Psalms 46:10'],
  ['trust in the Lord with all your heart and lean not on your own understanding', 'Proverbs 3:5'],
  ['they that wait upon the Lord shall renew their strength, they shall mount up with wings as eagles', 'Isaiah 40:31'],
  ['put on the whole armour of God', 'Ephesians 6:11'],
  ['in the beginning was the Word', 'John 1:1'],
  ['all things work together for good to them that love God', 'Romans 8:28'],
  ['the devil departed from him for a season', 'Luke 4:13'],
  ['a soft answer turneth away wrath', 'Proverbs 15:1'],
  ['my grace is sufficient for thee', '2 Corinthians 12:9'],
  ['I know the plans I have for you', 'Jeremiah 29:11'],
  ['where two or three are gathered together in my name', 'Matthew 18:20'],
  ['the joy of the Lord is your strength', 'Nehemiah 8:10'],
  ['ask and it shall be given you, seek and ye shall find', 'Matthew 7:7'],
  ['we wrestle not against flesh and blood', 'Ephesians 6:12'],
  ['iron sharpeneth iron', 'Proverbs 27:17'],
  ['the story where Jesus calms the storm and rebukes the wind', 'Mark 4:39'],
  ['when Peter walked on the water and began to sink', 'Matthew 14:30'],
  ['Elijah on Mount Carmel calling down fire on the altar', '1 Kings 18:38'],
  ['the valley of dry bones that came to life', 'Ezekiel 37:1'],
  ['Jesus said I am the way the truth and the life', 'John 14:6'],
  ['Joshua said as for me and my house we will serve the Lord', 'Joshua 24:15'],
]
const books = { Psalm: 'Psalms', Psalms: 'Psalms' }
const norm = (r) => r.replace(/^Psalm\b/, 'Psalms').replace(/\s+/g, ' ').trim().toLowerCase()
const sameRef = (a, b) => { const x = norm(a), y = norm(b); const [bx, cx] = x.split(/ (?=\d+:)/), [by, cy] = y.split(/ (?=\d+:)/); return bx === by && cx?.split(':')[0] === cy?.split(':')[0] && Math.abs(+(cx?.split(':')[1] ?? 0) - +(cy?.split(':')[1] ?? 0)) <= 1 }

const RECALL2 = 'You are a Bible scholar. A preacher is quoting or describing one Bible verse. Give the three most likely verses, best first, as full references like "Romans 8:28".'
const RECALL_SHOTS = [
  { role: 'user', content: 'it is easier for a camel to go through the eye of a needle' }, { role: 'assistant', content: '{"refs":["Matthew 19:24","Mark 10:25","Luke 18:25"]}' },
  { role: 'user', content: 'the story of David killing Goliath with a stone' }, { role: 'assistant', content: '{"refs":["1 Samuel 17:49","1 Samuel 17:50","1 Samuel 17:45"]}' },
]
// 2. Route: an instruction -> an action
const ROUTE_SYSTEM = `You operate the scripture screen in a church service. From the preacher's latest words, choose one action as JSON:
- {"action":"open","book":"John","chapter":1,"verse":24,"end":26} when they name a passage to read (verse and end are optional)
- {"action":"verse","verse":5} to jump within the passage already open
- {"action":"next"} or {"action":"previous"} to move one verse
- {"action":"version","version":"<one of the installed versions>"} when they ask for a different translation
- {"action":"none"} when they are simply preaching, praying or reading.
Only act on clear instructions. Spoken numbers may be split oddly by speech recognition ("John one twenty four" is John 1:24).`
const ROUTE_SCHEMA = { type: 'object', properties: { action: { enum: ['open', 'verse', 'next', 'previous', 'version', 'none'] }, book: { type: 'string' }, chapter: { type: 'integer' }, verse: { type: 'integer' }, end: { type: 'integer' }, version: { type: 'string' } }, required: ['action'] }
const shots = [
  { role: 'user', content: 'Installed versions: KJV, AMP\nOpen: Genesis 1\nPreacher: "turn with me to the gospel of John chapter one and verse twenty four"' },
  { role: 'assistant', content: '{"action":"open","book":"John","chapter":1,"verse":24}' },
  { role: 'user', content: 'Installed versions: KJV, AMP\nOpen: John 1\nPreacher: "let us look at that again in the amplified"' },
  { role: 'assistant', content: '{"action":"version","version":"AMP"}' },
  { role: 'user', content: 'Installed versions: KJV, AMP\nOpen: John 1\nPreacher: "God is good all the time and all the time God is good"' },
  { role: 'assistant', content: '{"action":"none"}' }
]
const route = [
  ['open the book of Romans chapter eight from verse twenty eight', { action: 'open', book: 'Romans', chapter: 8, verse: 28 }],
  ['let us go to the first epistle of Peter chapter five', { action: 'open', book: '1 Peter', chapter: 5 }],
  ['can we see that in the new living translation', { action: 'version', version: 'NLT' }],
  ['show it to us in king james', { action: 'version', version: 'KJV' }],
  ['go down to verse twelve', { action: 'verse', verse: 12 }],
  ['jump to the seventh verse', { action: 'verse', verse: 7 }],
  ['the one after that please', { action: 'next' }],
  ['take us back one verse', { action: 'previous' }],
  ['bring back the verse before', { action: 'previous' }],
  ['let us pray, father we thank you for this day', { action: 'none' }],
  ['church I want you to understand that grace is not earned', { action: 'none' }],
  ['and the word was with God and the word was God', { action: 'none' }],
  ['turn to Psalm one hundred and twenty one', { action: 'open', book: 'Psalms', chapter: 121 }],
  ['go to Hebrews eleven verse six', { action: 'open', book: 'Hebrews', chapter: 11, verse: 6 }],
  ['give us that in the amplified version', { action: 'version', version: 'AMP' }],
  ['read verses three to five', { action: 'verse', verse: 3 }],
  ['next one', { action: 'next' }],
  ['the bible says in Proverbs that a merry heart doeth good like medicine', { action: 'none' }],
  ['look at Second Timothy chapter one verse seven', { action: 'open', book: '2 Timothy', chapter: 1, verse: 7 }],
  ['the passage I want us to read is Isaiah fifty three five', { action: 'open', book: 'Isaiah', chapter: 53, verse: 5 }],
]
const ROUTE2 = `You control the scripture screen in a church. Read the preacher's words and reply with one action as JSON.
open: they name a book and chapter to read. Give book, chapter, and verse if said.
verse: they ask for a verse number in the chapter already open, without naming a book.
next / previous: they ask for the following or the earlier verse.
version: they ask for a translation that is installed.
none: anything else, including preaching, praying, and reading scripture aloud.
When unsure, answer none.`
const shots2 = [
  ['Installed versions: KJV, AMP\nOpen: Genesis 1\nPreacher: "turn with me to the gospel of John chapter one and verse twenty four"', '{"action":"open","book":"John","chapter":1,"verse":24}'],
  ['Installed versions: KJV, AMP\nOpen: John 1\nPreacher: "let us look at that again in the amplified"', '{"action":"version","version":"AMP"}'],
  ['Installed versions: KJV, AMP\nOpen: John 1\nPreacher: "God is good all the time and all the time God is good"', '{"action":"none"}'],
  ['Installed versions: KJV, AMP\nOpen: John 1\nPreacher: "go back to the verse before"', '{"action":"previous"}'],
  ['Installed versions: KJV, AMP\nOpen: John 1\nPreacher: "the following verse please"', '{"action":"next"}'],
  ['Installed versions: KJV, AMP\nOpen: John 1\nPreacher: "look at verse nine"', '{"action":"verse","verse":9}'],
  ['Installed versions: KJV, AMP\nOpen: John 1\nPreacher: "open to second Kings chapter four"', '{"action":"open","book":"2 Kings","chapter":4}'],
  ['Installed versions: KJV, AMP\nOpen: John 1\nPreacher: "father we bless your name for this word"', '{"action":"none"}'],
].flatMap(([u, a]) => [{ role: 'user', content: u }, { role: 'assistant', content: a }])
const okRoute = (got, want) => got.action === want.action && Object.entries(want).every(([k, v]) => k === 'action' || String(got[k] ?? '').toLowerCase().replace(/^psalm$/, 'psalms') === String(v).toLowerCase())

// 3. Rerank: which candidate is being quoted
const RERANK_SYSTEM = 'You match what a preacher said to the Bible verse they are quoting, paraphrasing or describing. Reply with only the number of the best candidate, or 0 if none of them fits.'
const rerank = [
  ['the camel and the needle, rich man entering the kingdom', ['Genesis 24:10 And the servant took ten camels of the camels of his master', 'Matthew 19:24 It is easier for a camel to go through the eye of a needle, than for a rich man to enter into the kingdom of God', 'Leviticus 11:4 the camel, because he cheweth the cud'], 2],
  ['God is our refuge in times of trouble', ['Psalms 46:1 God is our refuge and strength, a very present help in trouble', 'Psalms 9:9 The LORD also will be a refuge for the oppressed', 'Nahum 1:7 The LORD is good, a strong hold in the day of trouble'], 1],
  ['the fruit of the spirit is love joy peace', ['Galatians 5:22 But the fruit of the Spirit is love, joy, peace, longsuffering', 'John 15:5 I am the vine, ye are the branches', 'Romans 14:17 righteousness, and peace, and joy in the Holy Ghost'], 1],
  ['he went to sea and a great fish swallowed him', ['Jonah 1:17 Now the LORD had prepared a great fish to swallow up Jonah', 'Matthew 13:47 a net, that was cast into the sea', 'Genesis 1:21 And God created great whales'], 1],
  ['we should forget the former things', ['Isaiah 43:18 Remember ye not the former things', 'Philippians 3:13 forgetting those things which are behind', 'Ecclesiastes 1:11 There is no remembrance of former things'], 1],
  ['the sheep hear my voice and follow me', ['John 10:27 My sheep hear my voice, and I know them, and they follow me', 'Psalms 100:3 we are his people, and the sheep of his pasture', 'Isaiah 53:6 All we like sheep have gone astray'], 1],
  ['God gives power to the faint', ['Isaiah 40:29 He giveth power to the faint; and to them that have no might he increaseth strength', 'Philippians 4:13 I can do all things through Christ', 'Psalms 73:26 My flesh and my heart faileth'], 1],
  ['the church is built on this rock', ['Matthew 16:18 upon this rock I will build my church', 'Psalms 18:2 The LORD is my rock', '1 Corinthians 10:4 that Rock was Christ'], 1],
  ['blessed are the poor in spirit', ['Matthew 5:3 Blessed are the poor in spirit: for theirs is the kingdom of heaven', 'Luke 6:20 Blessed be ye poor', 'James 2:5 hath not God chosen the poor of this world'], 1],
  ['I will never leave thee nor forsake thee', ['Hebrews 13:5 I will never leave thee, nor forsake thee', 'Joshua 1:5 I will not fail thee, nor forsake thee', 'Deuteronomy 31:6 he will not fail thee, nor forsake thee'], 1],
]

let score = { recall: 0, route: 0, rerank: 0 }, ms = { recall: [], route: [], rerank: [] }, misses = []
for (const [said, want] of recall) {
  const r = await chat(V2 ? [{ role: 'system', content: RECALL2 }, ...RECALL_SHOTS, { role: 'user', content: said }] : [{ role: 'system', content: RECALL_SYSTEM }, { role: 'user', content: said }], 60, RECALL_SCHEMA)
  ms.recall.push(r.ms)
  let refs = []; try { refs = JSON.parse(r.text).refs ?? [] } catch {}
  if (refs.some((x) => sameRef(x, want))) score.recall++; else misses.push(`recall: "${said}" -> ${JSON.stringify(refs)} (want ${want})`)
}
for (const [said, want] of route) {
  const r = await chat([{ role: 'system', content: V2 ? ROUTE2 : ROUTE_SYSTEM }, ...(V2 ? shots2 : shots), { role: 'user', content: `Installed versions: KJV, AMP, NLT\nOpen: John 1\nPreacher: "${said}"` }], 48, ROUTE_SCHEMA)
  ms.route.push(r.ms)
  let got = {}; try { got = JSON.parse(r.text) } catch {}
  if (okRoute(got, want)) score.route++; else misses.push(`route: "${said}" -> ${r.text} (want ${JSON.stringify(want)})`)
}
for (const [said, cands, want] of rerank) {
  const list = cands.map((c, i) => `${i + 1}. ${c}`).join('\n')
  const r = await chat([{ role: 'system', content: RERANK_SYSTEM }, { role: 'user', content: `Preacher said: "${said}"\nCandidates:\n${list}` }], 4)
  ms.rerank.push(r.ms)
  if (parseInt(r.text, 10) === want) score.rerank++; else misses.push(`rerank: "${said}" -> ${r.text} (want ${want})`)
}
const med = (a) => a.sort((x, y) => x - y)[Math.floor(a.length / 2)]
console.log(`port ${PORT}: recall ${score.recall}/${recall.length}  route ${score.route}/${route.length}  rerank ${score.rerank}/${rerank.length}  | median ms recall ${med(ms.recall)} route ${med(ms.route)} rerank ${med(ms.rerank)}`)
for (const m of misses) console.log('  miss', m)
