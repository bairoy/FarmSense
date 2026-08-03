# Frontend Engineering Steps

This document tracks significant changes, UX decisions, and engineering steps made on the frontend application (`farmsense-frontend`).

## Step 1: Regional Field Locks (Siraha)
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
