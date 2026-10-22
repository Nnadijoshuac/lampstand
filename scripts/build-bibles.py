"""Builds the public-domain translations Bible Show does not carry (website/public/bibles/) in the Lampstand Bible format.
scripts/convert-bibleshow.ts converts the rest; scripts/build-catalog.py lists everything.

Source: scrollmapper/bible_databases (MIT), public-domain English translations only.
usage: python scripts/build-bibles.py <folder with the source JSON files>

Lampstand Bible format (one JSON file per translation, *.lamp.json):
  {
    "format": "lampstand-bible", "version": 1,
    "short": "ASV", "name": "American Standard Version", "year": 1901,
    "language": "en", "license": "Public domain", "source": "...",
    "books": [ [ ["verse 1", "verse 2", ...], ...chapters ], ...66 books in Protestant canonical order ]
  }
Verse n of a chapter is at index n - 1. A verse a translation leaves out is "".
"""
import json, os, re, sys

SRC = sys.argv[1]
OUT = os.path.join(os.path.dirname(__file__), '..', 'website', 'public', 'bibles')

BOOKS = ['Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy', 'Joshua', 'Judges', 'Ruth', '1 Samuel', '2 Samuel',
         '1 Kings', '2 Kings', '1 Chronicles', '2 Chronicles', 'Ezra', 'Nehemiah', 'Esther', 'Job', 'Psalms', 'Proverbs',
         'Ecclesiastes', 'Song of Solomon', 'Isaiah', 'Jeremiah', 'Lamentations', 'Ezekiel', 'Daniel', 'Hosea', 'Joel', 'Amos',
         'Obadiah', 'Jonah', 'Micah', 'Nahum', 'Habakkuk', 'Zephaniah', 'Haggai', 'Zechariah', 'Malachi', 'Matthew', 'Mark',
         'Luke', 'John', 'Acts', 'Romans', '1 Corinthians', '2 Corinthians', 'Galatians', 'Ephesians', 'Philippians',
         'Colossians', '1 Thessalonians', '2 Thessalonians', '1 Timothy', '2 Timothy', 'Titus', 'Philemon', 'Hebrews', 'James',
         '1 Peter', '2 Peter', '1 John', '2 John', '3 John', 'Jude', 'Revelation']

TRANSLATIONS = [
    ('BBE', 'Bible in Basic English', 1965, 'BBE.json'),
    ('GNV', 'Geneva Bible', 1599, 'Geneva1599.json'),
    ('NHEB', 'New Heart English Bible', 2010, 'NHEB.json'),
    ('WBT', 'Webster Bible', 1833, 'Webster.json'),
]


def canon(name):
    name = re.sub(r'^III ', '3 ', re.sub(r'^II ', '2 ', re.sub(r'^I ', '1 ', name)))
    return 'Revelation' if name == 'Revelation of John' else name


os.makedirs(OUT, exist_ok=True)
index = []
for short, name, year, file in TRANSLATIONS:
    src = json.load(open(os.path.join(SRC, file), encoding='utf8'))
    by_name = {canon(b['name']): b for b in src['books']}
    books = []
    for title in BOOKS:
        b = by_name.get(title)
        chapters = []
        for ch in sorted(b['chapters'], key=lambda c: c['chapter']) if b else []:
            last = max(v['verse'] for v in ch['verses'])
            verses = [''] * last
            for v in ch['verses']:
                verses[v['verse'] - 1] = re.sub(r'\s+', ' ', v['text']).strip()
            chapters.append(verses)
        books.append(chapters)
    verses = sum(len(v) for b in books for v in b)
    missing = [t for t, b in zip(BOOKS, books) if not b]
    assert verses > 30000 and not missing, (short, verses, missing)
    doc = {'format': 'lampstand-bible', 'version': 1, 'short': short, 'name': name, 'year': year, 'language': 'en',
           'license': 'Public domain', 'source': 'scrollmapper/bible_databases', 'books': books}
    path = os.path.join(OUT, f'{short}.lamp.json')
    json.dump(doc, open(path, 'w', encoding='utf8'), ensure_ascii=False, separators=(',', ':'))
    index.append({'short': short, 'name': name, 'year': year, 'language': 'en', 'license': 'Public domain',
                  'file': f'{short}.lamp.json', 'size': os.path.getsize(path), 'verses': verses})
    print(short, verses, round(os.path.getsize(path) / 1e6, 1), 'MB')
json.dump(index, open(os.path.join(OUT, 'scrollmapper.json'), 'w', encoding='utf8'), ensure_ascii=False, indent=1)
