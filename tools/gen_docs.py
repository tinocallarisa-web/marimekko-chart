# -*- coding: utf-8 -*-
"""Páginas publicadas (docs/) de Marimekko & Mekko Chart by TCViz (armazón del Radar).

Estilo, cabecera y buscador: los de Word Cloud (certificado), como Box & Whisker. El contenido describe lo que
hace el código; si cambia una función, cambiarla aquí y regenerar:   python tools/gen_docs.py
Para OKviz: "conditional formatting (fx)" y "dynamic format strings" van escritos tal cual (KPI Card 2.2 los perdió
por no estar escritos).
"""
import io, json, os, re, html

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WC = r"C:\tcviz\dev\WordCloud\docs"
NAME = "Marimekko & Mekko Chart by TCViz"
BASE = "https://tinocallarisa-web.github.io/marimekko-chart/"
REPO = "https://github.com/tinocallarisa-web/marimekko-chart"
VERSION = json.load(io.open(os.path.join(ROOT, "pbiviz.json"), encoding="utf-8"))["visual"]["version"]
FECHA = "2 November 2026"
VIDEO = "https://www.youtube.com/watch?v=s9qSTA-dvJw"

plantilla = io.open(os.path.join(WC, "privacy.html"), encoding="utf-8").read()
HEAD = plantilla[:plantilla.index("<body>")]
HEADER = plantilla[plantilla.index("<header>"):plantilla.index("</header>") + len("</header>")]
sup = io.open(os.path.join(WC, "support.html"), encoding="utf-8").read()
SCRIPT = sup[sup.rindex("<script"):sup.rindex("</script>") + len("</script>")]


def page(title, sub, body, nav="", search=False):
    head = HEAD.replace("Privacy Policy – Word Cloud by TCViz", f"{title} – {NAME}")
    hdr = HEADER.replace("Word Cloud by TCViz", NAME).replace(">Privacy Policy<", f">{html.escape(sub)}<")
    sb = ""
    if search:
        sb = '''<div class="searchbar">
  <div class="searchbox">
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"
         stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
    <input id="docsearch" type="search" placeholder="Search the documentation — try &quot;Others&quot;, &quot;focus&quot;, &quot;share&quot;…"
           autocomplete="off" aria-label="Search the documentation">
    <button id="searchclear" type="button" aria-label="Clear search" hidden>&times;</button>
  </div>
  <div id="searchstatus" class="search-status" role="status" aria-live="polite"></div>
</div>
'''
    foot = f'''<footer>
  <div style="margin-bottom:10px;">
    <a href="{BASE}support.html">Documentation</a>
    <a href="{BASE}privacy.html">Privacy Policy</a>
    <a href="{BASE}terms.html">Terms of Use</a>
    <a href="{BASE}changelog.html">Changelog</a>
    <a href="{REPO}/discussions" target="_blank">Discussions</a>
    <a href="{REPO}" target="_blank">GitHub</a>
    <a href="https://tcviz.com" target="_blank">tcviz.com</a>
  </div>
  <p>© 2026 TCViz · {NAME} · <a href="mailto:support@tcviz.com">support@tcviz.com</a></p>
</footer>
'''
    return (head + "<body>\n" + hdr + "\n" + nav + sb + body + foot + (SCRIPT if search else "") + "\n</body>\n</html>\n")


# ── Datos comunes ────────────────────────────────────────────────────────────

FIELDS = [
    ("Columns (segments)", "Grouping", "Yes", "The segments of the market: channel, region, category. Each column is as wide as its share of the total. A hierarchy gives drilldown. Up to 60 columns; with more, the first 60 are drawn and a note says so."),
    ("Series (stack)", "Grouping", "No, one field", "Who shares each segment: company, brand, competitor. Free names the 3 largest series and adds up the rest in Others; Pro names up to 12. Others is never dropped, so every column keeps its real 100%."),
    ("Value", "Measure", "Yes", "Sales, volume or units. One measure. Negative values are drawn as zero."),
    ("Comparison value", "Measure", "No — Pro, one measure", "The same measure for another period, such as last year: the change in share in percentage points on every cell and in the summary sentence."),
    ("Small multiples", "Grouping", "No — Pro, one field", "One chart per value — year, country, product line — all on the same scale."),
    ("Tooltips", "Measure", "No, up to 10", "Extra measures in the tooltip."),
]

