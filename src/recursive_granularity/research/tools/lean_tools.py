#!/usr/bin/env python3
"""
lean_tools.py -- index the L = RL = BPL Lean library and split declarations
into recursive proof chunks for the /recursive_granularity research view.

  python3 lean_tools.py index
      Index every declaration (kind, name, namespace, 1-indexed line span,
      signature, docstring). Writes tools/out/lean_index.json and a greppable
      tools/out/lean_index.tsv.

  python3 lean_tools.py chunks <Module> <decl_name>
      Print the chunk tree of one declaration: its header (signature through
      `:= by`) and the proof split into top-level tactic items, recursing into
      `have ... := by` blocks and `·` bullets. Every chunk is a whole-line range
      of the source file, so the chunks of a node always concatenate back to
      exactly the node's source.

Declaration-span detection is adapted from tools/index_lean.py on branch
nora/try_paper_formalization.

Source: https://github.com/openai/math (Apache-2.0), lean/OAI/Computability/Logspace
"""
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
LEAN_ROOT = (HERE / "../../../../public/recursive_granularity/l_rl_bpl/lean").resolve()
SUBTREE = Path("OAI/Computability/Logspace")
OUT = HERE / "out"

DECL_KEYWORDS = (
    "theorem", "lemma", "def", "abbrev", "structure",
    "instance", "class", "inductive", "example", "axiom",
)
MODIFIERS = ("private", "protected", "noncomputable", "partial", "unsafe", "scoped", "local")
DECL_RE = re.compile(
    r"^(?P<mods>(?:@\[[^\]]*\]\s*|(?:" + "|".join(MODIFIERS) + r")\s+)*)"
    r"(?P<kw>" + "|".join(DECL_KEYWORDS) + r")\s+"
    r"(?P<name>[^\s:({\[]+)"
)
TERMINATOR_RE = re.compile(
    r"^(end\b|namespace\b|section\b|open\b|import\b|variable\b|universe\b|"
    r"noncomputable section\b|/-!|attribute\b|set_option\b|/--|#)"
)
NAMESPACE_RE = re.compile(r"^namespace\s+(\S+)")
END_RE = re.compile(r"^end\s+(\S+)\s*$")
IMPORT_RE = re.compile(r"^import\s+(\S+)")


def module_short(rel: Path) -> str:
    return rel.stem


def index_file(path: Path):
    lines = path.read_text(encoding="utf-8").split("\n")
    decls, imports, ns_stack = [], [], []
    pending = None
    doc_start = None   # line index where the most recent /-- docstring began

    def close(end_idx):
        nonlocal pending
        if pending is None:
            return
        start_idx, m, ns, doc = pending
        e = end_idx
        while e > start_idx + 1 and not lines[e - 1].strip():
            e -= 1
        name = m.group("name")
        decls.append({
            "kind": m.group("kw"),
            "name": name,
            "full_name": ".".join(ns + [name]),
            "start_line": start_idx + 1,
            "end_line": e,
            "doc": doc,
        })
        pending = None

    i = 0
    while i < len(lines):
        line = lines[i]
        mi = IMPORT_RE.match(line)
        if mi:
            imports.append(mi.group(1))
            i += 1
            continue
        if line.startswith("/--"):
            close(i)
            j = i
            while "-/" not in lines[j]:
                j += 1
            doc = " ".join(l.strip() for l in lines[i:j + 1])
            doc = re.sub(r"^/--\s*|\s*-/$", "", doc).strip()
            doc_start = (i, j, doc)
            i = j + 1
            continue
        if not line or line[0] in " \t":
            i += 1
            continue
        mn = NAMESPACE_RE.match(line)
        me = END_RE.match(line)
        md = DECL_RE.match(line)
        if mn:
            close(i)
            ns_stack.append(mn.group(1))
        elif me:
            close(i)
            if ns_stack and ns_stack[-1] == me.group(1):
                ns_stack.pop()
        elif md:
            close(i)
            doc = doc_start[2] if doc_start and doc_start[1] == i - 1 else None
            pending = (i, md, list(ns_stack), doc)
        elif TERMINATOR_RE.match(line):
            close(i)
        i += 1
    close(len(lines))
    return lines, imports, decls


def load_module(short: str):
    path = LEAN_ROOT / SUBTREE / f"{short}.lean"
    return index_file(path)


# ------------------------------------------------------------------ chunking

