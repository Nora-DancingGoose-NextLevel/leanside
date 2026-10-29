// src/recursive_granularity/research/ResearchPaper.jsx
// The paper column of the research mode. Renders data/paper.json (parsed from
// the LaTeX source by tools/parse_paper.py). Adapted from PaperDocument /
// PaperInline / TexMath on branch nora/try_paper_formalization.
//
// Theorem-like blocks and section headings are the mapping anchors: hovering
// one highlights its cells, clicking one jumps the cell panel to them.
import { Fragment, memo, useMemo } from "react";
import katex from "katex";
import { PAPER_MACROS } from "./paperMacros";
import "./researchPaper.css";

const FIGURE_BASE = `${import.meta.env.BASE_URL}recursive_granularity/l_rl_bpl/paper/figures`;

const TexMath = memo(function TexMath({ tex, display = false }) {
  const html = useMemo(() => {
    try {
      return katex.renderToString(tex, {
        displayMode: display, macros: { ...PAPER_MACROS }, strict: false, throwOnError: true, trust: true,
      });
    } catch {
      return null;
    }
  }, [tex, display]);
  if (html === null) return <code className="rp-math-error">{tex}</code>;
  return <span className={display ? "rp-math-display" : undefined} dangerouslySetInnerHTML={{ __html: html }} />;
});

/** Inline nodes: text, math, ref (\ref, \eqref, \cref), cite, em, bold. */
function Inline({ nodes, labels, onRef }) {
  if (!nodes) return null;
  return nodes.map((n, i) => {
    switch (n.t) {
      case "text":
        return <Fragment key={i}>{n.v}</Fragment>;
      case "math":
        return <TexMath key={i} tex={n.v} />;
      case "ref": {
        const meta = labels[n.label];
        const text = !meta ? "?" : n.eq ? `(${meta.number})` : n.named ? `${meta.prefix} ${meta.number}` : meta.number;
        return (
          <a key={i} className="rp-ref" href={`#${n.label}`}
             onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRef(n.label); }}>
            {text}
          </a>
        );
      }
      case "cite":
        return (
          <span key={i} className="rp-cite">
            [{n.nums.join(", ")}{n.loc ? <>, <Inline nodes={n.loc} labels={labels} onRef={onRef} /></> : null}]
          </span>
        );
      case "em":
        return <em key={i}><Inline nodes={n.c} labels={labels} onRef={onRef} /></em>;
      case "bold":
        return <strong key={i}><Inline nodes={n.c} labels={labels} onRef={onRef} /></strong>;
      default:
        return null;
    }
  });
}

function MappingBadge({ conf, unmappedReason }) {
  if (conf) return <span className={`rg-conf rg-conf--${conf}`} title="Lean cells exist for this result">{conf}</span>;
  if (unmappedReason) return <span className="rp-unmapped" title={unmappedReason}>not in Lean</span>;
  return null;
}

/** Nested block content (paragraphs, math, proofs, lists, ...). */
function renderBlocks(blocks, labels, onRef) {
  return blocks.map((b, i) => {
    switch (b.type) {
      case "para":
        return <p key={i} className="rp-para"><Inline nodes={b.content} labels={labels} onRef={onRef} /></p>;
      case "math":
        return (
          <div key={i} id={b.labels?.[0]} className="rp-eq">
            <div className="rp-eq__body"><TexMath tex={b.latex} display /></div>
            {b.numbers?.length > 0 && <span className="rp-eqno">{b.numbers.map((n) => `(${n})`).join(" ")}</span>}
          </div>
        );
      case "proof":
        return (
          <div key={i} className="rp-proof">
            <span className="rp-proof__label">
              {b.title ? <Inline nodes={b.title} labels={labels} onRef={onRef} /> : "Proof"}.
            </span>
            {renderBlocks(b.blocks, labels, onRef)}
            <span className="rp-proof__qed" aria-hidden="true" />
          </div>
        );
      case "figure":
        return (
          <figure key={i} id={b.label || undefined} className="rp-figure">
            <img src={`${FIGURE_BASE}/${b.figure}.png`} alt={`Figure ${b.number}`} />
            {b.caption && (
              <figcaption><strong>Figure {b.number}.</strong> <Inline nodes={b.caption} labels={labels} onRef={onRef} /></figcaption>
            )}
          </figure>
        );
      case "table":
        return (
          <div key={i} id={b.label || undefined} className="rp-table-wrap">
            <table className="rp-table">
              <tbody>
                {b.rows.map((row, r) => (
                  <tr key={r} className={r === 0 ? "rp-table__head" : undefined}>
                    {row.map((cell, c) => <td key={c}><Inline nodes={cell} labels={labels} onRef={onRef} /></td>)}
                  </tr>
                ))}
              </tbody>
            </table>
            {b.caption && <div className="rp-table__cap"><strong>Table {b.number}.</strong> <Inline nodes={b.caption} labels={labels} onRef={onRef} /></div>}
          </div>
        );
      case "list": {
        const Tag = b.ordered ? "ol" : "ul";
        return <Tag key={i} className="rp-list">{b.items.map((it, k) => <li key={k}>{renderBlocks(it.blocks, labels, onRef)}</li>)}</Tag>;
      }
      case "heading": {
        const Tag = b.level === 2 ? "h3" : "h4";
        return (
          <Tag key={i} id={b.id} className={b.level === 2 ? "rp-h2" : "rp-h4"}>
            {b.number && <span className="rp-h2__num">{b.number}</span>}
            <Inline nodes={b.title} labels={labels} onRef={onRef} />
          </Tag>
        );
      }
      default:
        return null;
    }
  });
}

