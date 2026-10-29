# L = RL = BPL: paper, Lean, and mapping

Source data for the **Research paper** mode of the site (`?mode=paper`).

| folder | contents | origin |
| --- | --- | --- |
| `paper/` | `paper.pdf`, the LaTeX source (`latex/`), the two TikZ figures cropped from the PDF (`figures/`) | [openai/math](https://github.com/openai/math) `preprints/Exact-Derandomization-of-Logarithmic-Space-L-equals-RL-equals-BPL-September-23-2026` |
| `lean/` | the full Lean library `OAI/Computability/Logspace` (39 modules, ~43k lines), the Comparator statement, the repo's scope note `docs/103.md`, `lean-toolchain` (Lean v4.34.1) | openai/math `lean/` |
| `mapping/` | one JSON file per paper section: which Lean declarations formalize which paper result, and a one-sentence informalization for every result, declaration and proof chunk | written for this project |

Upstream commit: see `UPSTREAM_COMMIT`. Paper and Lean are Apache-2.0 (`LICENSE`) and are kept
unmodified. The Lean library is not compiled here (it needs Lean v4.34.1 and Mathlib); the viewer
only displays it.

## How the mapping was made

The Lean names are invented (`Rock`, `Umbra`, `Fret`, ...) and there are almost no docstrings, so
the correspondence was found by reading the Lean statements against the paper. Each paper result
is labelled with the evidence behind its link:

| label | meaning |
| --- | --- |
| `anchored` | asserted by the upstream repo: `formalization.yaml` names `exact_logarithmic_space_derandomization` as the formalization of Theorem 1.1 |
| `named` | the Lean declaration states the paper result (possibly in an equivalent form) |
| `structural` | the declaration carries out the result's argument or is its closest counterpart, but does not state it |

Results with no Lean counterpart are listed under `unmapped` with a reason. Notably, the Lean
proves the class equality with a fixed accuracy (1/32) and does not formalize the variable-precision
theorem, the effective compiler (Section 13), fingerprints/hashing (Section 9 compares IDs exactly
instead), promise classes, or certified search.

Informalizations follow the LeanTutor informalizer rules: one
sentence, faithful to the Lean statement (not the paper), LaTeX in `\( \)`, paper notation where a
Lean object corresponds to a paper object.

## Regenerating

Tools live in `src/recursive_granularity/research/tools/`:

```sh
cd src/recursive_granularity/research/tools
python3 parse_paper.py ../../../../public/recursive_granularity/l_rl_bpl/paper/latex ../data/paper.json
node check_paper.mjs                      # KaTeX parses every formula, refs/cites resolve
python3 lean_tools.py index               # declaration index -> out/lean_index.{json,tsv}
python3 lean_tools.py chunks <Module> <decl>   # chunk tree of one declaration
python3 mapping_tools.py validate ../../../../public/recursive_granularity/l_rl_bpl/mapping/*.json
python3 build_tree.py                     # -> ../data/research_tree.json
python3 crop_figures.py                   # needs PyMuPDF; -> paper/figures/*.png
```

`build_tree.py` refuses to build if a mapping file fails validation, or if a declaration's chunks
do not reassemble its exact source text.
