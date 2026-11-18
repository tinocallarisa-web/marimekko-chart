# -*- coding: utf-8 -*-
"""Infografías y capturas de la ficha del Marimekko (1366x768, assets/) con la plantilla común de la web.
Modelo: Treemap/tools/gen_infographic.py.

El contenido sale de docs/WEBSITE-PRODUCT-PAGE.md (la entrada de data.jsx): se corrige la ficha, no la imagen.
  infographic.png       plantilla común con la imagen del simulador (ficha_central)
  infographic-pro.png   Free frente a Pro, el mismo dato (simulador)
  Screenshot_1..5.png   la mejor imagen, small multiples, tres tamaños, estilos, novedades 1.0.1 (simulador)
Las imágenes del simulador son del caso Begudes Nord (tools/simulador/begudes_nord.json, datos de la demo) y no llevan
marca de agua: la build de prueba fuerza Pro. Su pie no dice "Power BI Desktop".

    node build-test.js && python tools/simulador/harness.py ficha && python tools/infografias_mk.py
Copia 2x para la web en datos/demo_rtm/export/infografias/marimekko-chart-infographic*.png.
"""
import html, json, os, re, shutil, subprocess, sys, tempfile
sys.path.insert(0, r"C:\tcviz\datos\demo_rtm")
import infografias as I
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CAP = os.path.join(ROOT, "tools", "simulador", "capturas")
ASSETS = os.path.join(ROOT, "assets")
md = open(os.path.join(ROOT, "docs", "WEBSITE-PRODUCT-PAGE.md"), encoding="utf-8").read()
js = re.search(r"```js\n(.*?)\n```", md, re.S).group(1).strip().rstrip(",")
r = subprocess.run(["node", "-e", "process.stdout.write(JSON.stringify(eval('(' + require('fs').readFileSync(0,'utf8') + ')')))"],
                   input=js, capture_output=True, text=True, encoding="utf-8", check=True)
P = json.loads(r.stdout)
e = html.escape
CSS = I.CSS % {"pop": I.uri(os.path.join(I.BASE, "tema", "Poppins"))}
LOGO = I.uri(os.path.join(I.WEB, "logos", "tcviz-logo-light.svg"))


def cap(n):
    f = os.path.join(CAP, "ficha_" + n + ".png")
    assert os.path.exists(f), f"falta {f}: python tools/simulador/harness.py ficha"
    return I.uri(f)


def render(h_html, png2x, png1x):
    subprocess.run([I.EDGE, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=2",
                    "--allow-file-access-from-files", f"--screenshot={png2x}", "--window-size=1366,768", I.uri(h_html)],
                   capture_output=True, timeout=90)
    Image.open(png2x).convert("RGB").resize((1366, 768), Image.LANCZOS).save(png1x, optimize=True)
    print("  ", os.path.relpath(png1x, ROOT))


def cabecera(titulo, sub, tier='<span class="pill free">Free</span><span class="pill pro">Pro</span>'):
    return (f'<div class="cab"><img class="logo" src="{LOGO}"><div class="sep"></div>'
            f'<div><h1>{e(titulo)}</h1><p>{e(sub)}</p></div><div class="tier">{tier}</div></div><div class="raya"></div>')


PIE = (f'<div class="fin"><span>tcviz.com · Power BI custom visual · {e(P["name"])}</span>'
       f'<span>Sample data: Begudes Nord, a fictitious drinks company · drawn by the visual, Report theme</span></div>')
PIE_EST = PIE.replace(", Report theme", "")
FREE = '<span class="pill free">Free</span>'
PRO = '<span class="pill pro">Pro</span>'


def pagina(nombre, cuerpo, extra_css=""):
    h = os.path.join(I.OUT, nombre + ".html")
    open(h, "w", encoding="utf-8").write(f'<!doctype html><html><head><meta charset="utf-8"><style>{CSS}{extra_css}</style></head><body>{cuerpo}</body></html>')
    return h


li = lambda xs: "".join(f"<li>{e(x)}</li>" for x in xs)

# 1. Plantilla común de la web, con la imagen del simulador (1.0.1: títulos de eje, colores de serie distintos) en lugar
#    de export/central_22.png, que es de la 1.0.0. La imagen no es de Desktop: el pie lo dice.
tmp = tempfile.mkdtemp()
try:
    shutil.copy(os.path.join(CAP, "ficha_central.png"), os.path.join(tmp, "central_99.png"))
    exp, I.EXP = I.EXP, tmp
    ficha = I.ficha(P, 99, "Where are we strong in the market?")
    I.EXP = exp
    assert "Power BI Desktop, TCViz theme" in ficha
    h1 = os.path.join(I.OUT, "marimekko-chart-infographic.html")
    open(h1, "w", encoding="utf-8").write(ficha.replace("Sample report on Begudes Nord, a fictitious drinks company — Power BI Desktop, TCViz theme",
                                                        "Begudes Nord, a fictitious drinks company — drawn by the visual, Report theme"))
    render(h1, os.path.join(I.OUT, "marimekko-chart-infographic.png"), os.path.join(ASSETS, "infographic.png"))
