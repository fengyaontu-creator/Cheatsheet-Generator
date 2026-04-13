import asyncio

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field

try:
    from playwright.async_api import Browser, Page, Playwright, async_playwright
except ModuleNotFoundError:
    Browser = None  # type: ignore[assignment]
    Page = None  # type: ignore[assignment]
    Playwright = None  # type: ignore[assignment]
    async_playwright = None

router = APIRouter()

MAX_HTML_LENGTH = 2_000_000  # ~2MB, plenty for a multi-page cheatsheet
_playwright_instance: Playwright | None = None
_browser: Browser | None = None
_browser_lock = asyncio.Lock()


class ExportPdfRequest(BaseModel):
    html: str = Field(min_length=1, max_length=MAX_HTML_LENGTH)


@router.post("/export/pdf")
async def export_pdf(payload: ExportPdfRequest):
    try:
        pdf_bytes = await _render_pdf(payload.html)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF render failed: {e}")
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=cheatsheet.pdf"},
    )


async def _render_pdf(html: str) -> bytes:
    browser = await _get_browser()
    page = await browser.new_page()
    try:
        await page.emulate_media(media="print")
        await page.set_content(html, wait_until="load")
        await page.wait_for_load_state("networkidle")
        await page.wait_for_function(
            "() => !document.fonts || document.fonts.status === 'loaded'"
        )
        pdf_bytes = await page.pdf(
            format="A4",
            margin={"top": "0mm", "right": "0mm", "bottom": "0mm", "left": "0mm"},
            print_background=True,
        )
        return pdf_bytes
    finally:
        await page.close()


async def _get_browser() -> Browser:
    global _browser, _playwright_instance

    if async_playwright is None:
        raise RuntimeError(
            "Playwright is not installed. Run `pip install playwright` and "
            "`python -m playwright install chromium`."
        )

    if _browser is not None and _browser.is_connected():
        return _browser

    async with _browser_lock:
        if _browser is not None and _browser.is_connected():
            return _browser

        if _playwright_instance is None:
            _playwright_instance = await async_playwright().start()

        _browser = await _playwright_instance.chromium.launch()
        return _browser
