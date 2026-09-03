"""India's fishing harbours — the canonical list.

Owner: E · Phase: P4

Two jobs, and the second is why this lives in the backend rather than in the frontend's
picker where it started:

  1. populate the location picker (``GET /api/harbours``)
  2. answer **"then where?"** when someone asks about the sea from a place that has none

The second is the one that matters. Anyone opening ORCA from an office is inland, every
marine model correctly returns nothing, and until P4 the honest-but-useless answer was
"sea state data was unavailable, treat this as provisional". That is not what a person
standing in Hyderabad needs to hear. They need to hear *Hyderabad is 280 km from the coast,
the nearest harbour is Kakinada* — and then be given one click to go there.

The list is deliberately short and hand-checked rather than scraped: fourteen real
harbours, coordinates verified against the port entrance rather than the city centre, so a
marine forecast actually exists at each one. A longer auto-generated list with a few
inland centroids in it would break the exact feature this file exists to support.
"""

from __future__ import annotations

from dataclasses import dataclass

from app.agents.geospatial import compass_word, distance_and_bearing
from app.schemas.response import Location


@dataclass(frozen=True)
class Harbour:
    name: str
    lat: float
    lon: float
    state: str
    coast: str  # "east" (Bay of Bengal) | "west" (Arabian Sea)

    def as_location(self) -> Location:
        return Location(lat=self.lat, lon=self.lon, name=self.name, source="harbour")

    def as_dict(self) -> dict:
        return {
            "name": self.name,
            "lat": self.lat,
            "lon": self.lon,
            "state": self.state,
            "coast": self.coast,
        }


HARBOURS: list[Harbour] = [
    Harbour("Kakinada", 16.99, 82.24, "Andhra Pradesh", "east"),
    Harbour("Visakhapatnam", 17.69, 83.30, "Andhra Pradesh", "east"),
    Harbour("Chennai", 13.08, 80.29, "Tamil Nadu", "east"),
    Harbour("Nagapattinam", 10.77, 79.85, "Tamil Nadu", "east"),
    Harbour("Rameswaram", 9.29, 79.31, "Tamil Nadu", "east"),
    Harbour("Paradip", 20.26, 86.67, "Odisha", "east"),
    Harbour("Digha", 21.62, 87.53, "West Bengal", "east"),
    Harbour("Port Blair", 11.62, 92.73, "Andaman & Nicobar", "east"),
    Harbour("Kochi", 9.95, 76.24, "Kerala", "west"),
    Harbour("Kozhikode", 11.25, 75.75, "Kerala", "west"),
    Harbour("Mangaluru", 12.86, 74.83, "Karnataka", "west"),
    Harbour("Ratnagiri", 16.99, 73.30, "Maharashtra", "west"),
    Harbour("Mumbai", 18.94, 72.83, "Maharashtra", "west"),
    Harbour("Veraval", 20.90, 70.36, "Gujarat", "west"),
]


def nearest(location: Location) -> tuple[Harbour, float, float]:
    """The closest harbour, with geodesic distance in km and bearing in degrees.

    Geodesic via ``geospatial.distance_and_bearing``, not euclidean on lat/lon — at Indian
    latitudes a degree of longitude is ~15% shorter than a degree of latitude, and the
    euclidean answer picks the wrong harbour often enough to matter.
    """
    best: tuple[Harbour, float, float] | None = None

    for harbour in HARBOURS:
        distance_km, bearing = distance_and_bearing(location, harbour.as_location())
        if best is None or distance_km < best[1]:
            best = (harbour, distance_km, bearing)

    assert best is not None  # HARBOURS is never empty
    return best


def describe_nearest(location: Location) -> str:
    """One sentence naming the nearest harbour, in the words a person would use.

    English only, like every other message built in the services layer;
    ``services.explainability`` translates it if the answer is going out in another
    language.
    """
    harbour, distance_km, bearing = nearest(location)
    return (
        f"The nearest coast is at {harbour.name} in {harbour.state}, about "
        f"{distance_km:.0f} km {compass_word(bearing)}."
    )


def as_payload() -> list[dict]:
    """The list, for ``GET /api/harbours``."""
    return [harbour.as_dict() for harbour in HARBOURS]
