// src/recursive_granularity/CellTree.jsx
// Shared pieces of the recursive-granularity view: math/Lean renderers and the
// row tree of Lean cells + one-sentence informalizations. Used by both the toy
// problem and the research-paper mode.
import { memo, useMemo } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import hljs from "highlight.js/lib/core";
import lean from "highlightjs-lean";
import "highlight.js/styles/github-dark.css";
import { fullLean } from "./proofData";
import { PAPER_MACROS } from "./research/paperMacros";

if (!hljs.getLanguage("lean")) hljs.registerLanguage("lean", lean);

const MATH_RE = /\\\((.+?)\\\)|\\\[([\s\S]+?)\\\]/g;

function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Render text containing \( \) / \[ \] math with KaTeX. */
function mathToHtml(text) {
  let html = "";
  let last = 0;
  for (const m of text.matchAll(MATH_RE)) {
    html += escapeHtml(text.slice(last, m.index));
    const display = m[2] !== undefined;
    html += katex.renderToString(display ? m[2] : m[1], {
      displayMode: display, throwOnError: false, macros: { ...PAPER_MACROS },
    });
    last = m.index + m[0].length;
  }
  return html + escapeHtml(text.slice(last));
}

export const TexText = memo(function TexText({ text, className }) {
  const html = useMemo(() => mathToHtml(text), [text]);
  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />;
});

function dedent(code) {
  const lines = code.split("\n");
  const indents = lines.filter((l) => l.trim()).map((l) => l.match(/^ */)[0].length);
  const min = indents.length ? Math.min(...indents) : 0;
  return lines.map((l) => l.slice(min)).join("\n");
}

export const LeanCode = memo(function LeanCode({ code }) {
  const html = useMemo(() => hljs.highlight(dedent(code), { language: "lean" }).value, [code]);
  return <pre className="rg-lean-code"><code className="hljs" dangerouslySetInnerHTML={{ __html: html }} /></pre>;
});

function formatSteps(steps) {
  const sorted = [...steps].sort((a, b) => a - b);
  const ranges = [];
  for (const s of sorted) {
    const r = ranges[ranges.length - 1];
    if (r && s === r[1] + 1) r[1] = s;
    else ranges.push([s, s]);
  }
  const label = ranges.map(([a, b]) => (a === b ? `${a}` : `${a}–${b}`)).join(", ");
  return `${sorted.length > 1 ? "Steps" : "Step"} ${label}`;
}

const KIND_LABEL = { theorem: "theorem", part: "part", group: "group", lemma: "lemma", tactic: "have / tactic" };
const RESEARCH_KIND_LABEL = { theorem: "main theorem", part: "paper section", group: "paper result", lemma: "declaration", tactic: "have / tactic" };

function countLines(code) {
  return code.split("\n").length;
}

export function maxLevel(node) {
  return node.children ? Math.max(...node.children.map(maxLevel)) : node.level;
}

export function collectVisible(node, isExpanded, out = []) {
  if (isExpanded(node)) node.children.forEach((c) => collectVisible(c, isExpanded, out));
  else out.push(node);
  return out;
}

/**
 * Visible rows that cover a step / paper block: collapsed cells containing it,
 * or — when no visible descendant does (e.g. step 1 at fine granularity) — the
 * deepest unfolded frame that still contains it.
 */
export function findStepTargets(node, step, isExpanded, out = []) {
  const covers = node.steps.includes(step);
  if (!isExpanded(node)) {
    if (covers) out.push(node.id);
    return out;
  }
  // Children may cite steps their parent doesn't (e.g. a `have` reusing an
  // earlier lemma), so search every child.
  const before = out.length;
  node.children.forEach((c) => findStepTargets(c, step, isExpanded, out));
  if (covers && out.length === before) out.push(node.id);
  return out;
}

export function indexNodes(root) {
  const idx = {};
  (function walk(n) { idx[n.id] = n; n.children?.forEach(walk); })(root);
  return idx;
}

/** Folded code: containers in the research tree carry a statement view. */
function foldedCode(node) {
  return node.collapsedCode ?? fullLean(node);
}

