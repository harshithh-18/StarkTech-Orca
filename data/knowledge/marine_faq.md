# Marine FAQ

Background for questions off the golden path. Explains **concepts and methods** — never
current conditions. Every number the user sees comes from an adapter as `evidence[]` with
a source and a timestamp; nothing here is a measurement.

---

## What is a Potential Fishing Zone (PFZ)?

An area where fish are likely to aggregate, inferred from satellite ocean data rather than
observed directly. INCOIS issues PFZ advisories for the Indian coast, usually daily and
weather permitting.

The method looks for two things occurring together: **high chlorophyll-a**, which
indicates phytoplankton at the base of the food chain, and a **sea-surface-temperature
front**, where warm and cool water masses meet. Fronts concentrate nutrients and prey, so
the overlap of the two is a good predictor of where fish gather.

A PFZ is a probability, not a guarantee. It says where conditions favour fish, not that
fish are present.

## How does ORCA find fishing zones?

By computing them from Copernicus Marine satellite data — chlorophyll-a concentration
intersected with the sea-surface-temperature gradient — which is the same physical method
INCOIS uses. Each zone carries the chlorophyll value and front strength that qualified it,
so the reasoning is inspectable rather than asserted.

ORCA also checks the INCOIS advisory page and will corroborate against it when a
machine-readable advisory is available.

## What is chlorophyll-a and why does it matter?

The green pigment in phytoplankton, measured in milligrams per cubic metre (mg/m³).
Satellites detect it by ocean colour. Higher chlorophyll means more phytoplankton, which
feeds zooplankton, which feeds fish. It is the standard proxy for ocean productivity.

Indian coastal waters are seasonally very productive: the southwest monsoon drives
upwelling and river discharge, and chlorophyll rises sharply through it.

## What is a thermal front?

A boundary where sea-surface temperature changes sharply over a short distance, measured
as a gradient in °C per kilometre. Fronts mark where different water masses meet, and they
concentrate nutrients and prey. They are a standard indicator in fisheries oceanography.

## What is CAPE and why does ORCA use it for lightning?

Convective Available Potential Energy, in joules per kilogram — the standard measure of
how unstable the atmosphere is, and therefore how capable of producing thunderstorms.
Above roughly 1000 J/kg the atmosphere is storm-capable; above 2500 J/kg it is strongly
unstable.

**CAPE is a modelled proxy, not an observation.** It describes an atmosphere that could
produce storms. It is not a lightning strike detection, and ORCA labels it as a proxy
wherever it appears.

## What is significant wave height?

The average height of the highest third of waves, which is roughly what an experienced
observer reports by eye. Individual waves can be substantially higher than the significant
wave height — occasional waves reach nearly twice it.

## Why does ORCA sample offshore rather than at the harbour?

Because wave height at the harbour wall is not the wave height where the boat will be
fishing. Measured at Kakinada, the harbour cell reported roughly a third of the wave
height found 25 km offshore in the same fishing ground — with a small-craft threshold
sitting between the two readings. ORCA samples a ring of points offshore and reports the
worst, then shows which point the reading came from.

## What is a small-craft advisory?

A warning that conditions are dangerous for small vessels — typically driven by wind
speed, gusts and wave height. Thresholds vary by vessel: a mechanised trawler and a
catamaran do not share a safe limit. ORCA's current thresholds assume a small mechanised
boat.

## What is a marine heat wave?

A prolonged period of unusually warm sea-surface temperature for the location and season.
Marine heat waves can suppress the vertical mixing that carries nutrients to the surface,
reducing plankton and therefore fish. They also stress coral and can shift species ranges.

## Why does ORCA sometimes say it does not know?

Because a partial, honest answer is more useful than a confident wrong one. When a data
source is unavailable, ORCA reports which agent could not run and why, rather than
answering with less and not saying so. Every skipped step is visible in the reasoning
trace.

## Can ORCA decide whether it is safe to sail?

The verdict comes from a deterministic rule engine comparing forecast values against
published thresholds — not from a language model. A model is used only to phrase the
result in the user's language, and it is never permitted to change, soften or re-decide a
verdict. ORCA is an advisory tool; the decision to sail remains the skipper's.
