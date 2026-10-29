#!/usr/bin/env python3
"""
parse_paper.py -- Convert the LaTeX source of the OpenAI preprint "Exact
Derandomization of Logarithmic Space: L = RL = BPL" into a structured JSON
document the React viewer can render.

Adapted from the Vlasov-Maxwell parser on branch nora/try_paper_formalization
(src/research_formalization/tools/parse_paper.py).

The parser handles the subset of LaTeX this paper actually uses: sectioning,
amsthm theorem environments, numbered/unnumbered display math, proofs, two tikz
figures (shown as images cropped from paper.pdf), booktabs tables, and inline
markup (math, \\eqref, \\ref, \\cref, \\cite, \\emph).

Every theorem-like block gets a stable `id` (its \\label, else `res-<number>`),
and every proof records the id of the result it proves in `for`, so the
paper -> Lean mapping can address results that carry no label.

It computes LaTeX's numbering itself -- theorem-family counters shared and reset
per section (\\newtheorem{theorem}{Theorem}[section]) and equation counters reset
per section (\\numberwithin{equation}{section}) -- so that cross references
resolve to the same numbers the compiled PDF shows.

Source: https://github.com/openai/math (Apache-2.0)
"""
import json
import re
import sys
from pathlib import Path

THEOREM_ENVS = {
    "theorem": "Theorem",
    "proposition": "Proposition",
    "lemma": "Lemma",
    "corollary": "Corollary",
    "definition": "Definition",
    "remark": "Remark",
    "claim": "Claim",
    "assumption": "Assumption",
    "example": "Example",
}
# Display-math environments. Value says whether LaTeX numbers them.
MATH_ENVS = {
    "equation": True, "equation*": False,
    "align": True, "align*": False,
    "gather": True, "gather*": False,
    "multline": True, "multline*": False,
}


# ---------------------------------------------------------------- inline pass

INLINE_MATH_RE = re.compile(r"\$(?P<body>(?:[^$\\]|\\.)+)\$", re.S)


def strip_comments(text: str) -> str:
    out = []
    for line in text.split("\n"):
        # A percent sign is a comment unless escaped.
        i, esc = 0, False
        cut = None
        while i < len(line):
            c = line[i]
            if esc:
                esc = False
            elif c == "\\":
                esc = True
            elif c == "%":
                cut = i
                break
            i += 1
        out.append(line if cut is None else line[:cut])
    return "\n".join(out)


def texify_punctuation(t: str) -> str:
    """Apply the text-mode ligatures TeX would: dashes, quotes and ties."""
    t = t.replace("---", "\u2014").replace("--", "\u2013")
    t = t.replace("``", "\u201c").replace("''", "\u201d")
    t = t.replace("~", "\u00a0")
    return t


def read_group(s: str, i: int):
    """Read a brace group starting at s[i]=='{'. Returns (content, index_after)."""
    assert s[i] == "{", s[i:i + 20]
    depth, j = 0, i
    while j < len(s):
        if s[j] == "\\":
            j += 2
            continue
        if s[j] == "{":
            depth += 1
        elif s[j] == "}":
            depth -= 1
            if depth == 0:
                return s[i + 1:j], j + 1
        j += 1
    raise ValueError("unbalanced braces: " + s[i:i + 60])


def read_optional(s: str, i: int):
    """Read an optional [..] argument at s[i]. Returns (content_or_None, index_after)."""
    if i < len(s) and s[i] == "[":
        depth, j = 0, i
        while j < len(s):
            if s[j] == "[":
                depth += 1
            elif s[j] == "]":
                depth -= 1
                if depth == 0:
                    return s[i + 1:j], j + 1
            j += 1
    return None, i


class Doc:
    """Holds counters and the label table while parsing."""

    def __init__(self):
        self.section = 0
        self.thm = 0          # shared amsthm counter, reset per section
        self.eq = 0           # equation counter, reset per section
        self.subsection = 0
        self.figure = 0
        self.table = 0
        self.labels = {}      # label -> {"kind","number","prefix"}
        self.cites = {}       # bibkey -> index
        self.citeorder = []
        self.last_figsource = None  # most recent \figsource sentinel
        self.last_result = None     # id of the most recent theorem-like block

    def new_section(self):
        self.section += 1
        self.thm = 0
        self.eq = 0
        self.subsection = 0
        return str(self.section)

    def new_subsection(self):
        self.subsection += 1
        return f"{self.section}.{self.subsection}"

    def new_theorem(self):
        self.thm += 1
        return f"{self.section}.{self.thm}"

    def new_equation(self):
        self.eq += 1
        return f"{self.section}.{self.eq}"

    def new_figure(self):
        self.figure += 1
        return str(self.figure)

    def cite(self, key):
        if key not in self.cites:
            self.citeorder.append(key)
            self.cites[key] = len(self.citeorder)
        return self.cites[key]