function CellBarExtras({ node, ctx }) {
  return (
    <>
      {node.confidence && <span className={`rg-conf rg-conf--${node.confidence}`} title={node.note}>{node.confidence}</span>}
      {node.source && (
        <a
          className="rg-source"
          href={`${ctx.leanBase}/${node.source.path}#L${node.source.start_line}`}
          target="_blank"
          rel="noreferrer"
          title={`${node.source.name} — open the upstream file`}
        >
          {node.source.module}.lean:{node.source.start_line}
        </a>
      )}
    </>
  );
}

/**
 * One row = one Lean cell + its informalization. Expanded nodes render a slim
 * "frame" row (header code + muted summary) followed by their children,
 * indented one level. `ctx.research` swaps the column order to
 * informalization | Lean and the chips to paper references.
 */
export function CellTree({ node, depth, ctx }) {
  const expanded = ctx.isExpanded(node);
  const highlighted = ctx.hoveredId === node.id || (ctx.hoveredStep != null && node.steps.includes(ctx.hoveredStep));
  const flash = ctx.flash?.ids.has(node.id) ? ` is-flash-${ctx.flash.n % 2}` : "";
  const kindLabel = (ctx.research ? RESEARCH_KIND_LABEL : KIND_LABEL)[node.kind];
  const chip = node.chip ?? formatSteps(node.steps);

  const guides = Array.from({ length: depth }, (_, i) => <span key={i} className="rg-guide" />);
  const rowProps = {
    "data-node-id": node.id,
    onMouseEnter: () => ctx.setHoveredId(node.id),
    onMouseLeave: () => ctx.setHoveredId(null),
  };
  const chipEl = (
    <button className="rg-chip" onClick={() => ctx.revealInSource(node)} title="Show in the source on the left">
      {chip}
    </button>
  );

  if (!expanded) {
    const code = foldedCode(node);
    return (
      <div className={`rg-row${highlighted ? " is-highlighted" : ""}${flash}`} {...rowProps}>
        <div className="rg-lean-col">
          {guides}
          <div className="rg-lean-cell">
            <div className="rg-cell-bar">
              {node.children ? (
                <button className="rg-toggle" onClick={() => ctx.toggle(node, true)} title="Unfold into finer cells">+</button>
              ) : (
                <span className="rg-toggle rg-toggle-leaf" title="Finest granularity">·</span>
              )}
              <span className="rg-kind">{kindLabel}</span>
              <CellBarExtras node={node} ctx={ctx} />
              <span className="rg-lines">
                {node.collapsedCode
                  ? `${node.children.length} inside · statements`
                  : `${countLines(code)} ${countLines(code) === 1 ? "line" : "lines"}`}
              </span>
            </div>
            <LeanCode code={code} />
          </div>
        </div>
        <div className="rg-informal-col">
          {guides}
          <div className="rg-informal-cell">
            <TexText text={node.informal} className="rg-informal-text" />
            <div className="rg-chips">{chipEl}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className={`rg-row rg-frame-row${highlighted ? " is-highlighted" : ""}${flash}`} {...rowProps}>
        <div className="rg-lean-col">
          {guides}
          <div className={`rg-lean-frame${node.header ? "" : " no-header"}`}>
            <div className="rg-cell-bar">
              <button className="rg-toggle" onClick={() => ctx.toggle(node, false)} title="Fold back into one cell">−</button>
              <span className="rg-kind">{kindLabel}</span>
              <CellBarExtras node={node} ctx={ctx} />
              <span className="rg-lines">unfolded into {node.children.length} cells</span>
            </div>
            {node.header && <LeanCode code={node.header} />}
          </div>
        </div>
        <div className="rg-informal-col">
          {guides}
          <div className="rg-informal-frame">
            <TexText text={node.informal} className="rg-informal-text" />
          </div>
        </div>
      </div>
      {node.children.map((c) => (
        <CellTree key={c.id} node={c} depth={depth + 1} ctx={ctx} />
      ))}
    </>
  );
}