finally:
    shutil.rmtree(tmp, ignore_errors=True)

# 2. Free frente a Pro con el mismo dato
DOS = """.dos{position:absolute;left:24px;right:24px;top:115px;bottom:40px;display:grid;grid-template-columns:1fr 1fr;gap:16px}
.dos .card{padding:14px 16px;display:flex;flex-direction:column}
.dos img{width:100%;border-radius:4px;display:block}
.dos h2{font-size:16px} .dos .f h2{color:#3E9C5B} .dos .p h2{color:#2B6CB0}
.dos ul{list-style:none;margin-top:10px;columns:2;column-gap:18px}
.dos li{font-size:12.5px;line-height:1.35;padding-left:16px;position:relative;margin-bottom:6px;break-inside:avoid}
.dos .f li:before{content:'✓';color:#3E9C5B;position:absolute;left:0;font-weight:700}
.dos .p li:before{content:'+';color:#2B6CB0;position:absolute;left:0;font-weight:700}
.sub{font-size:12.5px;color:#666;margin:-4px 0 8px}"""
free_items = ["Columns at 100%: width = size of the segment", "3 named series plus Others, every column at its real 100%",
              "Share labels, column totals with % of the total", "Axis titles, legend, ordering",
              "Report theme + 6 collection styles, all free", "Filtering, bookmarks, keyboard, 12 languages"]
h2 = pagina("marimekko-chart-infographic-pro", cabecera("Free reads the market. Pro reads your position.",
            f'{P["name"]} — the same data, without and with a licence.') + f"""
<div class="dos">
<div class="card f"><h2>Free — a complete Marimekko</h2><div class="sub">Who leads each subchannel, and how big each subchannel is.</div>
<img src="{cap('free')}"><ul>{li(free_items)}</ul></div>
<div class="card p"><h2>Pro — your company in focus</h2><div class="sub">Begudes Nord highlighted, with its summary sentence and the change in share vs last year.</div>
<img src="{cap('pro')}"><ul>{li(P["freemium"]["pro"])}</ul></div>
</div>
<div class="fin"><span>tcviz.com · Power BI custom visual · {e(P["name"])}</span><span>Without a licence, Pro features are drawn working under a "Pro preview" watermark while you edit.</span></div>""", DOS)
render(h2, os.path.join(I.OUT, "marimekko-chart-infographic-pro.png"), os.path.join(ASSETS, "infographic-pro.png"))

# 3. Capturas de la ficha: una idea por imagen
UNA = """.una{position:absolute;left:24px;right:24px;top:112px;bottom:40px;display:flex;gap:16px}
.una .card{padding:14px;display:flex;align-items:center;justify-content:center;flex:1;min-width:0}
.una img{max-width:100%;max-height:100%;display:block}
.una .lado{flex:0 0 300px;flex-direction:column;align-items:flex-start;justify-content:flex-start}
.una .lado h2{font-size:17px;margin-bottom:8px} .una .lado p{font-size:13.5px;line-height:1.45;color:#444;margin-bottom:10px}
.tres{position:absolute;left:24px;right:24px;top:112px;bottom:40px;display:grid;grid-template-columns:1.55fr 1fr;grid-template-rows:1fr 1fr;gap:14px}
.tres .card{padding:10px;display:flex;flex-direction:column;align-items:flex-start;min-height:0;overflow:hidden}
.tres .l{grid-row:1 / span 2}
.tres img{display:block;outline:1px solid #E6E3DA}
.tres b{font-size:12.5px;margin-bottom:6px;color:#555}
.est{position:absolute;left:24px;right:24px;top:112px;bottom:40px;display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:1fr 1fr;gap:12px}
.est .card{padding:8px;display:flex;flex-direction:column;min-height:0;overflow:hidden}
.est img{flex:1 1 auto;min-height:0;width:100%;object-fit:contain;display:block;border-radius:3px} .est b{font-size:12.5px;margin-top:5px;color:#555}
.nov{position:absolute;left:24px;right:24px;top:112px;bottom:40px;display:grid;grid-template-columns:repeat(3,1fr);gap:14px;align-items:start}
.nov .card{padding:12px 14px;display:flex;flex-direction:column;min-height:0;overflow:hidden}
.nov img{width:100%;display:block;border-radius:3px;margin-bottom:10px}
.nov h2{font-size:15px;margin-bottom:6px} .nov p{font-size:12.8px;line-height:1.42;color:#444;margin-bottom:6px}"""


