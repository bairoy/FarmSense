"""Agent tools.

Note on the repo's history: the improvement report assumed a LangGraph agent
already existed here and asked for four tools to be "added" to it. It did not
exist - `ai/` contained only a 19-line FastAPI app and the classifier. This
module is the tool layer built from scratch.

The design rule that matters:

    THE AGENT NEVER COMPUTES AN AGRONOMIC NUMBER.

Every tool here is a thin wrapper over a backend endpoint. Fertilizer
quantities come from a published ICAR / UP Dept of Agriculture rate table times a
measured field area.
Irrigation volumes come from the FAO-56 water balance. Treatments come from a
reviewed lookup keyed on a confidence-gated classification.

A language model asked "how much urea for my rice" will produce a fluent,
specific, confident number, and a farmer has no way to tell it apart from the
right one. The model's job is to explain and translate what the deterministic
layer computed - never to originate it.
"""

from __future__ import annotations

from typing import Any

import httpx

from config import BACKEND_URL


class BackendError(RuntimeError):
    pass


def _get(path: str, token: str) -> Any:
    """Calls the backend as the farmer.

    The user's own Supabase token is forwarded rather than using a service
    key. That means the backend's existing ownership checks apply unchanged,
    and the agent cannot read a crop its user does not own even if it is asked
    to - authorisation is not something the tool layer gets to decide.
    """
    try:
        response = httpx.get(
            f"{BACKEND_URL}{path}",
            headers={"Authorization": f"Bearer {token}"},
            timeout=45.0,
        )
    except httpx.RequestError as exc:
        raise BackendError(f"Could not reach the FarmSense backend: {exc}") from exc

    if response.status_code == 401:
        raise BackendError("Your session has expired. Please sign in again.")
    if response.status_code == 404:
        raise BackendError("That crop was not found, or it does not belong to you.")
    if response.status_code >= 400:
        raise BackendError(f"Backend returned {response.status_code}: {response.text[:200]}")

    return response.json()


def _confidence_preamble(confidence: dict) -> str:
    """Every tool output leads with this.

    Putting the caveat first, not last, is deliberate: a model summarising a
    long tool result will reliably carry the opening framing into its answer
    and will just as reliably drop a trailing disclaimer.
    """
    band = confidence.get("band", "unknown")
    stale = confidence.get("stale_days")

    staleness = (
        "never independently checked"
        if stale is None
        else f"last independently checked {stale} day(s) ago"
    )

    return (
        f"[CONFIDENCE: {band.upper()} ({confidence.get('score')}), {staleness}]\n"
        f"{confidence.get('caveat', '')}\n"
    )


def get_crop_state_summary(crop_id: str, token: str) -> str:
    """How is my crop?

    This is the canonical view. Every other tool derives from the same fused
    state, so their answers cannot contradict this one.
    """
    data = _get(f"/api/recommendations/{crop_id}/state", token)

    lines = [_confidence_preamble(data.get("confidence", {}))]
    lines.append(
        f"{data['crop_type'].title()} in {data['field']['name']}, "
        f"day {data['day_number']}, growth stage: {data['phase']} "
        f"({data['progress_pct']}% through the season)."
    )
    lines.append(f"Health score: {data['health_score']}/100 ({data['status']}).")

    water = data.get("water", {})
    if water.get("model") == "paddy":
        lines.append(
            f"Paddy water: {water.get('ponded_depth_mm', 0):.0f} mm standing water"
            + (f", dry for {water['dry_days']} day(s)" if water.get("dry_days") else "")
            + "."
        )
    else:
        lines.append(
            f"Soil water: {water.get('depletion_mm', 0):.0f} mm depleted, "
            f"stress begins at {water.get('RAW_mm', 0):.0f} mm."
        )

    if data.get("stress_factors"):
        lines.append("Current stresses: " + "; ".join(data["stress_factors"]))

    diagnosis = data.get("latest_diagnosis")
    if diagnosis:
        lines.append(
            f"Most recent photo diagnosis: {diagnosis['disease']} "
            f"({diagnosis['confidence'] * 100:.0f}% confidence, "
            f"{diagnosis['days_ago']} day(s) ago)."
        )

    correction = data.get("correction", {})
    if correction.get("note"):
        lines.append(f"Satellite check: {correction['note']}")

    for factor in data.get("confidence", {}).get("factors", []):
        lines.append(f"  - {factor}")

    return "\n".join(lines)


