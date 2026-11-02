"use strict";

import powerbi from "powerbi-visuals-api";
import "./../style/visual.less";
import { valueFormatter } from "powerbi-visuals-utils-formattingutils";
import {
    HtmlSubSelectableClass, HtmlSubSelectionHelper, SubSelectableDisplayNameAttribute,
    SubSelectableObjectNameAttribute, SubSelectableTypeAttribute,
} from "powerbi-visuals-utils-onobjectutils";
import { STRINGS } from "./strings";
import { LANDING_ICON } from "./landingIcon";

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
    labels: boolean; labelContent: string; labelFont: number; labelColor: string; labelDecimals: number;
    colLabels: boolean; colFont: number; colColor: string; colBold: boolean;
    totals: boolean; totalsPct: boolean; totalsFont: number; totalsColor: string;
    axis: boolean; axisFont: number; axisColor: string; gridlines: boolean;
    focus: string; focusColor: string; dimOthers: boolean; summary: boolean; summaryFont: number;
    showChange: boolean; posColor: string; negColor: string; changeSentence: boolean;
    legend: boolean; legendPos: string; legendFont: number; legendColor: string;
    smCols: number; smGap: number; smTitleSize: number; smTitleColor: string; smTitleBold: boolean;
    smBackground: string; smBorder: boolean; smBorderColor: string;
    background: string;
}

const DEFAULTS: Settings = {
    template: "clean", guide: true,
    orientation: "vertical", mode: "percent", gap: 2, sortColumns: "size", sortSeries: "size",
    named: 12, othersLabel: "", othersColor: "#C8C6C4", opacity: 100, borderColor: "#FFFFFF", borderWidth: 1,
    labels: true, labelContent: "share", labelFont: 10, labelColor: "", labelDecimals: 0,
    colLabels: true, colFont: 11, colColor: "#3D3929", colBold: false,
    totals: true, totalsPct: true, totalsFont: 10, totalsColor: "#605E5C",
    axis: true, axisFont: 9, axisColor: "#83827D", gridlines: false,
    focus: "", focusColor: "#2B6CB0", dimOthers: true, summary: true, summaryFont: 12,
    showChange: true, posColor: "#107C10", negColor: "#C4314B", changeSentence: true,
    legend: true, legendPos: "top", legendFont: 11, legendColor: "#605E5C",
    smCols: 0, smGap: 10, smTitleSize: 12, smTitleColor: "#3D3929", smTitleBold: true,
    smBackground: "", smBorder: false, smBorderColor: "#E1DFDD",
    background: "",
};

/**
 * Plantillas: un punto de partida. Solo rellenan lo que el usuario no ha tocado: un ajuste escrito
 * a mano (presente en metadata.objects) gana siempre a la plantilla.
 */
const TEMPLATES: Record<string, Partial<Settings>> = {
    clean: {},
    classic: { gap: 0, borderColor: "#FFFFFF", borderWidth: 1.5, gridlines: true },
    minimal: { gap: 4, borderWidth: 0, axis: false, totals: false, labelFont: 9, colColor: "#605E5C" },
    contrast: { gap: 1, borderColor: "#252423", borderWidth: 1, colBold: true, colColor: "#252423", labelFont: 11 },
    compact: { gap: 1, labelFont: 8, colFont: 9, totalsFont: 8, legendFont: 9, axisFont: 8 },
    // Estética de IBCS (sobria, grises, sin adornos). Es un estilo: no afirma cumplimiento del estándar.
    ibcs: { gap: 1, borderColor: "#FFFFFF", borderWidth: 1, colColor: "#262626", legendColor: "#262626", totalsColor: "#262626", focusColor: "#262626" },
};

/** Tonos de gris para el estilo IBCS: las series se distinguen por gris, no por colores del tema. */
const IBCS_GREYS = ["#404040", "#7F7F7F", "#A6A6A6", "#BFBFBF", "#595959", "#D9D9D9"];

type Objects = powerbi.DataViewObjects | undefined;

