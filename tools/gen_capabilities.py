# -*- coding: utf-8 -*-
"""Genera capabilities.json y tools/caps_en.json a partir de una sola definición.

Las demás lenguas salen de tools/i18n.py (mismas claves). Ejecutar desde la raíz del repo:
    python tools/gen_capabilities.py && python tools/extract_ui.py && python tools/i18n.py
"""
import io, json, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

ROLES = [
    ("category", "Columns (segments)", "Grouping", "The segments of the market: channel, region, category. Each column is as wide as its share of the total."),
    ("series", "Series (stack)", "Grouping", "Who shares each segment: company, brand, competitor. Free names 3 and sums the rest in Others; Pro up to 12."),
    ("value", "Value", "Measure", "Sales, volume or units. One measure."),
    ("comparison", "Comparison value (Pro)", "Measure", "The same measure for another period, for the change in share in percentage points."),
    ("panel", "Small multiples (Pro)", "Grouping", "One chart per value, on a shared scale."),
    ("tooltips", "Tooltips", "Measure", "Extra values in the tooltip, up to 10."),
]

def E(*items):
    return [{"value": v, "displayName": n, "displayNameKey": k} for v, k, n in items]

# (objeto, nombre, [(prop, nombre, tipo)])  tipo: bool | num | text | color | colorfx | enum:[...]
OBJECTS = [
    ("style", "Style template", [
        ("template", "Template", E(("clean", "Enum_tpl_clean", "Clean"), ("classic", "Enum_tpl_classic", "Classic"),
                                    ("minimal", "Enum_tpl_minimal", "Minimal"), ("contrast", "Enum_tpl_contrast", "Contrast"),
                                    ("compact", "Enum_tpl_compact", "Compact"), ("ibcs", "Enum_tpl_ibcs", "IBCS style"))),
        ("guide", "Setup guide", "bool"),
    ]),
    ("layout", "Layout", [
        ("orientation", "Orientation", E(("vertical", "Enum_or_vertical", "Columns (vertical)"), ("horizontal", "Enum_or_horizontal", "Bars (horizontal)"))),
        ("mode", "Values", E(("percent", "Enum_md_percent", "100% (share)"), ("absolute", "Enum_md_absolute", "Absolute (bar Mekko)"))),
        ("gap", "Space between columns", "num"),
        ("sortColumns", "Order columns by", E(("data", "Enum_sc_data", "Data order"), ("size", "Enum_sc_size", "Size"),
                                             ("focus", "Enum_sc_focus", "Share of the focus series (Pro)"))),
        ("sortSeries", "Order series by", E(("size", "Enum_ss_size", "Size"), ("data", "Enum_ss_data", "Data order"))),
    ]),
    ("series", "Series", [
        ("named", "Named series (Free 3, Pro 12)", "num"),
        ("othersLabel", "Others label", "text"),
        ("othersColor", "Others color", "color"),
        ("fill", "Color", "colorfx"),
        ("opacity", "Opacity %", "num"),
        ("borderColor", "Cell border color", "color"),
        ("borderWidth", "Cell border width", "num"),
    ]),
    ("labels", "Cell labels", [
        ("show", "Show", "bool"),
        ("content", "Show", E(("share", "Enum_lc_share", "Share of the column"), ("total", "Enum_lc_total", "% of the total"), ("value", "Enum_lc_value", "Value"), ("both", "Enum_lc_both", "Value and share"),
                              ("name", "Enum_lc_name", "Series name and share"))),
        ("fontSize", "Text size", "num"),
        ("color", "Text color (empty = automatic)", "color"),
        ("decimals", "Decimals of the share", "num"),
    ]),
    ("columnLabels", "Column labels", [
        ("show", "Show", "bool"),
        ("fontSize", "Text size", "num"),
        ("color", "Text color", "color"),
        ("bold", "Bold", "bool"),
    ]),
    ("totals", "Column totals", [
        ("show", "Show the size of each column", "bool"),
        ("percent", "Also its % of the total", "bool"),
        ("fontSize", "Text size", "num"),
        ("color", "Text color", "color"),
    ]),
    ("axis", "Share axis", [
        ("show", "Show", "bool"),
        ("fontSize", "Text size", "num"),
        ("color", "Text color", "color"),
        ("gridlines", "Gridlines", "bool"),
    ]),
    ("focus", "Focus series", [
        ("name", "Focus series (Pro): name of a series", "text"),
        ("color", "Focus color", "color"),
        ("dimOthers", "Dim the other series", "bool"),
        ("summary", "Summary sentence", "bool"),
        ("fontSize", "Sentence text size", "num"),
    ]),
    ("comparison", "Comparison", [
        ("showChange", "Show the change in share (Pro)", "bool"),
        ("positiveColor", "Gain color", "color"),
        ("negativeColor", "Loss color", "color"),
        ("sentence", "Change in the summary sentence", "bool"),
    ]),
    ("legend", "Legend", [
        ("show", "Show", "bool"),
        ("position", "Position", E(("top", "Enum_lg_top", "Top"), ("bottom", "Enum_lg_bottom", "Bottom"), ("right", "Enum_lg_right", "Right"))),
        ("fontSize", "Text size", "num"),
        ("color", "Text color", "color"),
    ]),
    ("smallMultiples", "Small multiples", [
        ("columns", "Columns (0 = automatic)", "num"),
        ("gap", "Space between panels", "num"),
        ("titleSize", "Title size", "num"),
        ("titleColor", "Title color", "color"),
        ("titleBold", "Bold title", "bool"),
        ("background", "Panel background", "color"),
        ("border", "Panel border", "bool"),
        ("borderColor", "Panel border color", "color"),
    ]),
    ("background", "Background", [
        ("color", "Color", "color"),
    ]),
]

