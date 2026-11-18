"use strict";

import powerbi from "powerbi-visuals-api";
import "./../style/visual.less";
import { valueFormatter } from "powerbi-visuals-utils-formattingutils";
import { dataViewWildcard } from "powerbi-visuals-utils-dataviewutils";
import {
    HtmlSubSelectableClass, HtmlSubSelectionHelper, SubSelectableDisplayNameAttribute,
    SubSelectableObjectNameAttribute, SubSelectableTypeAttribute,
} from "powerbi-visuals-utils-onobjectutils";
import { STRINGS } from "./strings";
import { LANDING_ICON } from "./landingIcon";
import { createProWatermark, renderProWatermark } from "./comun/watermark";
import { styleSeriesColor } from "./comun/paleta";

import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import ISelectionId = powerbi.visuals.ISelectionId;
import ISelectionManager = powerbi.extensibility.ISelectionManager;
import DataView = powerbi.DataView;
import DataViewValueColumn = powerbi.DataViewValueColumn;
import DataViewCategoryColumn = powerbi.DataViewCategoryColumn;

const SVG = "http://www.w3.org/2000/svg";

// ─── Licencia (igual que el Radar) ────────────────────────────────────────────

/** Plan de pago. El Service ID que llega es editor.oferta.plan; se acepta también el Plan ID solo. */
const PLAN_IDS = ["marimekko-pro"];
/** Y cualquier otro plan de pago de esta oferta (tramos, anual, privados) sin sacar versión. */
const OFFER_PREFIX = "tino_callarisa.marimekko-tcviz.";
const STATE_ACTIVE = 1;
const STATE_WARNING = 2;
/** LicenseNotificationType.General: const enum, en runtime hace falta el número. */
const NOTIFY_GENERAL = 0;

/** Series con nombre en la versión gratuita (como el Radar: 3) y tope del Pro (12). El resto va en "Others". */
const FREE_SERIES = 3;
const MAX_SERIES = 12;
const MAX_COLUMNS = 60;
/** Tramas por serie (D10): rayas a 135°, verticales, horizontales, puntos, aspa y cuadrícula; se repiten pasado el 6. Others: rayas a 45°. */
const PATTERNS = 6;
const OTHERS = "\u0000others";

function matchesPlan(sp: string, planId: string): boolean {
    return sp === planId || sp.endsWith("." + planId);
}
function isOurPaidPlan(spIdentifier: unknown): boolean {
    const sp = String(spIdentifier ?? "");
    if (PLAN_IDS.some(id => matchesPlan(sp, id))) return true;
    return sp.startsWith(OFFER_PREFIX) && !/free/i.test(sp.slice(OFFER_PREFIX.length));
}

/** Enlaces de la pantalla de inicio. ?ref= cuenta en la web las visitas que llegan desde el visual. */
const URL_GUIDE = "https://tinocallarisa-web.github.io/marimekko-chart/support.html";
const URL_PRODUCT = "https://tcviz.com/product/marimekko-chart/?ref=visual-marimekko";
const URL_VIDEO = "https://www.youtube.com/watch?v=s9qSTA-dvJw";

// ─── Ajustes ──────────────────────────────────────────────────────────────────

interface Settings {
    template: string; guide: boolean;
    orientation: string; mode: string; gap: number; sortColumns: string; sortSeries: string;
    named: number; othersLabel: string; othersColor: string; opacity: number; borderColor: string; borderWidth: number;
    labels: boolean; labelContent: string; labelFont: number; labelColor: string; labelDecimals: number; labelBold: boolean;
    colLabels: boolean; colFont: number; colColor: string; colBold: boolean;
    totals: boolean; totalsPct: boolean; totalsFont: number; totalsColor: string;
    axis: boolean; axisFont: number; axisColor: string; gridlines: boolean;
    focus: string; focusColor: string; dimOthers: boolean; summary: boolean; summaryFont: number;
    showChange: boolean; posColor: string; negColor: string; changeSentence: boolean;
    legend: boolean; legendPos: string; legendFont: number; legendColor: string;
    smCols: number; smGap: number; smTitleSize: number; smTitleColor: string; smTitleBold: boolean;
    smBackground: string; smBorder: boolean; smBorderColor: string;
    background: string;
    /** series.cellColor: color fijo de todas las celdas con nombre (vacío = un color por serie); la regla fx llega por fila. */
    cellColor: string;
    // Accesibilidad (D10). focus* de arriba es la serie propia; a11y* es el foco del teclado.
    hcMode: string; a11yFocusColor: string; a11yFocusWidth: number; minText: number; patterns: boolean; dataPatterns: boolean;
    // Títulos de eje (FC.CART01): el de las columnas va en la tarjeta Column labels; el de la cuota, en Share axis.
    colTitle: boolean; colTitleText: string; colTitleSize: number; colTitleColor: string;
    axisTitle: boolean; axisTitleText: string; axisTitleSize: number; axisTitleColor: string;
}

const DEFAULTS: Settings = {
    template: "clean", guide: true,
    orientation: "vertical", mode: "percent", gap: 2, sortColumns: "size", sortSeries: "size",
    named: 12, othersLabel: "", othersColor: "#C8C6C4", opacity: 100, borderColor: "#FFFFFF", borderWidth: 1,
    labels: true, labelContent: "share", labelFont: 10, labelColor: "", labelDecimals: 0, labelBold: false,
    colLabels: true, colFont: 11, colColor: "#3D3929", colBold: false,
    totals: true, totalsPct: true, totalsFont: 10, totalsColor: "#605E5C",
    axis: true, axisFont: 9, axisColor: "#83827D", gridlines: false,
    focus: "", focusColor: "#2B6CB0", dimOthers: true, summary: true, summaryFont: 12,
    showChange: true, posColor: "#107C10", negColor: "#C4314B", changeSentence: true,
    legend: true, legendPos: "top", legendFont: 11, legendColor: "#605E5C",
    smCols: 0, smGap: 10, smTitleSize: 12, smTitleColor: "#3D3929", smTitleBold: true,
    smBackground: "", smBorder: false, smBorderColor: "#E1DFDD",
    background: "",
    cellColor: "",
    // minText 8: el menor tamaño que ya usaba la plantilla Compacta, para no cambiar los informes que existen.
    hcMode: "auto", a11yFocusColor: "#1F4E80", a11yFocusWidth: 2, minText: 8, patterns: true, dataPatterns: false,
    colTitle: true, colTitleText: "", colTitleSize: 11, colTitleColor: "#605E5C",
    axisTitle: true, axisTitleText: "", axisTitleSize: 11, axisTitleColor: "#605E5C",
};

/**
 * Estilos: los mismos de la colección que KPI Card, Pareto, Line Chart, Histogram y Treemap (mismos tokens, mismos
 * colores), para que una página se lea como un solo informe. "clean" = Report theme (sigue el tema del informe).
 * En el Marimekko los siete son GRATIS (decisión de Tino, 18-11-2026): no entran en el gating ni en la marca de agua.
 * Una plantilla solo rellena lo que el usuario no ha tocado: un ajuste escrito a mano (presente en metadata.objects)
 * gana siempre. Alto contraste manda sobre el estilo.
 */
const COLLECTION_STYLES = ["boardroom", "ledger", "editorial", "signal", "aurora", "terrace"];
interface StyleTokens { bg: string; text: string; axis: string; grid: string; plan: string; up: string; down: string; series: string[]; font?: string; grad?: string; }
const STYLE_TOKENS: Record<string, StyleTokens> = {
    boardroom: { bg: "#16263D", text: "#F2F0E8", axis: "#9FB0C6", grid: "#2A3E5C", plan: "#6FCF97", up: "#6FCF97", down: "#EB8A7B", series: ["#C9A45C", "#8FB8E8", "#EB8A7B", "#6FCF97", "#C5D3E3"] },
    ledger: { bg: "#FBF8EF", text: "#231F16", axis: "#6E6652", grid: "#D9D2BE", plan: "#946A10", up: "#2F6B3B", down: "#A32A2A", series: ["#7A1F1F", "#3A3528", "#2F6B3B", "#946A10", "#B7AD92"], font: "Georgia, serif" },
    editorial: { bg: "#FFFFFF", text: "#111111", axis: "#5F5F5F", grid: "#E2E2E2", plan: "#111111", up: "#111111", down: "#D7263D", series: ["#D7263D", "#111111", "#5F5F5F", "#BDBDBD", "#8C1C2B"], font: "Georgia, serif" },
    signal: { bg: "#FFFFFF", text: "#14202B", axis: "#566472", grid: "#D9DEE4", plan: "#B7791F", up: "#1F7A4D", down: "#C0392B", series: ["#1F7A4D", "#14202B", "#B7791F", "#C0392B", "#9AA5B1"] },
    aurora: { bg: "#10395E", text: "#FFFFFF", axis: "#C5D3E3", grid: "#3A5C7E", plan: "#FFD27D", up: "#7CE7D0", down: "#FF9DB0", series: ["#7CE7D0", "#FFD27D", "#FF9DB0", "#9DB7FF", "#C5D3E3"], grad: "linear-gradient(135deg, #1B1147, #10395E 50%, #0B5A5E)" },
    terrace: { bg: "#FBF5EC", text: "#3A2A1E", axis: "#7A6450", grid: "#E5D6C2", plan: "#5E7128", up: "#5E7128", down: "#B5372A", series: ["#B5532A", "#5E7128", "#B5782A", "#B5372A", "#C9A77E"] },
};
const TEMPLATES: Record<string, Partial<Settings>> = { clean: {} };
for (const k of COLLECTION_STYLES) {
    const t = STYLE_TOKENS[k];
    // Las juntas entre celdas toman el fondo del estilo; Others, el color de la rejilla (con su trama); la serie
    // propia, el color de acento ("plan") del estilo; textos principales en "text" y secundarios en "axis".
    TEMPLATES[k] = { borderColor: t.bg, othersColor: t.grid, focusColor: t.plan, posColor: t.up, negColor: t.down,
        colColor: t.text, totalsColor: t.axis, axisColor: t.axis, legendColor: t.axis,
        smTitleColor: t.text, smBorderColor: t.grid, colTitleColor: t.axis, axisTitleColor: t.axis };
}

/**
 * Plantillas antiguas (1.0.0.x) -> estilo de la colección. Un informe guardado con ellas no se rompe: se lee con el
 * estilo que más se le parece y el desplegable ya solo ofrece los siete nuevos.
 *   classic  -> ledger     (sobria y con rejilla, de papel)
 *   minimal  -> editorial  (blanco, tinta negra, sin adornos)
 *   contrast -> signal     (tinta oscura y colores firmes sobre blanco)
 *   compact  -> clean      (solo cambiaba tamaños: se queda con el tema del informe)
 *   ibcs     -> editorial  (grises y negro sobre blanco con un solo acento: lo más cercano a la estética IBCS;
 *                           ledger tiñe el fondo de crema y los tonos de sepia, que IBCS no usa)
 * Lo que la plantilla antigua cambiaba fuera del color (huecos, tamaños, ocultar eje o totales) vuelve al valor por
 * defecto si el usuario no lo había tocado.
 */
const LEGACY_TEMPLATES: Record<string, string> = { classic: "ledger", minimal: "editorial", contrast: "signal", compact: "clean", ibcs: "editorial" };

function templateName(raw: unknown): string {
    const v = String(raw ?? "") || DEFAULTS.template;
    const m = LEGACY_TEMPLATES[v] ?? v;
    return TEMPLATES[m] ? m : DEFAULTS.template;
}

type Objects = powerbi.DataViewObjects | undefined;

function readSettings(objects: Objects): Settings {
    const tplName = templateName(objects?.["style"]?.["template"]);
    const tpl = TEMPLATES[tplName];
    const pick = <K extends keyof Settings>(obj: string, prop: string, key: K): Settings[K] => {
        const raw = objects?.[obj]?.[prop];
        if (raw !== undefined && raw !== null) {
            if (typeof raw === "object" && (raw as any).solid) return (raw as any).solid.color as Settings[K];
            return raw as Settings[K];
        }
        return (tpl[key] !== undefined ? tpl[key] : DEFAULTS[key]) as Settings[K];
    };
    return {
        template: tplName, guide: pick("style", "guide", "guide"),
        orientation: pick("layout", "orientation", "orientation"), mode: pick("layout", "mode", "mode"), gap: pick("layout", "gap", "gap"),
        sortColumns: pick("layout", "sortColumns", "sortColumns"), sortSeries: pick("layout", "sortSeries", "sortSeries"),
        named: pick("series", "named", "named"), othersLabel: pick("series", "othersLabel", "othersLabel"), othersColor: pick("series", "othersColor", "othersColor"),
        opacity: pick("series", "opacity", "opacity"), borderColor: pick("series", "borderColor", "borderColor"), borderWidth: pick("series", "borderWidth", "borderWidth"),
        labels: pick("labels", "show", "labels"), labelContent: pick("labels", "content", "labelContent"), labelFont: pick("labels", "fontSize", "labelFont"),
        labelColor: pick("labels", "color", "labelColor"), labelDecimals: pick("labels", "decimals", "labelDecimals"), labelBold: pick("labels", "bold", "labelBold"),
        colLabels: pick("columnLabels", "show", "colLabels"), colFont: pick("columnLabels", "fontSize", "colFont"),
        colColor: pick("columnLabels", "color", "colColor"), colBold: pick("columnLabels", "bold", "colBold"),
        totals: pick("totals", "show", "totals"), totalsPct: pick("totals", "percent", "totalsPct"),
        totalsFont: pick("totals", "fontSize", "totalsFont"), totalsColor: pick("totals", "color", "totalsColor"),
        axis: pick("axis", "show", "axis"), axisFont: pick("axis", "fontSize", "axisFont"), axisColor: pick("axis", "color", "axisColor"),
        gridlines: pick("axis", "gridlines", "gridlines"),
        focus: pick("focus", "name", "focus"), focusColor: pick("focus", "color", "focusColor"), dimOthers: pick("focus", "dimOthers", "dimOthers"),
        summary: pick("focus", "summary", "summary"), summaryFont: pick("focus", "fontSize", "summaryFont"),
        showChange: pick("comparison", "showChange", "showChange"), posColor: pick("comparison", "positiveColor", "posColor"),
        negColor: pick("comparison", "negativeColor", "negColor"), changeSentence: pick("comparison", "sentence", "changeSentence"),
        legend: pick("legend", "show", "legend"), legendPos: pick("legend", "position", "legendPos"),
        legendFont: pick("legend", "fontSize", "legendFont"), legendColor: pick("legend", "color", "legendColor"),
        smCols: pick("smallMultiples", "columns", "smCols"), smGap: pick("smallMultiples", "gap", "smGap"),
        smTitleSize: pick("smallMultiples", "titleSize", "smTitleSize"), smTitleColor: pick("smallMultiples", "titleColor", "smTitleColor"),
        smTitleBold: pick("smallMultiples", "titleBold", "smTitleBold"), smBackground: pick("smallMultiples", "background", "smBackground"),
        smBorder: pick("smallMultiples", "border", "smBorder"), smBorderColor: pick("smallMultiples", "borderColor", "smBorderColor"),
        background: pick("background", "color", "background"),
        cellColor: pick("series", "cellColor", "cellColor"),
        hcMode: pick("accessibility", "highContrast", "hcMode"), a11yFocusColor: pick("accessibility", "focusColor", "a11yFocusColor"),
        a11yFocusWidth: pick("accessibility", "focusWidth", "a11yFocusWidth"), minText: pick("accessibility", "minTextSize", "minText"),
        patterns: pick("accessibility", "patterns", "patterns"), dataPatterns: pick("accessibility", "dataPatterns", "dataPatterns"),
        colTitle: pick("columnLabels", "showTitle", "colTitle"), colTitleText: pick("columnLabels", "titleText", "colTitleText"),
        colTitleSize: pick("columnLabels", "titleSize", "colTitleSize"), colTitleColor: pick("columnLabels", "titleColor", "colTitleColor"),
        axisTitle: pick("axis", "showTitle", "axisTitle"), axisTitleText: pick("axis", "titleText", "axisTitleText"),
        axisTitleSize: pick("axis", "titleSize", "axisTitleSize"), axisTitleColor: pick("axis", "titleColor", "axisTitleColor"),
    };
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Number.isFinite(v) ? v : lo));

// ─── Color: contraste y distancia (los mismos que el Treemap) ──────────────────

