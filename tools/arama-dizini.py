#!/usr/bin/env python3
"""Site içi arama dizinini (arama.json) üretir.
Sayfalar sitemap.xml'den, algoritma durumları algoritma JSON'larından okunur.
İçerik değişince yeniden çalıştır:  python3 tools/arama-dizini.py
"""
import json, re, subprocess, html, os
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + '/'

def i18n():
    js = "const fs=require('fs');const n=new Function(fs.readFileSync('%sjs/i18n.js','utf8')+';return SITE_I18N')();console.log(JSON.stringify(n.pages))" % R
    return json.loads(subprocess.check_output(['node', '-e', js]))
PAGES = i18n()
def sub_name(page, key, lang):
    d = PAGES.get(page, {}).get(lang, {})
    return d.get('subset_' + key) or ''

items = []
# --- sayfalar ---
sm = open(R + 'sitemap.xml').read()
for url in re.findall(r'<loc>https://rubikacademy\.fun([^<]*)</loc>', sm):
    path = url.strip('/') or 'index'
    f = R + path + ('.html' if not path.endswith('.html') else '')
    if not os.path.exists(f):
        f = R + path + '/index.html'
        if not os.path.exists(f): continue
    s = open(f).read()
    m = re.search(r'<title>(.*?)</title>', s, re.S); t = html.unescape(m.group(1)).strip() if m else url
    t = re.sub(r'^Rubik Academy\s*[-—]\s*', '', t); t = re.sub(r'\s*[-—]\s*Rubik Academy$', '', t)
    m = re.search(r'<meta name="description" content="([^"]*)"', s); d = html.unescape(m.group(1)) if m else ''
    items.append({'t': t, 's': d[:110], 'u': url or '/', 'p': 1})

# --- algoritma durumları ---
A = R + 'icerikler/algoritmalar/'
def groups_of(data, key):
    if 'sets' in data:
        st = [x for x in data['sets'] if x['id'] == key]
        return st[0]['groups'] if st else []
    return data.get(key, [])
SETS = [  # (dosya, anahtar, sayfa adresi, i18n sayfası, görünen ad, adresteki set)
    ('oll-pll.json', 'oll', '/icerikler/algoritmalar/oll', 'oll', 'OLL', ''),
    ('oll-pll.json', 'pll', '/icerikler/algoritmalar/pll', 'pll', 'PLL', ''),
    ('2look.json', '2lo', '/icerikler/algoritmalar/2look-oll', 'twolook_algos', '2-Look OLL', ''),
    ('2look.json', '2lp', '/icerikler/algoritmalar/2look-pll', 'twolook_algos', '2-Look PLL', ''),
    ('coll.json', 'coll', '/icerikler/algoritmalar/coll', 'coll', 'COLL', ''),
    ('wv.json', 'wv', '/icerikler/algoritmalar/wv', 'wv', 'WV', ''),
    ('oh.json', 'oll', '/icerikler/algoritmalar/tek-el', 'oh_algos', 'OH OLL', 'oll'),
    ('oh.json', 'pll', '/icerikler/algoritmalar/tek-el', 'oh_algos', 'OH PLL', 'pll'),
    ('oh.json', 'cmll', '/icerikler/algoritmalar/tek-el', 'oh_algos', 'OH CMLL', 'cmll'),
    ('roux.json', 'cmll', '/icerikler/algoritmalar/roux', 'roux_algos', 'Roux CMLL', 'cmll'),
    ('roux.json', 'eo', '/icerikler/algoritmalar/roux', 'roux_algos', 'Roux EO', 'eo'),
    ('bld.json', 'edges', '/icerikler/algoritmalar/3bld', 'bld', '3BLD kenar', 'edges'),
    ('bld.json', 'corners', '/icerikler/algoritmalar/3bld', 'bld', '3BLD köşe', 'corners'),
    ('cll.json', 'cll', '/icerikler/algoritmalar/cll', 'cll', 'CLL', ''),
    ('eg.json', 'eg1', '/icerikler/algoritmalar/eg1', 'eg1', 'EG-1', ''),
    ('eg.json', 'eg2', '/icerikler/algoritmalar/eg2', 'eg2', 'EG-2', ''),
    ('ortega-oll.json', 'oll', '/icerikler/algoritmalar/ortega-oll', 'ortega-oll', 'Ortega OLL', ''),
    ('ortega-pbl.json', 'pbl', '/icerikler/algoritmalar/ortega-pbl', 'ortega-pbl', 'Ortega PBL', ''),
    ('pyraminx.json', 'l3e', '/icerikler/algoritmalar/pyraminx', 'pyra_algos', 'Pyraminx L3E', 'l3e'),
    ('pyraminx.json', 'l4e', '/icerikler/algoritmalar/pyraminx', 'pyra_algos', 'Pyraminx L4E', 'l4e'),
    ('skewb.json', 'beginner', '/icerikler/algoritmalar/skewb', 'skewb_algos', 'Skewb Beginner', 'beginner'),
    ('skewb.json', 'intermediate', '/icerikler/algoritmalar/skewb', 'skewb_algos', 'Skewb Intermediate', 'intermediate'),
    ('skewb.json', 'advanced', '/icerikler/algoritmalar/skewb', 'skewb_algos', 'Skewb Advanced', 'advanced'),
    ('4x4.json', 'parity', '/icerikler/algoritmalar/4x4', 'alg4', '4x4 Parity', 'parity'),
    ('5x5.json', 'parity', '/icerikler/algoritmalar/5x5', 'alg5', '5x5 Parity', 'parity'),
]
from urllib.parse import quote
for fn, key, url, page, label, hashset in SETS:
    data = json.load(open(A + fn))
    for g in groups_of(data, key):
        sub_tr = sub_name(page, g['subset'], 'tr'); sub_en = sub_name(page, g['subset'], 'en')
        for c in g['cases']:
            name = c['name']
            title = (label + ' ' + name) if fn == 'bld.json' else name
            u = url + '?case=' + quote(name) + ('#' + hashset if hashset else '')
            kw = ' '.join(x for x in [label, sub_tr, sub_en, g['subset']] if x)
            items.append({'t': title, 's': label + (' · ' + sub_tr if sub_tr else ''), 'u': u, 'k': kw, 'a': c.get('alg', '')})
json.dump({'v': 1, 'items': items}, open(R + 'arama.json', 'w'), ensure_ascii=False, separators=(',', ':'))
print(len(items), 'öğe')
