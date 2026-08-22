"""Route Optimization Agent — STRETCH GOAL.

Owner: E · Phase: P3 (only if the golden path is solid) · Type: Tool (A* / graph search)

Golden query #5: least-risk sea path from A to B over the sea-state grid.

> **Do not start this before P3.** It is the most seductive feature in the backlog and the
> least load-bearing. Four flawless queries beat five shaky ones — see docs/ROADMAP.md
> "Scope discipline". If P2 slipped at all, this is the first thing to cut, and cutting it
> costs nothing: pointing at a clean stub and saying "architected, not built" reads far
> better to judges than a route that draws itself through an island.
"""

from __future__ import annotations

from app.schemas.response import Location


async def plan_route(
    origin: Location, destination: Location, departure_time: str | None = None
) -> dict:
    """Least-risk path over a wave-height cost grid.

    Approach: build a coarse grid over the bounding box, cost each cell by forecast wave
    height and wind at the estimated time of arrival, mark land cells impassable, then A*.

    TODO(P3, E): build the cost grid from adapters.open_meteo_marine
    TODO(P3, E): mask land — a route through a headland is an instant credibility loss.
                 Use a coastline polygon, not a coarse bbox.
    TODO(P3, E): mask restricted zones (IMBL, MPA) as impassable, not merely costly
    TODO(P3, E): A* with a geodesic-distance heuristic; return a GeoJSON LineString
    TODO(P3, E): cost by wave height AT ESTIMATED ARRIVAL TIME per cell, not at departure —
                 otherwise the route sails into weather that wasn't there when it started
    """
    raise NotImplementedError("TODO(P3, E) — stretch goal, do not start before P3")
