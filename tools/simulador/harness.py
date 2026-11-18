# -*- coding: utf-8 -*-
"""Simulador Playwright del Marimekko: comprueba formato dinámico (F11), fx (F04), accesibilidad (D10) y la marca de
agua común, con capturas en tools/simulador/capturas/.

Carga el bundle de la última build de prueba (.tmp/drop/visual.js) con un host simulado y un dataView categorical
sintético (4 columnas × 6 series). Modelo: Treemap/tools/simulador/harness.py.
No reproduce el motor de Power BI: qué columna trae la regla fx y la cadena dinámica, tooltips reales, menús y licencia
solo se ven en Desktop. Aquí se simula lo que Power BI documenta (objects[i] por fila).

Uso:  node build-test.js          && python tools/simulador/harness.py pro
      node build-test.js --free   && python tools/simulador/harness.py free
"""
import asyncio, io, json, os, sys
from playwright.async_api import async_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DROP = os.path.join(ROOT, ".tmp", "drop")
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "capturas")
MODE = sys.argv[1] if len(sys.argv) > 1 else "pro"
GUID = json.load(io.open(os.path.join(DROP, "pbiviz.json"), encoding="utf-8"))["visual"]["guid"]

COLS = ["Retail", "Online", "Wholesale", "Export"]
SERIES = ["Acme", "Brava", "Cielo", "Delta", "Eko", "Fargo"]
BASE = {"Retail": 420, "Online": 260, "Wholesale": 180, "Export": 90}
SHARE = [0.34, 0.22, 0.16, 0.12, 0.09, 0.07]

STUB = r"""
window.__ev = []; window.__tips = []; window.__persist = []; window.__notices = [];
window.powerbi = { visuals: { plugins: {} }, extensibility: {} };
(function(){
 const PAL = ['#118DFF','#12239E','#E66C37','#6B007B','#E044A7','#744EC2','#D9B300','#D64550','#197278','#1AAB40'];
 let pi = 0; const pmap = {};
 function mkId(k){ return { __k:k, getKey(){return k;}, getSelector(){return {data:[{k}]};}, equals(o){return !!o && o.__k===k;}, includes(o){ return !!o && o.__k===k; } }; }
 window.__mkHost = function(opts){ return {
  eventService: { renderingStarted(){ __ev.push('S'); }, renderingFinished(){ __ev.push('F'); }, renderingFailed(o,m){ __ev.push('X'); console.error('FAILED', m); } },
  createSelectionManager(){ return { select(){ return Promise.resolve([]); }, clear(){ return Promise.resolve(); }, getSelectionIds(){ return []; },
     hasSelection(){ return false; }, registerOnSelectCallback(){}, showContextMenu(){ return Promise.resolve(); } }; },
  createSelectionIdBuilder(){ const k=[]; return { withCategory(c,i){ k.push(c.source.queryName+'='+c.values[i]); return this; },
     withMeasure(m){ k.push(m); return this; }, withSeries(){ return this; }, createSelectionId(){ return mkId(k.join('|')); } }; },
  createLocalizationManager(){ return { getDisplayName(k){ return k; } }; },
  tooltipService: { show(o){ __tips.push(o.dataItems); }, move(){}, hide(){} },
  subSelectionService: { subSelect(){}, updateRegionOutlines(){} },
  hostCapabilities: { allowInteractions: true }, locale: opts.locale || 'en-US',
  colorPalette: opts.hc ? { isHighContrast:true, foreground:{value:'#FFFFFF'}, background:{value:'#000000'}, foregroundSelected:{value:'#1AEBFF'},
      getColor(k){ return {value:'#FFFFFF'}; } }
    : { isHighContrast:false, foreground:{value:'#252423'}, background:{value:'#FFFFFF'}, foregroundSelected:{value:'#1AEBFF'},
      getColor(k){ if (!(k in pmap)) pmap[k] = PAL[(pi++) % PAL.length]; return {value: pmap[k]}; } },
  licenseManager: opts.license ? {
      getAvailableServicePlans(){ return Promise.resolve({ plans: [], isLicenseInfoAvailable: true, isLicenseUnsupportedEnv: false }); },
      notifyFeatureBlocked(m){ __notices.push(m); return Promise.resolve(true); }, notifyLicenseRequired(){ return Promise.resolve(true); },
      clearLicenseNotification(){ return Promise.resolve(true); } } : undefined,
  fetchMoreData(){ return false; }, persistProperties(c){ __persist.push(c); }, launchUrl(){}, displayWarningIcon(){}, hideWarningIcon(){},
 }; };
})();
"""