FREE_PRO = [
    ("Marimekko columns at 100%: width = size of each segment, height = share inside it", "✓", "✓"),
    ("3 named series plus Others, which keeps every column at its real 100%", "✓", "✓"),
    ("Share labels (or series name and share), hidden when they do not fit", "✓", "✓"),
    ("Column totals with their % of the total; share axis with gridlines; legend top, bottom or right", "✓", "✓"),
    ("Order columns by data order or size; order series by size or data order", "✓", "✓"),
    ("Colours per series, Others label and colour, opacity, cell borders", "✓", "✓"),
    ("6 style templates, including IBCS style; setup guide inside the visual", "✓", "✓"),
    ("Tooltip with both readings: share of the column and % of the total", "✓", "✓"),
    ("Cross-filtering, highlight, bookmarks, drilldown, context menu, keyboard, high contrast", "✓", "✓"),
    ("Number format of the measure, dynamic format strings included; format on the canvas; 12 languages", "✓", "✓"),
    ("4 to 12 named series", "—", "✓"),
    ("Focus series: your company highlighted, the others dimmed, and a summary sentence (share, strongest and weakest segment)", "—", "✓"),
    ("Order columns by the share of the focus series", "—", "✓"),
    ("Change in share against a comparison period: points per cell and a sentence with the segment that explains it", "—", "✓"),
    ("Small multiples on a shared scale", "—", "✓"),
    ("Horizontal bars and absolute values (bar Mekko)", "—", "✓"),
    ("Labels with the value or the % of the total", "—", "✓"),
]

FORMAT = [
    ("Style template", "Clean, Classic, Minimal, Contrast, Compact, IBCS style. A template only fills what you have not set yourself. Setup guide: turn it back on to see the guide again."),
    ("Layout", "Columns (vertical) or bars (horizontal, Pro); values as 100% shares or absolute (bar Mekko, Pro); space between columns; order columns by data order, size or share of the focus series (Pro); order series by size or data order."),
    ("Series", "One colour per named series; number of named series (Free 3, Pro 12); Others label and colour; opacity; cell border colour and width."),
    ("Cell labels", "Show; share of the column or series name and share; % of the total, value, or value and share (Pro); text size; text colour (empty = automatic, white or dark depending on the cell); decimals of the share."),
    ("Column labels", "Show; text size and colour; bold. Long names are shortened to fit; the full name is in the tooltip."),
    ("Column totals", "Show the size of each column; also its % of the total; text size and colour."),
    ("Share axis", "Show; text size and colour; gridlines."),
    ("Focus series", "Name of a series (Pro), exactly as in the data; focus colour; dim the other series; summary sentence and its text size."),
    ("Comparison", "Show the change in share (Pro); gain and loss colours; change in the summary sentence."),
    ("Legend", "Show; position top, bottom or right; text size and colour."),
    ("Small multiples", "Columns (0 = automatic); space between panels; title size, colour and bold; panel background and border."),
    ("Background", "Colour of the whole visual."),
]

