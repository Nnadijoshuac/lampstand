"""Builds website/public/bibles/index.json: every translation Bible Show offers, plus the public-domain ones
Lampstand hosts itself. Each entry says where to get it:

  "lampstand"  hosted here as a Lampstand Bible (`file`), added in one click
  "bibleshow"  belongs to its publisher or Bible society: download it from Bible Show, then upload the file
  "builtin"    comes with Lampstand (the KJV)
  "held"       public domain, but numbers the Psalms the Greek/Latin way: coming once Lampstand converts the numbering

usage: python scripts/build-catalog.py <bibleshow modules.json>
"""
import json, os, sys

BIBLES = os.path.join(os.path.dirname(__file__), '..', 'website', 'public', 'bibles')
modules = json.load(open(sys.argv[1], encoding='utf-8-sig'))
converted = {x['id']: x for x in json.load(open(os.path.join(BIBLES, 'bibleshow-pd.json'), encoding='utf8'))}
extra = json.load(open(os.path.join(BIBLES, 'scrollmapper.json'), encoding='utf8'))

HELD = {'BB1688', 'BB1795', 'CPDV2009', 'RST1876', 'UBIO1988', 'VBOR1982'}  # Septuagint/Vulgate Psalm numbering
RENAME = {'DBY2013': 'FDBY'}  # French Darby: "DBY" is the English Darby

entries = []
for m in modules:
    year = None
    if '(' in m['Name'] and m['Name'].rstrip().endswith(')'):
        tail = m['Name'].rstrip()[-5:-1]
        year = int(tail) if tail.isdigit() else None
    name = m['Name'][: m['Name'].rfind('(')].strip() if year else m['Name']
    short = RENAME.get(m['ID'], (m['Abbr'] or m['ID']).upper())
    e = {'id': m['ID'], 'short': short, 'name': name, 'year': year, 'language': m['Language'], 'copyright': m['Copyright'] or ''}
    c = converted.get(m['ID'])
    if m['ID'] == 'KJV1769':
        e['source'] = 'builtin'
    elif m['ID'] in HELD:
        e['source'] = 'held'
    elif c:
        e.update(source='lampstand', file=c['file'], size=c['size'], verses=c['verses'], license='Public domain')
    else:
        e.update(source='bibleshow', bibleshowFile=m['File'], size=m['Size'])
    entries.append(e)

have = {e['short'] for e in entries}
for x in extra:
    if x['short'] in have:  # Bible Show lists it too: host ours instead of linking out
        for e in entries:
            if e['short'] == x['short'] and e['language'] == 'English':
                e.update(source='lampstand', file=x['file'], size=x['size'], verses=x['verses'], license='Public domain')
        continue
    entries.append({'id': x['short'], 'short': x['short'], 'name': x['name'], 'year': x['year'], 'language': 'English',
                    'copyright': 'Public domain', 'source': 'lampstand', 'file': x['file'], 'size': x['size'],
                    'verses': x['verses'], 'license': 'Public domain'})

# The French Darby file carries the short name it was converted with; fix it inside the file too.
for e in entries:
    if e['id'] in RENAME and e.get('file'):
        p = os.path.join(BIBLES, e['file'])
        d = json.load(open(p, encoding='utf8'))
        d['short'] = e['short']
        json.dump(d, open(p, 'w', encoding='utf8'), ensure_ascii=False, separators=(',', ':'))

entries.sort(key=lambda e: (e['language'] != 'English', e['language'], e['name']))
json.dump(entries, open(os.path.join(BIBLES, 'index.json'), 'w', encoding='utf8'), ensure_ascii=False, indent=1)
from collections import Counter
print(len(entries), 'translations', dict(Counter(e['source'] for e in entries)), len({e['language'] for e in entries}), 'languages')
