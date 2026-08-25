import test from "node:test";
import assert from "node:assert/strict";
import { createCropSchema, updateCropSchema } from "../modules/crops/crop.validation.ts";
import { loadActiveRegion } from "../modules/rules/rules.loader.ts";

/**
 * The engine resolves a crop with `region.crops[crop_type] ?? region.crops.rice`.
 * That fallback is silent: a crop stored as "Basmati rice" is modelled with the
 * rice Kc curve, produces a confident timeline, and never reports that it was
 * given a crop the region has no calibration for. The validation boundary is
 * the only place that can be caught loudly, so it is worth pinning down.
 */

const FIELD_ID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

const base = {
  field_id: FIELD_ID,
  sowing_date: "2026-06-20",
};

test("every crop the region calibrates is accepted", () => {
  for (const key of Object.keys(loadActiveRegion().crops)) {
    const result = createCropSchema.safeParse({ ...base, crop_type: key });
    assert.ok(result.success, `region crop "${key}" should be accepted`);
  }
});

test("a crop the region cannot model is rejected, not defaulted", () => {
  for (const crop_type of ["Basmati rice", "sugarcane", "Rice", "maize", ""]) {
    const result = createCropSchema.safeParse({ ...base, crop_type });
    assert.equal(result.success, false, `"${crop_type}" should be rejected`);
  }
});

test("the rejection message names the crops that would work", () => {
  const result = createCropSchema.safeParse({ ...base, crop_type: "sugarcane" });
  assert.equal(result.success, false);

  // Find the crop_type issue rather than trusting issue order.
  const issue = result.error!.issues.find((i) => i.path[0] === "crop_type");
  assert.ok(issue, "expected an issue on crop_type");
  const message = issue.message;
  // A farmer who picked the wrong thing needs to know what the right thing is.
  assert.match(message, /rice/);
  assert.match(message, /wheat/);
});

test("updates are held to the same crop list", () => {
  assert.equal(updateCropSchema.safeParse({ crop_type: "wheat" }).success, true);
  assert.equal(updateCropSchema.safeParse({ crop_type: "barley" }).success, false);
  // crop_type stays optional on update - omitting it is not a change to it.
  assert.equal(updateCropSchema.safeParse({ status: "harvested" }).success, true);
});
