#!/usr/bin/env python3
"""
build_tree.py -- assemble the recursive-granularity tree for the research view
from the hand-authored mapping files.

  python3 build_tree.py

Reads   public/recursive_granularity/l_rl_bpl/mapping/*.json   (paper -> Lean
        mapping + informalizations, one file per paper section) and the Lean
        sources; writes src/recursive_granularity/research/data/research_tree.json.

Tree levels (same node shape as the toy problem in ../../proofData.js):
  0 theorem   the main theorem (Theorem 1.1 / exact_logarithmic_space_derandomization)
  1 part      a paper section
  2 group     a paper result (theorem, lemma, ...) with its mapped declarations
  3 lemma     one Lean declaration
  4+ tactic   proof chunks from lean_tools.chunk_decl (have statements, nested haves)

Lean code is copied verbatim from the upstream files: a declaration's chunks
are whole-line slices, and the build fails if header + chunks do not
reassemble the declaration exactly. Containers (theorem / section / result)
show a statement view when folded: each declaration's signature with its proof
elided.
"""
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import lean_tools as lt  # noqa: E402
import mapping_tools as mt  # noqa: E402

MAPPING_DIR = (HERE / "../../../../public/recursive_granularity/l_rl_bpl/mapping").resolve()
PAPER = HERE / "../data/paper.json"
OUT = HERE / "../data/research_tree.json"

MAIN = ("Equality", "exact_logarithmic_space_derandomization")
ROOT_INFORMAL = (r"Deterministic, one-sided randomized and two-sided randomized logarithmic space "
                 r"coincide: \(\mathsf{L} = \mathsf{RL}\) and \(\mathsf{RL} = \mathsf{BPL}\).")

_modules = {}


def module(short):
    if short not in _modules:
        lines, _, decls = lt.load_module(short)
        _modules[short] = (lines, decls)
    return _modules[short]


def slice_lines(lines, a, b):
    """1-indexed inclusive line slice."""
    return "\n".join(lines[a - 1:b])


def signature_view(lines, decl):
    """The declaration's statement with the proof elided."""
    text = slice_lines(lines, decl["start_line"], decl["end_line"])
    off = lt.find_proof_start(text)
    if off is None or decl["kind"] not in ("theorem", "lemma"):
        head = text.split("\n")
        return "\n".join(head[:12]) + ("\n  …" if len(head) > 12 else "")
    return text[:off].rstrip() + " := …"


def chunk_nodes(lines, tree, refs, chip, informals, level):
    """Turn a lean_tools chunk tree into UI nodes."""
    out = []
    for c in tree.get("children", []):
        node = {"id": c["id"], "level": level, "kind": "tactic", "steps": refs, "chip": chip,
                "informal": informals[c["id"]]}
        if "children" in c:
            # `· bullet` chunks have children but no header line of their own.
            if "header" in c:
                node["header"] = slice_lines(lines, c["header"][0], c["header"][1])
            node["children"] = chunk_nodes(lines, c, refs, chip, informals, level + 1)
        else:
            node["code"] = slice_lines(lines, c["start_line"], c["end_line"])
        out.append(node)
    return out


def full_code(node):
    if "children" not in node:
        return node["code"]
    head = [node["header"]] if node.get("header") else []
    return "\n".join(head + [full_code(c) for c in node["children"]])


def decl_node(d, refs, chip, node_id):
    lines, decl = lt.find_decl(d["module"], d["name"])
    tree = lt.label_chunks(lt.chunk_decl(lines, decl), f"{d['module']}.{decl['name']}")
    node = {"id": node_id, "level": 3, "kind": "lemma", "steps": refs, "chip": chip,
            "informal": d["informal"],
            "source": {"module": d["module"], "name": decl["full_name"], "kind": decl["kind"],
                       "path": f"OAI/Computability/Logspace/{d['module']}.lean",
                       "start_line": decl["start_line"], "end_line": decl["end_line"]}}
    source = slice_lines(lines, decl["start_line"], decl["end_line"])
    if "children" in tree:
        node["header"] = slice_lines(lines, tree["header"][0], tree["header"][1])
        node["children"] = chunk_nodes(lines, tree, refs, chip, d["chunks"], 4)
        if full_code(node) != source:
            raise SystemExit(f"chunks of {d['module']}.{d['name']} do not reassemble the source")
    else:
        node["code"] = source
    return node, signature_view(lines, decl)


