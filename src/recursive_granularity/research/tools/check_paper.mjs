// check_paper.mjs -- sanity checks for data/paper.json:
// every math fragment parses under KaTeX with the paper's macros, every
// \ref resolves, every \cite has a bib entry, and no LaTeX control word is
// left in prose. Run: node src/recursive_granularity/research/tools/check_paper.mjs
import fs from "fs";
import katex from "katex";
import { PAPER_MACROS } from "../paperMacros.js";

const doc = JSON.parse(fs.readFileSync(new URL("../data/paper.json", import.meta.url)));
const problems = [];
const counts = { types: {}, math: 0 };

function inline(nodes, where) {
  for (const n of nodes || []) {
    if (n.t === "math") tex(n.v, false, where);
    else if (n.t === "ref" && !doc.labels[n.label]) problems.push(`unresolved ref ${n.label} @ ${where}`);
    else if (n.t === "cite") n.keys.forEach((k) => doc.bib[k] || problems.push(`missing bib ${k}`));
    else if (n.t === "text" && /\\[a-zA-Z]/.test(n.v)) problems.push(`stray control word "${n.v.match(/\\[a-zA-Z]+/)[0]}" @ ${where}`);
    if (n.c) inline(n.c, where);
    if (n.loc) inline(n.loc, where);
  }
}
function tex(src, display, where) {
  counts.math++;
  try { katex.renderToString(src, { displayMode: display, macros: { ...PAPER_MACROS }, strict: false, throwOnError: true }); }
  catch (e) { problems.push(`katex @ ${where}: ${e.message.slice(0, 120)}`); }
}
function blocks(bs, where) {
  for (const b of bs) {
    counts.types[b.type] = (counts.types[b.type] || 0) + 1;
    const w = b.id || b.label || where;
    if (b.type === "para") inline(b.content, w);
    if (b.type === "heading") inline(b.title, w);
    if (b.type === "math") tex(b.latex, true, w);
    if (b.type === "theorem" || b.type === "proof") { inline(b.title, w); blocks(b.blocks, w); }
    if (b.type === "list") b.items.forEach((it) => blocks(it.blocks, w));
    if (b.type === "table") { b.rows.forEach((r) => r.forEach((c) => inline(c, w))); inline(b.caption, w); }
    if (b.type === "figure") inline(b.caption, w);
  }
}
inline(doc.abstract, "abstract");
blocks(doc.blocks, "top");
console.log(counts);
console.log(problems.length ? problems.join("\n") : "OK: no problems");
