# Marimekko & Mekko Chart by TCViz

A Power BI custom visual: a Marimekko (Mekko) chart for market structure — the width of each column is the size of the segment,
the stack is who shares it. The free version names 3 series plus Others, which keeps every column at its real 100%; Pro adds up
to 12 series, your company highlighted with a summary sentence, the change in share against a comparison period, small
multiples, horizontal bars, absolute values (bar Mekko) and value or % of the total labels.

- Documentation: https://tinocallarisa-web.github.io/marimekko-chart/support.html
- Privacy: https://tinocallarisa-web.github.io/marimekko-chart/privacy.html · Terms: https://tinocallarisa-web.github.io/marimekko-chart/terms.html
- Questions: https://github.com/tinocallarisa-web/marimekko-chart/discussions · support@tcviz.com

## Build

```
npm ci
node build-test.js          # test package, Pro forced (_test)
node build-test.js --free   # test package, real licence (_testfree)
```

Texts and the Format pane are generated: `python tools/gen_capabilities.py`, `python tools/extract_ui.py`, `python tools/i18n.py`.
Documentation: `python tools/gen_docs.py`.

© 2026 TCViz. Source published for transparency and review; see the Terms of Use.