def parse_inline(s: str, doc: Doc):
    """Turn a run of body text into a list of inline nodes."""
    nodes = []
    buf = []

    def flush():
        if buf:
            t = "".join(buf)
            # Collapse whitespace but keep paragraph-internal single spaces.
            t = re.sub(r"\s+", " ", t)
            t = texify_punctuation(t)
            if t:
                nodes.append({"t": "text", "v": t})
            buf.clear()

    i = 0
    while i < len(s):
        c = s[i]
        if c == "$":
            m = INLINE_MATH_RE.match(s, i)
            if m:
                flush()
                nodes.append({"t": "math", "v": re.sub(r"\s+", " ", m.group("body")).strip()})
                i = m.end()
                continue
            buf.append(c)
            i += 1
            continue
        if c == "\\":
            m = re.match(r"\\([a-zA-Z]+)\*?", s[i:])
            if not m:
                # Escaped character such as \% or \&, or \\ line break.
                buf.append(s[i + 1:i + 2])
                i += 2
                continue
            cmd = m.group(1)
            j = i + m.end()
            if cmd in ("eqref", "ref"):
                arg, j2 = read_group(s, j)
                flush()
                nodes.append({"t": "ref", "label": arg.strip(), "eq": cmd == "eqref"})
                i = j2
                continue
            if cmd in ("cref", "Cref"):
                # cleveref prints the kind with the number: "Lemma 4.3".
                arg, j2 = read_group(s, j)
                flush()
                for k, lb in enumerate(x.strip() for x in arg.split(",")):
                    if k:
                        nodes.append({"t": "text", "v": ", "})
                    nodes.append({"t": "ref", "label": lb, "eq": False, "named": True})
                i = j2
                continue
            if cmd == "S":
                buf.append("\u00a7")
                i = j
                continue
            if cmd in ("textnormal", "textrm", "mbox", "hbox"):
                arg, j2 = read_group(s, j) if j < len(s) and s[j] == "{" else ("", j)
                buf.append(arg)
                i = j2
                continue
            if cmd == "cite":
                # \cite may carry a locator: \cite[Theorem~1.2]{Key}
                locator, j = read_optional(s, j)
                arg, j2 = read_group(s, j)
                flush()
                keys = [k.strip() for k in arg.split(",") if k.strip()]
                nodes.append({"t": "cite", "keys": keys,
                              "nums": [doc.cite(k) for k in keys],
                              "loc": parse_inline(locator, doc) if locator else None})
                i = j2
                continue
            if cmd in ("emph", "textit", "textbf", "text"):
                arg, j2 = read_group(s, j)
                flush()
                sub = parse_inline(arg, doc)
                nodes.append({"t": "bold" if cmd == "textbf" else "em", "c": sub})
                i = j2
                continue
            if cmd == "label":
                arg, j2 = read_group(s, j)
                i = j2
                continue
            if cmd == "figsource":
                arg, j2 = read_group(s, j)
                doc.last_figsource = arg.strip()
                i = j2
                continue
            if cmd in ("qquad", "quad"):
                buf.append(" ")
                i = j
                continue
            if cmd in ("Needspace", "needspace", "centering", "noindent",
                       "smallskip", "medskip", "bigskip", "par",
                       "renewcommand", "arraystretch", "toprule", "midrule",
                       "bottomrule", "small", "footnotesize", "displaystyle",
                       "begingroup", "endgroup", "widowpenalty", "newline",
                       "baselineskip", "rm", "notag"):
                # Layout-only commands: drop them, with their arguments.
                if cmd == "renewcommand":
                    _, j = read_group(s, j) if j < len(s) and s[j] == "{" else (None, j)
                    _, j = read_group(s, j) if j < len(s) and s[j] == "{" else (None, j)
                elif cmd in ("Needspace", "needspace"):
                    while j < len(s) and s[j] not in "\n":
                        j += 1
                i = j
                continue
            if cmd in ("dots", "ldots"):
                buf.append("\u2026")
                i = j
                continue
            # Unknown control word: keep its literal text so nothing is silently lost.
            buf.append("\\" + cmd)
            i = j
            continue
        buf.append(c)
        i += 1
    flush()
    return nodes


