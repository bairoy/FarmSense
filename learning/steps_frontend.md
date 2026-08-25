# Frontend Engineering Steps

This document tracks significant changes, UX decisions, and engineering steps made on the frontend application (`farmsense-frontend`).

## Step 1: Regional Field Locks (Siraha)

> **Superseded by Step 3.** The region is now Gorakhpur, UP, and these values are
> served by the backend rather than hardcoded in the component. Kept for the
> reasoning, not as a description of current code.

**Context:** We designed the MVP of FarmSense specifically for the Siraha region in Nepal. This means our agronomic models (GDD, FAO-56 evapotranspiration) and soil configurations are heavily calibrated for this specific climate and soil type ("alluvial"). 

**Problem:** The `AddField` component previously allowed users to enter any arbitrary latitude, longitude, and soil type. If a user entered coordinates for a completely different climate, the backend engine would compute incorrect agronomic stresses, because the regional configuration (e.g., `siraha.json`) was hardcoded on the backend.

**Solution:**
We modified `src/features/fields/pages/AddField.tsx` to enforce these constraints at the UI level.

1. **Hardcoded State Init:**
   The form state is now initialized with the exact Siraha coordinates and soil type:
   ```tsx
   const [form, setForm] = useState<CreateFieldPayload>({
     location_name: "",
     latitude: 26.65,
     longitude: 86.20,
     soil_type: "alluvial",
     area: 0,
   });
   ```

2. **UX Affordances (Read-Only Fields):**
   Instead of hiding the fields entirely (which might confuse users who want to know where their farm is being simulated), we kept them visible but made them `readOnly`.
   We updated the labels to indicate the lock, for example: `Latitude (Locked to Siraha)`.
   We also applied CSS classes (`bg-gray-100 text-gray-500 cursor-not-allowed`) to visually indicate that these inputs cannot be edited.

**Impact:**
This ensures that the frontend strictly aligns with the backend's regional engine limits, preventing dirty data from causing inaccurate digital twin simulations.

## Step 2: Regional Crop & Irrigation Locks (Siraha)

> **Superseded by Step 3.** See the note on Step 1.

**Context:** Following the field constraints, the crop types and irrigation methods also needed to be constrained. Siraha predominantly relies on surface canal irrigation systems for rice cultivation, and our backend configuration (`siraha.json`) specifically models "Basmati rice".

**Problem:** The `CreateCrop` component allowed free-text entry for both the crop type and irrigation method. This could lead to users creating crops that the backend physics engine doesn't have GDD or crop coefficient (Kc) data for, resulting in empty or broken timelines.

**Solution:**
We updated `src/features/crops/pages/CreateCrop.tsx` to lock these values.

1. **State Initialization:**
   ```tsx
   const [form, setForm] = useState({
     field_id: fieldId!,
     crop_type: "Basmati rice",
     sowing_date: "",
     irrigation_method: "surface canal system",
     status: "active",
   });
   ```

2. **UX Affordances (Read-Only Fields):**
   Similar to Step 1, we made the `Crop Type` and `Irrigation` inputs `readOnly`, added "(Locked to Siraha)" to their labels, and applied grayed-out CSS styles to indicate they are non-editable. The `Sowing Date` remains fully editable since planting dates vary by farmer.

## Step 3: The region comes from the backend, not the component

**Context:** Steps 1 and 2 were right about the constraint and wrong about where
to put it. Hardcoding Siraha's coordinates, unit ladder and crop name into three
React components meant the frontend held its own private copy of the
calibration. Changing districts then meant hunting for every copy.

That bill came due when the project moved to **Gorakhpur, Uttar Pradesh**.

**Problems the old approach had:**

1. **A silent physics bug.** `crop_type` was hardcoded to the string
   `"Basmati rice"`, but the backend resolves crops with
   `region.crops[crop_type] ?? region.crops.rice`. That fallback is silent — the
   app produced a confident timeline built from a Kc curve for a crop the region
   had no entry for, and never said so.
2. **Duplicated unit constants.** The bigha/katha/dhur factors lived in
   `AreaInput.tsx` *and* in the backend, with a comment asking whoever changed
   one to remember the other. A UP pucca bigha is 2529 m²; the Nepal Terai bigha
   is 6772 m². A stale copy would show the farmer a live area preview 2.7× off
   the value actually being stored — and every fertilizer dose derives from it.
3. **Stale coordinates.** `AddField` still initialised to 26.65 / 86.20, which
   is in Nepal.

**Solution:**

1. **`GET /api/region`** — a new unauthenticated endpoint (it is static
   calibration data, and the signup screen needs it before a token exists)
   serving the active region's name, coordinates, unit ladder and crop list. It
   deliberately does *not* expose Kc curves, GDD boundaries or paddy geometry;
   those are engine internals with no UI use.
2. **`src/services/region.ts`** — one module-level cached promise plus a
   `useRegion()` hook. The region cannot change within a session, so it resolves
   once per page load rather than once per component mount.
3. **`AreaInput` renders the ladder it is given.** One input per level from
   `region.land_units.levels`, with loading and error states. Zero unit
   constants in the frontend.
4. **`CreateCrop` builds its `<select>` from `region.crops`.** The dropdown
   cannot offer a crop the engine has no calibration for.
5. **Validation made the fallback loud.** `crop.validation.ts` now rejects any
   crop type outside the region's list, with a message naming the ones that
   work, and `cropValidation.test.ts` pins that behaviour.

**Impact:**
The constraint from Steps 1-2 is still enforced — arguably better, since a
`<select>` can't be typed into — but it is now enforced from a single source of
truth. Moving districts is a new `regions/*.json` file and a `DEFAULT_REGION`
change, with no frontend edit at all.