def main():
    paper = json.loads(PAPER.read_text())
    results = {r["id"]: r for r in mt.paper_results()}
    section_meta = {b["label"]: b for b in paper["blocks"] if b["type"] == "heading" and b["level"] == 1}
    order = [b["label"] for b in paper["blocks"] if b["type"] == "heading" and b["level"] == 1]

    mappings = {}
    for f in sorted(MAPPING_DIR.glob("*.json")):
        if not mt.validate(f):
            raise SystemExit(f"{f.name} does not validate")
        m = json.loads(f.read_text())
        mappings[m["section"]] = m

    sections, unmapped, decl_count, chunk_count = [], {}, 0, 0
    result_order = {r: k for k, r in enumerate(results)}
    for label in order:
        m = mappings.get(label)
        if not m:
            continue
        sec_num = section_meta[label]["number"]
        sec_children, sec_sigs = [], []
        for r in sorted(m["results"], key=lambda r: result_order[r["paper_id"]]):
            meta = results[r["paper_id"]]
            chip = meta["name"]
            refs = [r["paper_id"]]
            kids, sigs = [], []
            for k, d in enumerate(r["decls"]):
                node, sig = decl_node(d, refs, chip, f"{r['paper_id']}::{d['module']}.{d['name']}")
                kids.append(node)
                sigs.append(sig)
                decl_count += 1
                chunk_count += len(d["chunks"])
            head = f"-- {meta['name']}" + (f" ({meta['title']})" if meta["title"] else "")
            statement = head + "\n" + "\n\n".join(sigs)
            sec_children.append({
                "id": r["paper_id"], "level": 2, "kind": "group", "steps": refs, "chip": chip,
                "informal": r["informal"], "confidence": r["confidence"], "note": r["note"],
                "collapsedCode": statement, "children": kids})
            sec_sigs.append(statement)
        for u in m.get("unmapped", []):
            unmapped[u["paper_id"]] = u["reason"]
        if not sec_children:
            continue
        steps = [label] + [c["id"] for c in sec_children]
        sections.append({
            "id": label, "level": 1, "kind": "part", "steps": steps, "chip": f"Section {sec_num}",
            "informal": m["informal"], "modules": m["modules"],
            "collapsedCode": f"-- Section {sec_num}: Lean modules {', '.join(m['modules'])}\n\n"
                             + "\n\n".join(sec_sigs),
            "children": sec_children})

    lines, main_decl = lt.find_decl(*MAIN)
    main_code = slice_lines(lines, main_decl["start_line"], main_decl["end_line"])
    all_steps = [s for sec in sections for s in sec["steps"]] + ["thm:main"]
    tree = {"id": "root", "level": 0, "kind": "theorem", "steps": all_steps, "chip": "Theorem 1.1",
            "informal": ROOT_INFORMAL, "header": main_code, "collapsedCode": main_code,
            "children": sections}

    lean_lines = sum(len(module(p.stem)[0]) for p in (lt.LEAN_ROOT / lt.SUBTREE).glob("*.lean"))
    data = {
        "tree": tree,
        "unmapped": unmapped,
        "stats": {"sections": len(sections), "results_mapped": sum(len(s["children"]) for s in sections),
                  "results_unmapped": len(unmapped), "declarations": decl_count, "chunks": chunk_count,
                  "lean_modules": 39, "lean_lines": lean_lines},
    }
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=1))
    print(json.dumps(data["stats"]))


if __name__ == "__main__":
    main()