FAQ = [
    ("How do I read a Marimekko chart?",
     "<p>The width of each column is the size of the segment; the height of each cell is its share inside that segment; so the area of a cell is "
     "its share of the whole market. Above each column you see its size and its % of the total. Wide columns are the segments that matter; a "
     "small share in a wide column is the biggest opportunity.</p>"),
    ("What is Others?",
     "<p>The series beyond the named ones, added up. They are never dropped: every column still adds up to its real 100%, so the widths do not "
     "change. Free names the 3 largest series; Pro up to 12. Click Others to select every series inside it.</p>"),
    ("How do I highlight my company?",
     "<p>Type its name in <strong>Format → Focus series</strong> (Pro), exactly as it appears in the data. The other series are dimmed and a "
     "sentence summarises its share and its strongest and weakest segments. If no series has that name, a note says so.</p>"),
    ("How do I show the change in share?",
     "<p>Add the same measure for last year (for example with SAMEPERIODLASTYEAR) to <strong>Comparison value</strong> (Pro). Each cell shows the "
     "change in its share in percentage points, and the summary sentence adds the total change and the segment that explains most of it.</p>"),
    ("Share of the column or % of the total?",
     "<p>Both are true. The share of the column answers who leads each segment; the % of the total answers how big that cell is in the whole "
     "market. The tooltip always shows both; the cell labels show one of them.</p>"),
    ("Why does a column look narrow?",
     "<p>Column widths are shares of what is in the chart, so they always add up to 100% of the filtered total. If a slicer or another visual "
     "filters the data, the widths follow that filter.</p>"),
    ("Can I use bars instead of columns, or absolute values?",
     "<p>Yes, in <strong>Format → Layout</strong> (Pro). Absolute values (bar Mekko) draw each column as tall as its size, so you compare "
     "both the size and the mix.</p>"),
    ("How many rows can it use?",
     "<p>Power BI sends up to 30,000 combinations of column, series and panel at a time. In the Power BI service the visual asks for further "
     "blocks, up to 20 more; in Power BI Desktop it uses the first block. A warning icon in the visual header says when rows were left out.</p>"),
    ("Do bookmarks keep my settings?",
     "<p>Bookmarks keep the cells you select and the filters of the page. Like every Power BI visual, they do not keep formatting.</p>"),
    ("What is the \"Pro preview\" watermark?",
     "<p>While you edit a report without a licence, Pro features you turn on are drawn working under a watermark that names them, and Power BI "
     "shows its licence notice. Reading view shows the free result, with a small note naming the Pro features it leaves out. Where Power BI "
     "provides no licence information (for example when you are not signed in to Power BI Desktop), the free result is shown.</p>"),
    ("How do I get Pro?",
     "<p>On the visual's Microsoft AppSource page, choose <strong>Buy now</strong> (not Install free). Licences are per user and managed by "
     "Microsoft; restart Power BI Desktop after the licence is assigned. See <a href=\"https://tcviz.com/licensing.html\">tcviz.com/licensing</a>.</p>"),
    ("How are numbers formatted?",
     "<p>With the number format of the measure from the model, <strong>dynamic format strings</strong> included, in the report's language; "
     "sizes in totals and in the sentence are shortened (40.2 M).</p>"),
    ("Is my data sent anywhere?",
     "<p>No. The visual makes no network requests and stores nothing outside your report. The links on the start screen open only when you click "
     "them, through Power BI.</p>"),
]


def table(headers, rows):
    th = "".join(f"<th>{html.escape(h)}</th>" for h in headers)
    trs = "".join("<tr>" + "".join(f"<td>{c}</td>" for c in r) + "</tr>" for r in rows)
    return f"<table><thead><tr>{th}</tr></thead><tbody>{trs}</tbody></table>"


