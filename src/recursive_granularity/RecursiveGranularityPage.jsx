// src/recursive_granularity/RecursiveGranularityPage.jsx
// Static prototype of recursively unfoldable proof granularity, in two modes
// switched by a small toggle (?mode=paper in the URL):
//   toy    EECS127 midterm Q11: NL proof | Lean cells | informalization
//   paper  "L = RL = BPL" preprint: paper | informalization | Lean cells
// Both modes share the cell tree (CellTree.jsx), the granularity slider, the
// per-cell +/- unfolding, and click-to-navigate with a short flash.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./recursiveGranularity.css";
import {
  PROBLEM,
  NL_SOLUTION,
  AXIOMS_USED,
  PROOF_TREE,
  GRANULARITY_LABELS,
  DEFAULT_GRANULARITY,
} from "./proofData";
import { CellTree, TexText, collectVisible, findStepTargets, indexNodes, maxLevel } from "./CellTree";
import ResearchPaper from "./research/ResearchPaper";

const RESEARCH_LABELS = [
  "Main theorem",
  "Paper sections",
  "Paper results",
  "Lean declarations",
  "Have statements",
  "Nested haves",
  "Nested haves (2)",
  "Nested haves (3)",
];
const RESEARCH_DEFAULT_GRANULARITY = 2;
// BASE_URL keeps asset paths working when the site is served from a subpath (GitHub Pages).
const LEAN_BASE = `${import.meta.env.BASE_URL}recursive_granularity/l_rl_bpl/lean`;
const FLASH_MS = 1800;