def get_irrigation_recommendation(crop_id: str, token: str) -> str:
    """Should I irrigate, and how much? Dosage and timing, fused."""
    data = _get(f"/api/recommendations/{crop_id}/irrigation", token)

    if data.get("blocked"):
        return data["blocked"]

    irrigation = data.get("irrigation")
    if not irrigation:
        return "No irrigation recommendation is available for this crop."

    lines = [_confidence_preamble(data.get("confidence", {}))]
    lines.append(f"Recommendation: {irrigation['action'].replace('_', ' ').upper()} "
                 f"(urgency: {irrigation['urgency']})")
    lines.append(irrigation["reason"])

    dosage = irrigation.get("dosage")
    if dosage and irrigation["action"] == "irrigate_now":
        lines.append(
            f"Amount: {dosage['depth_mm']} mm across the field "
            f"= {dosage['volume_m3']} cubic metres "
            f"({dosage['volume_litres']:,} litres)."
        )
        if dosage.get("pump_hours_estimate"):
            lines.append(
                f"Roughly {dosage['pump_hours_estimate']} hours on a typical "
                "10 litre/second pump."
            )

    forecast = irrigation.get("forecast", {})
    lines.append(
        f"Forecast: {forecast.get('expected_rain_mm_7d', 0)} mm of rain expected "
        "over the next 7 days."
    )
    if forecast.get("first_meaningful_rain"):
        rain = forecast["first_meaningful_rain"]
        lines.append(f"  First meaningful rain: {rain['mm']} mm on {rain['date']}.")

    for caveat in irrigation.get("caveats", []):
        lines.append(f"Note: {caveat}")

    return "\n".join(lines)


def get_fertilizer_recommendation(crop_id: str, token: str) -> str:
    """What fertilizer, how much, and when."""
    data = _get(f"/api/recommendations/{crop_id}/fertilizer", token)

    if data.get("blocked"):
        return data["blocked"]

    plan = data.get("fertilizer")
    if not plan:
        return "No fertilizer plan is available for this crop."

    lines = [_confidence_preamble(data.get("confidence", {}))]
    lines.append(
        f"Fertilizer plan for {plan['area']['area_label']} "
        f"({plan['area']['hectares']} ha) of {plan['crop']}."
    )
    lines.append(
        f"Season total: {plan['season_total_kg']['N']} kg N, "
        f"{plan['season_total_kg']['P2O5']} kg P2O5, "
        f"{plan['season_total_kg']['K2O']} kg K2O."
    )
    lines.append(f"Organic: {plan['organic_recommendation']}")

    # Zinc deficiency is endemic in the Gangetic alluvium and is the most common
    # micronutrient constraint on rice yield there. It comes from the same rate
    # file as everything else, so the agent may repeat it but never invent it.
    micronutrient = plan.get("micronutrient_recommendation")
    if micronutrient:
        lines.append(f"Micronutrients: {micronutrient}")

    current = plan.get("current_action")
    if current:
        lines.append(f"\nDUE NOW - {current['name']} ({current['due']}): {current['timing']}")
        for product in current["products"]:
            lines.append(f"  {product['label']}: {product['local_units']}")
        lines.append(f"  {current['note']}")
    else:
        lines.append("\nNo fertilizer application is due at this growth stage.")

    lines.append("\nFull season schedule:")
    for split in plan["splits"]:
        products = ", ".join(f"{p['label']} {p['kg']} kg" for p in split["products"]) or "none"
        lines.append(f"  [{split['due']}] {split['name']} - {split['timing']}: {products}")

    for adjustment in plan.get("adjustments", []):
        lines.append(f"\nAdjusted for {adjustment['applied']}: {adjustment['reason']}")

    for caveat in plan.get("caveats", []):
        lines.append(f"Note: {caveat}")

    return "\n".join(lines)


