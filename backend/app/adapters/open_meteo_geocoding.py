"""Open-Meteo Geocoding — place name → coordinates.

Owner: B · Phase: P0
Endpoint: https://geocoding-api.open-meteo.com/v1/search
Auth: none · Cache TTL: 30 days (place names don't move)

Resolves "near Vizag" or "Kakinada" when the device gives no GPS.

## Two hazards this adapter exists to handle

**Ambiguity.** Many Indian place names have inland namesakes. Resolving a fishing query to
an inland town silently produces a nonsense marine forecast — the marine grid returns all
nulls there, so the failure surfaces far downstream as "no wave data" rather than as
"wrong place". Results are therefore scored toward the coast before one is picked.

**Name variety.** A fisherman may type "Vizag", "Visakhapatnam" or "విశాఖపట్నం" for the
same harbour. The geocoder handles the formal spellings and misses the colloquial ones,
so a small hand-written alias table covers the major fishing harbours — more reliable
than the geocoder for exactly the names our users actually type.
"""

from __future__ import annotations

import asyncio
import logging
import unicodedata

from app.adapters.base import fetch_with_cascade, get_json
from app.schemas.response import Location
from app.services.cache import cache_key

logger = logging.getLogger(__name__)

BASE_URL = "https://geocoding-api.open-meteo.com/v1/search"
CACHE_TTL = 2_592_000  # 30 days
ATTRIBUTION = "Geocoding by Open-Meteo.com (CC BY 4.0)"

SOURCE = "Open-Meteo Geocoding"

# Major Indian fishing harbours, keyed by every spelling a user might plausibly type —
# colloquial, formal, and regional script. Checked before the geocoder because these are
# the names that actually appear in our queries, and a fixed point beats a lucky match.
HARBOUR_ALIASES: dict[str, tuple[float, float, str]] = {
    # Andhra Pradesh
    "kakinada": (16.9604, 82.2381, "Kakinada"),
    "కాకినాడ": (16.9604, 82.2381, "Kakinada"),
    "vizag": (17.6868, 83.2185, "Visakhapatnam"),
    "visakhapatnam": (17.6868, 83.2185, "Visakhapatnam"),
    "vishakhapatnam": (17.6868, 83.2185, "Visakhapatnam"),
    "విశాఖపట్నం": (17.6868, 83.2185, "Visakhapatnam"),
    "machilipatnam": (16.1875, 81.1389, "Machilipatnam"),
    "మచిలీపట్నం": (16.1875, 81.1389, "Machilipatnam"),
    "nizampatnam": (15.9036, 80.6689, "Nizampatnam"),
    # Tamil Nadu
    "chennai": (13.0827, 80.2707, "Chennai"),
    "சென்னை": (13.0827, 80.2707, "Chennai"),
    "nagapattinam": (10.7660, 79.8420, "Nagapattinam"),
    "நாகப்பட்டினம்": (10.7660, 79.8420, "Nagapattinam"),
    "rameswaram": (9.2876, 79.3129, "Rameswaram"),
    "இராமேஸ்வரம்": (9.2876, 79.3129, "Rameswaram"),
    "tuticorin": (8.7642, 78.1348, "Thoothukudi"),
    "thoothukudi": (8.7642, 78.1348, "Thoothukudi"),
    "kanyakumari": (8.0883, 77.5385, "Kanyakumari"),
    # Kerala
    "kochi": (9.9312, 76.2673, "Kochi"),
    "cochin": (9.9312, 76.2673, "Kochi"),
    "കൊച്ചി": (9.9312, 76.2673, "Kochi"),
    "kozhikode": (11.2588, 75.7804, "Kozhikode"),
    "calicut": (11.2588, 75.7804, "Kozhikode"),
    "kollam": (8.8932, 76.6141, "Kollam"),
    "thiruvananthapuram": (8.5241, 76.9366, "Thiruvananthapuram"),
    "trivandrum": (8.5241, 76.9366, "Thiruvananthapuram"),
    # West Bengal / Odisha
    "digha": (21.6270, 87.5079, "Digha"),
    "দীঘা": (21.6270, 87.5079, "Digha"),
    "haldia": (22.0667, 88.0698, "Haldia"),
    "paradip": (20.3161, 86.6114, "Paradip"),
    "paradeep": (20.3161, 86.6114, "Paradip"),
    "gopalpur": (19.2647, 84.9052, "Gopalpur"),
    # West coast
    "mumbai": (18.9388, 72.8354, "Mumbai"),
    "मुंबई": (18.9388, 72.8354, "Mumbai"),
    "ratnagiri": (16.9902, 73.3120, "Ratnagiri"),
    "goa": (15.4909, 73.8278, "Panaji"),
    "panaji": (15.4909, 73.8278, "Panaji"),
    "mangalore": (12.9141, 74.8560, "Mangaluru"),
    "mangaluru": (12.9141, 74.8560, "Mangaluru"),
    "karwar": (14.8137, 74.1290, "Karwar"),
    "veraval": (20.9070, 70.3670, "Veraval"),
    "porbandar": (21.6417, 69.6293, "Porbandar"),
    "okha": (22.4667, 69.0710, "Okha"),
}