def support():
    nav = '''<nav>
  <a href="#quickstart" class="active">Quick Start</a>
  <a href="#read">How to read it</a>
  <a href="#fields">Field Wells</a>
  <a href="#freepro">Free and Pro</a>
  <a href="#format">Format Pane</a>
  <a href="#interaction">Selection</a>
  <a href="#accessibility">Accessibility</a>
  <a href="#faq">FAQ</a>
  <a href="changelog.html">Changelog</a>
  <a href="#contact">Contact</a>
</nav>
'''
    video = (f'<div class="video-wrap"><iframe src="https://www.youtube.com/embed/{VIDEO.split("v=")[-1]}" title="{NAME} video" '
             f'allowfullscreen></iframe></div>') if VIDEO else ""
    faq = "".join(f'<details><summary>{html.escape(q)}</summary><div class="faq-body">{a}</div></details>' for q, a in FAQ)
    body = f'''<div class="wrap">

<div class="verpill">Visual v{VERSION} &nbsp;·&nbsp; docs updated {FECHA} &nbsp;·&nbsp; <a href="changelog.html">what's new</a></div>

<p class="lead">A Marimekko (Mekko) chart for market structure: the width of each column is the size of the segment, the stack is who
shares it. It answers "where are we strong in a big market?". The free version draws the full chart with three named series and Others.
<strong>Pro</strong> adds up to 12 series, your company highlighted with a summary sentence, the change in share against a prior period,
small multiples, horizontal bars, absolute values and labels with the value or the % of the total.</p>
{video}
<h2 id="quickstart">Quick Start</h2>
<div class="card">
<ol style="padding-left:20px;font-size:14px;color:var(--t2)">
<li>Add <strong>{html.escape(NAME)}</strong> to the page. With no fields it shows a start screen with these steps.</li>
<li>Drag the segments of the market to <strong>Columns</strong> — channel, region, category.</li>
<li>Drag who shares them to <strong>Series</strong> — company, brand, competitor — and the sales or volume to <strong>Value</strong>.</li>
<li>The setup guide in the corner lists the optional fields and the style templates.</li>
<li>Pro: type your company in <strong>Format → Focus series</strong> and add last year to <strong>Comparison value</strong>.</li>
</ol>
</div>

<h2 id="read">How to read it</h2>
<div class="card">
<figure style="margin:0 0 14px">
<svg viewBox="0 0 640 230" role="img" aria-label="Annotated Marimekko chart: column widths, shares, Others and a focus series" style="width:100%;max-width:640px;display:block;margin:0 auto">
  <g font-family="Segoe UI, sans-serif" font-size="12" fill="#535146">
    <g stroke="#FFFFFF" stroke-width="2">
      <rect x="20" y="30" width="130" height="60" fill="#C8C6C4"/><rect x="20" y="90" width="130" height="50" fill="#3E9C5B"/><rect x="20" y="140" width="130" height="30" fill="#2B6CB0"/><rect x="20" y="170" width="130" height="40" fill="#D9A21B"/>
      <rect x="152" y="30" width="90" height="40" fill="#C8C6C4"/><rect x="152" y="70" width="90" height="40" fill="#3E9C5B"/><rect x="152" y="110" width="90" height="70" fill="#2B6CB0"/><rect x="152" y="180" width="90" height="30" fill="#D9A21B"/>
      <rect x="244" y="30" width="50" height="50" fill="#C8C6C4"/><rect x="244" y="80" width="50" height="60" fill="#3E9C5B"/><rect x="244" y="140" width="50" height="35" fill="#2B6CB0"/><rect x="244" y="175" width="50" height="35" fill="#D9A21B"/>
    </g>
    <text x="85" y="22" text-anchor="middle">120 M (45%)</text><text x="197" y="22" text-anchor="middle">90 M (34%)</text><text x="269" y="22" text-anchor="middle">55 M</text>
    <text x="85" y="225" text-anchor="middle">Supermarket</text><text x="197" y="225" text-anchor="middle">Bars</text><text x="269" y="225" text-anchor="middle">Other</text>
    <text x="320" y="40" font-weight="700" fill="#252423">Width</text><text x="320" y="56">the size of each segment, with its % of the total</text>
    <text x="320" y="86" font-weight="700" fill="#252423">Height of a cell</text><text x="320" y="102">its share inside the segment; its area = share of the market</text>
    <text x="320" y="132" font-weight="700" fill="#2B6CB0">Focus series (Pro)</text><text x="320" y="148">your company highlighted, with a summary sentence</text>
    <text x="320" y="178" font-weight="700" fill="#83827D">Others</text><text x="320" y="194">the series beyond the named ones, never dropped</text>
  </g>
</svg>
</figure>
<p>Read it twice: across, which segments are big; up, who leads each one. A small share in a wide column is the biggest opportunity; a big
share in a narrow column does not move the total much.</p>
</div>

<h2 id="fields">Field Wells</h2>
{table(["Field", "Kind", "Required", "What it does"], [(f"<strong>{a}</strong>", b, c, d) for a, b, c, d in FIELDS])}

<h2 id="freepro">Free and Pro</h2>
{table(["Capability", "Free", "Pro"], FREE_PRO)}
<p>Turn on a Pro capability without a licence while editing and it is drawn working under a "Pro preview" watermark that names it.
Reading view shows the free result. Pro is sold per user on Microsoft AppSource.</p>

<h2 id="format">Format Pane</h2>
{table(["Card", "Settings"], [(f"<strong>{a}</strong>", b) for a, b in FORMAT])}
<p>Format on the canvas: in format mode, click the cells, the column labels, the share axis, the legend, the summary sentence or the background to format them where they are.</p>

<h2 id="interaction">Selection and interaction</h2>
<div class="card">
<ul>
<li>Click a cell to filter the rest of the page by its column and series; click a column label to select the whole column, or a legend item to select the whole series. Ctrl/Cmd + click adds; click again or click the background to clear.</li>
<li>Others carries every series inside it: selecting it filters by all of them.</li>
<li>Highlight: when another visual filters this one, the cells that are not highlighted are dimmed.</li>
<li>Bookmarks restore the selection. Right-click opens the Power BI context menu. A hierarchy in Columns gives drilldown.</li>
<li>When the report author turns interactions off, clicks do not filter.</li>
</ul>
</div>

<h2 id="accessibility">Accessibility</h2>
<div class="card">
<ul>
<li>Keyboard: Tab into the visual, arrows move between cells, Home/End jump to the first/last, Enter or Space selects, Esc clears, the context-menu key opens the menu. The tooltip opens on the focused cell.</li>
<li>Each cell has a description for screen readers with its column, series, value and share; the chart describes its columns and series.</li>
<li>High contrast: the visual uses the colours of the Windows contrast theme, with every cell outlined; the focus series is drawn in the selection colour.</li>
<li>The layout adapts to the size of the visual: labels are hidden when they do not fit, names are shortened, totals and axis are dropped in small panels, and the start screen has three layouts.</li>
</ul>
</div>

<h2 id="faq">FAQ</h2>
{faq}

<h2 id="contact">Contact</h2>
<div class="contact-box"><div class="icon">✉</div><div>
<h3>Questions, bugs, ideas</h3>
<p>Write to <a href="mailto:support@tcviz.com">support@tcviz.com</a> or open a thread in <a href="{REPO}/discussions" target="_blank">GitHub Discussions</a>.</p>
</div></div>

</div>
'''
    return page("Documentation", "Documentation", body, nav=nav, search=True)


