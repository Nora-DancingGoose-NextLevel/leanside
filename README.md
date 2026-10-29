# Recursive Granularity

**Live site:** https://nora-dancinggoose-nextlevel.github.io/leanside/

A static web interface that shows a mathematical proof, its Lean 4 formalization, and a one-sentence
natural-language *informalization* of every piece of Lean code, side by side. The Lean code is split into
cells whose granularity is adjustable, and every cell can be unfolded recursively: a theorem unfolds into
its parts, a part into lemmas, a lemma into its `have` statements, a `have` into the `have`s inside it.
Every cell, at every level, keeps exactly one informalization.

Two examples, switched with the toggle in the top bar:

| mode | left | middle | right |
| --- | --- | --- | --- |
| **Toy problem** — EECS 127 midterm: the second principal component, $p^\star = \lambda_1$ | student-style solution | Lean cells | informalization |
| **Research paper** — *Exact Derandomization of Logarithmic Space: L = RL = BPL* (OpenAI, 2026) | the paper | informalization | Lean cells |

How to use it:

- **Granularity slider**: coarse (one cell for the whole theorem) to fine (nested `have` statements).
- **+ / −** on a cell: unfold it one level, or fold it back.
- **Hover** a cell to highlight the part of the proof or paper it corresponds to (and vice versa).
- **Click** a proof step, paper result or section heading to jump to its cells; they flash briefly.
- **Click** a cell's label (e.g. *Lemma 7.4*) to scroll the left column to it.
- `?mode=paper` links straight to the research-paper mode.

## Running locally

Requires Node 20+.

```sh
npm install
npm run dev       # http://localhost:5173
npm run build     # static site in dist/
npm run preview   # serve dist/
```

There is no backend: all proofs, Lean code, mappings and informalizations are static files.

## Deploying to GitHub Pages

`.github/workflows/deploy.yml` builds the site and publishes it on every push to `main`.
One-time setup in the GitHub repository: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
The build uses relative asset paths (`base: "./"` in `vite.config.js`), so it works under
`https://<user>.github.io/leanside/` and on any other static host.

## Layout

```
src/
  main.jsx, index.css                     entry point and global palette
  recursive_granularity/
    RecursiveGranularityPage.jsx          the page: mode toggle, slider, panels
    CellTree.jsx                          Lean cells + informalizations (shared by both modes)
    proofData.js                          toy problem: solution, Lean proof tree, informalizations
    research/
      ResearchPaper.jsx                   paper renderer
      data/paper.json                     paper, parsed from LaTeX           (generated)
      data/research_tree.json             paper -> Lean granularity tree     (generated)
      tools/                              generators and checks (Python / Node)
public/recursive_granularity/l_rl_bpl/    paper source + PDF, full Lean library, mapping files
```

### Toy problem

The Lean proof in `proofData.js` compiles against Mathlib (Lean v4.23); its only `sorry`s are two
axioms of the original problem setup (`spectral_quadratic_form`, `parseval_identity`). The tree
reassembles the compiled file exactly at every granularity.

### Research paper

Paper and Lean library are from [openai/math](https://github.com/openai/math) (Apache-2.0) and are
shown unmodified. The paper→Lean mapping and the informalizations were written for this project by
reading the Lean statements against the paper. Each link is labelled `anchored` (asserted by the
upstream repo — only Theorem 1.1), `named` (the Lean states the result) or `structural` (closest
counterpart, not a direct statement). Results without a Lean counterpart are marked *not in Lean*.
See [`public/recursive_granularity/l_rl_bpl/README.md`](public/recursive_granularity/l_rl_bpl/README.md)
for details and how to regenerate the data.

## Licensing

The paper and Lean sources under `public/recursive_granularity/l_rl_bpl/` are © OpenAI, Apache-2.0
(see the `LICENSE` file in that folder).
