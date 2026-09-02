# ORCA backend.
#
# Owner: B · Phase: P3 (deployment)
#
# One container that runs anywhere with a real filesystem — Render, Hugging Face Spaces,
# Railway, Fly. Not Vercel: see docs/DEPLOYMENT.md for why the backend needs a disk.
#
#   docker build -t orca .
#   docker run -p 8000:8000 --env-file .env orca
#
# The data ORCA reads (Copernicus NetCDF, boundary GeoJSON) is gitignored and therefore
# absent from a fresh clone. It is fetched at CONTAINER START rather than build time, so
# credentials never end up baked into an image layer and a rebuild doesn't re-download
# 60 MB. See scripts/bootstrap_data.py.

FROM python:3.11-slim

# ── System libraries ──────────────────────────────────────────────────────
# Only curl, for the health check. The manylinux wheels for shapely, pyproj, netCDF4 and
# pyogrio bundle their own GEOS/PROJ/HDF5, so installing Debian's copies would add ~200 MB
# and — worse — pin the build to exact package names that change between Debian releases.
# A build that fails on `libproj25` not existing is not something to debug on demo day.
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Dependencies first, so an application-code change doesn't reinstall the whole stack.
COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

COPY backend/ backend/
COPY scripts/ scripts/
COPY data/knowledge/ data/knowledge/

# Directories the app writes to. Created up front so a read-only-ish base image doesn't
# fail on first write.
RUN mkdir -p data/cache data/copernicus data/geojson data/mock data/chroma

ENV PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app/backend \
    PORT=8000

EXPOSE 8000

# Readiness, not liveness: /health answers even when every upstream source is down, which
# is exactly what a platform health check should be testing for.
HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 \
    CMD curl -fsS "http://localhost:${PORT}/health" || exit 1

COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

ENTRYPOINT ["/app/docker-entrypoint.sh"]
