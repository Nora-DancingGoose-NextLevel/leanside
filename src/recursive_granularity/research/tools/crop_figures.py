#!/usr/bin/env python3
"""
crop_figures.py -- cut the paper's two TikZ figures out of paper.pdf as PNGs,
since the viewer cannot run TikZ. Requires PyMuPDF (`pip install pymupdf`).

Each figure is located by a phrase from its caption; the crop is the union of
the vector drawings between the previous text block and the caption.

  python3 crop_figures.py
"""
from pathlib import Path

import fitz  # PyMuPDF

HERE = Path(__file__).resolve().parent
PAPER = (HERE / "../../../../public/recursive_granularity/l_rl_bpl/paper").resolve()
OUT = PAPER / "figures"

FIGURES = {
    "controller-space": "Physical stack segments",
    "compiler-padding": "The fixed library reads the padded input",
}


def crop(doc, needle):
    for page in doc:
        hits = page.search_for(needle)
        if not hits:
            continue
        anchor = hits[0]
        drawings = [d["rect"] for d in page.get_drawings() if d["rect"].height < page.rect.height * 0.9]
        if not drawings:
            continue
        # Drawings that sit in the figure: within 320pt of the anchor phrase.
        near = [r for r in drawings if abs(r.y0 - anchor.y0) < 320]
        box = fitz.Rect(near[0])
        for r in near[1:]:
            box |= r
        # Include text labels inside the drawing area, and the title phrase.
        for b in page.get_text("blocks"):
            r = fitz.Rect(b[:4])
            if r.intersects(box) or r.contains(anchor):
                if "Figure" not in b[4]:
                    box |= r
        box = (box + (-6, -6, 6, 6)) & page.rect
        return page.get_pixmap(matrix=fitz.Matrix(2.5, 2.5), clip=box)
    raise SystemExit(f"figure phrase not found: {needle}")


def main():
    OUT.mkdir(exist_ok=True)
    doc = fitz.open(PAPER / "paper.pdf")
    for name, needle in FIGURES.items():
        pix = crop(doc, needle)
        pix.save(OUT / f"{name}.png")
        print(f"{name}.png  {pix.width}x{pix.height}")


if __name__ == "__main__":
    main()