# Feature codes that indicate a populated place near water vs. an inland administrative
# area. Open-Meteo returns GeoNames feature codes; harbours and coastal towns are almost
# always PPL* (populated place).
_COASTAL_HINT_WORDS = ("port", "harbour", "harbor", "beach", "coast", "island", "bay")


def _normalise(name: str) -> str:
    """Casefold + strip accents so 'Kākināda' and 'Kakinada' hit the same alias."""
    decomposed = unicodedata.normalize("NFKD", name.strip().casefold())
    # Keep Indic combining marks (they are meaningful); drop only Latin diacritics.
    return "".join(
        ch for ch in decomposed if not (unicodedata.combining(ch) and ord(ch) < 0x0300 or
                                        unicodedata.category(ch) == "Mn" and ord(ch) < 0x0370)
    )


def _lookup_alias(name: str) -> Location | None:
    """Resolve against the hand-written harbour table."""
    key = _normalise(name)
    hit = HARBOUR_ALIASES.get(key)
    if hit is None:
        # Try the raw casefolded form too, for scripts the normaliser leaves alone.
        hit = HARBOUR_ALIASES.get(name.strip().casefold())
    if hit is None:
        return None
    lat, lon, label = hit
    return Location(lat=lat, lon=lon, name=label, source="geocoded")


def _score_result(result: dict) -> float:
    """Rank a geocoder hit by how likely it is to be the coastal place the user meant.

    Higher is better. Population breaks ties between same-named places; elevation is the
    strongest available signal for "this one is inland" without shipping a coastline.
    """
    score = 0.0

    elevation = result.get("elevation")
    if elevation is not None:
        # Sea-level places win. A town at 500 m is certainly not the fishing harbour.
        if elevation <= 20:
            score += 100.0
        elif elevation <= 100:
            score += 30.0
        else:
            score -= elevation / 10.0

    population = result.get("population") or 0
    if population:
        # Compressed: a 10× larger town is better, but not 10× better.
        score += min(population, 10_000_000) ** 0.25

    haystack = " ".join(
        str(result.get(k, "")) for k in ("name", "admin1", "admin2", "feature_code")
    ).casefold()
    if any(word in haystack for word in _COASTAL_HINT_WORDS):
        score += 25.0

    return score


async def geocode(name: str, language: str = "en") -> Location | None:
    """Resolve a place name to a Location, preferring coastal matches.

    Returns None when the name cannot be resolved — the caller turns that into the
    contract's LOCATION_UNRESOLVED error rather than guessing a point.
    """
    if not name or not name.strip():
        return None

    alias = _lookup_alias(name)
    if alias is not None:
        logger.debug("geocoding: '%s' resolved from the harbour alias table", name)
        return alias

    params = {
        "name": name.strip(),
        "count": 5,
        "language": language,
        "format": "json",
        "countryCode": "IN",
    }
    key = cache_key("open_meteo_geocoding", params)
    try:
        result = await fetch_with_cascade(
            key, lambda: get_json(BASE_URL, params), CACHE_TTL, SOURCE
        )
    except Exception as exc:  # noqa: BLE001 - geocoding failure is not fatal
        logger.warning("geocoding: '%s' failed (%s)", name, exc)
        return None

    results = (result.payload or {}).get("results") or []
    if not results:
        logger.info("geocoding: no match for '%s'", name)
        return None

    best = max(results, key=_score_result)
    return Location(
        lat=best["latitude"],
        lon=best["longitude"],
        name=best.get("name", name),
        source="geocoded",
    )


async def _spike() -> None:
    """P0 spike: 'Kakinada' must resolve to ≈ (16.99, 82.24)."""
    print("Open-Meteo Geocoding\n")
    for name in [
        "Kakinada",
        "Vizag",
        "విశాఖపట్నం",
        "Chennai",
        "Nagapattinam",
        "Puducherry",
        "Hyderabad",
        "Zzzznotaplace",
    ]:
        location = await geocode(name)
        if location is None:
            print(f"  {name:18} → unresolved")
        else:
            print(
                f"  {name:18} → {location.lat:8.4f}, {location.lon:8.4f}  "
                f"({location.name})"
            )

    kakinada = await geocode("Kakinada")
    assert kakinada is not None, "Kakinada must resolve"
    assert abs(kakinada.lat - 16.99) < 0.1 and abs(kakinada.lon - 82.24) < 0.1, (
        f"Kakinada resolved to {kakinada.lat},{kakinada.lon}, expected ≈16.99,82.24"
    )
    print("\n  ✓ P0 assertion passed: Kakinada ≈ 16.99, 82.24")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    asyncio.run(_spike())
