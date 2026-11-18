# Changelog — Marimekko & Mekko Chart by TCViz

## 1.0.1.0 — November 2026
- Cell labels can be bold (Format → Cell labels → Bold).
- With more than five series, each style gives every series its own colour: the sixth no longer repeats the first.
- Small visuals keep the chart: the cells keep at least 55% of the height. When space runs out the summary sentence folds to one line (the full sentence shows on hover), the legend folds to one row with "+N" (the focus series first; hover the "+N" to see the rest), then axis titles and column totals step aside, and only then the sentence. Nothing disappears without a trace.
- Change in share is easier to read on every cell and style, dark ones included: green and red keep their tone but are lightened or darkened until they read on the cell (dimmed cells included); "±0.0 pp" uses the label colour. In high contrast, labels use the theme colours.
- The focus colour no longer blends in: if the default or style colour matches, or is very close to, another series (full or dimmed), the focus series takes a colour that stands apart. A focus colour you pick yourself is always kept. Dimmed series also keep their differences, so a sixth series no longer looks like the first once dimmed.
- Style templates are now the same as the rest of the TCViz collection: Report theme (follows the theme of the report) plus Boardroom, Ledger, Editorial, Signal, Aurora and Terrace, with the same colours, background and font as Treemap, Line Chart and the other visuals, so a page reads as one report. All seven are free. They colour the cells, Others, column labels, totals, axis and axis titles, legend, focus series, change in share and small multiples, and only fill what you have not set yourself; high contrast always wins. Reports saved with the 1.0.0 templates open with the closest style (Classic → Ledger, Minimal → Editorial, Contrast → Signal, Compact → Report theme, IBCS style → Editorial).
- Dynamic format strings per cell: labels, tooltip and screen-reader description use the format of each cell (for example euros in one column and dollars in another); column totals use the format their cells share.
- Conditional formatting (fx) of the cell colour: Format → Series → Cell color takes a fixed colour or a rule (gradient, rules or field value) evaluated for each cell.
- New Accessibility card: high contrast automatic or on, keyboard focus colour and width, minimum text size, pattern on Others and patterns on every series to tell them apart without colour; in high contrast each series gets its own pattern.
- Axis titles: the columns axis says what the width measures ("Channel (width = size)") and the share axis "Share of column" (the measure name with absolute values); your own text, size and colour in Column labels and Share axis. They follow the minimum text size and high contrast, and fit small visuals.
- Reset to default on every format card also clears the colours per series.
- The "Pro preview" watermark is the one common to every TCViz visual: easier to read over the chart.

## 1.0.0.0 — November 2026
- First release: Marimekko columns at 100% where the width is the size of each segment and the height its share.
- Free: 3 named series plus Others (which keeps every column at its real 100%), share labels, column totals with their % of the total, share axis, legend, ordering by size or data order.
- Pro: 4 to 12 named series; focus series with the others dimmed and a summary sentence; change in share against a comparison period; small multiples; horizontal bars; absolute values (bar Mekko); value and % of the total labels.
- Pro preview: while editing without a licence, Pro features are drawn working under a watermark that names them; reading view shows the free result.
- 6 style templates (including IBCS style), setup guide inside the visual, start screen in three sizes.
- Cross-filtering with every identity of a cell, highlight, bookmarks, drilldown, context menu, keyboard navigation, screen-reader labels, high contrast, format on the canvas.
- Number format of the measure, dynamic format strings included; 12 languages.
- No network requests and no privileges.