def privacy():
    body = f'''<div class="wrap prose">
<h1>Privacy Policy</h1>
<p><strong>Last updated:</strong> {FECHA} (version {VERSION})</p>
<h2>1. Overview</h2>
<p>{NAME} is a Power BI custom visual developed by TCViz (Tino Callarisa). This policy describes how data is handled when you use it.</p>
<h2>2. Data collection</h2>
<p>The visual <strong>does not collect, transmit or store any data</strong>. Every calculation — column widths, shares, the change in share, the summary sentence —
happens inside Power BI, on the data of your report.</p>
<h2>3. No network access</h2>
<p>The visual declares <strong>no network privileges</strong> (<code>"privileges": []</code>), so Power BI does not let it make any web request.
The icon on the start screen is bundled inside the visual.</p>
<p>The <em>Guide</em> and <em>Product page</em> links on the start screen ask Power BI to open those pages in your browser, only when you click
them (Power BI Desktop asks first). The visual sends nothing.</p>
<h2>4. Cookies and storage</h2>
<p>No cookies and no browser storage. Formatting settings are saved in your report by Power BI, like those of any visual.</p>
<h2>5. Licensing</h2>
<p>To know whether you have a Pro licence, the visual asks Microsoft's licensing API in Power BI (<code>IVisualLicenseManager</code>). TCViz receives
no data from this check. See the <a href="https://privacy.microsoft.com/privacystatement">Microsoft Privacy Statement</a>.</p>
<h2>6. Third parties</h2>
<p>No analytics, tracking or advertising.</p>
<h2>7. Contact</h2>
<p><a href="mailto:support@tcviz.com">support@tcviz.com</a></p>
</div>
'''
    return page("Privacy Policy", "Privacy Policy", body)


