import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import export as export_routes
from app.api.routes import ingest as ingest_routes

app = FastAPI()

# CORS_ORIGINS is a comma-separated list of allowed origins. Unset (dev
# default) permits the Vite dev server; in production set it to the
# public frontend origin, e.g. `http://cheatsheet.norafeng.duckdns.org`.
_default_origins = "http://localhost:5173,http://127.0.0.1:5173"
_cors_origins = [
    o.strip() for o in os.getenv("CORS_ORIGINS", _default_origins).split(",") if o.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(export_routes.router, prefix="/api", tags=["export"])
app.include_router(ingest_routes.router, prefix="/api", tags=["ingest"])


@app.get("/")
async def root():
    return {"status": "ok"}
