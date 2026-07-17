import os
from typing import Optional

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel

from crawl4ai import AsyncWebCrawler

# Crawl4AI microservice for CityBeat. Turns any URL into clean, LLM-ready markdown
# — used to enrich directory business listings (hours, menu, description) and to
# give the newsroom fuller source text than an RSS excerpt. Runs headless Chromium
# via Playwright. Deploy on Cloud Run (scale-to-zero ≈ free). Secured by a shared
# CRAWLER_SECRET header; the CityBeat web app calls it via lib/crawler.ts.

app = FastAPI(title="CityBeat Crawler")
SECRET = os.environ.get("CRAWLER_SECRET", "")


class CrawlRequest(BaseModel):
    url: str


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/crawl")
async def crawl(req: CrawlRequest, x_crawler_secret: str = Header(default="")):
    if SECRET and x_crawler_secret != SECRET:
        raise HTTPException(status_code=401, detail="unauthorized")
    if not req.url:
        raise HTTPException(status_code=400, detail="missing url")

    async with AsyncWebCrawler() as crawler:
        result = await crawler.arun(url=req.url)

        # `markdown` can be a plain string or a MarkdownGenerationResult.
        md = getattr(result, "markdown", "") or ""
        markdown = getattr(md, "raw_markdown", None) or (md if isinstance(md, str) else str(md))

        metadata = getattr(result, "metadata", None) or {}
        title: Optional[str] = metadata.get("title") if isinstance(metadata, dict) else None

        return {
            "url": req.url,
            "success": bool(getattr(result, "success", False)),
            "status_code": getattr(result, "status_code", None),
            "title": title,
            "markdown": (markdown or "")[:200000],
        }