def src(name, query, role, fmt=None, measure=False):
    s = {"displayName": name, "queryName": query, "roles": {role: True}}
    if fmt: s["format"] = fmt
    if measure: s["isMeasure"] = True
    return s


def dataview(objects=None, dyn_fmt=False, rule_in=None, cmp=False):
    """dyn_fmt: cadena dinámica por fila (Export en euros, el resto en dólares).
    rule_in: 'category' | 'value' — dónde llega la regla fx por fila (verde si la cuota > 20 %, rojo si < 10 %)."""
    cols, sers, vals, prev, vobj, cobj = [], [], [], [], [], []
    for c in COLS:
        for k, se in enumerate(SERIES):
            v = round(BASE[c] * SHARE[(k + COLS.index(c)) % len(SERIES)] * 1000)
            cols.append(c); sers.append(se); vals.append(v); prev.append(round(v * (0.9 + 0.05 * k)))
            o = {}
            if dyn_fmt: o["general"] = {"formatString": '#,0 "€"' if c == "Export" else '"$"#,0'}
            sh = SHARE[(k + COLS.index(c)) % len(SERIES)]
            rule = "#107C10" if sh > 0.2 else "#C4314B" if sh < 0.1 else "#C8C6C4"
            if rule_in == "value": o["series"] = {"cellColor": {"solid": {"color": rule}}}
            vobj.append(o)
            cobj.append({"series": {"cellColor": {"solid": {"color": rule}}}} if rule_in == "category" else {})
    cat = {"source": src("Channel", "Sales.Channel", "category"), "values": cols}
    if rule_in == "category": cat["objects"] = cobj
    ser = {"source": src("Brand", "Sales.Brand", "series"), "values": sers}
    val = {"source": src("Net sales", "Sum(Sales.Net sales)", "value", "#,0", True), "values": vals}
    if dyn_fmt or rule_in == "value": val["objects"] = vobj
    values = [val]
    if cmp: values.append({"source": src("Net sales PY", "Sum(Sales.Net sales PY)", "comparison", "#,0", True), "values": prev})
    return {"metadata": {"columns": [cat["source"], ser["source"]] + [v["source"] for v in values], "objects": objects or {}},
            "categorical": {"categories": [cat, ser], "values": values}}


async def page(browser, W, H, opts, bg="#FFFFFF"):
    pg = await browser.new_page(viewport={"width": W, "height": H}, device_scale_factor=2)
    errs = []
    pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
    pg.on("pageerror", lambda e: errs.append(str(e)))
    await pg.set_content(f"<html><body style='margin:0;background:{bg}'><div id='host' style='position:relative;width:{W}px;height:{H}px;overflow:hidden'></div></body></html>")
    await pg.add_style_tag(path=os.path.join(DROP, "visual.css"))
    await pg.add_script_tag(content=STUB)
    await pg.add_script_tag(path=os.path.join(DROP, "visual.js"))
    await pg.evaluate("([g, o]) => { window.__v = powerbi.visuals.plugins[g].create({ element: document.getElementById('host'), host: __mkHost(o) }); }", [GUID, opts])
    return pg, errs


async def update(pg, dv, W, H, view=0):
    await pg.evaluate("([dv, W, H, vm]) => __v.update({ dataViews: dv ? [dv] : [], viewport: {width: W, height: H}, type: 2, operationKind: 0, viewMode: vm })",
                      [dv, W, H, view])
    await pg.wait_for_timeout(500)


results = []


def check(name, ok, detail=""):
    results.append((name, ok, detail))
    print(f"  [{'OK ' if ok else 'FALLA'}] {name}  {detail}")