def find_proof_start(text: str):
    """Offset of the top-level `:=` that starts the proof/body, or None."""
    depth = 0
    i = 0
    last = 0
    while i < len(text) - 1:
        c = text[i]
        if text.startswith("--", i):
            i = text.find("\n", i)
            if i < 0:
                return None
            continue
        if c in "([{⟨":
            depth += 1
        elif c in ")]}⟩":
            depth -= 1
        elif depth == 0 and text.startswith(":=", i):
            # A `let x := v` / `have h := p` inside the statement is not the
            # proof start: skip it when a binder keyword opens the current segment.
            seg = text[last:i]
            if not re.search(r"(^|[\s(;])(let|have|set)\s[^;]*$", seg):
                return i
            last = i + 2
        i += 1
    return None


def indent_of(line: str) -> int:
    return len(line) - len(line.lstrip(" "))


# Items that become their own cell; anything else (intro, obtain, rw, simp, ...)
# merges with its neighbours into one tactic run.
STANDALONE = re.compile(r"^(·\s*)?(have|suffices|calc|show)\b")


def ends_with_by(line: str) -> bool:
    code = line.split("--")[0].rstrip()
    return bool(re.search(r"(:=|=>|\$|←|<\|)\s*by$", code)) or code.endswith(":=by") or code == "by" or code.endswith(" by")


def split_items(lines, lo, hi):
    """Split body lines [lo, hi) into top-level items (each a [start, end) range).
    An item starts at a line whose indent equals the block's base indent;
    deeper lines continue it. Comment and blank lines attach to the next item."""
    idx = [k for k in range(lo, hi) if lines[k].strip() and not lines[k].strip().startswith("--")]
    if not idx:
        return []
    base = min(indent_of(lines[k]) for k in idx)
    starts = [k for k in idx if indent_of(lines[k]) == base]
    items = []
    for n, s in enumerate(starts):
        e = starts[n + 1] if n + 1 < len(starts) else hi
        items.append([s, e])
    # Leading comments/blank lines belong to the first item.
    items[0][0] = lo
    # Trailing blank lines are trimmed from each item.
    for it in items:
        while it[1] > it[0] + 1 and not lines[it[1] - 1].strip():
            it[1] -= 1
    # Close gaps created by trimming so items stay contiguous, and let the last
    # item run to the end of the block, so the items always cover [lo, hi).
    for a, b in zip(items, items[1:]):
        a[1] = b[0]
    items[-1][1] = hi
    return items


def chunk_block(lines, lo, hi, depth, max_depth):
    """Chunk a tactic block into nodes. Consecutive plain tactic items are merged
    into one chunk; `have`/`obtain`/... and bullets stand alone and recurse."""
    items = split_items(lines, lo, hi)
    nodes, run = [], None

    def flush():
        nonlocal run
        if run:
            nodes.append({"start": run[0], "end": run[1]})
            run = None

    for s, e in items:
        first = next((k for k in range(s, e) if lines[k].strip() and not lines[k].strip().startswith("--")), s)
        head = lines[first].strip()
        standalone = STANDALONE.match(head) or head.startswith("·") or head.startswith("case ") or head.startswith("next")
        if not standalone:
            run = [run[0], e] if run else [s, e]
            continue
        flush()
        node = {"start": s, "end": e}
        if depth < max_depth and e - first > 1:
            if head.startswith("·") and not ends_with_by(lines[first]):
                # Bullet: its content is the bullet line plus deeper lines.
                kids = chunk_bullet(lines, first, e, depth + 1, max_depth)
                if len(kids) > 1:
                    kids[0]["start"] = s
                    node["children"] = kids
            else:
                # `have ... := by` whose proof continues on deeper lines.
                hdr_end = first
                while hdr_end < e - 1 and not ends_with_by(lines[hdr_end]):
                    hdr_end += 1
                if ends_with_by(lines[hdr_end]) and hdr_end + 1 < e:
                    kids = chunk_block(lines, hdr_end + 1, e, depth + 1, max_depth)
                    if len(kids) > 1:
                        node["header"] = [s, hdr_end + 1]
                        node["children"] = kids
        nodes.append(node)
    flush()
    return nodes


def chunk_bullet(lines, first, e, depth, max_depth):
    """Children of a `· tac` bullet: treat the bullet line (minus the dot) and
    its deeper lines as one tactic block."""
    shadow = list(lines)
    shadow[first] = re.sub(r"·", " ", lines[first], count=1)
    return chunk_block(shadow, first, e, depth, max_depth)