def terms():
    free = "; ".join(r[0][0].lower() + r[0][1:] for r in FREE_PRO if r[1] == "✓")
    pro = "; ".join(r[0][0].lower() + r[0][1:] for r in FREE_PRO if r[1] == "—")
    body = f'''<div class="wrap prose">
<h1>Terms of Use</h1>
<p><strong>Effective date:</strong> {FECHA} &nbsp;·&nbsp; applies to version {VERSION} and later</p>
<h2>1. Acceptance</h2>
<p>By installing or using {NAME} ("the Visual"), you agree to these Terms of Use. If you do not agree, do not install or use the Visual.</p>
<h2>2. License grant</h2>
<p>TCViz grants you a non-exclusive, non-transferable, revocable license to use the Visual within Microsoft Power BI, subject to these Terms
and any applicable Microsoft AppSource subscription terms.</p>
<p><strong>Free tier:</strong> available to all users at no cost. Includes: {html.escape(free)}.</p>
<p><strong>Pro tier:</strong> available through a Microsoft AppSource subscription, licensed per user. Adds: {html.escape(pro)}.
Without an active licence, Pro features are shown in edit mode only, as a preview marked with a watermark; reading view shows the free result.</p>
<h2>3. Restrictions</h2>
<ul>
<li>Do not reverse-engineer, decompile or disassemble the Visual, except where applicable law permits it.</li>
<li>Do not redistribute, resell, sublicense or transfer the Visual.</li>
<li>Do not remove or alter proprietary notices, branding or watermarks.</li>
<li>Do not use the Visual in breach of applicable laws.</li>
</ul>
<h2>4. Intellectual property</h2>
<p>The Visual, including its source code, design and documentation, is the intellectual property of TCViz. The source code is published on
GitHub for transparency and review; publication does not grant a licence to copy it or to build competing products.</p>
<h2>5. Disclaimer of warranties</h2>
<p>The Visual is provided "as is", without warranty of any kind, express or implied, including merchantability, fitness for a particular
purpose and non-infringement. TCViz does not warrant that the Visual will be error-free or uninterrupted.</p>
<h2>6. Limitation of liability</h2>
<p>To the maximum extent permitted by law, TCViz shall not be liable for any indirect, incidental, special, consequential or punitive damages
arising from the use of, or inability to use, the Visual.</p>
<h2>7. Updates</h2>
<p>TCViz may update the Visual and these Terms. Updated Terms are posted at this address with a new date; continued use means acceptance.</p>
<h2>8. Governing law</h2>
<p>These Terms are governed by the laws of Spain. Any dispute shall be resolved in the courts of Barcelona, Spain.</p>
<h2>9. Contact</h2>
<p><a href="mailto:support@tcviz.com">support@tcviz.com</a></p>
</div>
'''
    return page("Terms of Use", "Terms of Use", body)


def changelog():
    md = io.open(os.path.join(ROOT, "CHANGELOG.md"), encoding="utf-8").read()
    partes = re.split(r"^## ", md, flags=re.M)[1:]
    bloques = []
    for p in partes:
        cab, _, cuerpo = p.partition("\n")
        items = "".join(f"<li>{html.escape(l[2:].strip())}</li>" for l in cuerpo.splitlines() if l.startswith("- "))
        bloques.append(f'<div class="card"><h3>{html.escape(cab.strip())}</h3><ul>{items}</ul></div>')
    body = f'<div class="wrap prose"><h1>Changelog</h1><p>{NAME} · current version {VERSION}</p>{"".join(bloques)}</div>\n'
    return page("Changelog", "Changelog", body)


def main():
    os.makedirs(os.path.join(ROOT, "docs"), exist_ok=True)
    for nombre, f in (("support.html", support), ("privacy.html", privacy), ("terms.html", terms), ("changelog.html", changelog)):
        io.open(os.path.join(ROOT, "docs", nombre), "w", encoding="utf-8", newline="\n").write(f())
    io.open(os.path.join(ROOT, "docs", "index.html"), "w", encoding="utf-8", newline="\n").write(
        f'<!DOCTYPE html><meta charset="utf-8"><meta http-equiv="refresh" content="0; url=support.html"><title>{NAME}</title><a href="support.html">Documentation</a>\n')
    print("docs:", sorted(os.listdir(os.path.join(ROOT, "docs"))))


if __name__ == "__main__":
    main()