/**
 * One top-level block. Memoized on primitive props so that hovering a cell only
 * re-renders the anchors whose highlight state changed, not the whole paper.
 * `on` / `flash` / `conf` / `unmappedReason` only matter for anchors (results
 * and section headings).
 */
const TopBlock = memo(function TopBlock({ b, labels, actions, anchorId, on, flash, conf, unmappedReason }) {
  if (!anchorId) return renderBlocks([b], labels, actions.scrollToLabel);
  const mapped = Boolean(conf);
  const cls = `${mapped ? " rp-anchor" : ""}${on ? " is-highlighted" : ""}${flash ? ` is-flash-${flash}` : ""}`;
  const handlers = mapped ? {
    onMouseEnter: () => actions.setHoveredStep(anchorId),
    onMouseLeave: () => actions.setHoveredStep(null),
    onClick: () => actions.goToStep(anchorId),
    title: "Jump to the Lean cells for this result",
  } : {};
  const badge = <MappingBadge conf={conf} unmappedReason={unmappedReason} />;
  if (b.type === "heading") {
    return (
      <h2 id={b.id} className={`rp-h1${cls}`} {...handlers}>
        <span className="rp-h1__num">{b.number}</span>
        <span className="rp-h1__text"><Inline nodes={b.title} labels={labels} onRef={actions.scrollToLabel} /></span>
        {badge}
      </h2>
    );
  }
  return (
    <section id={b.id} className={`rp-thm rp-thm--${b.env}${cls}`} {...handlers}>
      <div className="rp-thm__head">
        <span className="rp-thm__label">{b.prefix} {b.number}</span>
        {b.title && <span className="rp-thm__title">(<Inline nodes={b.title} labels={labels} onRef={actions.scrollToLabel} />)</span>}
        {badge}
      </div>
      <div className="rp-thm__body">{renderBlocks(b.blocks, labels, actions.scrollToLabel)}</div>
    </section>
  );
});

/**
 * Props:
 *   doc         parsed paper.json
 *   confidence  paper id -> "anchored" | "named" | "structural" (mapped anchors)
 *   unmapped    paper id -> reason (results with no Lean counterpart)
 *   highlighted Set of paper ids to highlight (from the hovered cell)
 *   hoveredStep paper id under the mouse
 *   flash       { ids: Set, n } | null — anchors to flash after a chip click
 *   actions     stable callbacks { setHoveredStep, goToStep, scrollToLabel }
 */
function ResearchPaper({ doc, confidence, unmapped, highlighted, hoveredStep, flash, actions }) {
  const { labels } = doc;
  const anchorOf = (b) => (b.type === "theorem" ? b.id : b.type === "heading" && b.level === 1 ? b.label : null);
  return (
    <article className="rp-paper">
      <header className="rp-paper__head">
        <h1 className="rp-paper__title">
          Exact Derandomization of Logarithmic Space: <TexMath tex="\Lclass=\RL=\BPL" />
        </h1>
        <div className="rp-paper__meta">{doc.author} · {doc.date}</div>
        <p className="rp-paper__abstract"><Inline nodes={doc.abstract} labels={labels} onRef={actions.scrollToLabel} /></p>
        <p className="rp-provenance">
          Paper (LaTeX source) and Lean library from{" "}
          <a href="https://github.com/openai/math" target="_blank" rel="noreferrer">openai/math</a> (Apache-2.0),
          shown unmodified. Only Theorem 1.1 ↔ <code>exact_logarithmic_space_derandomization</code> is asserted by
          the repository; every other link is a reading of the Lean statements, labelled{" "}
          <span className="rg-conf rg-conf--named">named</span> or{" "}
          <span className="rg-conf rg-conf--structural">structural</span>. Click a result or section to jump to
          its cells.
        </p>
      </header>
      {doc.blocks.map((b, i) => {
        const id = anchorOf(b);
        return (
          <TopBlock
            key={i}
            b={b}
            labels={labels}
            actions={actions}
            anchorId={id}
            on={id ? highlighted.has(id) || hoveredStep === id : false}
            flash={id && flash?.ids.has(id) ? (flash.n % 2) + 1 : 0}
            conf={id ? confidence[id] : undefined}
            unmappedReason={id ? unmapped[id] : undefined}
          />
        );
      })}
      <section className="rp-refs">
        <h2 className="rp-h1"><span className="rp-h1__text">References</span></h2>
        <ol className="rp-biblio">
          {doc.citeorder.map((key, i) => {
            const e = doc.bib[key] || {};
            return (
              <li key={key}>
                <span className="rp-biblio__n">[{i + 1}]</span>
                <span>
                  {e.author ? `${e.author.replace(/\s+and\s+/g, ", ")}. ` : ""}
                  {e.title ? <em>{e.title.replace(/[{}]/g, "")}. </em> : ""}
                  {[e.journal, e.volume, e.pages, e.year].filter(Boolean).join(", ")}
                </span>
              </li>
            );
          })}
        </ol>
      </section>
    </article>
  );
}

export default memo(ResearchPaper);
