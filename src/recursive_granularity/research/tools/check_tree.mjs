// check_tree.mjs -- every informalization in data/research_tree.json renders
// under KaTeX (with the paper's macros), uses \( \) rather than $, has no bare
// Unicode math symbols, and every paper reference in the tree exists.
// Run: node src/recursive_granularity/research/tools/check_tree.mjs
import fs from "fs";
import katex from "katex";
import { PAPER_MACROS } from "../paperMacros.js";

const { tree } = JSON.parse(fs.readFileSync(new URL("../data/research_tree.json", import.meta.url)));
const paper = JSON.parse(fs.readFileSync(new URL("../data/paper.json", import.meta.url)));
const problems = [];
let n = 0;
const UNICODE_MATH = /[λ≤≥≠∑∏√∞∈∉⊆⊂∀∃→←↔·⟨⟩∘×÷±∫∂αβγδεθμπρσφωΔΣΩ]/;
(function walk(node) {
  n++;
  const text = node.informal ?? "";
  if (!text.trim()) problems.push(`${node.id}: empty informalization`);
  if (/(^|[^\\])\$/.test(text)) problems.push(`${node.id}: uses $ delimiters`);
  const outside = text.replace(/\\\((.+?)\\\)|\\\[([\s\S]+?)\\\]/g, "");
  if (UNICODE_MATH.test(outside)) problems.push(`${node.id}: Unicode math outside \\( \\): ${outside.match(UNICODE_MATH)[0]}`);
  for (const m of text.matchAll(/\\\((.+?)\\\)|\\\[([\s\S]+?)\\\]/g)) {
    try { katex.renderToString(m[1] ?? m[2], { macros: { ...PAPER_MACROS }, throwOnError: true, strict: false }); }
    catch (e) { problems.push(`${node.id}: ${e.message.slice(0, 100)}`); }
  }
  for (const s of node.steps) if (!paper.labels[s] && !s.startsWith("res-")) problems.push(`${node.id}: unknown paper ref ${s}`);
  node.children?.forEach(walk);
})(tree);
console.log(`${n} nodes checked`);
console.log(problems.length ? problems.join("\n") : "OK: no problems");