def una(n, titulo, sub, img, lado_h, lado_p, tier=None):
    ps = "".join(f"<p>{e(x)}</p>" for x in lado_p)
    cab = cabecera(titulo, sub) if tier is None else cabecera(titulo, sub, tier)
    h = pagina(f"marimekko-shot-{n}", cab + f"""<div class="una"><div class="card"><img src="{cap(img)}"></div>
<div class="card lado"><h2>{e(lado_h)}</h2>{ps}</div></div>""" + PIE, UNA)
    render(h, os.path.join(I.OUT, f"marimekko-shot-{n}.png"), os.path.join(ASSETS, f"Screenshot_{n}.png"))


una(1, "Where are we strong in the market?", "Column width is the size of each subchannel; the stack is who shares it. Begudes Nord in focus, change in share vs last year.",
    "hero", "Size and share in one picture",
    ["The area of every cell is its share of the whole drinks market: 105.7M€, January to September 2026.",
     "Begudes Nord is highlighted and the summary sentence names its strongest and weakest subchannel.",
     "Every cell gives its share of the column and the change in points against the same months of 2025.",
     "Axis titles on both axes, written for you: the width is the size, the height is the share."])
una(2, "One Mekko per zone", "Small multiples (Pro): the same series and colours in every panel, each panel from 0 to 100%.",
    "sm", "Where are we strong, zone by zone",
    ["Begudes Nord leads Bars & cafés in Baix Llobregat and Vallès, but is a small player in the supermarkets of BCN Ciutat.",
     "Each panel orders its own subchannels by size, so the widest column is the biggest segment of that zone.",
     "Without a licence, small multiples are drawn working under a Pro preview watermark while you edit."], tier=PRO)

W, H = {"l": (900, 520), "m": (480, 300), "s": (300, 170)}, None
for k, (w, h) in W.items():
    got = Image.open(os.path.join(CAP, f"ficha_size_{k}.png")).size
    assert got == (2 * w, 2 * h), f"ficha_size_{k}.png mide {got}, se esperaba {(2 * w, 2 * h)}"
sz = lambda k: f'style="width:{W[k][0] * 0.82:.0f}px;height:{W[k][1] * 0.82:.0f}px"'   # misma escala para los tres
h3 = pagina("marimekko-shot-3", cabecera("Readable at any size", "The same visual and settings (Pro: focus series, summary sentence, six series) in three slots at the same scale. As it shrinks, the sentence and legend fold to one line and the cells keep most of the height.") + f"""
<div class="tres"><div class="card l"><b>Large · 900 × 520 px</b><img src="{cap('size_l')}" {sz('l')}></div>
<div class="card"><b>Medium · 480 × 300 px</b><img src="{cap('size_m')}" {sz('m')}></div>
<div class="card"><b>Small · 300 × 170 px</b><img src="{cap('size_s')}" {sz('s')}></div></div>""" + PIE, UNA)
render(h3, os.path.join(I.OUT, "marimekko-shot-3.png"), os.path.join(ASSETS, "Screenshot_3.png"))

est = "".join(f'<div class="card"><img src="{cap("style_" + s)}"><b>{s.title()}</b></div>'
              for s in ("boardroom", "ledger", "editorial", "signal", "aurora", "terrace"))
h4 = pagina("marimekko-shot-4", cabecera("Six collection styles, all free", "The same looks as the rest of TCViz, so a report reads as one. Report theme follows your report.", FREE) +
            f'<div class="est">{est}</div>' + PIE_EST, UNA)
render(h4, os.path.join(I.OUT, "marimekko-shot-4.png"), os.path.join(ASSETS, "Screenshot_4.png"))

h5 = pagina("marimekko-shot-5", cabecera("New in 1.0.1", "Axis titles, patterns to tell series apart without colour, and conditional formatting of every cell — all three in the free version.") + f"""
<div class="nov">
<div class="card"><img src="{cap('free')}"><h2>Axis titles on both axes</h2>
<p>Written for you from your fields — "Subchannel (width = size)" and "Share of column" — or with your own text, size and colour.</p></div>
<div class="card"><img src="{cap('patterns')}"><h2>Patterns, not only colour</h2>
<p>Format → Accessibility → Patterns: each series gets its own pattern in the cells and in the legend, for colour-blind readers and grey printouts.</p>
<p>The same card sets high contrast, keyboard focus colour and width, and a minimum text size.</p></div>
<div class="card"><img src="{cap('fx')}"><h2>Conditional formatting (fx)</h2>
<p>Colour every cell by a rule. Here, Begudes Nord is green above 25% of the column, red below 12% and blue in between; the other series in grey, told apart by their patterns.</p></div>
</div>""" + PIE, UNA)
render(h5, os.path.join(I.OUT, "marimekko-shot-5.png"), os.path.join(ASSETS, "Screenshot_5.png"))
print("ok")
