"""Enumerations shared across the response contract.

Owner: C · Phase: P0 · Status: FROZEN after Day 3

Every value here is mirrored in ``frontend/src/types/orca.ts``. Adding one means editing
three files in the same PR — see docs/API_CONTRACT.md.
"""

from enum import Enum


class Intent(str, Enum):
    """What the user is actually asking for, per the golden path (report §6)."""

    PFZ_LOOKUP = "pfz_lookup"          # #1 "Where is the nearest fishing zone?"
    SAFETY_CHECK = "safety_check"      # #2 "Is it safe to sail tomorrow?"
    GEOFENCE_CHECK = "geofence_check"  # #3 "Am I near a restricted boundary?"
    DIAGNOSTIC = "diagnostic"          # #4 "Why has productivity declined?"
    ROUTE_PLANNING = "route_planning"  # #5 stretch
    GENERAL = "general"                # anything else — answered, but without specialists


class Verdict(str, Enum):
    """Safety verdict. Decided by ``services.risk_rules``, never by an LLM."""

    GO = "GO"
    CAUTION = "CAUTION"
    NO_GO = "NO_GO"
    NOT_APPLICABLE = "NOT_APPLICABLE"  # non-safety intents


class AlertType(str, Enum):
    """Drives the colour-coded alert banner."""

    CYCLONE = "CYCLONE"
    HIGH_WAVE = "HIGH_WAVE"
    HIGH_WIND = "HIGH_WIND"
    LIGHTNING = "LIGHTNING"                      # modelled proxy — see docs/DATA_SOURCES.md
    GEOFENCE_BREACH = "GEOFENCE_BREACH"          # already inside a restricted zone
    GEOFENCE_PROXIMITY = "GEOFENCE_PROXIMITY"    # approaching one
    MARINE_HEAT_WAVE = "MARINE_HEAT_WAVE"
    TSUNAMI = "TSUNAMI"


class MapLayer(str, Enum):
    """Layers the frontend should switch on for a given answer."""

    USER_PIN = "user_pin"
    PFZ_ZONES = "pfz_zones"
    EEZ_BOUNDARY = "eez_boundary"
    IMBL_LINE = "imbl_line"                      # International Maritime Boundary Line
    MPA_ZONES = "mpa_zones"                      # Marine Protected Areas
    WAVE_HEATMAP = "wave_heatmap"
    SST_HEATMAP = "sst_heatmap"
    CHLOROPHYLL_HEATMAP = "chlorophyll_heatmap"
    HAZARD_OVERLAY = "hazard_overlay"
    ROUTE_LINE = "route_line"


class Language(str, Enum):
    """ISO 639-1. Coastal languages first — ta/te/ml/bn are the demo targets."""

    TAMIL = "ta"
    TELUGU = "te"
    MALAYALAM = "ml"
    BENGALI = "bn"
    HINDI = "hi"
    KANNADA = "kn"
    MARATHI = "mr"
    GUJARATI = "gu"
    ODIA = "or"
    ENGLISH = "en"


class TraceStatus(str, Enum):
    """Renders as spinner / tick / cross / dash in the Reasoning Trace panel."""

    STARTED = "started"
    OK = "ok"
    FAILED = "failed"
    SKIPPED = "skipped"   # specialist couldn't run; the answer degrades but still ships


class ChartKind(str, Enum):
    LINE = "line"
    BAR = "bar"
    AREA = "area"