function readSettings(objects: Objects): Settings {
    const tplName = (objects?.["style"]?.["template"] as string) || DEFAULTS.template;
    const tpl = TEMPLATES[tplName] || {};
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
        labelColor: pick("labels", "color", "labelColor"), labelDecimals: pick("labels", "decimals", "labelDecimals"),
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
    };
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Number.isFinite(v) ? v : lo));

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
    private valueFormat: string | undefined;
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
        this.watermarkEl = document.createElement("div");
        this.watermarkEl.className = "tcmk-watermark";
        this.watermarkEl.setAttribute("aria-hidden", "true");
        this.root.appendChild(this.watermarkEl);
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
        return out;
    }

    /** Ajustes que se dibujan: sin Pro activo, cada función de pago vuelve a su valor gratuito. */
    private effective(): Settings {
        if (this.proActive) return { ...this.s, named: clamp(Math.round(this.s.named), 1, MAX_SERIES) };
        const s = { ...this.s };
        s.named = clamp(Math.round(s.named), 1, FREE_SERIES);
        s.focus = "";
        if (s.sortColumns === "focus") s.sortColumns = "size";
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
        const isIbcs = s.template === "ibcs";
        this.series = ordered.map((nm, k) => {
            const row = serFirstRow.get(nm);
            const own = serCol ? (serCol.objects?.[row]?.["series"]?.["fill"] as any)?.solid?.color : undefined;
            const selector = serCol
                ? (this.host.createSelectionIdBuilder().withCategory(serCol, row).createSelectionId() as any).getSelector?.()
                : undefined;
            let color = own || (isIbcs ? IBCS_GREYS[k % IBCS_GREYS.length] : this.host.colorPalette.getColor(nm).value);
            if (focusName && nm.toLowerCase() === focusName) color = s.focusColor || color;
            return { key: "s" + k, name: nm, color, others: false, total: serTotal.get(nm), selector };
        });
        const othersTotal = serOrder.filter(x => !namedSet.has(x)).reduce((t, x) => t + serTotal.get(x), 0);
        if (serOrder.length > named.length) {
            this.series.push({ key: OTHERS, name: s.othersLabel.trim() || this.t("UI_Others", "Others"), color: s.othersColor || "#C8C6C4",
                others: true, total: othersTotal, selector: undefined });
        }
        const keyOfSeries = new Map<string, string>();
        this.series.forEach(se => { if (!se.others) keyOfSeries.set(se.name, se.key); });

        // 2. Celdas
        const panelSet: string[] = [];
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
            if (!cell) { cell = { key, panel, col: c, ser: sk, value: 0, cmp: null, hl: null, ids: [], tips: [] }; this.cells.set(key, cell); }
            cell.value += Math.max(0, v);
            const cv = cmpCol ? this.num(cmpCol.values[i]) : null;
            if (cv !== null) { cell.cmp = (cell.cmp ?? 0) + Math.max(0, cv); this.hasComparison = true; }
            const hv = valCol.highlights ? this.num(valCol.highlights[i]) : null;
            if (hv !== null && hv !== undefined) { cell.hl = (cell.hl ?? 0) + Math.max(0, hv); this.hasHighlights = true; }
            if (sk !== OTHERS && tipCols.length && !cell.tips.length) {
                cell.tips = tipCols.map(tc => {
                    const raw = tc.values[i];
                    const nv = this.num(raw);
                    return { name: tc.source.displayName, value: nv !== null ? this.formatter(this.formatOf(tc))(nv) : (raw === null || raw === undefined ? "" : String(raw)) };
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
        this.columns = colOrder.slice(0, MAX_COLUMNS);
        return this.cells.size > 0 && this.series.length > 0;
    }

    private formatOf(col: DataViewValueColumn): string | undefined {
        // getFormatStringByColumn devuelve también las cadenas de formato dinámicas de la medida.
        try { return valueFormatter.getFormatStringByColumn(col.source as any) || col.source.format; } catch { return col.source.format; }
    }

    private formatter(format: string | undefined, value?: number): (v: number) => string {
        const culture = this.culture;
        try {
            const f = valueFormatter.create({ format: format || undefined, value, cultureSelector: culture } as any);
            const plain = (() => { try { return new Intl.NumberFormat(culture, { maximumFractionDigits: 2 }); } catch { return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }); } })();
            return (v: number) => {
                const out = f.format(v);
                if (Number.isInteger(v) || /%/.test(format || "") || /[.,]\d/.test(out)) return out;
                return format ? out : plain.format(v);
            };
        } catch { return (v: number) => String(Math.round(v * 100) / 100); }
    }

    /** Valores grandes en forma corta (40,2 M) para totales y frases; el formato del modelo en el tooltip. */
    private shortFmt(v: number): string {
        try {
            const f = valueFormatter.create({ format: this.valueFormat, value: v > 0 ? v : 1, precision: 1, cultureSelector: this.culture } as any);
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

    private hc(): { on: boolean; fg: string; bg: string; sel: string } {
        const p: any = this.host.colorPalette;
        return { on: !!p?.isHighContrast, fg: p?.foreground?.value || "#000000", bg: p?.background?.value || "#FFFFFF", sel: p?.foregroundSelected?.value || p?.foreground?.value || "#000000" };
    }

    /** Dibuja con el último dataView. Lo usa update() y el repintado tras resolver la licencia. */
    private draw(): void {
        if (this.destroyed || !this.lastOptions) return;
        const vp = this.lastOptions.viewport;
        const hc = this.hc();
        this.root.style.background = hc.on ? hc.bg : (this.s.background || "transparent");
        this.subSelectable(this.root, "background", this.t("Obj_background", "Background"), powerbi.visuals.SubSelectionStylesType.Shape);
        this.guideEl.style.display = "none";
        if (!this.hasData) {
            this.clearSvg(); this.noteEl.style.display = "none";
            this.watermarkEl.style.display = "none";
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

    private render(s: Settings, W: number, H: number): void {
        this.clearSvg();
        this.svg.setAttribute("width", String(W));
        this.svg.setAttribute("height", String(H));
        const hc = this.hc();
        const tiny = W < 220 || H < 160;
        let top = 4, bottom = 4, right = 4;

        // Frase resumen (Pro: serie propia)
        const focus = this.focusSeries(s);
        if (focus && s.summary && this.panels.length === 1 && !tiny) {
            const lines = this.summaryLines(s, focus);
            const fs = clamp(s.summaryFont, 8, 28);
            const g = this.el("g", { class: "tcmk-summary" }, this.svg);
            this.subSelectable(g, "focus", this.t("Obj_focus", "Focus series"), powerbi.visuals.SubSelectionStylesType.Text);
            lines.forEach((ln, k) => {
                const t = this.el("text", { x: 6, y: top + fs * (k + 1) + k * 4, "font-size": k ? fs - 1 : fs, "font-weight": k ? 400 : 600,
                    fill: hc.on ? hc.fg : (k ? "#605E5C" : "#252423") }, g);
                t.textContent = this.fit(ln, k ? fs - 1 : fs, W - 12);
            });
            top += lines.length * (fs + 4) + 6;
        }

        // Leyenda
        if (s.legend && this.series.length > 1 && !tiny) {
            const lg = this.el("g", { class: "tcmk-legend" }, this.svg);
            this.subSelectable(lg, "legend", this.t("Obj_legend", "Legend"), powerbi.visuals.SubSelectionStylesType.Text);
            const fl = clamp(s.legendFont, 6, 30);
            const rowH = fl + 8;
            if (s.legendPos === "right" && W > 380) {
                const colW = Math.min(170, Math.max(...this.series.map(x => this.textW(x.name, fl))) + fl + 18);
                let y = top + rowH / 2;
                for (const se of this.series) { this.legendItem(lg, se, W - colW, y, fl, s, hc); y += rowH; }
                right += colW + 6;
            } else {
                const y = s.legendPos === "bottom" ? H - rowH / 2 - 2 : top + rowH / 2;
                let x = 6;
                for (const se of this.series) {
                    const w = fl + 10 + Math.min(170, this.textW(se.name, fl));
                    if (x + w > W - 6) break;
                    this.legendItem(lg, se, x, y, fl, s, hc);
                    x += w + 12;
                }
                if (s.legendPos === "bottom") bottom += rowH + 4; else top += rowH + 2;
            }
        }

        // Paneles (múltiplos pequeños con la misma escala)
        const panels = this.panels;
        const gap = panels.length > 1 ? clamp(s.smGap, 0, 60) : 0;
        const plotW = W - right, plotH = H - top - bottom;
        const autoCols = Math.max(1, Math.round(Math.sqrt(panels.length * (plotW / Math.max(1, plotH)))));
        const cols = panels.length === 1 ? 1 : Math.min(panels.length, s.smCols > 0 ? Math.round(s.smCols) : autoCols);
        const rows = Math.ceil(panels.length / cols);
        const cellW = (plotW - gap * (cols - 1)) / cols, cellH = (plotH - gap * (rows - 1)) / rows;
        const smTitle = clamp(s.smTitleSize, 6, 40);
        // Escala común en modo absoluto: la columna mayor de todos los paneles
        const all = panels.map(p => this.columnsOf(p, s));
        const maxCol = Math.max(1e-9, ...all.map(cs => Math.max(0, ...cs.map(c => c.total))));
        panels.forEach((panel, pi) => {
            const x0 = (pi % cols) * (cellW + gap), y0 = top + Math.floor(pi / cols) * (cellH + gap);
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
            this.drawMekko(pg, all[pi], s, cellW, cellH - titleH, maxCol, hc, tiny || (panels.length > 4 && cellW < 240));
        });
    }

    /**
     * El gráfico de un panel. Vertical: el ancho de cada columna es su parte del total y la altura de cada
     * celda su cuota dentro de la columna (o su valor, en modo absoluto). Horizontal: lo mismo girado.
     * Se reserva primero el área de dibujo y los adornos se quitan por orden si no caben.
     */
    private drawMekko(g: SVGGElement, cols: ColDraw[], s: Settings, W: number, H: number, maxCol: number,
        hc: { on: boolean; fg: string; bg: string; sel: string }, small: boolean): void {
        if (!cols.length) return;
        const vertical = s.orientation !== "horizontal";
        const absolute = s.mode === "absolute";
        const grand = cols.reduce((t, c) => t + c.total, 0);
        const fc = clamp(s.colFont, 6, 30), ft = clamp(s.totalsFont, 6, 30), fa = clamp(s.axisFont, 6, 24);
        const focus = this.focusSeries(s);
        const showTotals = s.totals && !small;
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
                    if (s.gridlines && f > 0) this.el("line", { x1: mL, x2: mL + pw, y1: y, y2: y, stroke: hc.on ? hc.fg : "#E6E4E0", "stroke-width": 1 }, ax);
                    const t = this.el("text", { x: mL - 4, y: y + fa * 0.35, "text-anchor": "end", "font-size": fa, fill: hc.on ? hc.fg : s.axisColor }, ax);
                    t.textContent = lab;
                } else {
                    const x = mL + f * pw;
                    if (s.gridlines && f > 0) this.el("line", { x1: x, x2: x, y1: mT, y2: mT + ph, stroke: hc.on ? hc.fg : "#E6E4E0", "stroke-width": 1 }, ax);
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
        const fl = clamp(s.labelFont, 6, 24);
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
                const cg = this.el("g", { "data-pt": cell.key, role: "option", tabindex: "-1", class: "tcmk-cell" }, cellsG);
                const dim = focus && s.dimOthers && se.key !== focus.key;
                this.el("rect", { x: x.toFixed(2), y: y.toFixed(2), width: Math.max(0, w).toFixed(2), height: Math.max(0, h).toFixed(2),
                    fill: hc.on ? (se.key === focus?.key ? hc.sel : hc.bg) : se.color,
                    "fill-opacity": hc.on ? 1 : clamp(s.opacity, 5, 100) / 100 * (dim ? 0.45 : 1),
                    stroke: hc.on ? hc.fg : (s.borderWidth > 0 ? s.borderColor : "none"), "stroke-width": hc.on ? 1 : clamp(s.borderWidth, 0, 6) }, cg);
                cg.setAttribute("aria-label", `${c.col}, ${se.name}: ${this.formatter(this.valueFormat)(cell.value)}, ${this.pct(share, 1)}`);
                this.wire(cg, cell);

                // Etiqueta de la celda, solo si cabe
                if (s.labels && !small) {
                    const txt = this.cellLabel(s, se, cell, share, grand);
                    const chg = showChange && cell.cmp !== null && c.cmpTotal ? this.pp(share - cell.cmp / c.cmpTotal) : "";
                    const lines = chg ? 2 : 1;
                    const needW = Math.max(this.textW(txt, fl), chg ? this.textW(chg, fl - 1) : 0) + 6;
                    if (txt && w >= needW && h >= fl * lines + 4 * lines) {
                        const col = s.labelColor || (hc.on ? hc.fg : this.contrast(dim ? "#E8E8E8" : se.color));
                        const cy = y + h / 2 - (lines - 1) * (fl / 2);
                        const t = this.el("text", { x: x + w / 2, y: cy + fl * 0.35, "text-anchor": "middle", "font-size": fl, fill: col }, labelsG);
                        t.textContent = txt;
                        if (chg) {
                            const up = share - cell.cmp / c.cmpTotal >= 0;
                            const t2 = this.el("text", { x: x + w / 2, y: cy + fl + 1 + fl * 0.35, "text-anchor": "middle", "font-size": fl - 1, "font-weight": 600,
                                fill: hc.on ? hc.fg : (s.labelColor || this.contrast(se.color) === "#FFFFFF" ? "#FFFFFF" : (up ? s.posColor : s.negColor)) }, labelsG);
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
                const txt = this.shortFmt(c.total) + (s.totalsPct ? " (" + this.pct(c.total / grand) + ")" : "");
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
            case "value": return this.shortFmt(cell.value);
            // El área de la celda ya es su parte del mercado: aquí se escribe ese número
            case "total": return this.pct(grand ? cell.value / grand : 0, d);
            case "both": return this.shortFmt(cell.value) + " · " + this.pct(share, d);
            case "name": return se.name + " " + this.pct(share, d);
            default: return this.pct(share, d);
        }
    }

    /** Texto blanco o casi negro según la luminancia del fondo. */
    private contrast(color: string): string {
        const m = /^#?([0-9a-f]{6})$/i.exec(color || "");
        if (!m) return "#252423";
        const n = parseInt(m[1], 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
        const L = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        return L < 0.6 ? "#FFFFFF" : "#252423";
    }

    private legendItem(lg: SVGGElement, se: Series, x: number, y: number, fl: number, s: Settings, hc: { on: boolean; fg: string }): void {
        const it = this.el("g", { "data-series": se.key, cursor: se.others ? "default" : "pointer" }, lg);
        this.el("rect", { x, y: y - fl / 2, width: fl, height: fl, rx: 2, fill: hc.on ? hc.fg : se.color }, it);
        const t = this.el("text", { x: x + fl + 5, y: y + fl * 0.35, "font-size": fl, fill: hc.on ? hc.fg : s.legendColor }, it);
        t.textContent = this.fit(se.name, fl, 170);
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
        this.noteEl.style.color = hc.on ? hc.fg : "#83827D";
        return msgs.length > 0;
    }

    private renderWatermark(W: number, H: number): void {
        const wanted = this.isPreview() ? this.attemptedPro() : [];
        const el = this.watermarkEl;
        if (!wanted.length) { el.style.display = "none"; return; }
        while (el.firstChild) el.removeChild(el.firstChild);
        el.style.display = "flex";
        const t = document.createElement("div"); t.className = "tcmk-wm-title"; t.textContent = this.t("UI_ProPreview", "Pro preview");
        // Dos funciones y un contador: con cuatro se salía del gráfico (lección de Pareto 1.6)
        const names = wanted.map(x => x.label);
        const w = document.createElement("div"); w.className = "tcmk-wm-why";
        w.textContent = names.slice(0, 2).join(" · ") + (names.length > 2 ? " +" + (names.length - 2) : "");
        el.appendChild(t); el.appendChild(w);
        el.style.fontSize = Math.max(14, Math.min(44, Math.min(W, H) / 7)) + "px";
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
            for (const nombre of Object.keys(TEMPLATES)) {
                const tpl = { ...DEFAULTS, ...TEMPLATES[nombre] };
                const chip = document.createElement("button");
                chip.type = "button";
                const actual = nombre === this.s.template;
                chip.setAttribute("aria-pressed", String(actual));
                chip.className = "tcmk-g-chip";
                chip.style.borderColor = actual ? azul : "#C8C6C4";
                chip.style.borderWidth = actual ? "2px" : "1px";
                chip.appendChild(this.miniMekko(tpl, nombre === "ibcs", hc));
                const etq = document.createElement("div");
                etq.textContent = this.t("Enum_tpl_" + nombre, nombre.charAt(0).toUpperCase() + nombre.slice(1));
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

    /** Miniatura de una plantilla: tres columnas de ancho distinto con tres series. */
    private miniMekko(t: Settings, ibcs: boolean, hc: boolean): SVGSVGElement {
        const svg = document.createElementNS(SVG, "svg") as SVGSVGElement;
        svg.setAttribute("width", "60"); svg.setAttribute("height", "44"); svg.setAttribute("aria-hidden", "true");
        const colors = hc ? ["#FFFFFF", "#AAAAAA", "#555555"] : ibcs ? IBCS_GREYS.slice(0, 3) : this.series.filter(x => !x.others).slice(0, 3).map(x => x.color).concat(["#2B6CB0", "#7CB5D1", "#C8C6C4"]).slice(0, 3);
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
            this.selectionManager.showContextMenu(cell.ids[0] ?? ({} as ISelectionId), { x: e.clientX, y: e.clientY });
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
                    if (this.canInteract) this.selectionManager.showContextMenu(cell.ids[0] ?? ({} as ISelectionId), { x: r.left + r.width / 2, y: r.top });
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
        const f = this.formatter(this.valueFormat);
        const grand = this.columnsOf(cell.panel, s).reduce((t, c) => t + c.total, 0);
        const items: powerbi.extensibility.VisualTooltipDataItem[] = [];
        if (cell.panel !== null) items.push({ displayName: this.t("UI_Panel", "Panel"), value: cell.panel });
        items.push({ displayName: this.lastDv?.metadata?.columns?.find(c => c.roles?.["category"])?.displayName || this.t("Role_category", "Columns"), value: cell.col });
        if (se) items.push({ displayName: this.lastDv?.metadata?.columns?.find(c => c.roles?.["series"])?.displayName || this.t("Role_series", "Series"), value: se.name, color: se.color } as any);
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
                ? T("Landing_Pro", "Up to 12 named series, your company highlighted with a summary sentence, the change in share against a prior period, and small multiples.")
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
        const card = (obj: string, fb: string, slices: any[]) => ({ uid: `${obj}_card`, displayName: T(`Obj_${obj}`, fb), groups: [{ uid: `${obj}_g`, displayName: "", slices }] });
        // Un color por serie con nombre, guardado con el selector de su fila.
        const seriesColors = this.series.filter(x => x.selector && !x.others).map((se, k) => ({
            uid: `series_fill_${k}`, displayName: se.name || T("Prop_series_fill", "Color"),
            control: { type: powerbi.visuals.FormattingComponent.ColorPicker, properties: {
                descriptor: { objectName: "series", propertyName: "fill", selector: se.selector }, value: { value: se.color } } },
        }));

        return { cards: [
            card("style", "Style template", [
                dd("style", "template", "Template", s.template, [["clean", "Enum_tpl_clean", "Clean"], ["classic", "Enum_tpl_classic", "Classic"],
                    ["minimal", "Enum_tpl_minimal", "Minimal"], ["contrast", "Enum_tpl_contrast", "Contrast"], ["compact", "Enum_tpl_compact", "Compact"],
                    ["ibcs", "Enum_tpl_ibcs", "IBCS style"]]),
                tog("style", "guide", "Setup guide", s.guide),
            ]),
            card("layout", "Layout", [
                dd("layout", "orientation", "Orientation", s.orientation, [["vertical", "Enum_or_vertical", "Columns (vertical)"], ["horizontal", "Enum_or_horizontal", "Bars (horizontal)"]]),
                dd("layout", "mode", "Values", s.mode, [["percent", "Enum_md_percent", "100% (share)"], ["absolute", "Enum_md_absolute", "Absolute (bar Mekko)"]]),
                num("layout", "gap", "Space between columns", s.gap),
                dd("layout", "sortColumns", "Order columns by", s.sortColumns, [["data", "Enum_sc_data", "Data order"], ["size", "Enum_sc_size", "Size"],
                    ["focus", "Enum_sc_focus", "Share of the focus series (Pro)"]]),
                dd("layout", "sortSeries", "Order series by", s.sortSeries, [["size", "Enum_ss_size", "Size"], ["data", "Enum_ss_data", "Data order"]]),
            ]),
            card("series", "Series", [
                ...seriesColors,
                num("series", "named", "Named series (Free 3, Pro 12)", s.named),
                txt("series", "othersLabel", "Others label", s.othersLabel),
                col("series", "othersColor", "Others color", s.othersColor),
                num("series", "opacity", "Opacity %", s.opacity),
                col("series", "borderColor", "Cell border color", s.borderColor),
                num("series", "borderWidth", "Cell border width", s.borderWidth),
            ]),
            card("labels", "Cell labels", [
                tog("labels", "show", "Show", s.labels),
                dd("labels", "content", "Show", s.labelContent, [["share", "Enum_lc_share", "Share of the column"], ["total", "Enum_lc_total", "% of the total"], ["value", "Enum_lc_value", "Value"],
                    ["both", "Enum_lc_both", "Value and share"], ["name", "Enum_lc_name", "Series name and share"]]),
                num("labels", "fontSize", "Text size", s.labelFont),
                col("labels", "color", "Text color (empty = automatic)", s.labelColor),
                num("labels", "decimals", "Decimals of the share", s.labelDecimals),
            ]),
            card("columnLabels", "Column labels", [
                tog("columnLabels", "show", "Show", s.colLabels),
                num("columnLabels", "fontSize", "Text size", s.colFont),
                col("columnLabels", "color", "Text color", s.colColor),
                tog("columnLabels", "bold", "Bold", s.colBold),
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
            card("background", "Background", [
                col("background", "color", "Color", s.background),
            ]),
        ] } as any;
    }
}