async def run_pro(b):
    W, H = 900, 520
    # 1. Formato dinámico: etiquetas de valor (Pro), totales de columna, tooltip y aria-label
    pg, errs = await page(b, W, H, {})
    await update(pg, dataview(dyn_fmt=True, objects={"labels": {"content": "value"}, "focus": {"name": "Acme"}}), W, H)
    await pg.screenshot(path=os.path.join(OUT, "01_formato_dinamico.png"))
    labels = await pg.evaluate("() => Array.from(document.querySelectorAll('.tcmk-labels text')).map(t => t.textContent)")
    totals = await pg.evaluate("() => Array.from(document.querySelectorAll('.tcmk-totals text')).map(t => t.textContent)")
    summary = await pg.evaluate("() => Array.from(document.querySelectorAll('.tcmk-summary text')).map(t => t.textContent)")
    aria = await pg.evaluate("() => Array.from(document.querySelectorAll('g[data-pt]')).map(g => g.getAttribute('aria-label'))")
    check("F11 etiquetas: Export en €, resto en $", any("€" in x for x in labels) and any("$" in x for x in labels), f"{labels[:3]} … {[x for x in labels if '€' in x][:2]}")
    check("F11 totales de columna con el formato de su columna", any("€" in x for x in totals) and any("$" in x for x in totals), str(totals))
    check("F11 aria-label con el formato de la fila", any("Export" in a and "€" in a for a in aria) and any("Retail" in a and "$" in a for a in aria), [a for a in aria if "Export" in a][0])
    await pg.evaluate("() => { const g = Array.from(document.querySelectorAll('g[data-pt]')).find(g => g.getAttribute('aria-label').startsWith('Export')); g.dispatchEvent(new MouseEvent('mousemove', {bubbles:true, clientX:100, clientY:100})); }")
    tip = await pg.evaluate("() => __tips[__tips.length-1]")
    tv = [i["value"] for i in tip if i["displayName"] == "Net sales"]
    check("F11 tooltip con el formato de la fila", bool(tv) and "€" in tv[0], str(tv))
    check("F11 frase resumen (mezcla de formatos → formato de la medida)", bool(summary) and "€" not in summary[0], summary[0] if summary else "")
    check("sin errores de consola", not errs, "; ".join(errs[:2]))
    ev = await pg.evaluate("() => __ev.join('')")
    check("eventos de render 1:1", ev == "SF", ev)
    await pg.close()

    # 1b. Todas las filas con la misma cadena dinámica: también eje y frase
    pg, errs = await page(b, W, H, {})
    dv = dataview(dyn_fmt=True, objects={"focus": {"name": "Acme"}, "layout": {"mode": "absolute"}})
    for o in dv["categorical"]["values"][0]["objects"]: o["general"]["formatString"] = '#,0 "€"'
    await update(pg, dv, W, H)
    await pg.screenshot(path=os.path.join(OUT, "01b_formato_dinamico_comun.png"))
    summary = await pg.evaluate("() => Array.from(document.querySelectorAll('.tcmk-summary text')).map(t => t.textContent)")
    axis = await pg.evaluate("() => Array.from(document.querySelectorAll('.tcmk-axis text')).map(t => t.textContent)")
    check("F11 una sola cadena dinámica → frase y eje en €", "€" in summary[0] and any("€" in a for a in axis), f"{summary[0][:80]} | {axis[-1]}")
    await pg.close()

    # 2. fx: regla por fila (en la columna de categoría y en la de valor) y color fijo general
    for where in ("category", "value"):
        pg, errs = await page(b, W, H, {})
        await update(pg, dataview(rule_in=where), W, H)
        await pg.screenshot(path=os.path.join(OUT, f"02_fx_regla_en_{where}.png"))
        fills = await pg.evaluate("() => Array.from(document.querySelectorAll('g[data-pt] rect.tcmk-hit')).map(r => r.getAttribute('fill'))")
        check(f"F04 regla fx por fila (llega en {where})", set(fills) <= {"#107C10", "#C4314B", "#C8C6C4"} and "#107C10" in fills and "#C4314B" in fills, str(sorted(set(fills))))
        await pg.close()
    pg, errs = await page(b, W, H, {})
    await update(pg, dataview(objects={"series": {"cellColor": {"solid": {"color": "#2B6CB0"}}}, "accessibility": {"dataPatterns": True}}), W, H)
    await pg.screenshot(path=os.path.join(OUT, "02c_fx_color_fijo_con_tramas.png"))
    fills = await pg.evaluate("() => Array.from(document.querySelectorAll('g[data-pt] rect.tcmk-hit')).map(r => r.getAttribute('fill'))")
    check("F04 color fijo (nivel general) en todas las celdas", set(fills) == {"#2B6CB0"}, str(set(fills)))
    pats = await pg.evaluate("() => new Set(Array.from(document.querySelectorAll('rect.tcmk-pat')).map(r => r.getAttribute('fill'))).size")
    check("D10 tramas distintas por serie", pats >= 6, f"{pats} tramas")
    fm = await pg.evaluate("() => __v.getFormattingModel()")
    cards = {c["uid"]: c for c in fm["cards"]}
    fx = [sl for g in cards["series_card"]["groups"] for sl in g["slices"] if sl["uid"] == "series_cellColor"][0]["control"]["properties"]["descriptor"]
    check("F04 descriptor ConstantOrRule + altConstantValueSelector null", fx.get("instanceKind") == 3 and fx.get("altConstantValueSelector", "x") is None and "selector" in fx, json.dumps(fx)[:160])
    check("revertToDefaultDescriptors en todas las tarjetas", all(c.get("revertToDefaultDescriptors") for c in fm["cards"]), f"{len(fm['cards'])} tarjetas")
    acc = cards.get("accessibility_card")
    check("D10 tarjeta 'accessibility' en el panel", bool(acc), ", ".join(sl["uid"] for sl in acc["groups"][0]["slices"]) if acc else "")
    await pg.close()

    # 3. Accesibilidad: alto contraste forzado, mínimo de texto, foco del teclado con color y grosor propios
    pg, errs = await page(b, W, H, {})
    await update(pg, dataview(objects={"accessibility": {"highContrast": "on", "minTextSize": 12, "focusColor": {"solid": {"color": "#C4314B"}}, "focusWidth": 4},
                                       "series": {"named": 4}, "focus": {"name": "Acme"}}), W, H)
    await pg.keyboard.press("Tab")
    await pg.wait_for_timeout(200)
    await pg.screenshot(path=os.path.join(OUT, "03_alto_contraste_forzado_foco.png"))
    sizes = await pg.evaluate("() => Array.from(document.querySelectorAll('svg text')).map(t => Number(t.getAttribute('font-size')))")
    check("D10 tamaño mínimo de texto (12)", min(sizes) >= 12, f"mínimo {min(sizes)}")
    st = await pg.evaluate("() => { const r = document.activeElement && document.activeElement.querySelector && document.activeElement.querySelector('rect.tcmk-hit'); if (!r) return null; const c = getComputedStyle(r); return [c.stroke, c.strokeWidth]; }")
    check("D10 foco del teclado con color y grosor del panel", bool(st) and st[0] in ("rgb(196, 49, 75)",) and st[1] == "4px", str(st))
    fills = await pg.evaluate("() => Array.from(document.querySelectorAll('g[data-pt] rect.tcmk-hit')).map(r => r.getAttribute('fill'))")
    pats = await pg.evaluate("() => document.querySelectorAll('rect.tcmk-pat').length")
    check("D10 alto contraste forzado: blanco/negro + tramas", set(fills) <= {"#FFFFFF", "#1F4E80"} and pats > 0, f"{set(fills)} · {pats} tramas")
    await pg.close()
    # Alto contraste del sistema (tema negro)
    pg, errs = await page(b, W, H, {"hc": True}, bg="#000000")
    await update(pg, dataview(objects={"series": {"named": 4}}), W, H)
    await pg.screenshot(path=os.path.join(OUT, "03b_alto_contraste_sistema.png"))
    fills = await pg.evaluate("() => Array.from(document.querySelectorAll('g[data-pt] rect.tcmk-hit')).map(r => r.getAttribute('fill'))")
    check("D10 alto contraste del sistema: colores del tema", set(fills) == {"#000000"}, str(set(fills)))
    check("sin errores de consola (alto contraste)", not errs, "; ".join(errs[:2]))
    await pg.close()
    # 4. Títulos de eje (FC.CART01): automáticos, absolutos, horizontal, texto propio, mínimo de texto, alto contraste y tamaño S
    TT = "() => Array.from(document.querySelectorAll('.tcmk-axis-titles text')).map(t => { const b = t.getBBox(); return {t: t.textContent, fs: Number(t.getAttribute('font-size')), fill: t.getAttribute('fill'), rot: !!t.getAttribute('transform'), r: t.getBoundingClientRect().toJSON()}; })"
    LOWEST = "() => Math.max(...Array.from(document.querySelectorAll('.tcmk-collabels text, .tcmk-hit')).map(e => e.getBoundingClientRect().bottom))"
    LEFTMOST = "() => Math.min(...Array.from(document.querySelectorAll('.tcmk-axis text, .tcmk-hit')).map(e => e.getBoundingClientRect().left))"
    for name, objs, w, h in (("06_titulos_auto", {}, W, H), ("06b_titulos_absoluto", {"layout": {"mode": "absolute"}}, W, H),
                              ("06c_titulos_horizontal", {"layout": {"orientation": "horizontal"}}, W, H),
                              ("06d_titulos_texto_min_hc", {"columnLabels": {"titleText": "Sales channel"}, "axis": {"titleText": "Brand share", "titleSize": 7},
                                                            "accessibility": {"minTextSize": 12, "highContrast": "on"}}, W, H),
                              ("06e_titulos_tamano_s", {}, 300, 170), ("06f_titulos_tamano_m", {}, 480, 300)):
        pg, errs = await page(b, w, h, {})
        await update(pg, dataview(objects=objs), w, h)
        await pg.screenshot(path=os.path.join(OUT, name + ".png"))
        tt = await pg.evaluate(TT)
        low = await pg.evaluate(LOWEST); lm = await pg.evaluate(LEFTMOST)
        txt = [x["t"] for x in tt]
        inside = all(x["r"]["left"] >= 0 and x["r"]["top"] >= 0 and x["r"]["right"] <= w + 0.5 and x["r"]["bottom"] <= h + 0.5 for x in tt)
        bottomT = [x for x in tt if not x["rot"]]; leftT = [x for x in tt if x["rot"]]
        no_overlap = all(x["r"]["top"] >= low - 0.5 for x in bottomT) and all(x["r"]["right"] <= lm + 0.5 for x in leftT)
        if name == "06_titulos_auto":
            ok = txt == ["Channel (width = size)", "Share of column"] or set(txt) == {"Channel (width = size)", "Share of column"}
        elif name == "06b_titulos_absoluto": ok = "Net sales" in txt and "Channel (width = size)" in txt
        elif name == "06c_titulos_horizontal": ok = any(x["t"] == "Share of column" and not x["rot"] for x in tt) and any(x["t"].startswith("Channel") and x["rot"] for x in tt)
        elif name == "06d_titulos_texto_min_hc": ok = set(txt) == {"Sales channel", "Brand share"} and min(x["fs"] for x in tt) >= 12 and all(x["fill"] == "#000000" for x in tt)
        else: ok = len(tt) >= 1
        check(f"FC.CART01 {name}: dentro del visual y sin pisar el gráfico", ok and inside and no_overlap and not errs, f"{[(x['t'], x['fs']) for x in tt]} ok={ok} dentro={inside} sin_pisar={no_overlap} low={low:.0f} lm={lm:.0f} {[ (round(x['r']['left']), round(x['r']['top']), round(x['r']['right']), round(x['r']['bottom'])) for x in tt]} {errs[:1]}")
        await pg.close()

    # Patrón en Others (Free: 3 series + Others)
    pg, errs = await page(b, W, H, {})
    await update(pg, dataview(objects={"series": {"named": 3}}), W, H)
    await pg.screenshot(path=os.path.join(OUT, "04_patron_others.png"))
    n = await pg.evaluate("() => Array.from(document.querySelectorAll('rect.tcmk-pat')).filter(r => r.getAttribute('fill') === 'url(#tcmk-stripe)').length")
    check("D10 trama en Others (celdas y leyenda)", n >= 5, f"{n} rectángulos con trama")
    await pg.close()


