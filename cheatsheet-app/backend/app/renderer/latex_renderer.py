import os
import re
import shutil
import subprocess
import tempfile
from typing import Iterable, Optional

from jinja2 import Template

COMPILE_TIMEOUT_SECONDS = 15

LATEX_TEMPLATE = r"""
\documentclass[a4paper,10pt]{article}
\usepackage[margin={{ margin_mm }}mm]{geometry}
\usepackage{multicol}
\usepackage{microtype}
\usepackage[T1]{fontenc}
\usepackage[utf8]{inputenc}
\usepackage{amsmath,amssymb}
\usepackage{enumitem}
\pagestyle{empty}
\begin{document}
{% if document_title %}
\begin{center}
\Large \textbf{ {{ document_title }} }
\end{center}
\vspace{0.4em}
{% endif %}
\begin{multicols}{ {{ cols }} }
{% for block in blocks %}
\section*{ {{ block.title }} }
{{ block.content }}
{% if block.latex %}
\[
{{ block.latex }}
\]
{% endif %}

{% endfor %}
\end{multicols}
\end{document}
"""

_TEXT_ESCAPE_MAP = {
    "\\": r"\textbackslash{}",
    "{": r"\{",
    "}": r"\}",
    "#": r"\#",
    "$": r"\$",
    "%": r"\%",
    "&": r"\&",
    "_": r"\_",
    "^": r"\^{}",
    "~": r"\~{}",
}
_BLOCKED_LATEX_COMMANDS = re.compile(
    r"\\(?:input|include|openout|write|read|write18|usepackage|catcode|csname|def|edef|gdef|xdef|loop|repeat|immediate|special)\b",
    re.IGNORECASE,
)


def render_tex_document(
    document_title: str, blocks: Iterable[dict], cols: int = 2, margin_mm: int = 10
) -> str:
    prepared_blocks = []
    for block in blocks:
        prepared_blocks.append(
            {
                "title": escape_latex_text(str(block.get("title") or "")),
                "content": escape_latex_text(str(block.get("content") or "")),
                "latex": (block.get("latex") or "").strip(),
            }
        )

    tmpl = Template(LATEX_TEMPLATE)
    return tmpl.render(
        document_title=escape_latex_text(document_title),
        blocks=prepared_blocks,
        cols=cols,
        margin_mm=margin_mm,
    )


def render_pdf_from_tex(tex: str) -> Optional[bytes]:
    tmpdir = tempfile.mkdtemp()
    try:
        tex_path = os.path.join(tmpdir, "output.tex")
        with open(tex_path, "w", encoding="utf-8") as f:
            f.write(tex)

        for command in (
            ["tectonic", tex_path, "--outdir", tmpdir],
            ["pdflatex", "-interaction=nonstopmode", "-output-directory", tmpdir, tex_path],
        ):
            try:
                subprocess.run(
                    command,
                    check=True,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    timeout=COMPILE_TIMEOUT_SECONDS,
                )
            except (FileNotFoundError, subprocess.CalledProcessError, subprocess.TimeoutExpired):
                continue

            pdf_path = os.path.join(tmpdir, "output.pdf")
            if os.path.exists(pdf_path):
                with open(pdf_path, "rb") as pf:
                    return pf.read()
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)
    return None


def escape_latex_text(text: str) -> str:
    return "".join(_TEXT_ESCAPE_MAP.get(ch, ch) for ch in text)


def validate_latex_fragment(latex: str) -> None:
    if _BLOCKED_LATEX_COMMANDS.search(latex):
        raise ValueError("Unsafe LaTeX command detected in export payload.")