/** The `?mode=paper` query parameter, without a router (the site is one static page). */
function useModeParam() {
  const read = () => (new URLSearchParams(window.location.search).get("mode") === "paper" ? "paper" : "toy");
  const [mode, setMode] = useState(read);
  useEffect(() => {
    const onPop = () => setMode(read());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  const update = (m) => {
    const url = new URL(window.location.href);
    if (m === "paper") url.searchParams.set("mode", "paper");
    else url.searchParams.delete("mode");
    window.history.pushState(null, "", url);
    setMode(m);
  };
  return [mode, update];
}

/** Scroll `container` so that `el` sits near its top. */
function scrollWithin(container, el) {
  if (!container || !el) return;
  const top = el.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop;
  container.scrollTo({ top: Math.max(top - 12, 0), behavior: "smooth" });
}

/** A short-lived { ids, n } highlight; n alternates the CSS animation so repeat clicks restart it. */
function useFlash() {
  const [flash, setFlash] = useState(null);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  const trigger = useCallback((ids) => {
    setFlash((prev) => ({ ids: new Set(ids), n: (prev?.n ?? 0) + 1 }));
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setFlash(null), FLASH_MS);
  }, []);
  return [flash, trigger];
}

function ToySolutionPanel({ highlightedSteps, hoveredStep, setHoveredStep, goToStep, sourceFlash }) {
  let lastSection = null;
  return (
    <>
      <div className="rg-panel-heading">Problem</div>
      <div className="rg-problem">
        <TexText text={PROBLEM.statement} />
      </div>
      <div className="rg-panel-heading">Student solution</div>
      <ol className="rg-nl-steps">
        {NL_SOLUTION.map((s) => {
          const showSection = s.section && s.section !== lastSection;
          if (s.section) lastSection = s.section;
          const on = highlightedSteps.has(s.step) || hoveredStep === s.step;
          const flash = sourceFlash?.ids.has(s.step) ? ` is-flash-${sourceFlash.n % 2}` : "";
          return (
            <li key={s.step}>
              {showSection && <TexText text={s.section} className="rg-nl-section" />}
              <div
                id={`nl-step-${s.step}`}
                className={`rg-nl-step${on ? " is-highlighted" : ""}${flash}`}
                onMouseEnter={() => setHoveredStep(s.step)}
                onMouseLeave={() => setHoveredStep(null)}
                onClick={() => goToStep(s.step)}
                title="Jump to the Lean cells for this step"
              >
                <span className="rg-step-num">{s.step}</span>
                <TexText text={s.text} className="rg-step-text" />
              </div>
            </li>
          );
        })}
      </ol>
      <div className="rg-panel-heading">Axioms used</div>
      <ul className="rg-axioms">
        {AXIOMS_USED.map((a) => (
          <li key={a.name}>
            <code>{a.name}</code>
            <TexText text={a.informal} />
          </li>
        ))}
      </ul>
    </>
  );
}

export default function RecursiveGranularityPage() {
  const [mode, setModeParam] = useModeParam();
  const research = mode === "paper";

  // Research data is code-split: it loads the first time the paper mode opens.
  const [researchData, setResearchData] = useState(null);
  const [loadError, setLoadError] = useState(null);
  useEffect(() => {
    if (!research || researchData) return;
    Promise.all([import("./research/data/research_tree.json"), import("./research/data/paper.json")])
      .then(([t, p]) => setResearchData({ ...t.default, paper: p.default }))
      .catch((e) => setLoadError(e.message));
  }, [research, researchData]);

  // Granularity and per-cell unfolding are kept separately for each mode.
  const [views, setViews] = useState({
    toy: { granularity: DEFAULT_GRANULARITY, overrides: {} },
    paper: { granularity: RESEARCH_DEFAULT_GRANULARITY, overrides: {} },
  });
  const { granularity, overrides } = views[mode];
  const defaultGranularity = research ? RESEARCH_DEFAULT_GRANULARITY : DEFAULT_GRANULARITY;
  const labels = research ? RESEARCH_LABELS : GRANULARITY_LABELS;
  const tree = research ? researchData?.tree : PROOF_TREE;

  const [hoveredId, setHoveredId] = useState(null);
  const [hoveredStep, setHoveredStep] = useState(null);
  const [flash, triggerFlash] = useFlash();             // cells
  const [sourceFlash, triggerSourceFlash] = useFlash(); // left column
  const cellsRef = useRef(null);
  const sourceRef = useRef(null);

  const levels = useMemo(() => (tree ? maxLevel(tree) : 0), [tree]);
  const nodeIndex = useMemo(() => (tree ? indexNodes(tree) : {}), [tree]);

  const confidence = useMemo(() => {
    const out = {};
    for (const sec of researchData?.tree.children ?? []) {
      out[sec.id] = "named";
      for (const r of sec.children) out[r.id] = r.confidence;
    }
    if (researchData) out["thm:main"] = "anchored";
    return out;
  }, [researchData]);

  const isExpanded = (node) => {
    if (!node.children) return false;
    if (node.id in overrides) return overrides[node.id];
    return Math.min(...node.children.map((c) => c.level)) <= granularity;
  };

  const switchMode = (m) => {
    setHoveredId(null);
    setHoveredStep(null);
    setModeParam(m);
  };

  const updateView = (patch) => setViews((v) => ({ ...v, [mode]: { ...v[mode], ...patch } }));
  const changeGranularity = (g) => updateView({ granularity: g, overrides: {} });

  // Click a step / paper anchor: scroll to the first covering cell and flash all of them.
  const goToStep = (step) => {
    if (!tree) return;
    const ids = findStepTargets(tree, step, isExpanded);
    if (!ids.length) return;
    scrollWithin(cellsRef.current, cellsRef.current?.querySelector(`[data-node-id="${CSS.escape(ids[0])}"]`));
    triggerFlash(ids);
  };

  // Click a cell's chip: scroll the left column to what the cell formalizes.
  const revealInSource = (node) => {
    const container = sourceRef.current;
    const ref = research
      ? node.steps.find((s) => document.getElementById(s))
      : Math.min(...node.steps);
    const el = research ? document.getElementById(ref) : document.getElementById(`nl-step-${ref}`);
    scrollWithin(container, el);
    triggerSourceFlash([ref]);
  };

  // Stable callbacks for the (memoized) paper blocks.
  const goToStepRef = useRef(goToStep);
  goToStepRef.current = goToStep;
  const paperActions = useMemo(() => ({
    setHoveredStep,
    goToStep: (id) => goToStepRef.current(id),
    scrollToLabel: (label) => scrollWithin(sourceRef.current, document.getElementById(label)),
  }), []);

  const visible = tree ? collectVisible(tree, isExpanded) : [];
  const hoveredNode = hoveredId ? nodeIndex[hoveredId] : null;
  const highlightedSteps = useMemo(() => new Set(hoveredNode ? hoveredNode.steps : []), [hoveredNode]);

  const ctx = {
    isExpanded,
    hoveredId,
    hoveredStep,
    setHoveredId,
    flash,
    research,
    leanBase: LEAN_BASE,
    revealInSource,
    toggle: (node, open) => updateView({ overrides: { ...overrides, [node.id]: open } }),
  };

  const hasOverrides = Object.keys(overrides).length > 0;
  const stats = researchData?.stats;

  return (
    <div className={`rg-page${research ? " is-research" : ""}`}>
      <header className="rg-topbar">
        <div className="rg-title">
          <h2>Recursive Granularity</h2>
          <div className="rg-mode" role="tablist" aria-label="Problem">
            <button className={mode === "toy" ? "is-on" : ""} onClick={() => switchMode("toy")} role="tab" aria-selected={mode === "toy"}>
              Toy problem
            </button>
            <button className={research ? "is-on" : ""} onClick={() => switchMode("paper")} role="tab" aria-selected={research}>
              Research paper
            </button>
          </div>
          <span className="rg-subtitle">
            {research
              ? stats
                ? `L = RL = BPL · ${stats.results_mapped} results ↔ ${stats.declarations} Lean declarations`
                : "L = RL = BPL"
              : `${PROBLEM.title} · static prototype`}
          </span>
        </div>
        <div className="rg-granularity">
          <span className="rg-gran-label">Granularity</span>
          <span className="rg-gran-end">coarse</span>
          <input
            type="range"
            min={0}
            max={levels}
            step={1}
            value={granularity}
            disabled={!tree}
            onChange={(e) => changeGranularity(Number(e.target.value))}
          />
          <span className="rg-gran-end">fine</span>
          <span className="rg-gran-value">
            {labels[granularity] ?? `Level ${granularity}`}
            {granularity === defaultGranularity && " (default)"}
            {hasOverrides && " · edited"}
          </span>
          <span className="rg-gran-count">{visible.length} cells</span>
          {/* Always in the layout so the slider never shifts; hidden when there is nothing to reset. */}
          <button
            className="rg-reset"
            style={{ visibility: hasOverrides || granularity !== defaultGranularity ? "visible" : "hidden" }}
            onClick={() => changeGranularity(defaultGranularity)}
          >
            Reset
          </button>
        </div>
      </header>

      <main className="rg-main">
        <section className="rg-nl-panel" ref={sourceRef}>
          {research ? (
            researchData && (
              <ResearchPaper
                doc={researchData.paper}
                confidence={confidence}
                unmapped={researchData.unmapped}
                highlighted={highlightedSteps}
                hoveredStep={hoveredStep}
                flash={sourceFlash}
                actions={paperActions}
              />
            )
          ) : (
            <ToySolutionPanel
              highlightedSteps={highlightedSteps}
              hoveredStep={hoveredStep}
              setHoveredStep={setHoveredStep}
              goToStep={goToStep}
              sourceFlash={sourceFlash}
            />
          )}
        </section>

        <section className={`rg-cells-panel${research ? " is-informal-first" : ""}`}>
          <div className="rg-row rg-col-headings">
            <div className="rg-lean-col"><span>Lean 4</span></div>
            <div className="rg-informal-col"><span>Informalization</span></div>
          </div>
          <div className="rg-cells-scroll" ref={cellsRef}>
            {tree ? (
              <CellTree node={tree} depth={0} ctx={ctx} />
            ) : (
              <div className="rg-loading">{loadError ? `Could not load the paper data: ${loadError}` : "Loading the paper and its Lean mapping…"}</div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