def chunk_decl(lines, decl, max_depth=3):
    """Return the chunk tree for one declaration (0-indexed, end-exclusive
    ranges are converted to 1-indexed inclusive at the end)."""
    s0, e0 = decl["start_line"] - 1, decl["end_line"]
    text = "\n".join(lines[s0:e0])
    off = find_proof_start(text)
    tree = {"start": s0, "end": e0}
    if off is not None and decl["kind"] in ("theorem", "lemma"):
        line_of = s0 + text[:off].count("\n")
        rest = text[off + 2:].lstrip(" ")
        if rest.startswith("by"):
            hdr_end = line_of
            # The header ends at the line holding `by` (tactics may follow it there).
            if hdr_end + 1 < e0:
                kids = chunk_block(lines, hdr_end + 1, e0, 1, max_depth)
                if len(kids) > 1:
                    tree["header"] = [s0, hdr_end + 1]
                    tree["children"] = kids
    return to_inclusive(tree)


def to_inclusive(n):
    out = {"start_line": n["start"] + 1, "end_line": n["end"]}
    if "header" in n:
        out["header"] = [n["header"][0] + 1, n["header"][1]]
    if "children" in n:
        out["children"] = [to_inclusive(c) for c in n["children"]]
    return out


def label_chunks(tree, prefix):
    """Assign path ids: <prefix>, <prefix>/0, <prefix>/0/1, ..."""
    tree["id"] = prefix
    for k, c in enumerate(tree.get("children", [])):
        label_chunks(c, f"{prefix}/{k}")
    return tree


def find_decl(short, name):
    lines, _, decls = load_module(short)
    hits = [d for d in decls if d["name"] == name or d["full_name"].endswith("." + name) or d["full_name"] == name]
    if not hits:
        raise SystemExit(f"no declaration {name} in {short}")
    if len(hits) > 1:
        exact = [d for d in hits if d["name"] == name]
        if len(exact) != 1:
            raise SystemExit(f"ambiguous {name} in {short}: {[d['full_name'] for d in hits]}")
        hits = exact
    return lines, hits[0]


def print_tree(lines, n, depth=0):
    pad = "  " * depth
    print(f"{pad}[{n['id']}] lines {n['start_line']}-{n['end_line']}")
    if "children" in n:
        h0, h1 = n["header"] if "header" in n else (None, None)
        if h0:
            print(f"{pad}  header:")
            for k in range(h0, h1 + 1):
                print(f"{pad}  | {lines[k - 1]}")
        for c in n["children"]:
            print_tree(lines, c, depth + 1)
    else:
        for k in range(n["start_line"], n["end_line"] + 1):
            print(f"{pad}  | {lines[k - 1]}")


def cmd_index():
    OUT.mkdir(exist_ok=True)
    modules = {}
    tsv = ["module\tname\tfull_name\tkind\tstart\tend\tsignature\tdoc"]
    for p in sorted((LEAN_ROOT / SUBTREE).glob("*.lean")):
        lines, imports, decls = index_file(p)
        short = module_short(p)
        modules[short] = {"path": str(p.relative_to(LEAN_ROOT)), "lines": len(lines),
                          "imports": imports, "declarations": decls}
        for d in decls:
            text = "\n".join(lines[d["start_line"] - 1:d["end_line"]])
            off = find_proof_start(text)
            sig = re.sub(r"\s+", " ", text[:off] if off else text)[:300]
            tsv.append("\t".join([short, d["name"], d["full_name"], d["kind"],
                                  str(d["start_line"]), str(d["end_line"]), sig, d["doc"] or ""]))
    (OUT / "lean_index.json").write_text(json.dumps(modules, indent=1, ensure_ascii=False))
    (OUT / "lean_index.tsv").write_text("\n".join(tsv))
    total = sum(len(m["declarations"]) for m in modules.values())
    print(f"{len(modules)} modules, {total} declarations -> {OUT}")


def cmd_chunks(short, name):
    lines, decl = find_decl(short, name)
    tree = label_chunks(chunk_decl(lines, decl), f"{short}.{decl['name']}")
    print(f"{decl['kind']} {decl['full_name']}  ({short}.lean {decl['start_line']}-{decl['end_line']})")
    print_tree(lines, tree)


if __name__ == "__main__":
    if sys.argv[1:2] == ["index"]:
        cmd_index()
    elif sys.argv[1:2] == ["chunks"] and len(sys.argv) == 4:
        cmd_chunks(sys.argv[2], sys.argv[3])
    else:
        print(__doc__)