# ------------------------------------------------------------- block pass

ENV_BEGIN_RE = re.compile(r"\\begin\{([a-zA-Z*]+)\}")


def find_env_end(s: str, env: str, start: int):
    """Index of the \\end{env} matching the \\begin{env} that ends at `start`."""
    depth = 1
    pat = re.compile(r"\\(begin|end)\{" + re.escape(env) + r"\}")
    pos = start
    while True:
        m = pat.search(s, pos)
        if not m:
            raise ValueError(f"unterminated environment {env}")
        depth += 1 if m.group(1) == "begin" else -1
        if depth == 0:
            return m.start(), m.end()
        pos = m.end()


def collect_labels(body: str):
    return re.findall(r"\\label\{([^}]*)\}", body)


def clean_math(body: str) -> str:
    """Strip \\label and layout-only macros from a math body for KaTeX."""
    body = re.sub(r"\\label\{[^}]*\}", "", body)
    body = re.sub(r"\\(Needspace|needspace)\{[^}]*\}", "", body)
    body = re.sub(r"\\intertext\{([^}]*)\}", r"\\text{\1}", body)
    # Table-spacing directives are typesetting-only and KaTeX rejects them.
    body = re.sub(r"\\renewcommand\{[^}]*\}\{[^}]*\}", "", body)
    return body.strip()


