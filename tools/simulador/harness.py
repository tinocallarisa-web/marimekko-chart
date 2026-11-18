# -*- coding: utf-8 -*-
"""Simulador Playwright del Marimekko: comprueba formato dinámico (F11), fx (F04), accesibilidad (D10) y la marca de
agua común, con capturas en tools/simulador/capturas/.

Carga el bundle de la última build de prueba (.tmp/drop/visual.js) con un host simulado y un dataView categorical
sintético (4 columnas × 6 series). Modelo: Treemap/tools/simulador/harness.py.
No reproduce el motor de Power BI: qué columna trae la regla fx y la cadena dinámica, tooltips reales, menús y licencia
solo se ven en Desktop. Aquí se simula lo que Power BI documenta (objects[i] por fila).

Uso:  node build-test.js          && python tools/simulador/harness.py pro
      node build-test.js --free   && python tools/simulador/harness.py free
      node build-test.js          && python tools/simulador/harness.py ficha   (imágenes de la ficha, caso Begudes Nord:
                                     capturas/ficha_*.png, las usa tools/infografias_mk.py)
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
 const PAL0 = ['#118DFF','#12239E','#E66C37','#6B007B','#E044A7','#744EC2','#D9B300','#D64550','#197278','#1AAB40'];
 let pi = 0; const pmap = {}; let PAL = PAL0;
 function mkId(k){ return { __k:k, getKey(){return k;}, getSelector(){return {data:[{k}]};}, equals(o){return !!o && o.__k===k;}, includes(o){ return !!o && o.__k===k; } }; }
 window.__mkHost = function(opts){ PAL = opts.pal || PAL0; return {
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
    : { isHighContrast:false, foreground:{value: opts.fg || '#252423'}, background:{value:'#FFFFFF'}, foregroundSelected:{value:'#1AEBFF'},
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
        else:
            # D06 (1.0.1.0): a 300x170 los títulos ceden antes que las celdas; las celdas conservan el 55 % del alto.
            cells_h = await pg.evaluate("() => document.querySelector('.tcmk-cells').getBoundingClientRect().height")
            ok = (len(tt) >= 1 if name != "06e_titulos_tamano_s" else True) and cells_h >= 0.53 * h
        check(f"FC.CART01 {name}: dentro del visual y sin pisar el gráfico", ok and inside and no_overlap and not errs, f"{[(x['t'], x['fs']) for x in tt]} ok={ok} dentro={inside} sin_pisar={no_overlap} low={low:.0f} lm={lm:.0f} {[ (round(x['r']['left']), round(x['r']['top']), round(x['r']['right']), round(x['r']['bottom'])) for x in tt]} {errs[:1]}")
        await pg.close()

    # 5. Estilos de la colección (1.0.1.0): Report theme + seis, los mismos tokens que Treemap y Line Chart
    TOK = {"boardroom": ("#16263D", "#C9A45C"), "ledger": ("#FBF8EF", "#7A1F1F"), "editorial": ("#FFFFFF", "#D7263D"),
           "signal": ("#FFFFFF", "#1F7A4D"), "aurora": ("#10395E", "#7CE7D0"), "terrace": ("#FBF5EC", "#B5532A")}
    LOOK = """() => { const r = document.querySelector('.tcmk'); const cs = getComputedStyle(r);
        return { bg: r.style.background, font: r.style.fontFamily,
                 fills: Array.from(document.querySelectorAll('g[data-pt] rect.tcmk-hit')).map(x => x.getAttribute('fill')),
                 leg: Array.from(document.querySelectorAll('.tcmk-legend text')).map(x => x.getAttribute('fill')),
                 col: Array.from(document.querySelectorAll('.tcmk-collabels text')).map(x => x.getAttribute('fill')) }; }"""
    def rgb(h): return "rgb(%d, %d, %d)" % tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))
    for name in ["clean"] + list(TOK):
        pg, errs = await page(b, W, H, {})
        await update(pg, dataview(objects={"style": {"template": name}, "series": {"named": 4}}), W, H)
        await pg.screenshot(path=os.path.join(OUT, f"07_estilo_{name}.png"))
        lk = await pg.evaluate(LOOK)
        if name == "clean":
            ok = lk["bg"] in ("", "transparent") and "#118DFF" in lk["fills"] and lk["font"] == ""
        else:
            bg, s0 = TOK[name]
            ok = (rgb(bg) in lk["bg"]) and s0 in lk["fills"] and "#118DFF" not in lk["fills"]
            if name in ("ledger", "editorial"): ok = ok and "Georgia" in lk["font"]
        check(f"estilo {name}: fondo, paleta de series y fuente", ok and not errs, f"bg={lk['bg'][:60]} font={lk['font']} fills={sorted(set(lk['fills']))[:5]} {errs[:1]}")
        await pg.close()
    # Plantillas antiguas: se leen con el estilo equivalente y no rompen
    for old, new in (("classic", "ledger"), ("minimal", "editorial"), ("contrast", "signal"), ("compact", "clean"), ("ibcs", "editorial"), ("inexistente", "clean")):
        pg, errs = await page(b, W, H, {})
        await update(pg, dataview(objects={"style": {"template": old}, "series": {"named": 4}}), W, H)
        if old in ("classic", "ibcs"): await pg.screenshot(path=os.path.join(OUT, f"07b_plantilla_antigua_{old}.png"))
        lk = await pg.evaluate(LOOK)
        fm = await pg.evaluate("() => __v.getFormattingModel()")
        tpl = [sl for c in fm["cards"] if c["uid"] == "style_card" for g in c["groups"] for sl in g["slices"] if sl["uid"] == "style_template"][0]["control"]["properties"]
        ev = await pg.evaluate("() => __ev.join('')")
        ok_draw = len(lk["fills"]) > 0 and ev == "SF" and not errs
        ok_map = tpl["value"]["value"] == new and (new == "clean" or rgb(TOK[new][0]) in lk["bg"])
        check(f"plantilla antigua {old} -> {new}", ok_draw and ok_map, f"panel={tpl['value']['value']} bg={lk['bg'][:40]} ev={ev} {errs[:1]}")
        if old == "classic":
            items = [i["value"] for i in tpl["items"]]
            check("el desplegable ofrece solo los siete nuevos, sin (Pro)", items == ["clean"] + list(TOK) and not any("Pro" in i["displayName"] for i in tpl["items"]), str([i["displayName"] for i in tpl["items"]]))
        await pg.close()
    # Un ajuste tocado a mano gana al estilo; alto contraste gana al estilo
    pg, errs = await page(b, W, H, {})
    await update(pg, dataview(objects={"style": {"template": "boardroom"}, "legend": {"color": {"solid": {"color": "#FF0000"}}}, "series": {"named": 4}}), W, H)
    lk = await pg.evaluate(LOOK)
    check("ajuste a mano (color de la leyenda) gana al estilo; el resto, del estilo", set(lk["leg"]) == {"#FF0000"} and set(lk["col"]) == {"#F2F0E8"}, f"leg={set(lk['leg'])} col={set(lk['col'])}")
    await update(pg, dataview(objects={"style": {"template": "boardroom"}, "accessibility": {"highContrast": "on"}, "series": {"named": 4}}), W, H)
    await pg.screenshot(path=os.path.join(OUT, "07c_estilo_con_alto_contraste.png"))
    lk = await pg.evaluate(LOOK)
    check("alto contraste manda sobre el estilo", set(lk["fills"]) <= {"#FFFFFF", "#1F4E80"} and rgb("#FFFFFF") in lk["bg"] and lk["font"] == "", f"bg={lk['bg']} fills={set(lk['fills'])}")
    await pg.close()
    # Guía de configuración (paso 3): rejilla con los siete estilos, sin "(Pro)"
    pg, errs = await page(b, W, H, {})
    await update(pg, dataview(objects={"style": {"template": "aurora"}, "series": {"named": 4}}), W, H, view=1)
    for _ in range(3):
        btn = await pg.query_selector(".tcmk-g-main")
        if not btn: break
        if await pg.evaluate("() => document.querySelectorAll('.tcmk-g-chip').length") > 0: break
        await btn.click(); await pg.wait_for_timeout(200)
    await pg.screenshot(path=os.path.join(OUT, "07d_guia_rejilla_estilos.png"))
    chips = await pg.evaluate("() => Array.from(document.querySelectorAll('.tcmk-g-chip')).map(c => [c.textContent, c.getAttribute('aria-pressed')])")
    check("guía: siete estilos, Aurora marcado, sin (Pro)", [c[0] for c in chips] == ["Report theme", "Boardroom", "Ledger", "Editorial", "Signal", "Aurora", "Terrace"]
          and dict(chips).get("Aurora") == "true" and not any("Pro" in c[0] for c in chips), str(chips))
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
    await update(pg, dataview(objects={"style": {"template": "boardroom", "guide": False}, "series": {"named": 3}}), W, H, view=1)
    await pg.screenshot(path=os.path.join(OUT, "07e_estilo_gratis_sin_licencia.png"))
    wm = await pg.evaluate("() => getComputedStyle(document.querySelector('.tcviz-wm')).display")
    bg = await pg.evaluate("() => document.querySelector('.tcmk').style.background")
    check("estilo Boardroom gratis: sin licencia y editando, sin marca de agua", wm == "none" and "22, 38, 61" in bg, f"wm={wm} bg={bg}")
    check("sin errores de consola (free)", not errs, "; ".join(errs[:2]))
    await pg.close()


# ── Imágenes de la ficha (caso Begudes Nord) ─────────────────────────────────────────────────────────────────────────
# Datos reales de la demo (datos/demo_rtm/csv_en/fact_market.csv): mercado de bebidas por subcanal y fabricante,
# ene–sep 2026 frente a ene–sep 2025 (105,7 M€ frente a 97,5 M€, lo mismo que la página Market de DemoRTM_EN).
# "Report theme" con los colores del tema TCViz (datos/demo_rtm/tema/TCViz.json), como en las capturas de la demo.
TCVIZ_PAL = ['#2B6CB0', '#3E9C5B', '#D9A21B', '#C0392B', '#7A5FA8', '#5B9BD5', '#8BBF6A', '#E3B85A', '#6B6A63', '#A9C4E2', '#B5DABE', '#F0D9A0']
MFMT = '#,0"€"'


# Colores propios: Font Clara en gris (Format → Series), para que no se confunda con Iberia Drinks al atenuar las
# demás series; Begudes Nord con su color del tema (ámbar) como color de foco.
BN_COLORS = {"Font Clara": "#6B6A63"}


def bn_dataview(objects=None, cmp=False, zones=None, panel=False, colors=BN_COLORS, rule=None):
    """rule: función (subcanal, fabricante, cuota de la columna) -> color de la regla fx (series.cellColor por fila)."""
    d = json.load(io.open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "begudes_nord.json"), encoding="utf-8"))
    agg = {}
    for zone, ch, sub, man, v26, v25 in d["rows"]:
        if zones and zone not in zones: continue
        k = (zone if panel else "", sub, man)
        a = agg.setdefault(k, [0, 0]); a[0] += v26; a[1] += v25
    keys = sorted(agg, key=lambda k: ((zones.index(k[0]) if panel else 0), k[1], k[2]))
    cat = {"source": src("Subchannel", "Market.Subchannel", "category"), "values": [k[1] for k in keys]}
    ser = {"source": src("Manufacturer", "Market.Manufacturer", "series"), "values": [k[2] for k in keys]}
    if colors: ser["objects"] = [{"series": {"fill": {"solid": {"color": colors[k[2]]}}}} if k[2] in colors else {} for k in keys]
    cats = [cat, ser]
    if panel: cats.append({"source": src("Zone", "Market.Zone", "panel"), "values": [k[0] for k in keys]})
    values = [{"source": src("Market sales", "Sum(Market.Market sales)", "value", MFMT, True), "values": [agg[k][0] for k in keys]}]
    if rule:
        tot = {}
        for k in keys: tot[(k[0], k[1])] = tot.get((k[0], k[1]), 0) + agg[k][0]
        values[0]["objects"] = [{"series": {"cellColor": {"solid": {"color": rule(k[1], k[2], agg[k][0] / tot[(k[0], k[1])])}}}} for k in keys]
    if cmp: values.append({"source": src("Market sales PY", "Sum(Market.Market sales PY)", "comparison", MFMT, True), "values": [agg[k][1] for k in keys]})
    return {"metadata": {"columns": [c["source"] for c in cats] + [v["source"] for v in values], "objects": objects or {}},
            "categorical": {"categories": cats, "values": values}}


async def run_ficha(b):
    THEME = {"pal": TCVIZ_PAL, "fg": "#3D3929"}
    FOCUS = {"focus": {"name": "Begudes Nord", "color": {"solid": {"color": "#D9A21B"}}}}

    async def shot(name, W, H, objs, cmp=False, zones=None, panel=False, opts=THEME, bg="#FFFFFF", rule=None):
        pg, errs = await page(b, W, H, opts, bg)
        await update(pg, bn_dataview(objects=dict(objs, style=dict({"guide": False}, **objs.get("style", {}))), cmp=cmp, zones=zones, panel=panel, rule=rule), W, H)
        await pg.screenshot(path=os.path.join(OUT, f"ficha_{name}.png"))
        tt = await pg.evaluate("() => Array.from(document.querySelectorAll('svg text')).map(t => t.getBoundingClientRect().toJSON())")
        out = [r for r in tt if r["width"] > 0 and (r["left"] < -0.5 or r["top"] < -0.5 or r["right"] > W + 0.5 or r["bottom"] > H + 0.5)]
        wm = await pg.evaluate("() => { const e = document.querySelector('.tcviz-wm'); return e ? getComputedStyle(e).display : 'none'; }")
        ev = await pg.evaluate("() => __ev.join('')")
        check(f"ficha {name} ({W}x{H}): sin textos fuera, sin marca de agua, render 1:1", not out and wm == "none" and ev == "SF" and not errs,
              f"fuera={len(out)} wm={wm} ev={ev} {errs[:1]}")
        await pg.close()

    # Free (3 series con nombre + Others, sin nada de Pro) y Pro (seis series, Begudes Nord y cambio de cuota), mismo dato
    await shot("free", 620, 400, {"series": {"named": 3}})
    await shot("pro", 620, 400, FOCUS, cmp=True)
    # La mejor imagen: Pro completo con títulos de eje (1.0.1)
    await shot("hero", 980, 580, FOCUS, cmp=True)
    # La misma, al tamaño del hueco de la plantilla común de la infografía (texto legible a 1366x768)
    await shot("central", 820, 320, FOCUS, cmp=True)
    # Función Pro: small multiples por zona, a la misma escala
    await shot("sm", 980, 580, dict(FOCUS, smallMultiples={"columns": 2}), zones=["BCN Ciutat", "Girona", "Baix Llobregat", "Vallès"], panel=True)
    # Tres tamaños (D06): el mismo visual, misma configuración, Pro completo (frase, seis series y cambio de cuota).
    # Desde 1.0.1.0 los adornos ceden por orden al encoger y las celdas conservan el 55 % del alto: a 300x170 la frase
    # queda en una línea y la leyenda en una fila con "+N", con Begudes Nord primero.
    for nm, (w, h) in (("l", (900, 520)), ("m", (480, 300)), ("s", (300, 170))):
        await shot("size_" + nm, w, h, FOCUS, cmp=True)
        if nm == "s":
            pg, errs = await page(b, w, h, THEME)
            await update(pg, bn_dataview(objects=dict(FOCUS, style={"guide": False}), cmp=True), w, h)
            m = await pg.evaluate("""() => ({ cells: document.querySelector('.tcmk-cells').getBoundingClientRect().height,
                sum: document.querySelectorAll('.tcmk-summary text').length, sumTitle: document.querySelector('.tcmk-summary title')?.textContent || '',
                first: document.querySelector('.tcmk-legend g[data-series] text')?.textContent || '',
                more: document.querySelector('.tcmk-legend-more title')?.textContent || '' })""")
            check("D06 300x170 con frase y seis series: celdas >= 55 % del alto, frase en una línea con el texto completo en el title, "
                  "leyenda en una fila con la serie propia primero y +N con los nombres",
                  m["cells"] >= 0.53 * h and m["sum"] == 1 and m["sumTitle"].startswith("Begudes Nord holds") and m["first"].startswith("Begudes")
                  and m["more"].count(",") >= 1, str(m))
            await pg.close()
    # Estilos de la colección (todos gratis): con lo que dibuja la versión gratuita
    for st in ("boardroom", "ledger", "editorial", "signal", "aurora", "terrace"):
        await shot("style_" + st, 900, 520, {"style": {"template": st}, "series": {"named": 3}})
    # Novedades 1.0.1: tramas para distinguir series sin color, y color de celda con regla fx + tramas
    await shot("patterns", 620, 400, {"accessibility": {"dataPatterns": True}})
    # Color de celda con una regla fx (Begudes Nord: verde si tiene más del 25 % de la columna, rojo si menos del 12 %)
    # y las tramas que siguen diciendo de quién es cada celda
    bn_rule = lambda sub, man, sh: ("#3E9C5B" if sh > 0.25 else "#C0392B" if sh < 0.12 else "#2B6CB0") if man == "Begudes Nord" else "#D9D6CC"
    await shot("fx", 620, 400, {"accessibility": {"dataPatterns": True}}, rule=bn_rule)


async def main():
    os.makedirs(OUT, exist_ok=True)
    print("bundle:", GUID, "· modo", MODE)
    async with async_playwright() as p:
        b = await p.chromium.launch()
        if MODE == "free": await run_free(b)
        elif MODE == "ficha": await run_ficha(b)
        else: await run_pro(b)
        await b.close()
    bad = [r for r in results if not r[1]]
    print(f"{len(results) - len(bad)}/{len(results)} comprobaciones OK")
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    asyncio.run(main())