async def run_free(b):
    W, H = 900, 520
    pg, errs = await page(b, W, H, {"license": True})
    await update(pg, dataview(objects={"focus": {"name": "Acme"}, "layout": {"orientation": "horizontal"}}), W, H, view=1)
    await pg.wait_for_timeout(300)
    await update(pg, dataview(objects={"focus": {"name": "Acme"}, "layout": {"orientation": "horizontal"}, "style": {"guide": False}}), W, H, view=1)
    await pg.screenshot(path=os.path.join(OUT, "05_marca_agua_comun_edicion.png"))
    wm = await pg.evaluate("() => { const e = document.querySelector('.tcviz-wm'); return e ? [getComputedStyle(e).display, e.textContent] : null; }")
    check("marca de agua común (.tcviz-wm) en edición sin licencia", bool(wm) and wm[0] == "flex", str(wm))
    old = await pg.evaluate("() => document.querySelectorAll('.tcmk-watermark').length")
    check("sin la marca propia antigua", old == 0, str(old))
    await update(pg, dataview(objects={"focus": {"name": "Acme"}, "layout": {"orientation": "horizontal"}, "style": {"guide": False}}), W, H, view=0)
    await pg.screenshot(path=os.path.join(OUT, "05b_lectura_resultado_gratuito.png"))
    wm = await pg.evaluate("() => getComputedStyle(document.querySelector('.tcviz-wm')).display")
    check("en lectura no hay marca (resultado gratuito)", wm == "none", wm)
    check("sin errores de consola (free)", not errs, "; ".join(errs[:2]))
    await pg.close()


async def main():
    os.makedirs(OUT, exist_ok=True)
    print("bundle:", GUID, "· modo", MODE)
    async with async_playwright() as p:
        b = await p.chromium.launch()
        if MODE == "free": await run_free(b)
        else: await run_pro(b)
        await b.close()
    bad = [r for r in results if not r[1]]
    print(f"{len(results) - len(bad)}/{len(results)} comprobaciones OK")
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    asyncio.run(main())