def analyze_crop_image(crop_id: str, image_bytes: bytes, filename: str, token: str) -> str:
    """Classify a leaf photo and return a confidence-gated treatment.

    Posting through the backend rather than calling the local model directly
    is what makes the result persist: the backend stores the image in R2,
    writes a crop_states row, and links the two. Calling the classifier
    in-process would produce an answer that vanishes when the chat ends.
    """
    try:
        response = httpx.post(
            f"{BACKEND_URL}/api/disease/crop/{crop_id}/analyse",
            headers={"Authorization": f"Bearer {token}"},
            files={"file": (filename, image_bytes, "image/jpeg")},
            timeout=90.0,
        )
    except httpx.RequestError as exc:
        raise BackendError(f"Could not reach the FarmSense backend: {exc}") from exc

    if response.status_code >= 400:
        raise BackendError(f"Image analysis failed: {response.text[:200]}")

    data = response.json()
    diagnosis = data["diagnosis"]

    lines = [
        (
            f"Diagnosis: {diagnosis['disease'].replace('_', ' ')} "
            f"({diagnosis['confidence'] * 100:.0f}% confidence)."
        )
    ]

    # The gate. When the classifier is unsure we say so and ask for a better
    # photo, instead of naming a chemical. A confidently wrong pesticide
    # recommendation costs a farmer money and does nothing for the crop -
    # and for hispa (an insect) a fungicide does literally nothing.
    if not data.get("actionable"):
        lines.append(f"\n{data.get('reason', '')}")
        guidance = data.get("guidance", {})
        lines.append(guidance.get("message", ""))
        for action in guidance.get("actions", []):
            lines.append(f"  - {action}")
        lines.append(
            "\nDo not suggest any specific chemical or dose for this result. "
            "The classification was not confident enough to act on."
        )
        return "\n".join(lines)

    treatment = data["treatment"]
    lines.append(f"Severity: {treatment['severity']}.")

    chemical = treatment.get("chemical_treatment")
    if chemical:
        lines.append(
            f"\nTreatment: {chemical['active_ingredient']} at "
            f"{chemical['dose_per_hectare']}."
        )
        lines.append(f"  Application: {chemical['application']}")
        lines.append(f"  Timing: {chemical['timing']}")
        lines.append(
            f"  Do not harvest within {chemical['preharvest_interval_days']} days of spraying."
        )
    elif diagnosis["disease"] != "healthy":
        # A disease with no chemical on record (classes added with the v2 model
        # have no reviewed treatment yet). Say so explicitly, or the model fills
        # the gap with a dose from its own memory.
        lines.append(
            "\nNo chemical treatment is on record for this disease. Do not suggest "
            "any chemical, dose or spray timing; refer the farmer to the local "
            "agriculture extension officer."
        )

    lines.append("\nField practice:")
    for practice in treatment.get("cultural_practice", []):
        lines.append(f"  - {practice}")

    if treatment.get("notes"):
        lines.append(f"\nNote: {treatment['notes']}")

    return "\n".join(lines)


# Tool schemas, in the shape a tool-calling model expects. Kept next to the
# implementations so a signature change cannot silently diverge from the
# description the model sees.
TOOL_SCHEMAS = [
    {
        "name": "get_crop_state_summary",
        "description": (
            "Get the current condition of a crop: growth stage, health score, water "
            "status, stresses, and the confidence in that estimate. Use this first "
            "for any general question about how a crop is doing. This is the single "
            "source of truth - all other tools agree with it."
        ),
        "input_schema": {
            "type": "object",
            "properties": {"crop_id": {"type": "string", "description": "The crop instance UUID"}},
            "required": ["crop_id"],
        },
    },
    {
        "name": "get_irrigation_recommendation",
        "description": (
            "Get whether to irrigate now or wait for rain, and exactly how much water "
            "to apply. Combines the FAO-56 water balance with the rainfall forecast. "
            "Use for any question about watering, irrigation timing, or pump running time. "
            "Never estimate water amounts yourself - always call this."
        ),
        "input_schema": {
            "type": "object",
            "properties": {"crop_id": {"type": "string", "description": "The crop instance UUID"}},
            "required": ["crop_id"],
        },
    },
    {
        "name": "get_fertilizer_recommendation",
        "description": (
            "Get the fertilizer plan: which products, how many kg, and when, computed "
            "from official ICAR / UP Dept of Agriculture rate tables and the field's measured "
            "area. Use for any "
            "question about urea, DAP, potash, NPK, or top-dressing. NEVER state a "
            "fertilizer quantity from your own knowledge - always call this tool."
        ),
        "input_schema": {
            "type": "object",
            "properties": {"crop_id": {"type": "string", "description": "The crop instance UUID"}},
            "required": ["crop_id"],
        },
    },
    {
        "name": "analyze_crop_image",
        "description": (
            "Classify a photo of a rice leaf for disease and return a treatment, but "
            "only if the classifier is confident enough. If it returns a low-confidence "
            "result, ask the farmer for a better photo - do not fill in a treatment "
            "from your own knowledge. The result is saved to the crop's health history."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "crop_id": {"type": "string", "description": "The crop instance UUID"},
                "filename": {"type": "string", "description": "Original filename"},
            },
            "required": ["crop_id", "filename"],
        },
    },
]
