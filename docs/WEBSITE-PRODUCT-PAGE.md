# Website product page — Marimekko & Mekko Chart by TCViz 1.0.0.0

Entry for `C:\tcviz\web\src\data.jsx` (array `PRODUCTS`, after `radar-chart`). **Paste it when Microsoft publishes the
offer**, not before: the AppSource link 404s until then and any web publish in between would carry it (skill
`tcviz-publicada`). Then: icon `logos/icons/marimekko-chart.png`, screenshot and infographic with
`node scripts/screenshots.js`, the guide is generated from this entry by `scripts/guides.js`, `node scripts/build.js`.

The infographic of the web is generated from this entry (`datos/demo_rtm/infografias.py`): correct the entry, not the image.

```js
  {
    id: "marimekko-chart",
    docs: "https://tinocallarisa-web.github.io/marimekko-chart/support.html",
    certified: false,
    screenshot: "/logos/screenshots/marimekko-chart.png?v=1",
    infographic: "/logos/screenshots/marimekko-chart-infographic.png?v=1",
    appSource: "https://marketplace.microsoft.com/en-us/product/tino_callarisa.marimekko-tcviz?tab=Overview",
    youtube: "https://www.youtube.com/watch?v=s9qSTA-dvJw",
    guide: "/guides/marimekko-chart.html",
    name: "Marimekko & Mekko Chart by TCViz",
    icon: "/logos/icons/marimekko-chart.png",
    tagline: "Marimekko (Mekko) chart for Power BI: segment size as width, share as height, your company in focus.",
    category: "Comparison",
    price: 0.99,
    noTrial: true,
    version: "1.0.0.0",
    updated: "2026-11-02",
    downloads: 0,
    rating: 0,
    tags: ["Marimekko chart", "Mekko chart", "Market share", "Market map"],
    summary: "A stacked chart tells you who leads each segment, not which segments matter: a strong position in a small channel looks as good as one in the channel that carries half the market. Marimekko & Mekko Chart by TCViz draws both at once — the width of each column is the size of the segment, the stack is who shares it — so the area of every cell is its share of the whole market. Power BI has no built-in Marimekko chart. Pro adds more series, your company highlighted with a summary sentence, the change in share against last year, small multiples and more.",
    features: [
      { id: "F01", name: "Width is size", desc: "Each column is as wide as its segment, with its total and its % of the market above it.", free: true, pro: true },
      { id: "F02", name: "Others keeps the 100%", desc: "The series beyond the named ones are added up, never dropped, so every column keeps its real 100%.", free: true, pro: true },
      { id: "F03", name: "Both readings", desc: "Share labels in the cells; the tooltip gives the share of the column and the % of the total.", free: true, pro: true },
      { id: "F04", name: "Ordering", desc: "Columns by size or data order; series by size or data order.", free: true, pro: true },
      { id: "F05", name: "Named series", desc: "Series drawn with their own colour; the rest in Others.", free: "3", pro: "12" },
      { id: "F06", name: "Styling", desc: "6 templates incl. IBCS style, colours per series, Others label and colour, opacity, cell borders.", free: true, pro: true },
      { id: "F07", name: "Native interactions", desc: "Click a cell, a column or a series to filter; highlight, bookmarks, drilldown, context menu, keyboard, high contrast.", free: true, pro: true },
      { id: "F08", name: "Number format and 12 languages", desc: "The number format of the measure, dynamic format strings included; Format pane and texts in 12 languages.", free: true, pro: true },
      { id: "F09", name: "Focus series", desc: "Your company highlighted, the others dimmed, and a sentence: its share, strongest and weakest segment. Columns ordered by its share.", free: false, pro: true },
      { id: "F10", name: "Change in share", desc: "Against last year or any comparison period: points on every cell and the segment that explains the change.", free: false, pro: true },
      { id: "F11", name: "Small multiples", desc: "One Mekko per year, country or product line, on a shared scale.", free: false, pro: true },
      { id: "F12", name: "Bars and bar Mekko", desc: "Horizontal bars; absolute values, so each column is as tall as its size.", free: false, pro: true },
      { id: "F13", name: "Value and % of total labels", desc: "Cell labels with the value, the % of the total, or value and share.", free: false, pro: true }
    ],
    dataRoles: [
      { role: "Columns (segments)", kind: "Grouping", required: true, desc: "The segments of the market: channel, region, category. Up to 60 columns." },
      { role: "Series (stack)", kind: "Grouping", required: false, desc: "Who shares each segment: company, brand, competitor. Free 3 named, Pro 12." },
      { role: "Value", kind: "Measure", required: true, desc: "Sales, volume or units." },
      { role: "Comparison value (Pro)", kind: "Measure", required: false, desc: "The same measure for another period: the change in share." },
      { role: "Small multiples (Pro)", kind: "Grouping", required: false, desc: "One chart per value, on a shared scale." },
      { role: "Tooltips", kind: "Measure", required: false, desc: "Extra measures in the tooltip." }
    ],
    quickStart: [
      "Install Marimekko & Mekko Chart by TCViz from Microsoft AppSource",
      "Drag the segments of the market into Columns and sales into Value",
      "Drag who shares them into Series: company, brand, competitor",
      "Follow the setup guide in the corner; with Pro, type your company in Focus series"
    ],
    freemium: {
      free: "A complete Marimekko chart: columns at 100% with three named series plus Others, share labels, column totals with their % of the total, share axis, legend, ordering, six templates including IBCS style, filtering, highlight, bookmarks, drilldown, keyboard, high contrast and 12 languages.",
      pro: [
        "4 to 12 named series",
        "Your company highlighted, with a summary sentence",
        "Change in share against a comparison period",
        "Columns ordered by your share",
        "Small multiples on a shared scale",
        "Horizontal bars and absolute values (bar Mekko)",
        "Labels with the value or the % of the total"
      ]
    },
    formattingPane: [
      { group: "Style", items: "Clean, Classic, Minimal, Contrast, Compact, IBCS style; setup guide" },
      { group: "Layout", items: "Columns or bars (Pro); 100% or absolute (Pro); space between columns; order of columns and series" },
      { group: "Series", items: "Colour per series, number of named series, Others label and colour, opacity, cell borders" },
      { group: "Labels", items: "Cell labels: share, name and share; value or % of the total (Pro); decimals; column labels and totals" },
      { group: "Axis and legend", items: "Share axis with gridlines; legend top, bottom or right" },
      { group: "Focus and comparison (Pro)", items: "Focus series, colour, dim the others, summary sentence; change in share, gain and loss colours" },
      { group: "Small multiples (Pro)", items: "Columns, gap, title size, colour and bold, panel background and border" }
    ]
  },
```
