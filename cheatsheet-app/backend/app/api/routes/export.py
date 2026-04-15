import asyncio

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field

try:
    from playwright.sync_api import Error as PlaywrightError
    from playwright.sync_api import sync_playwright
except ModuleNotFoundError:
    PlaywrightError = Exception  # type: ignore[assignment]
    sync_playwright = None

router = APIRouter()

MAX_HTML_LENGTH = 2_000_000  # ~2MB, plenty for a multi-page cheatsheet


class ExportPdfRequest(BaseModel):
    html: str = Field(min_length=1, max_length=MAX_HTML_LENGTH)


@router.post("/export/pdf")
async def export_pdf(payload: ExportPdfRequest):
    try:
        pdf_bytes = await asyncio.to_thread(_render_pdf_sync, payload.html)
    except Exception as e:
        detail = str(e).strip() or repr(e)
        raise HTTPException(
            status_code=500,
            detail=f"PDF render failed ({type(e).__name__}): {detail}",
        )
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=cheatsheet.pdf"},
    )


def _render_pdf_sync(html: str) -> bytes:
    if sync_playwright is None:
        raise RuntimeError(
            "Playwright is not installed. Run `pip install playwright` and "
            "`python -m playwright install chromium`."
        )

    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        try:
            page = browser.new_page()
            try:
                page.emulate_media(media="print")
                page.set_content(html, wait_until="load")
                page.wait_for_load_state("networkidle")
                page.wait_for_function(
                    "() => !document.fonts || document.fonts.status === 'loaded'"
                )
                return page.pdf(
                    format="A4",
                    margin={"top": "0mm", "right": "0mm", "bottom": "0mm", "left": "0mm"},
                    print_background=True,
                )
            finally:
                page.close()
        except PlaywrightError:
            raise
        finally:
            browser.close()
