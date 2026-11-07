#!/usr/bin/env python3
"""
Genera il font delle icone ridotto (solo le icone che l'app usa) e il suo CSS.

Perché: il pacchetto completo di Tabler Icons ha 5.266 icone; l'app ne usa ~120. Il pacchetto da internet costava ~370 KB in 16 richieste
a un servizio esterno (e con versione "latest" non fissata). Il font ridotto pesa ~16 KB, è locale e funziona anche senza rete.

Quando serve rigenerarlo: ogni volta che nel codice compare una nuova icona "ti-qualcosa". Il test src/lib/icons.test.js lo segnala.

Uso (dalla radice del progetto):
    npm pack @tabler/icons-webfont@3.50.0 --pack-destination /tmp/tabler && tar xzf /tmp/tabler/*.tgz -C /tmp/tabler
    pip install fonttools brotli
    python3 scripts/build-icons.py /tmp/tabler/package
"""
import glob, os, re, subprocess, sys
pkg = sys.argv[1] if len(sys.argv) > 1 else '/tmp/tabler/package'
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
css_src = open(os.path.join(pkg, 'dist/tabler-icons.min.css'), encoding='utf-8').read()
codes = dict(re.findall(r'\.ti-([a-z0-9-]+):before\{content:"\\+([0-9a-fA-F]+)"\}', css_src))
used = set()
for f in glob.glob(os.path.join(root, 'src/**/*.js*'), recursive=True):
    if '.test.' in f: continue
    used |= set(re.findall(r'\bti-([a-z0-9-]+)', open(f, encoding='utf-8').read()))
import json
extra = json.load(open(os.path.join(root, 'scripts/icons-extra.json')))     # icone il cui nome è composto nel codice (es. ti-chevron-${su/giù})
used |= set(extra)
templ = set()
for f in glob.glob(os.path.join(root, 'src/**/*.js*'), recursive=True):
    if '.test.' in f: continue
    templ |= set(re.findall(r'\bti-([a-z0-9-]+-)\$\{', open(f, encoding='utf-8').read()))
for tp in sorted(templ):
    if not any(e.startswith(tp) for e in extra): print(f'ATTENZIONE: nel codice c\'è un nome composto "ti-{tp}${{…}}": aggiungere le icone possibili a scripts/icons-extra.json')
used = {u for u in used if not u.endswith('-')}                     # "chevron-" è solo l'inizio di un nome composto, non un'icona
unknown = sorted(u for u in used if u not in codes and u not in ('spin',))
if unknown: print('ATTENZIONE: nomi che non esistono in Tabler (icone invisibili):', ', '.join(unknown))
used = sorted(u for u in used if u in codes)
unicodes = ','.join('U+' + codes[u] for u in used)
out_font = os.path.join(root, 'src/assets/fonts/tabler-icons-subset.woff2')
os.makedirs(os.path.dirname(out_font), exist_ok=True)
subprocess.run(['pyftsubset', os.path.join(pkg, 'dist/fonts/tabler-icons.woff2'), '--unicodes=' + unicodes, '--flavor=woff2',
                '--output-file=' + out_font, '--layout-features=', '--no-hinting'], check=True)
base = re.search(r'\.ti\{[^}]*\}', css_src).group(0)
ver = re.search(r'Tabler Icons ([0-9.]+)', css_src).group(1)
lines = [f'/* Icone: sottoinsieme di Tabler Icons {ver} (MIT) — GENERATO da scripts/build-icons.py, non modificare a mano. {len(used)} icone. */',
         '@font-face{font-family:"tabler-icons";font-style:normal;font-weight:400;font-display:block;src:url("./assets/fonts/tabler-icons-subset.woff2") format("woff2")}',
         base]
lines += [f'.ti-{u}:before{{content:"\\{codes[u]}"}}' for u in used]
# rotazione: ti-spin (usata nel codice) e le icone "loader" (prima ferme)
lines += ['.ti-spin,.ti-loader-2,.ti-loader{display:inline-block;animation:ti-spin 1s linear infinite}', '@keyframes ti-spin{to{transform:rotate(360deg)}}',
          '@media (prefers-reduced-motion:reduce){.ti-spin,.ti-loader-2,.ti-loader{animation-duration:3s}}']
open(os.path.join(root, 'src/icons.css'), 'w', encoding='utf-8').write('\n'.join(lines) + '\n')
print(f'{len(used)} icone → {os.path.getsize(out_font)/1024:.1f} KB di font, {os.path.getsize(os.path.join(root, "src/icons.css"))/1024:.1f} KB di CSS')