def parse_blocks(s: str, doc: Doc, in_theorem=False):
    """Parse a body of LaTeX into a list of block nodes."""
    blocks = []
    pos = 0
    pending_text = []

    def flush_text():
        raw = "".join(pending_text)
        pending_text.clear()
        # Split on blank lines into paragraphs.
        for chunk in re.split(r"\n\s*\n", raw):
            if chunk.strip():
                content = parse_inline(chunk, doc)
                if content:
                    blocks.append({"type": "para", "content": content})

    while pos < len(s):
        # Sectioning
        m = re.compile(r"\\(section|subsection|subsubsection|paragraph)\*?\s*\{").search(s, pos)
        env = ENV_BEGIN_RE.search(s, pos)
        disp = re.compile(r"\\\[").search(s, pos)

        cands = [(x.start(), k, x) for k, x in
                 (("sec", m), ("env", env), ("disp", disp)) if x]
        if not cands:
            pending_text.append(s[pos:])
            break
        cands.sort()
        at, kind, mm = cands[0]
        pending_text.append(s[pos:at])

        if kind == "sec":
            flush_text()
            level = {"section": 1, "subsection": 2, "subsubsection": 3,
                     "paragraph": 4}[mm.group(1)]
            title_raw, after = read_group(s, mm.end() - 1)
            # A \label may follow on the same or next line.
            lm = re.compile(r"\s*\\label\{([^}]*)\}").match(s, after)
            label = None
            if lm:
                label, after = lm.group(1), lm.end()
            # \paragraph is a run-in heading and carries no number.
            number = (doc.new_section() if level == 1
                      else None if level == 4
                      else doc.new_subsection())
            if label:
                doc.labels[label] = {"kind": "section", "number": number,
                                     "prefix": "Section"}
            blocks.append({"type": "heading", "level": level, "number": number,
                           "title": parse_inline(title_raw, doc), "label": label,
                           "id": label or (f"sec-{number}" if number
                                           else f"para-{at}")})
            pos = after
            continue

        if kind == "disp":
            flush_text()
            end = s.find("\\]", mm.end())
            body = s[mm.end():end]
            blocks.append({"type": "math", "latex": clean_math(body),
                           "numbers": [], "labels": []})
            pos = end + 2
            continue

        name = mm.group(1)
        bstart = mm.end()

        if name in MATH_ENVS:
            flush_text()
            e0, e1 = find_env_end(s, name, bstart)
            body = s[bstart:e0]
            labels = collect_labels(body)
            numbers = []
            if MATH_ENVS[name]:
                # One number per label; a numbered env with no label still
                # advances LaTeX's counter.
                if labels:
                    for lb in labels:
                        n = doc.new_equation()
                        numbers.append(n)
                        doc.labels[lb] = {"kind": "equation", "number": n,
                                          "prefix": "Equation"}
                else:
                    numbers.append(doc.new_equation())
            inner = clean_math(body)
            if name in ("align", "align*", "gather", "gather*"):
                inner = f"\\begin{{{name.rstrip('*')}ed}}\n{inner}\n\\end{{{name.rstrip('*')}ed}}"
            blocks.append({"type": "math", "latex": inner,
                           "numbers": numbers, "labels": labels,
                           "env": name})
            pos = e1
            continue

        if name in THEOREM_ENVS:
            flush_text()
            e0, e1 = find_env_end(s, name, bstart)
            body = s[bstart:e0]
            # Optional [title] then optional \label
            opt, k = read_optional(body, 0)
            lm = re.compile(r"\s*\\label\{([^}]*)\}").match(body, k)
            label = None
            if lm:
                label, k = lm.group(1), lm.end()
            number = doc.new_theorem()
            if label:
                doc.labels[label] = {"kind": name, "number": number,
                                     "prefix": THEOREM_ENVS[name]}
            doc.last_result = label or f"res-{number}"
            blocks.append({
                "type": "theorem", "env": name, "prefix": THEOREM_ENVS[name],
                "number": number, "label": label, "id": doc.last_result,
                "title": parse_inline(opt, doc) if opt else None,
                "blocks": parse_blocks(body[k:], doc, in_theorem=True),
            })
            pos = e1
            continue

        if name == "proof":
            flush_text()
            e0, e1 = find_env_end(s, name, bstart)
            body = s[bstart:e0]
            opt, k = read_optional(body, 0)
            blocks.append({"type": "proof", "for": doc.last_result,
                           "title": parse_inline(opt, doc) if opt else None,
                           "blocks": parse_blocks(body[k:], doc)})
            pos = e1
            continue

        if name == "figure":
            flush_text()
            e0, e1 = find_env_end(s, name, bstart)
            body = s[bstart:e0]
            number = doc.new_figure()
            labels = collect_labels(body)
            cap = re.search(r"\\caption\{", body)
            caption = None
            if cap:
                cbody, _ = read_group(body, cap.end() - 1)
                caption = parse_inline(cbody, doc)
            # Which hand-written SVG to use: named by the \figsource sentinel
            # that expand_figure_inputs() left where the \input used to be.
            inner = [m for m in re.findall(r"\\figsource\{([a-zA-Z-]+)\}", body)
                     if not m.endswith("-caption")]
            fig = inner[0] if inner else doc.last_figsource
            if fig and fig.endswith("-caption"):
                fig = fig[: -len("-caption")]
            for lb in labels:
                doc.labels[lb] = {"kind": "figure", "number": number,
                                  "prefix": "Figure"}
            blocks.append({"type": "figure", "number": number, "figure": fig,
                           "caption": caption, "label": labels[0] if labels else None})
            pos = e1
            continue

        if name == "table":
            # A floating table: keep its tabular and caption.
            flush_text()
            e0, e1 = find_env_end(s, name, bstart)
            body = s[bstart:e0]
            _, k = read_optional(body, 0)
            cap = re.search(r"\\caption\{", body)
            caption = None
            if cap:
                cbody, cend = read_group(body, cap.end() - 1)
                caption = parse_inline(cbody, doc)
                body = body[:cap.start()] + body[cend:]
            labels = collect_labels(body)
            doc.table += 1
            number = str(doc.table)
            for lb in labels:
                doc.labels[lb] = {"kind": "table", "number": number, "prefix": "Table"}
            inner = parse_blocks(re.sub(r"\\label\{[^}]*\}", "", body[k:]), doc)
            for blk in inner:
                if blk["type"] == "table":
                    blk.update(caption=caption, number=number,
                               label=labels[0] if labels else None)
            blocks.extend(inner)
            pos = e1
            continue

        if name in ("center", "tabular"):
            flush_text()
            e0, e1 = find_env_end(s, name, bstart)
            body = s[bstart:e0]
            tb = re.search(r"\\begin\{tabular\}", body) if name == "center" else None
            if name == "tabular" or tb:
                if name == "center":
                    t0, t1 = find_env_end(body, "tabular", tb.end())
                    spec_src = body[tb.end():t0]
                else:
                    spec_src = body
                spec_src = spec_src.lstrip()
                _, k = read_group(spec_src, 0) if spec_src.startswith("{") else (None, 0)
                rows_src = spec_src[k:]
                rows = []
                for raw in re.split(r"\\\\", rows_src):
                    raw = re.sub(r"\\(toprule|midrule|bottomrule)", "", raw)
                    if not raw.strip():
                        continue
                    cells = [parse_inline(c, doc) for c in raw.split("&")]
                    rows.append(cells)
                if rows:
                    blocks.append({"type": "table", "rows": rows})
                pos = e1
                continue
            # A \begin{center} wrapping something else: parse its contents.
            blocks.extend(parse_blocks(body, doc))
            pos = e1
            continue

        if name in ("itemize", "enumerate", "description"):
            flush_text()
            e0, e1 = find_env_end(s, name, bstart)
            body = s[bstart:e0]
            items = []
            parts = re.split(r"\\item\b", body)
            for p in parts[1:]:
                opt, k = read_optional(p, 0)
                items.append({"label": parse_inline(opt, doc) if opt else None,
                              "blocks": parse_blocks(p[k:], doc)})
            blocks.append({"type": "list", "ordered": name == "enumerate",
                           "items": items})
            pos = e1
            continue

        # Any other environment: parse its body inline so no prose is lost.
        e0, e1 = find_env_end(s, name, bstart)
        pending_text.append(s[bstart:e0])
        pos = e1

    flush_text()
    return blocks


