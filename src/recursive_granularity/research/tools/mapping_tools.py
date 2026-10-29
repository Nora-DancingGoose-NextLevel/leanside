#!/usr/bin/env python3
"""
mapping_tools.py -- helpers for the hand-authored paper -> Lean mapping.

  python3 mapping_tools.py results [section_label ...]
      List the paper's theorem-like blocks (id, number, title, statement) per
      section, from data/paper.json. Writes tools/out/paper_results.tsv.

  python3 mapping_tools.py validate <mapping.json> [...]
      Check a mapping file: paper ids exist and sit in the stated section,
      declarations exist, and every chunk of every mapped declaration (as
      printed by `lean_tools.py chunks`) has exactly one informalization.

Mapping file schema (one file per paper section, mapping/<section>.json):

{
  "section": "sec:est",
  "informal": "<one sentence: what the Lean for this section establishes>",
  "modules": ["EstimatorBounds", ...],
  "results": [
    {
      "paper_id": "lem:foo" | "res-7.3",
      "informal": "<one sentence: what the mapped declarations jointly state>",
      "confidence": "anchored" | "named" | "structural",
      "note": "<one sentence: why these declarations match>",
      "decls": [
        {"module": "EstimatorBounds", "name": "foo",
         "informal": "<one sentence for the declaration's statement>",
         "chunks": {"EstimatorBounds.foo/0": "<one sentence>", ...}}
      ]
    }
  ],
  "unmapped": [{"paper_id": "...", "reason": "<one sentence>"}]
}
"""
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import lean_tools as lt  # noqa: E402

PAPER = HERE / "../data/paper.json"


def plain(nodes):
    out = []
    for n in nodes or []:
        if n["t"] in ("text",):
            out.append(n["v"])
        elif n["t"] == "math":
            out.append(f"${n['v']}$")
        elif n["t"] == "ref":
            out.append(f"[{n['label']}]")
        elif n.get("c"):
            out.append(plain(n["c"]))
    return "".join(out)


def block_text(blocks):
    out = []
    for b in blocks:
        if b["type"] == "para":
            out.append(plain(b["content"]))
        elif b["type"] == "math":
            out.append(f"$${b['latex']}$$")
        elif b["type"] == "list":
            for it in b["items"]:
                out.append("- " + block_text(it["blocks"]))
    return " ".join(out)


def paper_results():
    doc = json.loads(PAPER.read_text())
    rows, section = [], None

    def walk(bs):
        for b in bs:
            if b["type"] == "theorem":
                rows.append({"section": section, "id": b["id"], "label": b["label"],
                             "name": f"{b['prefix']} {b['number']}",
                             "title": plain(b["title"]) if b["title"] else "",
                             "statement": re.sub(r"\s+", " ", block_text(b["blocks"]))})
            elif b["type"] in ("proof",):
                walk(b["blocks"])
            elif b["type"] == "list":
                for it in b["items"]:
                    walk(it["blocks"])

    for b in doc["blocks"]:
        if b["type"] == "heading" and b["level"] == 1:
            section = b["label"]
        walk([b])
    return rows


def cmd_results(sections):
    rows = paper_results()
    lt.OUT.mkdir(exist_ok=True)
    (lt.OUT / "paper_results.tsv").write_text("\n".join(
        "\t".join([r["section"], r["id"], r["name"], r["title"], r["statement"]]) for r in rows))
    for r in rows:
        if sections and r["section"] not in sections:
            continue
        print(f"{r['section']}\t{r['id']}\t{r['name']}\t{r['title']}\n    {r['statement'][:600]}\n")


def chunk_ids(tree):
    ids = [tree["id"]]
    for c in tree.get("children", []):
        ids += chunk_ids(c)
    return ids


def validate(path):
    m = json.loads(Path(path).read_text())
    errs = []
    results = {r["id"]: r for r in paper_results()}
    sec = m.get("section")
    for key in ("section", "informal", "modules", "results"):
        if key not in m:
            errs.append(f"missing top-level key {key}")
    seen = set()
    for r in m.get("results", []):
        pid = r.get("paper_id")
        if pid not in results:
            errs.append(f"unknown paper_id {pid}")
        elif results[pid]["section"] != sec:
            errs.append(f"{pid} is in {results[pid]['section']}, not {sec}")
        if pid in seen:
            errs.append(f"duplicate paper_id {pid}")
        seen.add(pid)
        for key in ("informal", "confidence", "note", "decls"):
            if not r.get(key):
                errs.append(f"{pid}: missing {key}")
        if r.get("confidence") not in ("anchored", "named", "structural"):
            errs.append(f"{pid}: bad confidence {r.get('confidence')}")
        for d in r.get("decls", []):
            try:
                lines, decl = lt.find_decl(d["module"], d["name"])
            except SystemExit as e:
                errs.append(f"{pid}: {e}")
                continue
            if not d.get("informal"):
                errs.append(f"{pid}: {d['name']} missing informal")
            tree = lt.label_chunks(lt.chunk_decl(lines, decl), f"{d['module']}.{decl['name']}")
            want = set(chunk_ids(tree)) - {tree["id"]}
            have = set(d.get("chunks", {}))
            for c in sorted(want - have):
                errs.append(f"{pid}: chunk {c} has no informalization")
            for c in sorted(have - want):
                errs.append(f"{pid}: chunk {c} does not exist (re-run lean_tools.py chunks)")
            for c, txt in d.get("chunks", {}).items():
                if not txt or not txt.strip():
                    errs.append(f"{pid}: chunk {c} informalization is empty")
    for u in m.get("unmapped", []):
        if u.get("paper_id") not in results:
            errs.append(f"unmapped: unknown paper_id {u.get('paper_id')}")
        seen.add(u.get("paper_id"))
    missing = [r["id"] for r in results.values() if r["section"] == sec and r["id"] not in seen]
    for pid in missing:
        errs.append(f"paper result {pid} in {sec} is neither mapped nor listed in unmapped")
    print(f"{path}: {'OK' if not errs else str(len(errs)) + ' problem(s)'}")
    for e in errs:
        print("  - " + e)
    return not errs


if __name__ == "__main__":
    if sys.argv[1:2] == ["results"]:
        cmd_results(sys.argv[2:])
    elif sys.argv[1:2] == ["validate"]:
        ok = all([validate(p) for p in sys.argv[2:]])
        sys.exit(0 if ok else 1)
    else:
        print(__doc__)
