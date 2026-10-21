"""Builds public/xref.json from OpenBible.info cross references (CC-BY, https://www.openbible.info/labs/cross-references/).

Output: {"b:c:v": [[book, chapter, verse, endVerse, votes], ...]} keeping the best-voted links per verse.
Usage: python scripts/build-xref.py cross_references.txt
"""
import json, sys
from collections import defaultdict

OSIS = ('Gen Exod Lev Num Deut Josh Judg Ruth 1Sam 2Sam 1Kgs 2Kgs 1Chr 2Chr Ezra Neh Esth Job Ps Prov Eccl Song Isa Jer '
        'Lam Ezek Dan Hos Joel Amos Obad Jonah Mic Nah Hab Zeph Hag Zech Mal Matt Mark Luke John Acts Rom 1Cor 2Cor Gal '
        'Eph Phil Col 1Thess 2Thess 1Tim 2Tim Titus Phlm Heb Jas 1Pet 2Pet 1John 2John 3John Jude Rev').split()
IDX = {b: i for i, b in enumerate(OSIS)}
KEEP = 15

def ref(s):
    b, c, v = s.split('.')
    return IDX[b], int(c), int(v)

links = defaultdict(list)
for line in open(sys.argv[1], encoding='utf8').read().splitlines()[1:]:
    frm, to, votes = line.split('\t')[:3]
    votes = int(votes)
    if votes < 1:
        continue
    start, _, end = to.partition('-')
    b, c, v = ref(start)
    e = ref(end)[2] if end and ref(end)[:2] == (b, c) else v
    links['%d:%d:%d' % ref(frm)].append([b, c, v, e, votes])

out = {k: sorted(v, key=lambda x: -x[4])[:KEEP] for k, v in links.items()}
json.dump(out, open('public/xref.json', 'w'), separators=(',', ':'))
print(len(out), 'verses,', sum(map(len, out.values())), 'links')