function hexToRgb(hex: string): [number, number, number] | null {
    const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec((hex || "").trim());
    if (!m) return null;
    let h = m[1];
    if (h.length === 3) h = h.split("").map(c => c + c).join("");
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function rgbToHex(r: number, g: number, b: number): string {
    return "#" + [r, g, b].map(v => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, "0")).join("");
}
function lerpColor(a: string, b: string, t: number): string {
    const x = hexToRgb(a), y = hexToRgb(b);
    if (!x || !y) return t < 0.5 ? a : b;
    return rgbToHex(x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t);
}
/** Luminancia relativa WCAG. */
function luminance(hex: string): number {
    const c = hexToRgb(hex);
    if (!c) return 1;
    const f = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
}
function contrastRatio(a: string, b: string): number {
    const la = luminance(a), lb = luminance(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
/**
 * El mismo tono, aclarado u oscurecido lo justo para leerse sobre el fondo (contraste ≥ 3,5): el verde sigue siendo
 * verde sobre una celda oscura o clara. El signo (+/−) dice el sentido aunque no se distinga el color.
 */
function legibleTone(color: string, bg: string): string {
    if (contrastRatio(color, bg) >= 3.5) return color;
    const toward = contrastRatio("#FFFFFF", bg) >= contrastRatio("#000000", bg) ? "#FFFFFF" : "#000000";
    for (let k = 0.15; k <= 1; k += 0.15) {
        const c = lerpColor(color, toward, k);
        if (contrastRatio(c, bg) >= 3.5) return c;
    }
    return toward;
}
/** El que más contrasta sobre el fondo: blanco o casi negro. */
function autoInk(bg: string): string {
    return contrastRatio("#FFFFFF", bg) >= contrastRatio("#252423", bg) ? "#FFFFFF" : "#252423";
}
/**
 * Tinta legible sobre un fondo. El color elegido se respeta allí donde se lee (contraste ≥ 4,5); con el contraste
 * automático activo, solo donde no se leería pasa a blanco o negro. Sin contraste automático, el elegido manda siempre.
 */
function readableInk(chosen: string, bg: string, auto: boolean): string {
    if (!bg) return chosen || "#252423";
    if (!chosen) return auto ? autoInk(bg) : "#252423";
    if (!auto || contrastRatio(chosen, bg) >= 4.5) return chosen;
    const alt = autoInk(bg);
    return contrastRatio(alt, bg) > contrastRatio(chosen, bg) ? alt : chosen;
}
/** Distancia perceptual aproximada entre dos colores (ΔE76 en CIELAB): < 20, se confunden de un vistazo. */
function colorDistance(a: string, b: string): number {
    const lab = (hex: string): [number, number, number] => {
        const c = hexToRgb(hex) || [0, 0, 0];
        const [r, g, bl] = c.map(v => { const s = v / 255; return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); });
        const x = (r * 0.4124 + g * 0.3576 + bl * 0.1805) / 0.95047, y = r * 0.2126 + g * 0.7152 + bl * 0.0722, z = (r * 0.0193 + g * 0.1192 + bl * 0.9505) / 1.08883;
        const f = (t: number) => t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
        return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
    };
    const p = lab(a), q = lab(b);
    return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
}
/** Opacidad de las series atenuadas por la serie propia. */
const DIM_ALPHA = 0.45;

// ─── Modelo ───────────────────────────────────────────────────────────────────

interface Series {
    key: string; name: string; color: string; others: boolean;
    total: number;
    selector: powerbi.data.Selector | undefined;   // para el color por serie en el panel de formato
}

/** Una celda: columna × serie × panel. "Others" junta las series sin nombre y todas sus identidades. */
interface Cell {
    key: string; panel: string | null; col: string; ser: string;
    value: number; cmp: number | null; hl: number | null;
    /** Color de la regla fx de su fila (null = sin regla). */
    rule: string | null;
    /** Cadena de formato dinámica de su fila; null = filas con formatos distintos (Others): se usa el de la medida. */
    fmt: string | undefined | null;
    ids: ISelectionId[];
    tips: { name: string; value: string }[];
}

interface ProFeature { id: string; label: string; }

/** Lo que se dibuja de una columna dentro de un panel. */
interface ColDraw { col: string; total: number; cmpTotal: number | null; cells: Cell[]; }

// ─── Visual ───────────────────────────────────────────────────────────────────

export class Visual implements IVisual {
    private host: IVisualHost;
    private root: HTMLDivElement;
    private svg: SVGSVGElement;
    private landingEl: HTMLDivElement;
    private watermarkEl: HTMLDivElement;
    private noteEl: HTMLDivElement;
    private guideEl: HTMLDivElement;
    private selectionManager: ISelectionManager;
    private events: powerbi.extensibility.IVisualEventService;
    private loc: powerbi.extensibility.ILocalizationManager;
    private s: Settings = DEFAULTS;
    private columns: string[] = [];
    private series: Series[] = [];
    private panels: (string | null)[] = [null];
    private cells = new Map<string, Cell>();
    private totalSeries = 0;
    private totalColumns = 0;
    private hasComparison = false;
    private hasHighlights = false;
    /** Opacidad de cada serie atenuada (separateFocus): 0,45 salvo para conservar la diferencia entre dos series. */
    private dimAlpha = new Map<string, number>();
    private valueFormat: string | undefined;
    /** Formateadores por cadena de formato: con formato dinámico la cadena cambia fila a fila. */
    private fmtCache = new Map<string, (v: number) => string>();
    private lastOptions: VisualUpdateOptions | null = null;
    private lastDv: DataView | undefined;
    private hasData = false;
    private focusKey = "";
    private restoredIds: ISelectionId[] = [];
    /** Clave de identidad -> celda, para casar selecciones y marcadores sin recorrer miles de identidades. */
    private idToCell = new Map<string, string>();
    private keySeq = 0;
    private keyboardNav = false;
    /** Formato desde el lienzo (on-object): el clic selecciona qué formatear, no filtra datos. */
    public visualOnObjectFormatting: powerbi.extensibility.visual.VisualOnObjectFormatting;
    private subSelectionHelper: HtmlSubSelectionHelper;
    private formatMode = false;
    /** Paso del asistente (2 = campos, 3 = estilo). El 1 es la pantalla de inicio. */
    private guideStep = 2;
    /** Filas por bloques: Power BI entrega 30.000 cada vez; el visual pide las siguientes. */
    private lastFetchCount = 0;
    private fetchRounds = 0;
    private truncatedAt = 0;
    private readonly MAX_FETCH_ROUNDS = 20;

    // Licencia
    private isPro = false;
    private licenseRequested = false;
    private licenseResolved = false;
    private licenseEnvUnsupported = false;
    private lastBlockedNotice = "";
    private licenseIconShown = false;
    private licenseIconTimer: number | null = null;
    private destroyed = false;

    constructor(options: VisualConstructorOptions) {
        this.host = options.host;
        this.events = options.host.eventService;
        this.loc = options.host.createLocalizationManager();
        this.selectionManager = options.host.createSelectionManager();

        this.root = document.createElement("div");
        this.root.className = "tcmk";
        options.element.appendChild(this.root);
        this.svg = document.createElementNS(SVG, "svg") as SVGSVGElement;
        this.svg.setAttribute("role", "listbox");
        this.svg.setAttribute("aria-multiselectable", "true");
        this.root.appendChild(this.svg);
        this.landingEl = document.createElement("div");
        this.landingEl.className = "tcmk-landing";
        this.root.appendChild(this.landingEl);
        this.noteEl = document.createElement("div");
        this.noteEl.className = "tcmk-note";
        this.root.appendChild(this.noteEl);
        this.watermarkEl = createProWatermark(this.root);
        this.guideEl = document.createElement("div");
        this.guideEl.className = "tcmk-guide";
        this.root.appendChild(this.guideEl);

        this.subSelectionHelper = HtmlSubSelectionHelper.createHtmlSubselectionHelper({
            hostElement: options.element,
            subSelectionService: options.host.subSelectionService,
            selectionIdCallback: () => undefined,
        });
        this.visualOnObjectFormatting = {
            getSubSelectionStyles: (subs) => this.getSubSelectionStyles(subs),
            getSubSelectionShortcuts: (subs) => this.getSubSelectionShortcuts(subs),
            getSubSelectables: (filter) => this.subSelectionHelper.getAllSubSelectables(filter),
        };

        this.svg.addEventListener("click", (e) => {
            if ((e.target as Element).closest?.("[data-pt],[data-col],[data-series]")) return;
            if (!this.canInteract || this.formatMode) return;
            this.selectionManager.clear().then(() => this.paintSelection());
        });
        this.svg.addEventListener("contextmenu", (e) => {
            if ((e.target as Element).closest?.("[data-pt]")) return;
            e.preventDefault();
            if (!this.canInteract) return;
            this.selectionManager.showContextMenu({} as ISelectionId, { x: e.clientX, y: e.clientY });
        });
        // Marcadores y selección hecha desde fuera: solo repintar. Nunca persistProperties aquí.
        this.selectionManager.registerOnSelectCallback((ids: ISelectionId[]) => { this.restoredIds = ids || []; this.paintSelection(); });
    }

    public destroy(): void {
        this.destroyed = true;
        this.cancelLicenseIcon();
    }

    private get canInteract(): boolean {
        const h: any = this.host;
        return (h.hostCapabilities?.allowInteractions ?? h.allowInteractions) !== false;
    }

    // ── Textos ────────────────────────────────────────────────────────────────

    /**
     * Primero la tabla del bundle (src/strings.ts): Power BI Desktop solo traduce con getDisplayName
     * las claves declaradas en capabilities.json, y los textos propios del visual no lo están.
     */
    private t(key: string, fallback: string): string {
        const own = this.stringsFor()?.[key];
        if (own) return own;
        try { const v = this.loc.getDisplayName(key); return v && v !== key ? v : fallback; } catch { return fallback; }
    }

    private stringsFor(): Record<string, string> | undefined {
        const loc = String((this.host as any)?.locale || "");
        if (!loc || /^en/i.test(loc)) return undefined;
        if (STRINGS[loc]) return STRINGS[loc];
        const lang = loc.split("-")[0].toLowerCase();
        const k = Object.keys(STRINGS).sort().find(x => x.toLowerCase().startsWith(lang + "-"));
        return k ? STRINGS[k] : undefined;
    }

    private get culture(): string { return (this.host as any).locale; }

    // ── Update ────────────────────────────────────────────────────────────────

    public update(options: VisualUpdateOptions): void {
        this.events.renderingStarted(options);
        try {
            this.lastOptions = options;
            const dv = options.dataViews?.[0];
            this.lastDv = dv;
            this.s = readSettings(dv?.metadata?.objects);
            this.formatMode = !!(options as any).formatMode;
            this.subSelectionHelper.setFormatMode(this.formatMode);
            if (dv && this.streamSegments(options, dv)) {
                // Se ha pedido el siguiente bloque: Power BI volverá a llamar a update() con todo junto.
                this.events.renderingFinished(options);
                return;
            }
            this.hasData = this.readData(dv);
            if (this.hasData) this.requestLicense();
            this.draw();
            this.updateOutlines(options);
            this.events.renderingFinished(options);
        } catch (e) {
            this.events.renderingFailed(options, String(e));
            console.error("[Marimekko]", e);
        }
    }

    private get isDesktop(): boolean {
        const env = Number((this.host as any)?.hostEnv);
        return isFinite(env) && env > 0 ? (env & 4) !== 0 : false;
    }

    private streamSegments(options: VisualUpdateOptions, dv: DataView): boolean {
        const op = (options as any).operationKind;
        if (op !== 1 && op !== 2) { this.lastFetchCount = 0; this.fetchRounds = 0; }
        this.truncatedAt = 0;
        if (!dv.metadata?.segment) return false;
        const loaded = dv.categorical?.categories?.[0]?.values?.length ?? 0;
        if (!this.isDesktop && loaded > this.lastFetchCount && this.fetchRounds < this.MAX_FETCH_ROUNDS) {
            this.lastFetchCount = loaded;
            this.fetchRounds++;
            if (this.host.fetchMoreData(true)) return true;
        }
        this.truncatedAt = loaded;
        return false;
    }

    // ── Pro: qué se pide y qué se dibuja ──────────────────────────────────────

    private isEditing(): boolean {
        const vm = (this.lastOptions as any)?.viewMode;
        return typeof vm === "number" && vm !== 0;
    }

    /** Vista previa: sin licencia, editando y con la licencia ya leída. En lectura, siempre el resultado gratuito. */
    private isPreview(): boolean {
        return !this.isPro && this.isEditing() && this.licenseResolved && !this.licenseEnvUnsupported;
    }

    private get proActive(): boolean {
        return this.isPro || this.isPreview();
    }

    /** Tokens del estilo de la colección que se dibuja (null con Report theme o alto contraste). Caché por dibujo. */
    private look(): StyleTokens | null { return this.curLook; }
    private curLook: StyleTokens | null = null;
    private computeLook(): StyleTokens | null {
        const t = this.s.template;
        return !this.hc().on && COLLECTION_STYLES.indexOf(t) >= 0 ? STYLE_TOKENS[t] : null;
    }

    /** Tinta principal y secundaria: la del estilo, o la del tema del informe. */
    private inkMain(): string {
        const p: any = this.host.colorPalette;
        return this.look()?.text ?? p?.foreground?.value ?? "#252423";
    }
    private inkDim(): string {
        const p: any = this.host.colorPalette;
        return this.look()?.axis ?? p?.foregroundNeutralSecondary?.value ?? "#605E5C";
    }

    private roleBound(role: string): boolean {
        return !!this.lastDv?.metadata?.columns?.some(c => c.roles?.[role]);
    }

    /** Funciones de pago que el informe está pidiendo ahora (con nombre para la marca y el aviso). */
    private attemptedPro(): ProFeature[] {
        const s = this.s, out: ProFeature[] = [];
        const add = (on: boolean, id: string, key: string, fb: string) => { if (on) out.push({ id, label: this.t(key, fb) }); };
        add(this.totalSeries > FREE_SERIES && s.named > FREE_SERIES, "series", "Feat_series", "more than 3 named series");
        add(!!s.focus.trim() || s.sortColumns === "focus", "focus", "Feat_focus", "focus series and summary");
        add(this.roleBound("comparison"), "comparison", "Feat_comparison", "change in share");
        add(this.roleBound("panel"), "panel", "Feat_panel", "small multiples");
        // Gratuito apretado (Tino, 02-11-2026): sin ventas, el Free resolvía todo lo habitual. Free = columnas al 100 %
        // con cuota; las otras lecturas son Pro y se ven en vista previa al elegirlas.
        add(s.orientation === "horizontal", "horizontal", "Feat_horizontal", "horizontal bars");
        add(s.mode === "absolute", "absolute", "Feat_absolute", "absolute values");
        add(s.labelContent === "total" || s.labelContent === "value" || s.labelContent === "both", "labels", "Feat_labels", "value and % of the total labels");
        return out;
    }

    /** Ajustes que se dibujan: sin Pro activo, cada función de pago vuelve a su valor gratuito. */
    private effective(): Settings {
        if (this.proActive) return { ...this.s, named: clamp(Math.round(this.s.named), 1, MAX_SERIES) };
        const s = { ...this.s };
        s.named = clamp(Math.round(s.named), 1, FREE_SERIES);
        s.focus = "";
        if (s.sortColumns === "focus") s.sortColumns = "size";
        s.orientation = "vertical"; s.mode = "percent";
        if (s.labelContent === "total" || s.labelContent === "value" || s.labelContent === "both") s.labelContent = "share";
        return s;
    }

    // ── Datos ─────────────────────────────────────────────────────────────────

    private name(v: any): string {
        return (v === null || v === undefined || v === "") ? this.t("UI_Blank", "(Blank)") : (v instanceof Date ? v.toLocaleDateString(this.culture) : String(v));
    }

    private num(v: any): number | null {
        if (v === null || v === undefined || v === "") return null;
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
    }

    /**
     * Una fila por columna × serie × panel. Las series con nombre son las N mayores (o las primeras, según
     * el orden elegido); las demás se suman en "Others" con todas sus identidades: la columna sigue sumando
     * el 100 % real y su ancho no cambia. false = no hay nada que dibujar (pantalla de inicio).
     */
    private readData(dv: DataView | undefined): boolean {
        this.columns = []; this.series = []; this.panels = [null]; this.cells.clear(); this.idToCell.clear();
        this.totalSeries = 0; this.totalColumns = 0; this.hasComparison = false; this.hasHighlights = false;
        const cat = dv?.categorical;
        const cats = cat?.categories || [];
        const vcols = cat?.values || ([] as any);
        const colCol = cats.find(c => c.source.roles?.["category"]);
        const valCol: DataViewValueColumn | undefined = vcols.find?.((c: DataViewValueColumn) => c.source.roles?.["value"]);
        if (!colCol || !valCol) return false;
        const pro = this.proActive;
        const s = this.effective();
        const serCol = cats.find(c => c.source.roles?.["series"]);
        const panelCol = pro ? cats.find(c => c.source.roles?.["panel"]) : undefined;
        const cmpCol: DataViewValueColumn | undefined = pro ? vcols.find((c: DataViewValueColumn) => c.source.roles?.["comparison"]) : undefined;
        const tipCols: DataViewValueColumn[] = vcols.filter((c: DataViewValueColumn) => c.source.roles?.["tooltips"]);
        this.valueFormat = this.formatOf(valCol);
        const n = colCol.values.length;

        // 1. Series y su total, en orden de llegada (respeta "Ordenar por columna" del modelo)
        const serOrder: string[] = [];
        const serTotal = new Map<string, number>();
        const serFirstRow = new Map<string, number>();
        const colOrder: string[] = [];
        const colSeen = new Set<string>();
        for (let i = 0; i < n; i++) {
            const v = this.num(valCol.values[i]);
            const sname = serCol ? this.name(serCol.values[i]) : this.t("Role_value", "Value");
            if (!serTotal.has(sname)) { serTotal.set(sname, 0); serOrder.push(sname); serFirstRow.set(sname, i); }
            if (v !== null && v > 0) serTotal.set(sname, serTotal.get(sname) + v);
            const c = this.name(colCol.values[i]);
            if (!colSeen.has(c)) { colSeen.add(c); colOrder.push(c); }
        }
        this.totalSeries = serOrder.length;
        this.totalColumns = colOrder.length;
        const bySize = serOrder.slice().sort((a, b) => serTotal.get(b) - serTotal.get(a));
        const focusName = s.focus.trim().toLowerCase();
        // Con serie propia, siempre con nombre aunque no esté entre las mayores.
        let named = bySize.slice(0, s.named);
        if (focusName) {
            const f = serOrder.find(x => x.toLowerCase() === focusName);
            if (f && named.indexOf(f) < 0) named = named.slice(0, Math.max(0, s.named - 1)).concat(f);
        }
        const namedSet = new Set(named);
        const ordered = (s.sortSeries === "data" ? serOrder.filter(x => namedSet.has(x)) : bySize.filter(x => namedSet.has(x)));
        // Con un estilo de la colección las series toman su paleta (como el resto de la cartera); si no, la del tema.
        const look = this.computeLook();
        this.series = ordered.map((nm, k) => {
            const row = serFirstRow.get(nm);
            const own = serCol ? (serCol.objects?.[row]?.["series"]?.["fill"] as any)?.solid?.color : undefined;
            const selector = serCol
                ? (this.host.createSelectionIdBuilder().withCategory(serCol, row).createSelectionId() as any).getSelector?.()
                : undefined;
            let color = own || (look ? styleSeriesColor(look.series, k) : this.host.colorPalette.getColor(nm).value);
            if (focusName && nm.toLowerCase() === focusName) color = s.focusColor || color;
            return { key: "s" + k, name: nm, color, others: false, total: serTotal.get(nm), selector };
        });
        const othersTotal = serOrder.filter(x => !namedSet.has(x)).reduce((t, x) => t + serTotal.get(x), 0);
        if (serOrder.length > named.length) {
            this.series.push({ key: OTHERS, name: s.othersLabel.trim() || this.t("UI_Others", "Others"), color: s.othersColor || "#C8C6C4",
                others: true, total: othersTotal, selector: undefined });
        }
        this.separateFocus(dv, s, look, focusName);
        const keyOfSeries = new Map<string, string>();
        this.series.forEach(se => { if (!se.others) keyOfSeries.set(se.name, se.key); });

        // 2. Celdas
        const panelSet: string[] = [];
        const rowFmts = new Set<string>();
        for (let i = 0; i < n; i++) {
            const v = this.num(valCol.values[i]);
            if (v === null) continue;
            const c = this.name(colCol.values[i]);
            const sname = serCol ? this.name(serCol.values[i]) : this.t("Role_value", "Value");
            const sk = keyOfSeries.get(sname) ?? OTHERS;
            const panel = panelCol ? this.name(panelCol.values[i]) : null;
            if (panel !== null && panelSet.indexOf(panel) < 0) panelSet.push(panel);
            const key = (panel ?? "") + "\u0001" + c + "\u0001" + sk;
            let cell = this.cells.get(key);
            if (!cell) { cell = { key, panel, col: c, ser: sk, value: 0, cmp: null, hl: null, rule: null, fmt: undefined, ids: [], tips: [] }; this.cells.set(key, cell); }
            cell.value += Math.max(0, v);
            // F11: formato dinámico de la medida, fila a fila (general.formatString declarado en capabilities)
            const rf = this.rowFormat(valCol, i);
            if (cell.fmt === undefined) cell.fmt = rf ?? "";
            else if (cell.fmt !== null && cell.fmt !== (rf ?? "")) cell.fmt = null;
            rowFmts.add(rf ?? "");
            // F04: color de la regla fx (series.cellColor). Others conserva su color: junta series distintas.
            if (sk !== OTHERS) {
                const rule = this.ruleOf([valCol, ...cats], i);
                if (rule) cell.rule = rule;
            }
            const cv = cmpCol ? this.num(cmpCol.values[i]) : null;
            if (cv !== null) { cell.cmp = (cell.cmp ?? 0) + Math.max(0, cv); this.hasComparison = true; }
            const hv = valCol.highlights ? this.num(valCol.highlights[i]) : null;
            if (hv !== null && hv !== undefined) { cell.hl = (cell.hl ?? 0) + Math.max(0, hv); this.hasHighlights = true; }
            if (sk !== OTHERS && tipCols.length && !cell.tips.length) {
                cell.tips = tipCols.map(tc => {
                    const raw = tc.values[i];
                    const nv = this.num(raw);
                    return { name: tc.source.displayName, value: nv !== null ? this.fmt(nv, this.rowFormat(tc, i) ?? this.formatOf(tc)) : (raw === null || raw === undefined ? "" : String(raw)) };
                });
            }
            let b = this.host.createSelectionIdBuilder().withCategory(colCol, i);
            if (serCol) b = b.withCategory(serCol, i);
            if (panelCol) b = b.withCategory(panelCol, i);
            const id = b.createSelectionId();
            const k = this.keyOf(id);
            if (!this.idToCell.has(k)) { this.idToCell.set(k, key); cell.ids.push(id); }
        }
        if (panelSet.length) this.panels = panelSet;
        // Si todas las filas traen la misma cadena dinámica, es el formato de la medida para ejes, totales y frase.
        if (rowFmts.size === 1) { const only = rowFmts.values().next().value; if (only) this.valueFormat = only; }
        this.columns = colOrder.slice(0, MAX_COLUMNS);
        return this.cells.size > 0 && this.series.length > 0;
    }

    /**
     * Con serie propia: (1) la atenuación de las demás conserva sus diferencias — si dos series atenuadas quedan casi
     * iguales (p. ej. la sexta de Signal, que es la primera aclarada), se reparten opacidades algo distintas;
     * (2) el color del foco no puede confundirse con ninguna otra serie, ni entera ni atenuada: si el de por defecto o
     * el del estilo coincide (Report theme con el tema TCViz: la primera serie es #2B6CB0, igual que el foco por
     * defecto), se toma el primero de una lista que se distinga. Un color de foco puesto a mano se respeta siempre.
     */
    private separateFocus(dv: DataView | undefined, s: Settings, look: StyleTokens | null, focusName: string): void {
        this.dimAlpha.clear();
        const fser = focusName ? this.series.find(se => !se.others && se.name.toLowerCase() === focusName) : undefined;
        if (!fser) return;
        const others = this.series.filter(se => se !== fser);
        const pageBg = look ? look.bg : (/^#[0-9a-f]{6}$/i.test(s.background || "") ? s.background : "#FFFFFF");
        const op = clamp(s.opacity, 5, 100) / 100;
        const baseOf = (se: Series) => se.others ? se.color : (s.cellColor || se.color);
        const dimOf = (c: string, a: number) => lerpColor(pageBg, c, a * op);
        if (s.dimOthers) {
            // Coordenadas: cada serie prueba unas pocas opacidades (siempre atenuada, 0,22–0,62) y se queda con la que
            // más separa el par más parecido. Solo si con 0,45 para todas hay dos series a menos de ΔE 12. Las series con
            // el mismo color de partida (color fijo de celdas) no cuentan: no se espera distinguirlas por color.
            const named = others.filter(se => !se.others);
            const bases = named.map(baseOf);
            const pairs: [number, number][] = [];
            for (let i = 0; i < named.length; i++) for (let j = i + 1; j < named.length; j++)
                if (colorDistance(bases[i], bases[j]) >= 3) pairs.push([i, j]);
            const score = (al: number[]) => pairs.length
                ? Math.min(...pairs.map(([i, j]) => colorDistance(dimOf(bases[i], al[i]), dimOf(bases[j], al[j])))) : 99;
            const al = named.map(() => DIM_ALPHA);
            if (score(al) < 12) {
                const OPTS = [DIM_ALPHA, 0.3, 0.62, 0.22];
                for (let pass = 0; pass < 3; pass++) {
                    for (let i = 0; i < named.length; i++) {
                        let bestA = al[i], bestS = -1;
                        for (const a of OPTS) {
                            const sc = Math.round(score(al.map((v, k) => k === i ? a : v)));
                            if (sc > bestS || (sc === bestS && a === DIM_ALPHA)) { bestS = sc; bestA = a; }
                        }
                        al[i] = bestA;
                    }
                }
            }
            named.forEach((se, i) => this.dimAlpha.set(se.key, al[i]));
        }
        const userColor = (dv?.metadata?.objects?.["focus"] as any)?.["color"] !== undefined;
        if (userColor) return;
        const near = (c: string) => others.length ? Math.min(...others.map(se => {
            const b = baseOf(se);
            const dRaw = colorDistance(c, b);
            const dDim = s.dimOthers ? colorDistance(c, dimOf(b, this.dimAlpha.get(se.key) ?? DIM_ALPHA)) : 99;
            return Math.min(dRaw, dDim * 1.3);
        })) : 99;
        const cands = [s.focusColor || fser.color, look?.plan, "#D9A21B", "#C0392B", "#7A5FA8", "#0E7C86", look ? look.text : "#252423"]
            .filter((c, i, a): c is string => !!c && /^#[0-9a-f]{6}$/i.test(c) && a.indexOf(c) === i);
        let best = cands[0], bestD = -1;
        for (const c of cands) {
            const d = near(c);
            if (d >= 20) { best = c; break; }
            if (d > bestD) { bestD = d; best = c; }
        }
        fser.color = best;
    }

    private formatOf(col: DataViewValueColumn): string | undefined {
        // Cadena estática de la columna; la dinámica llega por fila (rowFormat).
        try { return valueFormatter.getFormatStringByColumn(col.source as any) || col.source.format; } catch { return col.source.format; }
    }

    /** F11: cadena de formato dinámica de la fila i (values[c].objects[i].general.formatString), si la medida la tiene. */
    private rowFormat(col: { objects?: powerbi.DataViewObjects[] } | undefined, i: number): string | undefined {
        const f = (col?.objects?.[i] as any)?.general?.formatString;
        return typeof f === "string" && f ? f : undefined;
    }

    /** F04: color de la regla fx de la fila; según el host llega en la columna de valor o en una de categoría. */
    private ruleOf(cols: { objects?: powerbi.DataViewObjects[] }[], i: number): string | null {
        for (const c of cols) {
            const col = (c?.objects?.[i] as any)?.series?.cellColor?.solid?.color;
            if (typeof col === "string" && col) return col;
        }
        return null;
    }

    /** Formato de una celda: el de su fila, o el de la medida si no tiene (o si junta filas con formatos distintos). */
    private cellFmt(cell: Cell): string | undefined {
        return cell.fmt || this.valueFormat;
    }

    /** Formato común de varias celdas (total de una columna); si difieren, el de la medida. */
    private commonFmt(cells: Cell[]): string | undefined {
        let f: string | undefined | null;
        for (const c of cells) {
            const x = this.cellFmt(c);
            if (f === undefined) f = x ?? "";
            else if (f !== (x ?? "")) return this.valueFormat;
        }
        return f || this.valueFormat;
    }

    private formatter(format: string | undefined): (v: number) => string {
        return (v: number) => this.fmt(v, format);
    }

    /** Valor con su cadena de formato; un formateador por cadena, en caché. */
    private fmt(v: number, format: string | undefined): string {
        const key = format || "";
        let f = this.fmtCache.get(key);
        if (!f) {
            const culture = this.culture;
            try {
                const vf = valueFormatter.create({ format: format || undefined, cultureSelector: culture } as any);
                const plain = (() => { try { return new Intl.NumberFormat(culture, { maximumFractionDigits: 2 }); } catch { return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }); } })();
                f = (x: number) => {
                    const out = vf.format(x);
                    if (Number.isInteger(x) || /%/.test(format || "") || /[.,]\d/.test(out)) return out;
                    return format ? out : plain.format(x);
                };
            } catch { f = (x: number) => String(Math.round(x * 100) / 100); }
            if (this.fmtCache.size > 200) this.fmtCache.clear();
            this.fmtCache.set(key, f);
        }
        return f(v);
    }

    /** Valores grandes en forma corta (40,2 M) para etiquetas, totales y frases, con la cadena de formato dada. */
    private shortFmt(v: number, format: string | undefined = this.valueFormat): string {
        try {
            // WholeUnits (2): el sistema por defecto pasa a "bn" desde 100 M y escribe 105,8 M como 0,1 bn.
            // Con un porcentaje no hay unidades que acortar.
            if (/%/.test(format || "")) return this.fmt(v, format);
            const f = valueFormatter.create({ format, value: v > 0 ? v : 1, precision: 1, cultureSelector: this.culture, displayUnitSystemType: 2 } as any);
            return f.format(v);
        } catch { return String(Math.round(v)); }
    }

    private pct(v: number, decimals = 0): string {
        try { return new Intl.NumberFormat(this.culture, { style: "percent", maximumFractionDigits: decimals, minimumFractionDigits: decimals }).format(v); }
        catch { return (v * 100).toFixed(decimals) + "%"; }
    }

    private pp(d: number): string {
        const v = d * 100;
        const txt = (() => { try { return new Intl.NumberFormat(this.culture, { maximumFractionDigits: 1, minimumFractionDigits: 1 }).format(Math.abs(v)); } catch { return Math.abs(v).toFixed(1); } })();
        return (v > 0.05 ? "+" : v < -0.05 ? "−" : "±") + txt + " pp";
    }

    /** Columnas de un panel en el orden elegido, con su total y sus celdas en el orden de las series. */
    private columnsOf(panel: string | null, s: Settings): ColDraw[] {
        const sIdx = new Map(this.series.map((x, i) => [x.key, i]));
        const out: ColDraw[] = [];
        for (const col of this.columns) {
            const cells: Cell[] = [];
            let total = 0, cmpTotal: number | null = null;
            for (const se of this.series) {
                const c = this.cells.get((panel ?? "") + "\u0001" + col + "\u0001" + se.key);
                if (c && c.value > 0) { cells.push(c); total += c.value; }
                if (c && c.cmp !== null) cmpTotal = (cmpTotal ?? 0) + c.cmp;
            }
            if (total > 0) out.push({ col, total, cmpTotal, cells: cells.sort((a, b) => sIdx.get(a.ser) - sIdx.get(b.ser)) });
        }
        const focus = this.focusSeries(s);
        if (s.sortColumns === "size") out.sort((a, b) => b.total - a.total);
        else if (s.sortColumns === "focus" && focus) {
            const share = (c: ColDraw) => (c.cells.find(x => x.ser === focus.key)?.value ?? 0) / c.total;
            out.sort((a, b) => share(b) - share(a));
        }
        return out;
    }

    private focusSeries(s: Settings): Series | undefined {
        const f = s.focus.trim().toLowerCase();
        return f ? this.series.find(x => !x.others && x.name.toLowerCase() === f) : undefined;
    }

    // ── Dibujo ────────────────────────────────────────────────────────────────

    private clearSvg(): void {
        while (this.svg.firstChild) this.svg.removeChild(this.svg.firstChild);
    }

    private el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>, parent: Element): SVGElementTagNameMap[K] {
        const e = document.createElementNS(SVG, tag) as SVGElementTagNameMap[K];
        for (const k in attrs) e.setAttribute(k, String(attrs[k]));
        parent.appendChild(e);
        return e;
    }

    /**
     * Alto contraste: el del sistema (colores del tema de Windows) o forzado desde Accesibilidad (negro sobre blanco,
     * serie propia en azul oscuro). En los dos, las series se distinguen por tramas además del borde.
     */
    private hc(): { on: boolean; fg: string; bg: string; sel: string } {
        const p: any = this.host.colorPalette;
        const sys = !!p?.isHighContrast;
        if (sys) return { on: true, fg: p?.foreground?.value || "#000000", bg: p?.background?.value || "#FFFFFF", sel: p?.foregroundSelected?.value || p?.foreground?.value || "#000000" };
        if (this.s.hcMode === "on") return { on: true, fg: "#000000", bg: "#FFFFFF", sel: "#1F4E80" };
        return { on: false, fg: "#000000", bg: "#FFFFFF", sel: "#000000" };
    }

    /** Tamaño de texto acotado y nunca por debajo del mínimo de Accesibilidad. */
    private fsz(v: number, lo: number, hi: number): number {
        const min = this.minFont;
        return clamp(v, Math.max(lo, min), Math.max(hi, min));
    }

    private get minFont(): number { return clamp(this.s.minText, 6, 24); }

    /**
     * Tramas (D10): "Others" rayado y, si se pide (o en alto contraste), una trama por serie para distinguirlas sin
     * color. Dos tintas por trama, clara y oscura, para que se vean sobre cualquier color de serie.
     */
    private patternDefs(hc: { on: boolean; fg: string }): void {
        const defs = this.el("defs", {}, this.svg);
        // kind: 0 rayas 45° (solo Others), 1 rayas 135°, 2 verticales, 3 horizontales, 4 puntos, 5 aspa, 6 cuadrícula
        const make = (id: string, kind: number, color: string, op: number) => {
            const attrs: Record<string, string | number> = { id, width: 6, height: 6, patternUnits: "userSpaceOnUse" };
            if (kind === 0) attrs.patternTransform = "rotate(45)";
            else if (kind === 1) attrs.patternTransform = "rotate(135)";
            else if (kind === 3) attrs.patternTransform = "rotate(90)";
            const p = this.el("pattern", attrs, defs);
            const ln = (x1: number, y1: number, x2: number, y2: number) =>
                this.el("line", { x1, y1, x2, y2, stroke: color, "stroke-width": 1.4, "stroke-opacity": op }, p);
            if (kind === 4) this.el("circle", { cx: 3, cy: 3, r: 1.3, fill: color, "fill-opacity": op }, p);
            else if (kind === 5) { ln(0, 0, 6, 6); ln(6, 0, 0, 6); }
            else if (kind === 6) { ln(1, 0, 1, 6); ln(0, 1, 6, 1); }
            else ln(1, 0, 1, 6);
        };
        make("tcmk-stripe", 0, hc.on ? hc.fg : (this.look()?.axis ?? "#605E5C"), hc.on ? 1 : 0.45);
        for (let i = 0; i < PATTERNS; i++) {
            if (hc.on) make("tcmk-p" + i + "h", i + 1, hc.fg, 1);
            else { make("tcmk-p" + i + "d", i + 1, "#252423", 0.45); make("tcmk-p" + i + "l", i + 1, "#FFFFFF", 0.65); }
        }
    }

    /** Trama de una serie (o null): Others rayado; las demás por su posición si hay tramas o alto contraste. */
    private patternOf(se: Series, fill: string, s: Settings, hc: { on: boolean; sel: string }): string | null {
        if (se.others) return s.patterns || hc.on ? "url(#tcmk-stripe)" : null;
        if (!s.dataPatterns && !hc.on) return null;
        if (hc.on && fill === hc.sel) return null;
        const k = this.series.indexOf(se) % PATTERNS;
        return `url(#tcmk-p${k}${hc.on ? "h" : this.contrast(fill) === "#FFFFFF" ? "l" : "d"})`;
    }

    /** Dibuja con el último dataView. Lo usa update() y el repintado tras resolver la licencia. */
    private draw(): void {
        if (this.destroyed || !this.lastOptions) return;
        const vp = this.lastOptions.viewport;
        const hc = this.hc();
        this.curLook = this.hasData ? this.computeLook() : null;
        const look = this.curLook;
        // Con un estilo de la colección manda su fondo: el tema del informe rellena "background" en todos los visuales
        // (visualStyles "*") y no se distingue de un color puesto a mano.
        this.root.style.background = hc.on ? hc.bg : (look ? (look.grad ?? look.bg) : (this.s.background || "transparent"));
        this.root.style.fontFamily = look?.font ?? "";
        this.subSelectable(this.root, "background", this.t("Obj_background", "Background"), powerbi.visuals.SubSelectionStylesType.Shape);
        this.guideEl.style.display = "none";
        if (!this.hasData) {
            this.clearSvg(); this.noteEl.style.display = "none";
            renderProWatermark(this.watermarkEl, null);
            this.landing(vp.width, vp.height);
            this.warnings();
            return;
        }
        this.landingEl.style.display = "none";
        this.svg.style.display = "";
        const s = this.effective();
        const noteH = this.renderNote() ? 16 : 0;
        this.render(s, vp.width, Math.max(60, vp.height - noteH));
        this.renderWatermark(vp.width, vp.height);
        this.renderGuide();
        this.warnings();
        this.notifyProFeatureBlocked();
        this.paintSelection();
    }

    /** Ancho aproximado de un texto en px (sin medir en el DOM: el visual no puede esperar al layout). */
    private textW(txt: string, size: number, bold = false): number {
        return txt.length * size * (bold ? 0.6 : 0.55);
    }

    private fit(txt: string, size: number, maxW: number): string {
        if (this.textW(txt, size) <= maxW) return txt;
        const n = Math.max(1, Math.floor(maxW / (size * 0.55)) - 1);
        return n <= 1 ? "" : txt.slice(0, n) + "…";
    }

    /** Parte un texto en líneas de ancho maxW; la última, con elipsis si sobra texto. */
    private wrap(txt: string, size: number, maxW: number, maxLines: number): string[] {
        const words = txt.split(/\s+/).filter(Boolean);
        const out: string[] = [];
        let cur = "";
        for (let i = 0; i < words.length; i++) {
            const next = cur ? cur + " " + words[i] : words[i];
            if (this.textW(next, size) <= maxW || !cur) { cur = next; continue; }
            if (out.length === maxLines - 1) return out.concat(this.fit(cur + " " + words.slice(i).join(" "), size, maxW)).filter(Boolean);
            out.push(cur); cur = words[i];
        }
        if (cur) out.push(this.fit(cur, size, maxW));
        return out.filter(Boolean);
    }

    /**
     * Reparto de la leyenda horizontal en hasta maxRows filas. Lo que no cabe va en un "+N" al final de la última
     * fila (se le hace sitio quitando la última muestra si hace falta).
     */
    private legendRows(W: number, fl: number, maxRows: number, nameW: number, first?: Series): { filas: { se: Series; x: number }[][]; hidden: Series[]; plusX: number; nameW: number } {
        const filas: { se: Series; x: number; w: number }[][] = [[]];
        // En la fila compacta la serie propia va primero: es la que no puede acabar dentro del "+N".
        const order = first ? [first, ...this.series.filter(x => x !== first)] : this.series;
        let x = 6, placed = 0;
        for (const se of order) {
            const w = fl + 10 + Math.min(nameW, this.textW(se.name, fl));
            if (x + w > W - 6 && filas[filas.length - 1].length) {
                if (filas.length === maxRows) break;
                filas.push([]); x = 6;
            }
            filas[filas.length - 1].push({ se, x, w });
            x += w + 12; placed++;
        }
        const last = filas[filas.length - 1];
        const plusW = (n: number) => this.textW("+" + n, fl) + 4;
        while (placed < order.length && last.length > 1 && last[last.length - 1].x + last[last.length - 1].w + 10 + plusW(order.length - placed) > W - 6) {
            last.pop(); placed--;
        }
        const end = last.length ? last[last.length - 1].x + last[last.length - 1].w + 10 : 6;
        return { filas, hidden: order.slice(placed), plusX: end, nameW };
    }

    /** "+N" de la leyenda, con los nombres que faltan en su title: nunca se pierden series en silencio. */
    private legendMore(lg: SVGGElement, hidden: Series[], x: number, y: number, fl: number, s: Settings, hc: { on: boolean; fg: string }): void {
        const t = this.el("text", { x, y: y + fl * 0.35, "font-size": fl, "font-weight": 600, fill: hc.on ? hc.fg : s.legendColor, class: "tcmk-legend-more" }, lg);
        t.textContent = "+" + hidden.length;
        this.el("title", {}, t).textContent = hidden.map(h => h.name).join(", ");
    }

    private render(s: Settings, W: number, H: number): void {
        this.clearSvg();
        this.svg.setAttribute("width", String(W));
        this.svg.setAttribute("height", String(H));
        const hc = this.hc();
        const tiny = W < 220 || H < 160;
        let top = 4, bottom = 4, right = 4;
        this.patternDefs(hc);
        const vertical = s.orientation !== "horizontal";

        // ── Presupuesto de alto (D06). El gráfico (celdas, nombres de columna y eje) conserva al menos el 55 % del alto.
        // Cuando falta, los adornos ceden en este orden: la frase pasa a una línea con elipsis (completa en su title),
        // la leyenda se compacta en una fila con "+N" (la serie propia primero; los nombres que faltan, en el title del
        // "+N"), se ocultan los títulos de eje, después los totales (el ancho de la columna ya dice su tamaño) y por
        // último la frase. Las celdas no ceden: nunca se pierde nada en silencio.
        const minChart = H * 0.55;
        const focus = this.focusSeries(s);
        const sentences = focus && s.summary && this.panels.length === 1 && !tiny ? this.summaryLines(s, focus) : [];
        const fs = this.fsz(s.summaryFont, 8, 28), fs2 = Math.max(this.minFont, fs - 1);
        const fullSum: { text: string; size: number; k: number }[] = [];
        sentences.forEach((ln, k) => this.wrap(ln, k ? fs2 : fs, W - 12, k ? 2 : 3).forEach(text => fullSum.push({ text, size: k ? fs2 : fs, k })));
        const one = sentences.length ? this.fit(sentences.join(" "), fs, W - 12) : "";
        const oneSum = one ? [{ text: one, size: fs, k: 0 }] : [];
        const sumHeight = (ls: { size: number }[]) => ls.length ? ls.reduce((t, l) => t + l.size + 4, 0) + 6 : 0;

        const legOn = s.legend && this.series.length > 1 && !tiny;
        const fl = this.fsz(s.legendFont, 6, 30), rowH = fl + 8;
        const legRight = legOn && s.legendPos === "right" && W > 380;
        const legFull = legOn && !legRight ? this.legendRows(W, fl, 3, 170) : null;
        const legCompact = legOn && !legRight ? this.legendRows(W, fl, 1, Math.max(40, Math.min(170, (W - 12) / 3 - fl - 22)), focus) : null;
        const legHeight = (L: { filas: unknown[] } | null) => L ? L.filas.length * rowH + (s.legendPos === "bottom" ? 4 : 2) : 0;

        const colT = s.colTitle && s.colLabels ? this.axisTitle("col", s) : null;
        const shareT = s.axisTitle && s.axis ? this.axisTitle("share", s) : null;
        const bottomT = vertical ? colT : shareT, leftT = vertical ? shareT : colT;
        const totalsH = vertical && s.totals ? this.fsz(s.totalsFont, 6, 30) + 6 : 0;
        // Lo que drawMekko reserva siempre dentro del panel (nombres de columna o eje de abajo y márgenes): el 55 % es de las celdas.
        const fixedH = 4 + (vertical ? (s.colLabels ? this.fsz(s.colFont, 6, 30) + 6 : 0) : (s.axis ? this.fsz(s.axisFont, 6, 24) + 6 : 0));

        let sum = fullSum, leg = legFull, titles = true, totals = true;
        const chrome = () => 8 + fixedH + sumHeight(sum) + legHeight(leg) + (titles && bottomT ? bottomT.size + 6 : 0) + (totals ? totalsH : 0);
        const steps: (() => void)[] = [
            () => { sum = oneSum; },
            () => { leg = legCompact; },
            () => { titles = false; },
            () => { totals = false; },
            () => { sum = []; },
        ];
        for (const step of steps) { if (H - chrome() >= minChart) break; step(); }

        // Frase resumen (Pro: serie propia)
        if (sum.length) {
            const g = this.el("g", { class: "tcmk-summary" }, this.svg);
            this.subSelectable(g, "focus", this.t("Obj_focus", "Focus series"), powerbi.visuals.SubSelectionStylesType.Text);
            // Texto completo para el ratón y el lector de pantalla, aunque se vea recortado
            this.el("title", {}, g).textContent = sentences.join(" ");
            let y = top;
            for (const ln of sum) {
                y += ln.size;
                const t = this.el("text", { x: 6, y, "font-size": ln.size, "font-weight": ln.k ? 400 : 600,
                    fill: hc.on ? hc.fg : (ln.k ? (this.look() ? this.inkDim() : "#605E5C") : (this.look() ? this.inkMain() : "#252423")) }, g);
                t.textContent = ln.text;
                y += 4;
            }
            top += sumHeight(sum);
        }

        // Leyenda
        if (legOn) {
            const lg = this.el("g", { class: "tcmk-legend" }, this.svg);
            this.subSelectable(lg, "legend", this.t("Obj_legend", "Legend"), powerbi.visuals.SubSelectionStylesType.Text);
            if (legRight) {
                const colW = Math.min(170, Math.max(...this.series.map(x => this.textW(x.name, fl))) + fl + 18);
                // Las que no caben en el alto, en un "+N" con sus nombres en el title
                const fit = Math.max(1, Math.floor((H - top - 4) / rowH));
                const shown = this.series.length > fit ? this.series.slice(0, fit - 1) : this.series;
                let y = top + rowH / 2;
                for (const se of shown) { this.legendItem(lg, se, W - colW, y, fl, s, hc, 170); y += rowH; }
                if (shown.length < this.series.length) this.legendMore(lg, this.series.slice(shown.length), W - colW, y, fl, s, hc);
                right += colW + 6;
            } else if (leg) {
                const alto = leg.filas.length * rowH;
                const y0 = s.legendPos === "bottom" ? H - alto - 2 + rowH / 2 : top + rowH / 2;
                leg.filas.forEach((f, k) => f.forEach(it => this.legendItem(lg, it.se, it.x, y0 + k * rowH, fl, s, hc, leg.nameW)));
                if (leg.hidden.length) this.legendMore(lg, leg.hidden, leg.plusX, y0 + (leg.filas.length - 1) * rowH, fl, s, hc);
                if (s.legendPos === "bottom") bottom += alto + 4; else top += alto + 2;
            }
        }

        // Títulos de eje, una vez para todos los paneles: abajo el eje horizontal y a la izquierda (girado) el vertical.
        // Vertical: columnas abajo y cuota a la izquierda; horizontal, al revés. Si el gráfico quedara sin sitio, no se dibujan.
        let left = 0;
        if (titles) {
            const tg = this.el("g", { class: "tcmk-axis-titles", "aria-hidden": "true" }, this.svg);
            if (bottomT && H - top - bottom - (bottomT.size + 6) >= 40) {
                const t = this.el("text", { x: (W - right) / 2, y: H - bottom - 2, "text-anchor": "middle", "font-size": bottomT.size, "font-weight": 600,
                    fill: hc.on ? hc.fg : bottomT.color }, tg);
                t.textContent = this.fit(bottomT.text, bottomT.size, W - right - 12);
                this.subSelectable(t, bottomT.obj, bottomT.label, powerbi.visuals.SubSelectionStylesType.Text);
                bottom += bottomT.size + 6;
            }
            if (leftT && W - right - (leftT.size + 6) >= 60) {
                const cy = top + (H - top - bottom) / 2;
                // Girado -90°: la línea base queda a la derecha y las letras suben hacia x = 0; se deja margen al borde.
                const bx = leftT.size + 3;
                const t = this.el("text", { x: bx, y: cy, "text-anchor": "middle", "font-size": leftT.size, "font-weight": 600,
                    transform: `rotate(-90 ${bx} ${cy.toFixed(1)})`, fill: hc.on ? hc.fg : leftT.color }, tg);
                t.textContent = this.fit(leftT.text, leftT.size, H - top - bottom - 8);
                this.subSelectable(t, leftT.obj, leftT.label, powerbi.visuals.SubSelectionStylesType.Text);
                left = leftT.size + 9;
            }
        }

        // Paneles (múltiplos pequeños con la misma escala)
        const panels = this.panels;
        const gap = panels.length > 1 ? clamp(s.smGap, 0, 60) : 0;
        const plotW = W - right - left, plotH = H - top - bottom;
        const autoCols = Math.max(1, Math.round(Math.sqrt(panels.length * (plotW / Math.max(1, plotH)))));
        const cols = panels.length === 1 ? 1 : Math.min(panels.length, s.smCols > 0 ? Math.round(s.smCols) : autoCols);
        const rows = Math.ceil(panels.length / cols);
        const cellW = (plotW - gap * (cols - 1)) / cols, cellH = (plotH - gap * (rows - 1)) / rows;
        const smTitle = this.fsz(s.smTitleSize, 6, 40);
        // Escala común en modo absoluto: la columna mayor de todos los paneles
        const all = panels.map(p => this.columnsOf(p, s));
        const maxCol = Math.max(1e-9, ...all.map(cs => Math.max(0, ...cs.map(c => c.total))));
        panels.forEach((panel, pi) => {
            const x0 = left + (pi % cols) * (cellW + gap), y0 = top + Math.floor(pi / cols) * (cellH + gap);
            const g = this.el("g", { transform: `translate(${x0.toFixed(1)},${y0.toFixed(1)})` }, this.svg);
            let titleH = 0;
            if (panel !== null) {
                if ((s.smBackground && !hc.on) || s.smBorder) {
                    this.el("rect", { x: 0.5, y: 0.5, width: Math.max(0, cellW - 1), height: Math.max(0, cellH - 1), rx: 2,
                        fill: s.smBackground && !hc.on ? s.smBackground : "none", stroke: s.smBorder ? (hc.on ? hc.fg : s.smBorderColor) : "none" }, g);
                }
                const t = this.el("text", { x: 6, y: smTitle + 2, "font-size": smTitle, "font-weight": s.smTitleBold ? 600 : 400, fill: hc.on ? hc.fg : s.smTitleColor }, g);
                t.textContent = this.fit(panel, smTitle, cellW - 12);
                titleH = smTitle + 6;
            }
            const pg = this.el("g", { transform: `translate(0,${titleH})` }, g);
            this.drawMekko(pg, all[pi], s, cellW, cellH - titleH, maxCol, hc, tiny || (panels.length > 4 && cellW < 240), !totals);
        });
    }

    /**
     * Texto, tamaño y color de un título de eje. Vacío = automático: el nombre del campo Columns con lo que mide su
     * ancho; en la cuota, "Share of column" (o el nombre de la medida, en valores absolutos).
     */
    private axisTitle(which: "col" | "share", s: Settings): { text: string; size: number; color: string; obj: string; label: string } | null {
        const cols = this.lastDv?.metadata?.columns || [];
        if (which === "col") {
            const field = cols.find(c => c.roles?.["category"])?.displayName || this.t("Role_category", "Columns (segments)");
            const text = s.colTitleText.trim() || this.t("UI_ColTitle", "{0} (width = size)").replace("{0}", field);
            return { text, size: this.fsz(s.colTitleSize, 6, 30), color: s.colTitleColor, obj: "columnLabels", label: this.t("Obj_columnLabels", "Column labels") };
        }
        const measure = cols.find(c => c.roles?.["value"])?.displayName || this.t("Role_value", "Value");
        const text = s.axisTitleText.trim() || (s.mode === "absolute" ? measure : this.t("UI_ShareTitle", "Share of column"));
        return { text, size: this.fsz(s.axisTitleSize, 6, 30), color: s.axisTitleColor, obj: "axis", label: this.t("Obj_axis", "Share axis") };
    }

    /**
     * El gráfico de un panel. Vertical: el ancho de cada columna es su parte del total y la altura de cada
     * celda su cuota dentro de la columna (o su valor, en modo absoluto). Horizontal: lo mismo girado.
     * Se reserva primero el área de dibujo y los adornos se quitan por orden si no caben.
     */
    private drawMekko(g: SVGGElement, cols: ColDraw[], s: Settings, W: number, H: number, maxCol: number,
        hc: { on: boolean; fg: string; bg: string; sel: string }, small: boolean, noTotals = false): void {
        if (!cols.length) return;
        const vertical = s.orientation !== "horizontal";
        const absolute = s.mode === "absolute";
        const grand = cols.reduce((t, c) => t + c.total, 0);
        const fc = this.fsz(s.colFont, 6, 30), ft = this.fsz(s.totalsFont, 6, 30), fa = this.fsz(s.axisFont, 6, 24);
        const focus = this.focusSeries(s);
        const showTotals = s.totals && !small && !noTotals;
        const showAxis = s.axis && !small;
        const longest = Math.max(...cols.map(c => this.textW(c.col, fc, s.colBold)));

        // Márgenes: medidos con el texto más largo y acotados a una parte del espacio
        let mL = 2, mR = 2, mT = 2, mB = 2;
        if (vertical) {
            if (showAxis) mL += Math.min(W * 0.12, this.textW(absolute ? this.shortFmt(maxCol) : "100%", fa) + 6);
            if (s.colLabels) mB += fc + 6;
            if (showTotals) mT += ft + 6;
            // La etiqueta "100%" se centra en el borde superior: sin este margen pisa el título del panel
            if (showAxis) mT = Math.max(mT, fa * 0.6 + 3);
        } else {
            if (s.colLabels) mL += Math.min(W * 0.3, longest + 8);
            if (showAxis) mB += fa + 6;
            if (showTotals) mR += Math.min(W * 0.2, this.textW("100.0 M (100%)", ft) + 6);
        }
        const pw = Math.max(10, W - mL - mR), ph = Math.max(10, H - mT - mB);
        const gapPx = clamp(s.gap, 0, 20);
        const along = vertical ? pw : ph;                         // eje de los anchos
        const avail = Math.max(1, along - gapPx * (cols.length - 1));
        const across = vertical ? ph : pw;                        // eje de las cuotas

        // Rejilla y eje de cuota
        if (showAxis) {
            const ax = this.el("g", { class: "tcmk-axis", "aria-hidden": "true" }, g);
            this.subSelectable(ax, "axis", this.t("Obj_axis", "Share axis"), powerbi.visuals.SubSelectionStylesType.Text);
            const ticks = [0, 0.25, 0.5, 0.75, 1];
            for (const f of ticks) {
                const lab = absolute ? this.shortFmt(maxCol * f) : this.pct(f);
                if (vertical) {
                    const y = mT + ph - f * ph;
                    if (s.gridlines && f > 0) this.el("line", { x1: mL, x2: mL + pw, y1: y, y2: y, stroke: hc.on ? hc.fg : (this.look()?.grid ?? "#E6E4E0"), "stroke-width": 1 }, ax);
                    const t = this.el("text", { x: mL - 4, y: y + fa * 0.35, "text-anchor": "end", "font-size": fa, fill: hc.on ? hc.fg : s.axisColor }, ax);
                    t.textContent = lab;
                } else {
                    const x = mL + f * pw;
                    if (s.gridlines && f > 0) this.el("line", { x1: x, x2: x, y1: mT, y2: mT + ph, stroke: hc.on ? hc.fg : (this.look()?.grid ?? "#E6E4E0"), "stroke-width": 1 }, ax);
                    const t = this.el("text", { x, y: mT + ph + fa + 3, "text-anchor": f === 0 ? "start" : f === 1 ? "end" : "middle", "font-size": fa, fill: hc.on ? hc.fg : s.axisColor }, ax);
                    t.textContent = lab;
                }
            }
        }

        const sById = new Map(this.series.map(x => [x.key, x]));
        const cellsG = this.el("g", { class: "tcmk-cells" }, g);
        this.subSelectable(cellsG, "series", this.t("Obj_series", "Series"), powerbi.visuals.SubSelectionStylesType.Shape);
        const labelsG = this.el("g", { class: "tcmk-labels", "pointer-events": "none" }, g);
        const colG = this.el("g", { class: "tcmk-collabels" }, g);
        this.subSelectable(colG, "columnLabels", this.t("Obj_columnLabels", "Column labels"), powerbi.visuals.SubSelectionStylesType.Text);
        const totG = this.el("g", { class: "tcmk-totals", "pointer-events": "none" }, g);
        const fl = this.fsz(s.labelFont, 6, 24);
        const showChange = !!(this.proActive && s.showChange && this.hasComparison);

        let pos = 0;
        for (const c of cols) {
            const size = c.total / grand * avail;
            const lenTotal = absolute ? c.total / maxCol * across : across;
            let acc = 0;
            for (const cell of c.cells) {
                const se = sById.get(cell.ser);
                if (!se) continue;
                const share = cell.value / c.total;
                const len = share * lenTotal;
                // vertical: x = pos, y desde abajo; horizontal: y = pos, x desde la izquierda
                const x = vertical ? mL + pos : mL + acc;
                const y = vertical ? mT + ph - acc - len : mT + pos;
                const w = vertical ? size : len, h = vertical ? len : size;
                acc += len;
                const cg = this.el("g", { "data-pt": cell.key, role: "option", tabindex: "-1", class: "tcmk-pt" }, cellsG);
                const dim = !!focus && s.dimOthers && se.key !== focus.key;
                const fill = hc.on ? (se.key === focus?.key ? hc.sel : hc.bg) : this.cellColor(se, cell, s);
                const alpha = clamp(s.opacity, 5, 100) / 100 * (dim ? (this.dimAlpha.get(se.key) ?? DIM_ALPHA) : 1);
                const rx = x.toFixed(2), ry = y.toFixed(2), rw = Math.max(0, w).toFixed(2), rh = Math.max(0, h).toFixed(2);
                this.el("rect", { x: rx, y: ry, width: rw, height: rh, fill, class: "tcmk-hit",
                    "fill-opacity": hc.on ? 1 : alpha,
                    stroke: hc.on ? hc.fg : (s.borderWidth > 0 ? s.borderColor : "none"), "stroke-width": hc.on ? 1 : clamp(s.borderWidth, 0, 6) }, cg);
                // Trama encima del color (D10): Others, series sin color o alto contraste
                const pat = this.patternOf(se, fill, s, hc);
                if (pat) this.el("rect", { x: rx, y: ry, width: rw, height: rh, fill: pat, "pointer-events": "none", class: "tcmk-pat" }, cg);
                cg.setAttribute("aria-label", `${c.col}, ${se.name}: ${this.fmt(cell.value, this.cellFmt(cell))}, ${this.pct(share, 1)}`);
                this.wire(cg, cell);

                // Etiqueta de la celda, solo si cabe
                if (s.labels && !small) {
                    const txt = this.cellLabel(s, se, cell, share, grand);
                    const chg = showChange && cell.cmp !== null && c.cmpTotal ? this.pp(share - cell.cmp / c.cmpTotal) : "";
                    const lines = chg ? 2 : 1;
                    const fl2 = Math.max(this.minFont, fl - 1);
                    const needW = Math.max(this.textW(txt, fl) * (s.labelBold ? 1.08 : 1), chg ? this.textW(chg, fl2) : 0) + 6;
                    if (txt && w >= needW && h >= fl * lines + 4 * lines) {
                        // Fondo real de la etiqueta: el relleno mezclado con el fondo según su opacidad (celda atenuada).
                        const under = hc.on ? fill : this.apparent(fill, alpha);
                        // En alto contraste, la tinta del tema: primer plano sobre el fondo y fondo sobre el color de selección.
                        const col = hc.on ? (fill === hc.bg ? hc.fg : hc.bg) : readableInk(s.labelColor, under, !s.labelColor);
                        const cy = y + h / 2 - (lines - 1) * (fl / 2);
                        const t = this.el("text", { x: x + w / 2, y: cy + fl * 0.35, "text-anchor": "middle", "font-size": fl, "font-weight": s.labelBold ? 700 : 400, fill: col }, labelsG);
                        // Sobre una trama, un halo del color de fondo de la celda para que el número se siga leyendo
                        const halo = pat ? { stroke: hc.on ? (fill === hc.bg ? hc.bg : fill) : under, "stroke-width": 3, "paint-order": "stroke", "stroke-linejoin": "round" } : null;
                        if (halo) for (const k in halo) t.setAttribute(k, String((halo as any)[k]));
                        t.textContent = txt;
                        if (chg) {
                            // Sin cambio (±0,0) va en la tinta de la etiqueta: ni sube ni baja.
                            const tone = chg.startsWith("±") ? col : share - cell.cmp / c.cmpTotal >= 0 ? s.posColor : s.negColor;
                            // Verde/rojo del cambio, con el tono ajustado hasta leerse sobre la celda (contraste ≥ 3,5),
                            // como en el Treemap; en alto contraste, la tinta del tema.
                            const t2 = this.el("text", { x: x + w / 2, y: cy + fl + 1 + fl * 0.35, "text-anchor": "middle", "font-size": fl2, "font-weight": 600,
                                fill: hc.on ? col : legibleTone(tone, under) }, labelsG);
                            if (halo) for (const k in halo) t2.setAttribute(k, String((halo as any)[k]));
                            t2.textContent = chg;
                        }
                    }
                }
            }

            // Nombre de la columna y su tamaño
            if (s.colLabels) {
                const lab = vertical ? this.fit(c.col, fc, Math.max(0, size - 2)) : this.fit(c.col, fc, mL - 8);
                if (lab) {
                    const t = this.el("text", vertical
                        ? { x: mL + pos + size / 2, y: mT + ph + fc + 3, "text-anchor": "middle", "font-size": fc, "font-weight": s.colBold ? 600 : 400, fill: hc.on ? hc.fg : s.colColor, "data-col": c.col, cursor: "pointer" }
                        : { x: mL - 6, y: mT + pos + size / 2 + fc * 0.35, "text-anchor": "end", "font-size": fc, "font-weight": s.colBold ? 600 : 400, fill: hc.on ? hc.fg : s.colColor, "data-col": c.col, cursor: "pointer" }, colG);
                    t.textContent = lab;
                    t.addEventListener("click", (e) => {
                        if (this.formatMode) return;
                        e.stopPropagation();
                        this.selectKeys(c.cells.map(x => x.key), (e as MouseEvent).ctrlKey || (e as MouseEvent).metaKey);
                    });
                }
            }
            if (showTotals) {
                const txt = this.shortFmt(c.total, this.commonFmt(c.cells)) + (s.totalsPct ? " (" + this.pct(c.total / grand) + ")" : "");
                const endAt = absolute ? lenTotal : across;
                if (vertical) {
                    const lab = this.fit(txt, ft, size - 2);
                    if (lab) { const t = this.el("text", { x: mL + pos + size / 2, y: mT + ph - endAt - 4, "text-anchor": "middle", "font-size": ft, fill: hc.on ? hc.fg : s.totalsColor }, totG); t.textContent = lab; }
                } else if (size >= ft + 2) {
                    const t = this.el("text", { x: mL + endAt + 4, y: mT + pos + size / 2 + ft * 0.35, "font-size": ft, fill: hc.on ? hc.fg : s.totalsColor }, totG);
                    t.textContent = txt;
                }
            }
            pos += size + gapPx;
        }
    }

    private cellLabel(s: Settings, se: Series, cell: Cell, share: number, grand: number): string {
        const d = clamp(Math.round(s.labelDecimals), 0, 3);
        switch (s.labelContent) {
            case "value": return this.shortFmt(cell.value, this.cellFmt(cell));
            // El área de la celda ya es su parte del mercado: aquí se escribe ese número
            case "total": return this.pct(grand ? cell.value / grand : 0, d);
            case "both": return this.shortFmt(cell.value, this.cellFmt(cell)) + " · " + this.pct(share, d);
            case "name": return se.name + " " + this.pct(share, d);
            default: return this.pct(share, d);
        }
    }

    /**
     * Color de una celda. Others y la serie propia conservan el suyo; las demás: la regla fx de su fila (F04), si no
     * el color fijo de "Color de las celdas", y si no el de su serie.
     */
    private cellColor(se: Series, cell: Cell, s: Settings): string {
        if (se.others) return se.color;
        const focus = this.focusSeries(s);
        if (focus && focus.key === se.key) return se.color;
        return cell.rule || s.cellColor || se.color;
    }

    /**
     * Color aparente de una celda con opacidad alpha: su relleno mezclado con el fondo (el del estilo; en Boardroom y
     * Aurora es oscuro; sin estilo, el fondo del visual o blanco). Es el fondo real sobre el que se lee su etiqueta.
     */
    private apparent(fill: string, alpha: number): string {
        if (alpha >= 0.999 || !hexToRgb(fill)) return fill;
        const look = this.look();
        const bg = look ? look.bg : (hexToRgb(this.s.background || "") ? this.s.background : "#FFFFFF");
        return lerpColor(bg, fill, alpha);
    }

    /** Texto blanco o casi negro según la luminancia del fondo. */
    private contrast(color: string): string {
        const m = /^#?([0-9a-f]{6})$/i.exec(color || "");
        if (!m) return "#252423";
        const n = parseInt(m[1], 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
        const L = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        return L < 0.6 ? "#FFFFFF" : "#252423";
    }

    private legendItem(lg: SVGGElement, se: Series, x: number, y: number, fl: number, s: Settings, hc: { on: boolean; fg: string }, nameW = 170): void {
        const it = this.el("g", { "data-series": se.key, cursor: se.others ? "default" : "pointer" }, lg);
        // Con serie propia, la muestra va atenuada como sus celdas: si no, una serie del mismo color que el foco se confunde con él.
        const focus = this.focusSeries(s);
        const dim = !!focus && s.dimOthers && se.key !== focus.key;
        // Muestra como sus celdas: en alto contraste el fondo con borde y su trama, para distinguir las series sin color.
        const hcf = this.hc();
        const isFocus = !!focus && focus.key === se.key;
        const fill = hc.on ? (isFocus ? hcf.sel : hcf.bg) : (se.others || isFocus ? se.color : (s.cellColor || se.color));
        this.el("rect", { x, y: y - fl / 2, width: fl, height: fl, rx: 2, fill, "fill-opacity": hc.on || !dim ? 1 : (this.dimAlpha.get(se.key) ?? DIM_ALPHA),
            stroke: hc.on ? hc.fg : "none", "stroke-width": 1 }, it);
        const pat = this.patternOf(se, fill, s, hcf);
        if (pat) this.el("rect", { x, y: y - fl / 2, width: fl, height: fl, rx: 2, fill: pat, "pointer-events": "none", class: "tcmk-pat" }, it);
        const t = this.el("text", { x: x + fl + 5, y: y + fl * 0.35, "font-size": fl, fill: hc.on ? hc.fg : s.legendColor }, it);
        t.textContent = this.fit(se.name, fl, nameW);
        if (t.textContent !== se.name) this.el("title", {}, it).textContent = se.name;
        it.addEventListener("click", (e) => {
            if (this.formatMode) return;
            e.stopPropagation();
            const keys: string[] = [];
            this.cells.forEach(c => { if (c.ser === se.key) keys.push(c.key); });
            this.selectKeys(keys, (e as MouseEvent).ctrlKey || (e as MouseEvent).metaKey);
        });
    }

    /**
     * Frase de la serie propia (Pro): cuota total, columna más fuerte y más débil; con comparación, el cambio
     * en puntos y la columna que más lo explica (la de mayor peso × cambio de cuota).
     */
    private summaryLines(s: Settings, focus: Series): string[] {
        const cols = this.columnsOf(null, s);
        const grand = cols.reduce((t, c) => t + c.total, 0);
        if (!grand) return [];
        const mine = (c: ColDraw) => c.cells.find(x => x.ser === focus.key);
        const own = cols.reduce((t, c) => t + (mine(c)?.value ?? 0), 0);
        const shares = cols.map(c => ({ c, sh: (mine(c)?.value ?? 0) / c.total }));
        const best = shares.slice().sort((a, b) => b.sh - a.sh)[0];
        const worst = shares.slice().sort((a, b) => a.sh - b.sh)[0];
        const l1 = this.t("UI_Summary", "{0} holds {1} of a {2} market; strongest in {3} ({4}), weakest in {5} ({6}).")
            .replace("{0}", focus.name).replace("{1}", this.pct(own / grand)).replace("{2}", this.shortFmt(grand))
            .replace("{3}", best.c.col).replace("{4}", this.pct(best.sh)).replace("{5}", worst.c.col).replace("{6}", this.pct(worst.sh));
        const out = [l1];
        if (this.proActive && s.changeSentence && this.hasComparison) {
            const cmpGrand = cols.reduce((t, c) => t + (c.cmpTotal ?? 0), 0);
            const ownCmp = cols.reduce((t, c) => t + (mine(c)?.cmp ?? 0), 0);
            if (cmpGrand > 0) {
                const d = own / grand - ownCmp / cmpGrand;
                const driver = cols.map(c => {
                    const m = mine(c);
                    const dsh = c.cmpTotal ? (m?.value ?? 0) / c.total - (m?.cmp ?? 0) / c.cmpTotal : 0;
                    return { c, eff: dsh * c.total / grand };
                }).sort((a, b) => Math.abs(b.eff) - Math.abs(a.eff))[0];
                out.push(this.t("UI_SummaryChange", "{0} vs the comparison period, mostly from {1}.").replace("{0}", this.pp(d)).replace("{1}", driver.c.col));
            }
        }
        return out;
    }

    private renderNote(): boolean {
        const msgs: string[] = [];
        if (this.totalColumns > this.columns.length)
            msgs.push(this.t("UI_ColumnsOf", "Showing {0} of {1} columns.").replace("{0}", String(this.columns.length)).replace("{1}", String(this.totalColumns)));
        const s = this.effective();
        if (s.focus.trim() && !this.focusSeries(s))
            msgs.push(this.t("UI_FocusMissing", "No series is called “{0}”. Check Format → Focus series.").replace("{0}", s.focus.trim()));
        const wanted = this.attemptedPro();
        if (!this.proActive && wanted.length && !this.isEditing())
            msgs.push(this.t("UI_ReadingFree", "Pro features not applied in reading view:") + " " + wanted.map(w => w.label).join(", "));
        this.noteEl.style.display = msgs.length ? "block" : "none";
        this.noteEl.textContent = msgs.join(" · ");
        const hc = this.hc();
        this.noteEl.style.color = hc.on ? hc.fg : (this.look() ? this.inkDim() : "#83827D");
        return msgs.length > 0;
    }

    /** Marca "Pro preview" común a la cartera (src/comun/watermark.ts): solo editando y sin licencia. */
    private renderWatermark(W: number, H: number): void {
        const wanted = this.isPreview() ? this.attemptedPro() : [];
        const hc = this.hc();
        renderProWatermark(this.watermarkEl, wanted.length ? {
            width: W, height: H, title: this.t("UI_ProPreview", "Pro preview"), features: wanted.map(x => x.label),
            highContrast: hc.on ? { foreground: hc.fg, background: hc.bg } : null,
        } : null);
    }

    /** Icono de aviso de la cabecera: filas que Power BI no ha entregado. */
    private warnings(): void {
        const host: any = this.host;
        if (typeof host.displayWarningIcon !== "function") return;
        if (this.truncatedAt) {
            host.displayWarningIcon(this.t("UI_WarnTitle", "Marimekko chart"), (this.isDesktop
                ? this.t("UI_WarnRowsDesktop", "In Power BI Desktop the visual uses the first rows Power BI sends: publish to the service to use them all.")
                : this.t("UI_WarnRows", "Power BI sent only part of the rows: the chart reflects the rows received.")) + " (" + this.truncatedAt + ")");
        } else if (typeof host.hideWarningIcon === "function") host.hideWarningIcon();
    }

    // ── Asistente de configuración ────────────────────────────────────────────

    /**
     * Panel flotante que guía la configuración mientras se edita. No puede tocar los pozos de campos
     * (eso solo lo hace el usuario): comprueba lo que ya está, explica qué da cada campo y aplica la
     * plantilla elegida. Al terminar o cerrarlo se guarda style.guide = false; se reabre desde
     * Formato → Plantilla de estilo. persistProperties sale de un clic, nunca del callback de selección.
     */
    private renderGuide(): void {
        const el = this.guideEl;
        while (el.firstChild) el.removeChild(el.firstChild);
        const vp = this.lastOptions?.viewport;
        if (!this.isEditing() || this.formatMode || !this.s.guide || !this.canInteract || !vp || vp.width < 360 || vp.height < 220) return;
        const hc = this.hc().on;
        const azul = hc ? "#FFFF00" : "#2B6CB0";
        const fg = hc ? "#FFFFFF" : "#252423";
        const muted = hc ? "#FFFFFF" : "#605E5C";
        el.style.display = "block";
        el.style.background = hc ? "#000000" : "#FFFFFF";
        el.style.borderColor = azul;
        el.style.color = fg;
        el.setAttribute("role", "dialog");
        el.setAttribute("aria-label", this.t("Guide_Title", "Setup guide"));
        el.onclick = (e) => e.stopPropagation();
        el.onkeydown = (e) => e.stopPropagation();
        const terminar = () => {
            this.guideStep = 2;
            this.host.persistProperties({ merge: [{ objectName: "style", selector: null as any, properties: { guide: false } }] });
        };
        const boton = (texto: string, principal: boolean, accion: () => void) => {
            const b = document.createElement("button");
            b.type = "button"; b.textContent = texto;
            b.className = principal ? "tcmk-g-btn tcmk-g-main" : "tcmk-g-btn";
            b.style.borderColor = azul;
            b.style.background = principal ? azul : "transparent";
            b.style.color = principal ? (hc ? "#000000" : "#FFFFFF") : azul;
            b.addEventListener("click", accion);
            return b;
        };
        const cab = document.createElement("div"); cab.className = "tcmk-g-head";
        const paso = document.createElement("div");
        paso.textContent = this.t("Guide_Step", "Setup · step {0} of 3").replace("{0}", String(this.guideStep));
        paso.style.color = azul;
        const cerrar = document.createElement("button");
        cerrar.type = "button"; cerrar.textContent = "✕"; cerrar.className = "tcmk-g-close";
        cerrar.title = this.t("Guide_Close", "Close the guide");
        cerrar.setAttribute("aria-label", cerrar.title);
        cerrar.style.color = muted;
        cerrar.addEventListener("click", terminar);
        cab.appendChild(paso); cab.appendChild(cerrar);
        el.appendChild(cab);
        const titulo = document.createElement("div"); titulo.className = "tcmk-g-title";
        el.appendChild(titulo);
        const pie = document.createElement("div"); pie.className = "tcmk-g-foot";
        if (this.guideStep !== 3) {
            titulo.textContent = this.t("Guide_Compare", "Read the market");
            const items: [boolean, string, string][] = [
                [this.roleBound("series"), this.t("Role_series", "Series (stack)"), this.t("Guide_SeriesWhy", "who shares each segment: company, brand, competitor")],
                [!!this.s.focus.trim(), this.t("Prop_focus_name", "Focus series (Pro)"), this.t("Guide_FocusWhy", "your company highlighted, with a summary sentence")],
                [this.roleBound("comparison"), this.t("Role_comparison", "Comparison value (Pro)"), this.t("Guide_CompWhy", "the change in share, in points, on every cell")],
                [this.roleBound("panel"), this.t("Role_panel", "Small multiples (Pro)"), this.t("Guide_PanelWhy", "one chart per year or country, same scale")],
            ];
            const lista = document.createElement("div"); lista.setAttribute("role", "list");
            for (const [hecho, nombre, porque] of items) {
                const f = document.createElement("div"); f.setAttribute("role", "listitem"); f.className = "tcmk-g-item";
                const marca = document.createElement("span");
                marca.textContent = hecho ? "✓" : "○";
                marca.setAttribute("aria-label", hecho ? this.t("Guide_Done", "added") : this.t("Guide_Todo", "not added"));
                marca.style.color = hecho ? (hc ? "#00FF00" : "#107C10") : muted;
                const txt = document.createElement("span");
                const b = document.createElement("b"); b.textContent = nombre;
                txt.appendChild(b); txt.appendChild(document.createTextNode(" — " + porque));
                txt.style.color = hecho ? muted : fg;
                f.appendChild(marca); f.appendChild(txt);
                lista.appendChild(f);
            }
            el.appendChild(lista);
            const nota = document.createElement("div"); nota.className = "tcmk-g-note"; nota.style.color = muted;
            nota.textContent = this.t("Guide_Wells", "Drag the fields into the field wells; this list updates by itself. All optional.");
            el.appendChild(nota);
            pie.appendChild(boton(this.t("Guide_Next", "Next"), true, () => { this.guideStep = 3; this.renderGuide(); }));
        } else {
            titulo.textContent = this.t("Guide_Style", "Pick a style");
            const rejilla = document.createElement("div"); rejilla.className = "tcmk-g-grid";
            // Los siete estilos son gratis en este visual: sin "(Pro)". Los nombres de la colección no se traducen.
            for (const nombre of ["clean", ...COLLECTION_STYLES]) {
                const tpl = { ...DEFAULTS, ...TEMPLATES[nombre] };
                const chip = document.createElement("button");
                chip.type = "button";
                const actual = nombre === this.s.template;
                chip.setAttribute("aria-pressed", String(actual));
                chip.className = "tcmk-g-chip";
                chip.style.borderColor = actual ? azul : "#C8C6C4";
                chip.style.borderWidth = actual ? "2px" : "1px";
                chip.appendChild(this.miniMekko(tpl, STYLE_TOKENS[nombre] ?? null, hc));
                const etq = document.createElement("div");
                etq.textContent = nombre === "clean" ? this.t("Enum_tpl_clean", "Report theme") : nombre.charAt(0).toUpperCase() + nombre.slice(1);
                chip.appendChild(etq);
                chip.addEventListener("click", () => {
                    this.host.persistProperties({ merge: [{ objectName: "style", selector: null as any, properties: { template: nombre } }] });
                });
                rejilla.appendChild(chip);
            }
            el.appendChild(rejilla);
            pie.appendChild(boton(this.t("Guide_Back", "Back"), false, () => { this.guideStep = 2; this.renderGuide(); }));
            pie.appendChild(boton(this.t("Guide_Finish", "Finish"), true, terminar));
        }
        el.appendChild(pie);
    }

    /** Miniatura de un estilo: tres columnas de ancho distinto con tres series, con su paleta y su fondo. */
    private miniMekko(t: Settings, tok: StyleTokens | null, hc: boolean): SVGSVGElement {
        const svg = document.createElementNS(SVG, "svg") as SVGSVGElement;
        svg.setAttribute("width", "60"); svg.setAttribute("height", "44"); svg.setAttribute("aria-hidden", "true");
        if (tok && !hc) svg.style.background = tok.grad ?? tok.bg;
        const colors = hc ? ["#FFFFFF", "#AAAAAA", "#555555"] : tok ? tok.series.slice(0, 3) : this.series.filter(x => !x.others).slice(0, 3).map(x => this.host.colorPalette.getColor(x.name).value).concat(["#2B6CB0", "#7CB5D1", "#C8C6C4"]).slice(0, 3);
        const widths = [26, 16, 12], shares = [[0.5, 0.3, 0.2], [0.3, 0.45, 0.25], [0.6, 0.2, 0.2]];
        const gap = Math.min(3, t.gap);
        let x = 2;
        widths.forEach((w, i) => {
            let y = 42;
            shares[i].forEach((sh, k) => {
                const h = sh * 38;
                y -= h;
                this.el("rect", { x, y, width: w, height: h, fill: colors[k], stroke: t.borderWidth > 0 ? (hc ? "#000000" : t.borderColor) : "none", "stroke-width": Math.min(1.5, t.borderWidth) }, svg);
            });
            x += w + gap;
        });
        return svg;
    }

    // ── Interacción ───────────────────────────────────────────────────────────

    private wire(g: SVGGElement, cell: Cell): void {
        g.addEventListener("click", (e) => {
            if (this.formatMode) return;
            e.stopPropagation();
            this.keyboardNav = false;
            this.selectKeys([cell.key], e.ctrlKey || e.metaKey);
        });
        g.addEventListener("contextmenu", (e) => {
            e.preventDefault(); e.stopPropagation();
            if (!this.canInteract) return;
            this.selectionManager.showContextMenu(this.menuId(cell), { x: e.clientX, y: e.clientY });
        });
        g.addEventListener("mousemove", (e) => this.showTooltip(cell, e.clientX, e.clientY));
        g.addEventListener("mouseleave", () => this.host.tooltipService.hide({ immediately: false, isTouchEvent: false }));
        g.addEventListener("focus", () => { const r = g.getBoundingClientRect(); this.showTooltip(cell, r.left + r.width / 2, r.top); });
        g.addEventListener("blur", () => this.host.tooltipService.hide({ immediately: true, isTouchEvent: false }));
        g.addEventListener("keydown", (e: KeyboardEvent) => {
            this.keyboardNav = true;
            const all = Array.from(this.svg.querySelectorAll<SVGGElement>("g[data-pt]"));
            const i = all.indexOf(g);
            const go = (j: number) => {
                const k = (j + all.length) % all.length;
                all.forEach((x, m) => x.setAttribute("tabindex", m === k ? "0" : "-1"));
                this.focusKey = all[k]?.getAttribute("data-pt") || "";
                all[k]?.focus();
            };
            let handled = true;
            switch (e.key) {
                case "ArrowRight": case "ArrowDown": go(i + 1); break;
                case "ArrowLeft": case "ArrowUp": go(i - 1); break;
                case "Home": go(0); break;
                case "End": go(all.length - 1); break;
                case "Enter": case " ": this.selectKeys([cell.key], e.ctrlKey || e.metaKey); break;
                case "Escape": if (this.canInteract) this.selectionManager.clear().then(() => this.paintSelection()); break;
                case "ContextMenu": {
                    const r = g.getBoundingClientRect();
                    if (this.canInteract) this.selectionManager.showContextMenu(this.menuId(cell), { x: r.left + r.width / 2, y: r.top });
                    break;
                }
                default: handled = false;
            }
            if (handled) { e.preventDefault(); e.stopPropagation(); }
        });
    }

    private keyOf(id: any): string {
        const k = id?.getKey?.();
        if (typeof k === "string") return k;
        const sel = id?.getSelector?.();
        return sel ? JSON.stringify(sel) : "#" + (++this.keySeq);
    }

    /** Celdas seleccionadas según Power BI (clic propio o marcador restaurado). */
    private selectedCells(): Set<string> {
        const own = this.selectionManager.getSelectionIds() as ISelectionId[];
        const sel = own.length ? own : this.restoredIds;
        const out = new Set<string>();
        for (const id of sel) {
            const k = this.idToCell.get(this.keyOf(id));
            if (k) { out.add(k); continue; }
            // Un marcador puede devolver la identidad con otra forma que la del clic: equals/includes contra cada celda.
            const igual = (x: any) => !!(x?.equals?.(id) || (id as any)?.equals?.(x) || (id as any)?.includes?.(x, true) || x?.includes?.(id, true));
            this.cells.forEach(c => { if (c.ids.some(igual)) out.add(c.key); });
        }
        return out;
    }

    /**
     * Selección por celdas, con TODAS sus identidades ("Others" junta muchas filas). Seleccionar una lista
     * no alterna, así que volver a pulsar lo único seleccionado se resuelve aquí con clear().
     */
    /** Menú contextual: una celda con varias filas (Others) no se reduce a la primera; se abre sin dato. */
    private menuId(cell: { ids: ISelectionId[] }): ISelectionId {
        return cell.ids.length === 1 ? cell.ids[0] : ({} as ISelectionId);
    }

    private selectKeys(keys: string[], multi: boolean): void {
        if (!this.canInteract || !keys.length) return;
        const actual = this.selectedCells();
        this.restoredIds = [];
        let siguiente: Set<string>;
        if (multi) {
            siguiente = new Set(actual);
            const todos = keys.every(k => actual.has(k));
            keys.forEach(k => todos ? siguiente.delete(k) : siguiente.add(k));
        } else {
            const mismo = actual.size === keys.length && keys.every(k => actual.has(k));
            siguiente = mismo ? new Set() : new Set(keys);
        }
        const ids: ISelectionId[] = [];
        siguiente.forEach(k => { const c = this.cells.get(k); if (c) ids.push(...c.ids); });
        (ids.length ? this.selectionManager.select(ids, false) : this.selectionManager.clear()).then(() => this.paintSelection());
    }

    private showTooltip(cell: Cell, x: number, y: number): void {
        const se = this.series.find(z => z.key === cell.ser);
        const s = this.effective();
        const col = this.columnsOf(cell.panel, s).find(c => c.col === cell.col);
        const f = this.formatter(this.cellFmt(cell));
        const grand = this.columnsOf(cell.panel, s).reduce((t, c) => t + c.total, 0);
        const items: powerbi.extensibility.VisualTooltipDataItem[] = [];
        if (cell.panel !== null) items.push({ displayName: this.t("UI_Panel", "Panel"), value: cell.panel });
        items.push({ displayName: this.lastDv?.metadata?.columns?.find(c => c.roles?.["category"])?.displayName || this.t("Role_category", "Columns"), value: cell.col });
        if (se) items.push({ displayName: this.lastDv?.metadata?.columns?.find(c => c.roles?.["series"])?.displayName || this.t("Role_series", "Series"), value: se.name, color: this.cellColor(se, cell, s) } as any);
        items.push({ displayName: this.lastDv?.metadata?.columns?.find(c => c.roles?.["value"])?.displayName || this.t("Role_value", "Value"), value: f(cell.value) });
        if (col) {
            items.push({ displayName: this.t("UI_ShareOfColumn", "Share of {0}").replace("{0}", cell.col), value: this.pct(cell.value / col.total, 1) });
            if (grand) {
                items.push({ displayName: this.t("UI_CellOfTotal", "% of the total"), value: this.pct(cell.value / grand, 1) });
                items.push({ displayName: this.t("UI_ColumnSize", "{0}, % of the total").replace("{0}", cell.col), value: this.pct(col.total / grand, 1) });
            }
            if (this.proActive && cell.cmp !== null && col.cmpTotal) {
                const prev = cell.cmp / col.cmpTotal;
                items.push({ displayName: this.t("UI_PrevShare", "Share in the comparison period"), value: this.pct(prev, 1) });
                items.push({ displayName: this.t("UI_ShareChange", "Change in share"), value: this.pp(cell.value / col.total - prev) });
            }
        }
        if (cell.hl !== null && this.hasHighlights) items.push({ displayName: this.t("UI_Highlighted", "Highlighted"), value: f(cell.hl) });
        for (const tp of cell.tips) items.push({ displayName: tp.name, value: tp.value });
        this.host.tooltipService.show({ dataItems: items as any, identities: cell.ids, coordinates: [x, y], isTouchEvent: false });
    }

    private paintSelection(): void {
        // Foco del teclado (D10): color y grosor de Accesibilidad; en alto contraste, el color de selección del tema.
        const sysHc = !!(this.host.colorPalette as any)?.isHighContrast;
        this.root.style.setProperty("--tcmk-focus", sysHc ? this.hc().sel : (this.s.a11yFocusColor || "#1F4E80"));
        this.root.style.setProperty("--tcmk-focus-w", clamp(this.s.a11yFocusWidth, 1, 6) + "px");
        const elegidos = this.selectedCells();
        const has = elegidos.size > 0;
        const seriesOn = new Set<string>();
        elegidos.forEach(k => { const c = this.cells.get(k); if (c) seriesOn.add(c.ser); });
        this.svg.querySelectorAll<SVGGElement>("g[data-pt]").forEach(g => {
            const key = g.getAttribute("data-pt") || "";
            const cell = this.cells.get(key);
            // Resaltado de otros visuales: la celda sin parte resaltada se atenúa, como en los nativos
            const hlOff = this.hasHighlights && !has && (!cell || !cell.hl);
            const on = !has || elegidos.has(key);
            g.setAttribute("opacity", hlOff ? "0.35" : on ? "1" : "0.3");
            g.setAttribute("aria-selected", has && on ? "true" : "false");
        });
        this.svg.querySelectorAll<SVGGElement>("g[data-series]").forEach(g => {
            g.setAttribute("opacity", !has || seriesOn.has(g.getAttribute("data-series") || "") ? "1" : "0.4");
        });
        const all = this.svg.querySelectorAll<SVGGElement>("g[data-pt]");
        if (all.length && !this.svg.querySelector("g[data-pt][tabindex='0']")) {
            const f = Array.from(all).find(g => g.getAttribute("data-pt") === this.focusKey) || all[0];
            f.setAttribute("tabindex", "0");
        }
        if (this.keyboardNav) this.svg.querySelector<SVGGElement>("g[data-pt][tabindex='0']")?.focus();
        this.svg.setAttribute("aria-label", this.t("UI_AriaChart", "Marimekko chart") + ": " + this.columns.length + " " + this.t("UI_AriaColumns", "columns") + ", " + this.series.length + " " + this.t("UI_AriaSeries", "series"));
    }

    // ── Pantalla de inicio ────────────────────────────────────────────────────

    /**
     * Qué es, cómo empezar con los pozos reales, ayuda y qué añade el Pro. Tres tamaños. Los enlaces
     * solo se abren al hacer clic (host.launchUrl); el Pro es texto, sin botón de compra.
     */
    private landing(w: number, h: number): void {
        this.svg.style.display = "none";
        const el = this.landingEl;
        while (el.firstChild) el.removeChild(el.firstChild);
        const size = (w >= 600 && h >= 340) ? "l" : (w >= 360 && h >= 220) ? "m" : "s";
        el.className = "tcmk-landing tcmk-landing-" + size;
        el.style.display = "flex";
        const hc = this.hc();
        const fg = hc.on ? hc.fg : "";
        const mk = (tag: string, cls?: string, text?: string): HTMLElement => {
            const n = document.createElement(tag);
            if (cls) n.className = cls;
            if (text !== undefined) n.textContent = text;
            if (fg) n.style.color = fg;
            return n;
        };
        const T = (k: string, d: string) => this.t(k, d);
        const colW = T("Role_category", "Columns (segments)"), val = T("Role_value", "Value"), ser = T("Role_series", "Series (stack)");
        const box = mk("div", "tcmk-l-box");
        el.appendChild(box);
        const head = mk("div", "tcmk-l-head");
        const img = document.createElement("img");
        img.src = LANDING_ICON; img.alt = ""; img.className = "tcmk-l-icon";
        head.appendChild(img);
        const titles = mk("div");
        titles.appendChild(mk("div", "tcmk-l-title", "Marimekko & Mekko Chart by TCViz"));
        if (size !== "s") titles.appendChild(mk("div", "tcmk-l-tag", size === "l"
            ? T("Landing_Tagline", "Where are you strong in a big market? Column width is the size of each segment; the stack is who shares it.")
            : T("Landing_TaglineShort", "Market size and share in one chart.")));
        head.appendChild(titles);
        box.appendChild(head);
        const link = (txt: string, url: string, cls: string): HTMLElement => {
            const a = mk("a", cls) as HTMLAnchorElement;
            a.href = url; a.tabIndex = 0; a.textContent = txt;
            if (hc.on) { a.style.background = "transparent"; a.style.borderColor = fg; }
            const open = (e: Event) => { e.preventDefault(); e.stopPropagation(); this.host.launchUrl(url); };
            a.addEventListener("click", open);
            a.addEventListener("keydown", (e: KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") open(e); });
            return a;
        };
        const links: [string, string, string][] = [
            [T("Landing_Guide", "Guide"), T("Landing_GuideSub", "support page"), URL_GUIDE],
            [T("Landing_Product", "Product page"), "tcviz.com", URL_PRODUCT],
        ];
        if (URL_VIDEO) links.push([T("Landing_Video", "Video"), "YouTube", URL_VIDEO]);
        if (size === "s") {
            box.appendChild(mk("p", "tcmk-l-do", T("Landing_Small", "Add {col}, {ser} and {val}.").replace("{col}", colW).replace("{val}", val).replace("{ser}", ser)));
            const row = mk("div", "tcmk-l-inline");
            row.appendChild(link(links[0][0], links[0][2], "tcmk-l-a"));
            box.appendChild(row);
            return;
        }
        const L = size === "l";
        const steps = mk("ol", "tcmk-l-steps");
        const step = (n: number, well: string, txt: string) => {
            const li = mk("li");
            const num = mk("b", "tcmk-l-n", String(n));
            if (hc.on) { num.style.background = fg; num.style.color = hc.bg; }
            li.appendChild(num);
            const sp = mk("span");
            sp.appendChild(mk("strong", "tcmk-l-well", well));
            sp.appendChild(document.createTextNode(" · " + txt));
            li.appendChild(sp);
            steps.appendChild(li);
        };
        step(1, colW, L ? T("Landing_Step1", "the segments of the market: channel, region, category") : T("Landing_Step1Short", "the market segments"));
        step(2, ser, L ? T("Landing_Step2", "who shares each segment: company, brand, competitor") : T("Landing_Step2Short", "who shares them"));
        step(3, val, L ? T("Landing_Step3", "sales, volume or units") : T("Landing_Step3Short", "sales or volume"));
        if (L) {
            const cols = mk("div", "tcmk-l-cols");
            const c1 = mk("div");
            c1.appendChild(mk("div", "tcmk-l-lbl", T("Landing_Start", "Start in 3 steps")));
            c1.appendChild(steps);
            const c2 = mk("div");
            c2.appendChild(mk("div", "tcmk-l-lbl", T("Landing_Help", "Help")));
            const list = mk("div", "tcmk-l-links");
            for (const [txt, sub, url] of links) {
                const a = link(txt, url, "tcmk-l-card");
                a.appendChild(mk("small", "tcmk-l-sub", sub));
                list.appendChild(a);
            }
            c2.appendChild(list);
            cols.appendChild(c1); cols.appendChild(c2);
            box.appendChild(cols);
        } else {
            box.appendChild(steps);
            const row = mk("div", "tcmk-l-inline");
            for (const l of links) row.appendChild(link(l[1] === "tcviz.com" ? "tcviz.com" : l[0], l[2], "tcmk-l-a"));
            box.appendChild(row);
        }
        if (!this.isPro) {
            const pro = mk("div", "tcmk-l-pro");
            const chip = mk("span", "tcmk-l-chip", "Pro");
            if (hc.on) { chip.style.background = "transparent"; chip.style.border = "1px solid " + fg; }
            pro.appendChild(chip);
            pro.appendChild(mk("span", undefined, L
                ? T("Landing_Pro", "Up to 12 named series, your company highlighted with a summary sentence, the change in share against a prior period, small multiples, horizontal bars, absolute values and % of the total labels.")
                : T("Landing_ProShort", "More series, your company highlighted, change in share, small multiples.")));
            box.appendChild(pro);
        }
    }

    // ── Licencia ──────────────────────────────────────────────────────────────

    /** Se pide una vez, cuando hay datos. Al llegar se repinta sin llamar a update(). */
    private requestLicense(): void {
        if (this.licenseRequested) return;
        this.licenseRequested = true;
        if (this.isPro) { this.licenseResolved = true; return; }
        try {
            const lm: any = (this.host as any).licenseManager;
            if (!lm) { this.licenseEnvUnsupported = true; this.licenseResolved = true; return; }
            lm.getAvailableServicePlans().then(
                (r: any) => {
                    if (r?.isLicenseUnsupportedEnv === true || r?.isLicenseInfoAvailable === false) this.licenseEnvUnsupported = true;
                    const plans: any[] = r?.plans ?? [];
                    // Solo Active y Warning (periodo de gracia por un problema de pago) son licencias utilizables.
                    if (plans.some(p => isOurPaidPlan(p.spIdentifier) && (p.state === STATE_ACTIVE || p.state === STATE_WARNING))) this.isPro = true;
                    this.licenseResolved = true;
                    this.refreshAfterLicense();
                },
                () => { this.licenseEnvUnsupported = true; this.licenseResolved = true; this.refreshAfterLicense(); });
        } catch {
            this.licenseEnvUnsupported = true; this.licenseResolved = true;
        }
    }

    private refreshAfterLicense(): void {
        if (this.destroyed || !this.lastOptions) return;
        // Las funciones Pro cambian qué se lee (series con nombre, comparación, paneles): se recalcula y se repinta.
        this.hasData = this.readData(this.lastDv);
        this.draw();
    }

    private cancelLicenseIcon(): void {
        if (this.licenseIconTimer !== null) { window.clearTimeout(this.licenseIconTimer); this.licenseIconTimer = null; }
    }

    private clearLicenseNotice(): void {
        this.lastBlockedNotice = "";
        this.cancelLicenseIcon();
        if (!this.licenseIconShown) return;
        this.licenseIconShown = false;
        try { (this.host as any).licenseManager?.clearLicenseNotification?.(); } catch { /* best-effort */ }
    }

    /**
     * Avisos de Power BI, nunca una interfaz de licencias propia. Orden: limpiar lo que haya, banner
     * con la función, y ~10 s después la barra Upgrade, que es la que lleva a la compra.
     */
    private notifyProFeatureBlocked(): void {
        const lm: any = (this.host as any).licenseManager;
        if (!lm) return;
        if (this.isPro) { this.clearLicenseNotice(); return; }
        const wanted = this.attemptedPro();
        if (!wanted.length) { this.clearLicenseNotice(); return; }
        if (!this.licenseResolved || this.licenseEnvUnsupported) return;
        const signature = wanted.map(w => w.id).join("|") + "|" + JSON.stringify(this.lastDv?.metadata?.objects ?? {});
        if (signature === this.lastBlockedNotice) return;
        this.lastBlockedNotice = signature;
        this.licenseIconShown = true;
        const list = wanted.map(w => w.label).join(", ");
        const msg = (this.isPreview()
            ? this.t("UI_NoticePreview", "Marimekko chart: {0} — part of the Pro plan, shown here as a watermarked preview. Reading view shows the free result.")
            : this.t("UI_NoticeBlocked", "Marimekko chart: {0} — part of the Pro plan. Get a licence to enable it.")).replace("{0}", list);
        const show = () => {
            try { lm.notifyFeatureBlocked?.(msg.slice(0, 500)); } catch { /* best-effort */ }
            this.cancelLicenseIcon();
            this.licenseIconTimer = window.setTimeout(() => {
                this.licenseIconTimer = null;
                if (this.destroyed || this.isPro || !this.licenseIconShown) return;
                try { lm.notifyLicenseRequired?.(NOTIFY_GENERAL); } catch { /* best-effort */ }
            }, 10500);
        };
        let cleared: any;
        try { cleared = lm.clearLicenseNotification?.(); } catch { /* best-effort */ }
        if (cleared && typeof cleared.then === "function") cleared.then(show, show); else show();
    }

    // ── Formato desde el lienzo (on-object) ───────────────────────────────────

    private subSelectable(el: Element, objectName: string, displayName: string, type: powerbi.visuals.SubSelectionStylesType): void {
        if (!this.formatMode) { el.classList.remove(HtmlSubSelectableClass); return; }
        el.classList.add(HtmlSubSelectableClass);
        el.setAttribute(SubSelectableObjectNameAttribute, objectName);
        el.setAttribute(SubSelectableDisplayNameAttribute, displayName);
        el.setAttribute(SubSelectableTypeAttribute, String(type));
    }

    private updateOutlines(options: VisualUpdateOptions): void {
        if (!this.formatMode) return;
        const subs = (options as any).subSelections as powerbi.visuals.CustomVisualSubSelection[] | undefined;
        this.subSelectionHelper.updateOutlinesFromSubSelections(subs ?? [], true);
    }

    private getSubSelectionStyles(subs: powerbi.visuals.CustomVisualSubSelection[]): powerbi.visuals.SubSelectionStyles | undefined {
        const name = subs[0]?.customVisualObjects[0]?.objectName;
        const ref = (objectName: string, propertyName: string, label: string) => ({ reference: { objectName, propertyName }, label });
        switch (name) {
            case "series":
                return { type: powerbi.visuals.SubSelectionStylesType.Shape,
                    stroke: ref("series", "borderColor", this.t("Prop_series_borderColor", "Cell border color")) } as any;
            case "columnLabels":
                return { type: powerbi.visuals.SubSelectionStylesType.Text,
                    bold: ref("columnLabels", "bold", this.t("Prop_columnLabels_bold", "Bold")),
                    fontSize: ref("columnLabels", "fontSize", this.t("Prop_columnLabels_fontSize", "Text size")),
                    fontColor: ref("columnLabels", "color", this.t("Prop_columnLabels_color", "Text color")) } as any;
            case "axis":
                return { type: powerbi.visuals.SubSelectionStylesType.Text,
                    fontSize: ref("axis", "fontSize", this.t("Prop_axis_fontSize", "Text size")),
                    fontColor: ref("axis", "color", this.t("Prop_axis_color", "Text color")) } as any;
            case "legend":
                return { type: powerbi.visuals.SubSelectionStylesType.Text,
                    fontSize: ref("legend", "fontSize", this.t("Prop_legend_fontSize", "Text size")),
                    fontColor: ref("legend", "color", this.t("Prop_legend_color", "Text color")) } as any;
            case "focus":
                return { type: powerbi.visuals.SubSelectionStylesType.Text,
                    fontSize: ref("focus", "fontSize", this.t("Prop_focus_fontSize", "Sentence text size")) } as any;
            case "background":
                return { type: powerbi.visuals.SubSelectionStylesType.Shape,
                    fill: ref("background", "color", this.t("Prop_background_color", "Color")) } as any;
        }
        return undefined;
    }

    private getSubSelectionShortcuts(subs: powerbi.visuals.CustomVisualSubSelection[]): powerbi.visuals.VisualSubSelectionShortcuts | undefined {
        const name = subs[0]?.customVisualObjects[0]?.objectName;
        const id = (objectName: string, propertyName: string) => ({ objectName, propertyName });
        const nav = (card: string, label: string) => ({ type: powerbi.visuals.VisualShortcutType.Navigate, destinationInfo: { cardUid: "Visual-" + card + "_card" }, label });
        switch (name) {
            case "series":
                return [
                    { type: powerbi.visuals.VisualShortcutType.Toggle, ...id("labels", "show"), relatedToggledFormattingIds: [id("labels", "show")],
                        disabledLabel: this.t("UI_HideLabels", "Hide labels"), enabledLabel: this.t("UI_ShowLabels", "Show labels") },
                    { type: powerbi.visuals.VisualShortcutType.Picker, ...id("style", "template"), label: this.t("Prop_style_template", "Template") },
                    { type: powerbi.visuals.VisualShortcutType.Divider },
                    nav("series", this.t("Obj_series", "Series")),
                ] as any;
            case "columnLabels":
                return [
                    { type: powerbi.visuals.VisualShortcutType.Reset, relatedResetFormattingIds: [id("columnLabels", "fontSize"), id("columnLabels", "color")] },
                    nav("columnLabels", this.t("Obj_columnLabels", "Column labels")),
                ] as any;
            case "axis":
                return [
                    { type: powerbi.visuals.VisualShortcutType.Toggle, ...id("axis", "gridlines"), relatedToggledFormattingIds: [id("axis", "gridlines")],
                        disabledLabel: this.t("UI_HideGrid", "Hide gridlines"), enabledLabel: this.t("UI_ShowGrid", "Show gridlines") },
                    nav("axis", this.t("Obj_axis", "Share axis")),
                ] as any;
            case "legend":
                return [
                    { type: powerbi.visuals.VisualShortcutType.Picker, ...id("legend", "position"), label: this.t("Prop_legend_position", "Position") },
                    { type: powerbi.visuals.VisualShortcutType.Divider },
                    nav("legend", this.t("Obj_legend", "Legend")),
                ] as any;
            case "focus":
                return [nav("focus", this.t("Obj_focus", "Focus series"))] as any;
            case "background":
                return [
                    { type: powerbi.visuals.VisualShortcutType.Reset, relatedResetFormattingIds: [id("background", "color")] },
                    nav("background", this.t("Obj_background", "Background")),
                ] as any;
        }
        return undefined;
    }

    // ── Panel de formato ──────────────────────────────────────────────────────

    public getFormattingModel(): powerbi.visuals.FormattingModel {
        const s = this.s;
        const T = (k: string, fb: string) => this.t(k, fb);
        const d = (obj: string, prop: string) => ({ objectName: obj, propertyName: prop });
        const name = (obj: string, prop: string, fb: string) => T(`Prop_${obj}_${prop}`, fb);
        const num = (obj: string, prop: string, fb: string, v: number) => ({ uid: `${obj}_${prop}`, displayName: name(obj, prop, fb), control: { type: powerbi.visuals.FormattingComponent.NumUpDown, properties: { descriptor: d(obj, prop), value: v } } });
        const tog = (obj: string, prop: string, fb: string, v: boolean) => ({ uid: `${obj}_${prop}`, displayName: name(obj, prop, fb), control: { type: powerbi.visuals.FormattingComponent.ToggleSwitch, properties: { descriptor: d(obj, prop), value: v } } });
        const txt = (obj: string, prop: string, fb: string, v: string) => ({ uid: `${obj}_${prop}`, displayName: name(obj, prop, fb), control: { type: powerbi.visuals.FormattingComponent.TextInput, properties: { descriptor: d(obj, prop), value: v, placeholder: "" } } });
        const col = (obj: string, prop: string, fb: string, v: string) => ({
            uid: `${obj}_${prop}`, displayName: name(obj, prop, fb),
            control: { type: powerbi.visuals.FormattingComponent.ColorPicker, properties: { descriptor: d(obj, prop), value: { value: v || "" } } },
        });
        const dd = (obj: string, prop: string, fb: string, v: string, items: [string, string, string][]) => {
            const list = items.map(([value, key, f]) => ({ value, displayName: T(key, f) }));
            return { uid: `${obj}_${prop}`, displayName: name(obj, prop, fb),
                control: { type: powerbi.visuals.FormattingComponent.Dropdown, properties: { descriptor: d(obj, prop), value: list.find(x => x.value === v) ?? list[0], items: list } as any } };
        };
        // revertToDefaultDescriptors: "Restablecer valores predeterminados" de cada tarjeta borra también los colores por serie.
        const card = (obj: string, fb: string, slices: any[]) => ({
            uid: `${obj}_card`, displayName: T(`Obj_${obj}`, fb), groups: [{ uid: `${obj}_g`, displayName: "", slices }],
            revertToDefaultDescriptors: slices.map(sl => sl.control.properties.descriptor),
        });
        // fx (F04) en el color de las celdas: la regla se evalúa por fila (selector comodín) y pinta cada celda.
        // altConstantValueSelector null: el color FIJO se guarda a nivel general; sin él llegaría fila a fila y el
        // panel no lo recordaría (lección de Bar Chart 1.11).
        const cellFill = col("series", "cellColor", "Cell color (fx)", s.cellColor);
        (cellFill.control.properties as any).descriptor = { ...d("series", "cellColor"), instanceKind: powerbi.VisualEnumerationInstanceKinds.ConstantOrRule,
            selector: dataViewWildcard.createDataViewWildcardSelector(dataViewWildcard.DataViewWildcardMatchingOption.InstancesAndTotals),
            altConstantValueSelector: null };
        // Un color por serie con nombre, guardado con el selector de su fila.
        const seriesColors = this.series.filter(x => x.selector && !x.others).map((se, k) => ({
            uid: `series_fill_${k}`, displayName: se.name || T("Prop_series_fill", "Color"),
            control: { type: powerbi.visuals.FormattingComponent.ColorPicker, properties: {
                descriptor: { objectName: "series", propertyName: "fill", selector: se.selector }, value: { value: se.color } } },
        }));

        return { cards: [
            card("style", "Style template", [
                dd("style", "template", "Template", s.template, [["clean", "Enum_tpl_clean", "Report theme"],
                    ...COLLECTION_STYLES.map(k => [k, "Enum_tpl_" + k, k.charAt(0).toUpperCase() + k.slice(1)] as [string, string, string])]),
                tog("style", "guide", "Setup guide", s.guide),
            ]),
            card("layout", "Layout", [
                dd("layout", "orientation", "Orientation", s.orientation, [["vertical", "Enum_or_vertical", "Columns (vertical)"], ["horizontal", "Enum_or_horizontal", "Bars (horizontal) (Pro)"]]),
                dd("layout", "mode", "Values", s.mode, [["percent", "Enum_md_percent", "100% (share)"], ["absolute", "Enum_md_absolute", "Absolute (bar Mekko) (Pro)"]]),
                num("layout", "gap", "Space between columns", s.gap),
                dd("layout", "sortColumns", "Order columns by", s.sortColumns, [["data", "Enum_sc_data", "Data order"], ["size", "Enum_sc_size", "Size"],
                    ["focus", "Enum_sc_focus", "Share of the focus series (Pro)"]]),
                dd("layout", "sortSeries", "Order series by", s.sortSeries, [["size", "Enum_ss_size", "Size"], ["data", "Enum_ss_data", "Data order"]]),
            ]),
            card("series", "Series", [
                ...seriesColors,
                cellFill,
                num("series", "named", "Named series (Free 3, Pro 12)", s.named),
                txt("series", "othersLabel", "Others label", s.othersLabel),
                col("series", "othersColor", "Others color", s.othersColor),
                num("series", "opacity", "Opacity %", s.opacity),
                col("series", "borderColor", "Cell border color", s.borderColor),
                num("series", "borderWidth", "Cell border width", s.borderWidth),
            ]),
            card("labels", "Cell labels", [
                tog("labels", "show", "Show", s.labels),
                dd("labels", "content", "Show", s.labelContent, [["share", "Enum_lc_share", "Share of the column"], ["total", "Enum_lc_total", "% of the total (Pro)"], ["value", "Enum_lc_value", "Value (Pro)"],
                    ["both", "Enum_lc_both", "Value and share (Pro)"], ["name", "Enum_lc_name", "Series name and share"]]),
                num("labels", "fontSize", "Text size", s.labelFont),
                col("labels", "color", "Text color (empty = automatic)", s.labelColor),
                num("labels", "decimals", "Decimals of the share", s.labelDecimals),
                tog("labels", "bold", "Bold", s.labelBold),
            ]),
            card("columnLabels", "Column labels", [
                tog("columnLabels", "show", "Show", s.colLabels),
                num("columnLabels", "fontSize", "Text size", s.colFont),
                col("columnLabels", "color", "Text color", s.colColor),
                tog("columnLabels", "bold", "Bold", s.colBold),
                tog("columnLabels", "showTitle", "Axis title", s.colTitle),
                txt("columnLabels", "titleText", "Title text (empty = automatic)", s.colTitleText),
                num("columnLabels", "titleSize", "Title size", s.colTitleSize),
                col("columnLabels", "titleColor", "Title color", s.colTitleColor),
            ]),
            card("totals", "Column totals", [
                tog("totals", "show", "Show the size of each column", s.totals),
                tog("totals", "percent", "Also its % of the total", s.totalsPct),
                num("totals", "fontSize", "Text size", s.totalsFont),
                col("totals", "color", "Text color", s.totalsColor),
            ]),
            card("axis", "Share axis", [
                tog("axis", "show", "Show", s.axis),
                num("axis", "fontSize", "Text size", s.axisFont),
                col("axis", "color", "Text color", s.axisColor),
                tog("axis", "gridlines", "Gridlines", s.gridlines),
                tog("axis", "showTitle", "Axis title", s.axisTitle),
                txt("axis", "titleText", "Title text (empty = automatic)", s.axisTitleText),
                num("axis", "titleSize", "Title size", s.axisTitleSize),
                col("axis", "titleColor", "Title color", s.axisTitleColor),
            ]),
            card("focus", "Focus series", [
                txt("focus", "name", "Focus series (Pro): name of a series", s.focus),
                col("focus", "color", "Focus color", s.focusColor),
                tog("focus", "dimOthers", "Dim the other series", s.dimOthers),
                tog("focus", "summary", "Summary sentence", s.summary),
                num("focus", "fontSize", "Sentence text size", s.summaryFont),
            ]),
            card("comparison", "Comparison", [
                tog("comparison", "showChange", "Show the change in share (Pro)", s.showChange),
                col("comparison", "positiveColor", "Gain color", s.posColor),
                col("comparison", "negativeColor", "Loss color", s.negColor),
                tog("comparison", "sentence", "Change in the summary sentence", s.changeSentence),
            ]),
            card("legend", "Legend", [
                tog("legend", "show", "Show", s.legend),
                dd("legend", "position", "Position", s.legendPos, [["top", "Enum_lg_top", "Top"], ["bottom", "Enum_lg_bottom", "Bottom"], ["right", "Enum_lg_right", "Right"]]),
                num("legend", "fontSize", "Text size", s.legendFont),
                col("legend", "color", "Text color", s.legendColor),
            ]),
            card("smallMultiples", "Small multiples", [
                num("smallMultiples", "columns", "Columns (0 = automatic)", s.smCols),
                num("smallMultiples", "gap", "Space between panels", s.smGap),
                num("smallMultiples", "titleSize", "Title size", s.smTitleSize),
                col("smallMultiples", "titleColor", "Title color", s.smTitleColor),
                tog("smallMultiples", "titleBold", "Bold title", s.smTitleBold),
                col("smallMultiples", "background", "Panel background", s.smBackground),
                tog("smallMultiples", "border", "Panel border", s.smBorder),
                col("smallMultiples", "borderColor", "Panel border color", s.smBorderColor),
            ]),
            card("accessibility", "Accessibility", [
                dd("accessibility", "highContrast", "High contrast", s.hcMode, [["auto", "Enum_hc_auto", "Automatic (Windows setting)"], ["on", "Enum_hc_on", "On"]]),
                col("accessibility", "focusColor", "Keyboard focus color", s.a11yFocusColor),
                num("accessibility", "focusWidth", "Keyboard focus width", s.a11yFocusWidth),
                num("accessibility", "minTextSize", "Minimum text size", s.minText),
                tog("accessibility", "patterns", "Pattern on Others", s.patterns),
                tog("accessibility", "dataPatterns", "Patterns on series (tell them apart without color)", s.dataPatterns),
            ]),
            card("background", "Background", [
                col("background", "color", "Color", s.background),
            ]),
        ] } as any;
    }
}
