import asyncio

from fastapi import APIRouter, HTTPException, Response

from app.renderer.latex_renderer import (
    render_pdf_from_tex,
    render_tex_document,
    validate_latex_fragment,
)
from app.schemas.export import ExportRequest

router = APIRouter()


@router.post("/export/latex")
async def export_latex(payload: ExportRequest):
    try:
        for block in payload.blocks:
            if block.latex:
                validate_latex_fragment(block.latex)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    tex = render_tex_document(
        document_title=payload.document_title,
        blocks=[block.model_dump() for block in payload.blocks],
        cols=payload.cols,
        margin_mm=payload.margin_mm,
    )
    pdf_bytes = await asyncio.to_thread(render_pdf_from_tex, tex)
    if pdf_bytes:
        return Response(content=pdf_bytes, media_type="application/pdf")

    return Response(
        content=tex,
        media_type="text/plain; charset=utf-8",
        headers={"X-Export-Fallback": "tex"},
    )