def main():
    build = Path(sys.argv[1])
    out = Path(sys.argv[2])
    main_tex = strip_comments((build / "main.tex").read_text(encoding="utf-8"))

    title = re.search(r"\\title\{(.*?)\}\s*\n", main_tex, re.S).group(1)
    title = title.replace("\\\\", " ").replace("--", "\u2013")
    title = re.sub(r"\s+", " ", title).strip()
    date = re.search(r"\\date\{([^}]*)\}", main_tex).group(1)
    author = re.search(r"\\author\{([^}]*)\}", main_tex).group(1)

    doc = Doc()
    abs_m = re.search(r"\\begin\{abstract\}(.*?)\\end\{abstract\}", main_tex, re.S)
    abstract = parse_inline(abs_m.group(1), doc) if abs_m else []

    def expand_figure_inputs(src: str) -> str:
        """Inline \\input{figures/...} so figure environments and their captions
        (which live in separate files) are visible to the block parser. A
        \\figsource sentinel records which figure it was, so the client can pick
        the matching hand-written SVG."""
        def sub(m):
            fname = m.group(1)
            body = strip_comments(
                (build / "figures" / f"{fname}.tex").read_text(encoding="utf-8"))
            return "\\figsource{" + fname + "}\n" + body
        prev = None
        while prev != src:
            prev = src
            src = re.sub(r"\\input\{figures/([a-zA-Z-]+)\}", sub, src)
        return src

    order = re.findall(r"\\input\{sections/([a-zA-Z-]+)\}", main_tex)
    blocks = []
    for name in order:
        src = strip_comments((build / "sections" / f"{name}.tex").read_text(encoding="utf-8"))
        src = expand_figure_inputs(src)
        for blk in parse_blocks(src, doc):
            blk["file"] = name
            blocks.append(blk)

    bib = {}
    bib_src = (build / "references.bib").read_text(encoding="utf-8")
    for m in re.finditer(r"@\w+\{([^,]+),(.*?)\n\}", bib_src, re.S):
        key, body = m.group(1).strip(), m.group(2)
        def field(f):
            fm = re.search(r"\b" + f + r"\s*=\s*", body)
            if not fm:
                return None
            j = fm.end()
            if body[j] == "{":
                return read_group(body, j)[0]
            em = re.match(r"([^,\n]+)", body[j:])
            return em.group(1).strip() if em else None
        bib[key] = {"author": field("author"), "title": field("title"),
                    "journal": field("journal") or field("booktitle"),
                    "year": field("year"), "volume": field("volume"),
                    "pages": field("pages")}

    data = {
        "title": title, "author": author, "date": date,
        "abstract": abstract, "blocks": blocks, "labels": doc.labels,
        "citeorder": doc.citeorder, "bib": bib,
        "source": {
            "repo": "https://github.com/openai/math",
            "path": "preprints/Exact-Derandomization-of-Logarithmic-Space-"
                    "L-equals-RL-equals-BPL-September-23-2026",
            "license": "Apache-2.0",
        },
    }
    out.write_text(json.dumps(data, ensure_ascii=False, indent=1))
    kinds = {}
    for b in blocks:
        kinds[b["type"]] = kinds.get(b["type"], 0) + 1
    print(f"-> {out}")
    print("blocks:", kinds)
    print("labels:", len(doc.labels), "cites:", len(doc.citeorder))


if __name__ == "__main__":
    main()