def ptype(t):
    if t == "bool": return {"bool": True}
    if t == "num": return {"numeric": True}
    if t == "text": return {"text": True}
    if t in ("color", "colorfx"): return {"fill": {"solid": {"color": True}}}
    return {"enumeration": t}

def main():
    en = {}
    roles = []
    for name, disp, kind, desc in ROLES:
        k = f"Role_{name}"
        en[k] = disp; en[k + "_Desc"] = desc
        roles.append({"name": name, "kind": kind, "displayName": disp, "displayNameKey": k,
                      "description": desc, "descriptionKey": k + "_Desc"})
    objects = {}
    for obj, disp, props in OBJECTS:
        en[f"Obj_{obj}"] = disp
        p = {}
        for prop, pd, t in props:
            key = f"Prop_{obj}_{prop}"
            en[key] = pd
            p[prop] = {"displayName": pd, "displayNameKey": key, "type": ptype(t)}
            if isinstance(t, list):
                for it in t: en[it["displayNameKey"]] = it["displayName"]
        objects[obj] = {"displayName": disp, "displayNameKey": f"Obj_{obj}", "properties": p}
    caps = {
        "dataRoles": roles,
        "dataViewMappings": [{
            "conditions": [{"category": {"max": 1}, "series": {"max": 1}, "value": {"max": 1}, "comparison": {"max": 1},
                            "panel": {"max": 1}, "tooltips": {"max": 10}}],
            "categorical": {
                "categories": {
                    # una fila por columna × serie × panel: cada celda lleva su propia identidad
                    "select": [{"bind": {"to": "category"}}, {"bind": {"to": "series"}}, {"bind": {"to": "panel"}}],
                    "dataReductionAlgorithm": {"window": {"count": 30000}},
                },
                "values": {
                    "select": [{"bind": {"to": "value"}}, {"bind": {"to": "comparison"}}, {"bind": {"to": "tooltips"}}],
                },
            },
        }],
        "objects": objects,
        "tooltips": {"supportedTypes": {"default": True, "canvas": True}, "roles": ["tooltips"]},
        "drilldown": {"roles": ["category"]},
        "sorting": {"default": {}},
        "supportsHighlight": True,
        "supportsLandingPage": True,
        "supportsEmptyDataView": True,
        "supportsKeyboardFocus": True,
        "supportsMultiVisualSelection": True,
        "privileges": [],
        "supportsOnObjectFormatting": True,
        "enablePointerEventsFormatMode": True,
    }
    io.open(os.path.join(ROOT, "capabilities.json"), "w", encoding="utf-8", newline="\n").write(
        json.dumps(caps, indent=2, ensure_ascii=False) + "\n")
    io.open(os.path.join(ROOT, "tools", "caps_en.json"), "w", encoding="utf-8", newline="\n").write(
        json.dumps(en, indent=2, ensure_ascii=False) + "\n")
    print("capabilities.json:", len(roles), "roles,", len(objects), "objects,", len(en), "keys")

if __name__ == "__main__":
    main()
