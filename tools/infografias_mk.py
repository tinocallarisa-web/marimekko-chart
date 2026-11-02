"""Infografías del Marimekko para Partner Center (assets/, 1366x768) y la web (2x, en datos/demo_rtm/export/infografias).
1: plantilla común de la web (ficha de docs/WEBSITE-PRODUCT-PAGE.md + export/central_22.png de la demo).
2: Free frente a Pro con dos renders del simulador (mk_ig_free.png, mk_ig_pro.png, 620x400, sin el marco),
   en la carpeta indicada como primer argumento (por defecto, la de este script)."""
import os, re, sys, json, subprocess, html
sys.path.insert(0, r"C:\tcviz\datos\demo_rtm")
import infografias as I
from PIL import Image

REPO = r"C:\tcviz\dev\Marimekko"
MK = sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(os.path.abspath(__file__))
md = open(os.path.join(REPO, "docs", "WEBSITE-PRODUCT-PAGE.md"), encoding="utf-8").read()
js = re.search(r"```js\n(.*?)\n```", md, re.S).group(1).strip().rstrip(",")
r = subprocess.run(["node", "-e", "process.stdout.write(JSON.stringify(eval('(' + require('fs').readFileSync(0,'utf8') + ')')))"],
                   input=js, capture_output=True, text=True, encoding="utf-8", check=True)
P = json.loads(r.stdout)


def render(h_html, png2x, png1x):
    subprocess.run([I.EDGE, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=2",
                    "--allow-file-access-from-files", f"--screenshot={png2x}", "--window-size=1366,768", I.uri(h_html)],
                   capture_output=True, timeout=90)
    Image.open(png2x).convert("RGB").resize((1366, 768), Image.LANCZOS).save(png1x, optimize=True)


# 1. Plantilla común
h1 = os.path.join(I.OUT, "marimekko-chart-infographic.html")
open(h1, "w", encoding="utf-8").write(I.ficha(P, 22, "Where are we strong in the market?"))
web1 = os.path.join(I.OUT, "marimekko-chart-infographic.png")
render(h1, web1, os.path.join(REPO, "assets", "infographic.png"))

# 2. Free y Pro con el mismo dato
e = html.escape
img_f, img_p = I.uri(os.path.join(MK, "mk_ig_free.png")), I.uri(os.path.join(MK, "mk_ig_pro.png"))
css = I.CSS % {"pop": I.uri(os.path.join(I.BASE, "tema", "Poppins"))}
pro_items = "".join(f"<li>{e(x)}</li>" for x in P["freemium"]["pro"])
free_items = "".join(f"<li>{e(x)}</li>" for x in [
    "Columns at 100%: width = size of the segment", "3 named series plus Others, every column at its real 100%",
    "Share labels, column totals with % of the total", "Share axis, legend, ordering, 6 templates",
    "Filtering, bookmarks, keyboard, 12 languages"])
h2 = os.path.join(I.OUT, "marimekko-chart-infographic-pro.html")
open(h2, "w", encoding="utf-8").write(f"""<!doctype html><html><head><meta charset="utf-8"><style>{css}
.dos{{position:absolute;left:24px;right:24px;top:115px;bottom:40px;display:grid;grid-template-columns:1fr 1fr;gap:16px}}
.dos .card{{padding:14px 16px;display:flex;flex-direction:column}}
.dos img{{width:100%;border-radius:4px;display:block}}
.dos h2{{font-size:16px}} .dos .f h2{{color:#3E9C5B}} .dos .p h2{{color:#2B6CB0}}
.dos ul{{list-style:none;margin-top:10px;columns:2;column-gap:18px}}
.dos li{{font-size:12.5px;line-height:1.35;padding-left:16px;position:relative;margin-bottom:6px;break-inside:avoid}}
.dos .f li:before{{content:'✓';color:#3E9C5B;position:absolute;left:0;font-weight:700}}
.dos .p li:before{{content:'+';color:#2B6CB0;position:absolute;left:0;font-weight:700}}
.sub{{font-size:12.5px;color:#666;margin:-4px 0 8px}}
</style></head><body>
<div class="cab"><img class="logo" src="{I.uri(os.path.join(I.WEB, "logos", "tcviz-logo-light.svg"))}"><div class="sep"></div>
<div><h1>Free reads the market. Pro reads your position.</h1><p>{e(P["name"])} — the same data, without and with a licence.</p></div>
<div class="tier"><span class="pill free">Free</span><span class="pill pro">Pro</span></div></div>
<div class="raya"></div>
<div class="dos">
<div class="card f"><h2>Free — a complete Marimekko</h2><div class="sub">Who leads each segment, and how big each segment is.</div>
<img src="{img_f}"><ul>{free_items}</ul></div>
<div class="card p"><h2>Pro — your company in focus</h2><div class="sub">Begudes Nord highlighted, with its summary sentence and the change in share vs last year.</div>
<img src="{img_p}"><ul>{pro_items}</ul></div>
</div>
<div class="fin"><span>tcviz.com · Power BI custom visual · {e(P["name"])}</span><span>Without a licence, Pro features are drawn working under a "Pro preview" watermark while you edit.</span></div>
</body></html>""")
web2 = os.path.join(I.OUT, "marimekko-chart-infographic-pro.png")
render(h2, web2, os.path.join(REPO, "assets", "infographic-pro.png"))
print("ok")
