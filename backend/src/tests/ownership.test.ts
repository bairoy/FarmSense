import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import "dotenv/config";

/**
 * Tenant isolation, end to end, against a real database.
 *
 * The other 90 tests in this directory cover pure functions - ETo, water
 * balance, land units - and none of them can fail because of a policy. This
 * one exists because RLS is the kind of thing that is either correct or
 * catastrophic, with no useful middle ground, and reading the migration is not
 * evidence that it was applied.
 *
 * Every case runs through the service layer rather than raw queries, because
 * the service layer is what a request actually reaches. The exception is the
 * last test, which deliberately goes underneath it.
 *
 * Requires a database with the migrations applied. Run it against a local
 * stack (`npx supabase start`), not production - it creates and deletes users.
 */

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_PUBLISHABLE_OR_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * A local Supabase stack, as opposed to a hosted project.
 *
 * `supabase start` binds to 127.0.0.1:54321; a hosted project is
 * `https://<ref>.supabase.co`.
 */
const isLocal = Boolean(
  url && /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|$|\/)/.test(url)
);

/**
 * Refuses to run against a hosted project unless explicitly told to.
 *
 * The first run of this file did exactly that: `.env` points at the real
 * project, `npm test` read it, and the suite created two auth users in
 * production before cleaning them up. Cleanup worked, and it still should
 * never have been possible - a test that seeds and deletes users is one typo
 * in a `t.after` away from deleting the wrong ones.
 *
 * Skipped rather than failed when unconfigured, so `npm test` stays green on a
 * clean checkout. The reason is always stated: a silently skipped security
 * test reads as a pass, which is worse than no test at all.
 */
const skip = !(url && anonKey && serviceKey)
  ? "Supabase credentials are not set; export SUPABASE_URL, " +
    "SUPABASE_PUBLISHABLE_OR_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY to run " +
    "the ownership tests."
  : !isLocal && process.env.ALLOW_REMOTE_OWNERSHIP_TESTS !== "1"
    ? `SUPABASE_URL points at a hosted project (${url}). These tests create ` +
      "and delete auth users. Run `npx supabase start` and point at the local " +
      "stack, or set ALLOW_REMOTE_OWNERSHIP_TESTS=1 if you are certain."
    : false;

/** Asserts that `work` rejects, and returns nothing useful if it does not. */
const denied = async (label: string, work: () => Promise<unknown>) => {
  await assert.rejects(work, `${label}: expected the other user to be denied`);
};

test("tenant isolation", { skip, concurrency: false }, async (t) => {
  // Imported dynamically: config/env.ts throws at module load when the
  // Supabase variables are absent, which would take down the whole test run
  // rather than skipping this file.
  const { userClient, supabaseAdmin, supabaseAnon } = await import(
    "../config/supabase.ts"
  );

  const fieldService = await import("../modules/fields/field.service.ts");
  const cropService = await import("../modules/crops/crop.service.ts");
  const irrigationService = await import("../modules/irrigation/irrigation.service.ts");
  const fertilizerService = await import("../modules/fertilizer/fertilizer.service.ts");
  const cropStateService = await import("../modules/crop-state/cropState.service.ts");

  type Actor = { id: string; db: import("../config/supabase.ts").Db };

  const created: string[] = [];

  const makeActor = async (label: string): Promise<Actor> => {
    const email = `rls-${label}-${randomUUID()}@farmsense.test`;
    const password = randomUUID();

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    assert.equal(error, null, `could not create test user ${label}`);
    const authUser = data.user!;
    created.push(authUser.id);

    const { error: profileError } = await supabaseAdmin
      .from("users")
      .insert({ id: authUser.id, name: `RLS ${label}`, email });
    assert.equal(profileError, null, `could not create profile for ${label}`);

    // Signing in on a throwaway client: the shared ones carry module-level
    // session state, and two actors signing in through the same client would
    // leave the second holding the first's session.
    const { createClient } = await import("@supabase/supabase-js");
    const signInClient = createClient(url!, anonKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: session, error: signInError } =
      await signInClient.auth.signInWithPassword({ email, password });
    assert.equal(signInError, null, `could not sign in as ${label}`);

    return { id: authUser.id, db: userClient(session.session!.access_token) };
  };

  const alice = await makeActor("alice");
  const bob = await makeActor("bob");

  t.after(async () => {
    // Cascades through users -> fields -> crop_instances -> everything else.
    for (const id of created) {
      await supabaseAdmin.auth.admin.deleteUser(id);
    }
  });

  // ---- Alice builds a full crop ------------------------------------------

  const field = await fieldService.createField(alice.db, alice.id, {
    location_name: "Alice plot",
    latitude: 26.76,
    longitude: 83.37,
    soil_type: "clay loam",
    area_sqm: 6772.63,
  });

  const crop: any = await cropService.createCropInstance(alice.db, alice.id, {
    field_id: field.id,
    crop_type: "rice",
    sowing_date: "2026-06-15",
  });

  const irrigation: any = await irrigationService.createIrrigation(
    alice.db,
    alice.id,
    { crop_instance_id: crop.id, amount: 40 }
  );

  const fertilizer: any = await fertilizerService.createFertilizer(
    alice.db,
    alice.id,
    { crop_instance_id: crop.id, fertilizer_type: "urea", quantity: 12 }
  );

  const state: any = await cropStateService.createCropState(alice.db, alice.id, {
    crop_instance_id: crop.id,
    phase: "vegetative",
    health_score: 82,
  });

  // ---- The control: none of this is testing that everything is broken -----

  await t.test("the owner can read her own data", async () => {
    const fields = await fieldService.getAllFields(alice.db, alice.id);
    assert.equal(fields.length, 1);
    assert.equal(fields[0].id, field.id);

    const fetched: any = await cropService.getCropById(alice.db, alice.id, crop.id);
    assert.equal(fetched.id, crop.id);

    const rows = await irrigationService.getIrrigationByCrop(
      alice.db,
      alice.id,
      crop.id
    );
    assert.equal(rows!.length, 1);
  });

  // ---- Reads -------------------------------------------------------------

  await t.test("another user cannot read fields", async () => {
    const fields = await fieldService.getAllFields(bob.db, bob.id);
    assert.deepEqual(fields, [], "Bob's field list must not contain Alice's");

    await denied("getFieldById", () =>
      fieldService.getFieldById(bob.db, bob.id, field.id)
    );
  });

  await t.test("another user cannot read crops", async () => {
    await denied("getCropById", () =>
      cropService.getCropById(bob.db, bob.id, crop.id)
    );
    await denied("getCropsByField", () =>
      cropService.getCropsByField(bob.db, bob.id, field.id)
    );
  });

  await t.test("another user cannot read actions or states", async () => {
    await denied("getIrrigationByCrop", () =>
      irrigationService.getIrrigationByCrop(bob.db, bob.id, crop.id)
    );
    await denied("getFertilizerByCrop", () =>
      fertilizerService.getFertilizerByCrop(bob.db, bob.id, crop.id)
    );
    await denied("getCropStates", () =>
      cropStateService.getCropStates(bob.db, bob.id, crop.id)
    );
  });

  // ---- Writes ------------------------------------------------------------

  await t.test("another user cannot write into someone else's field", async () => {
    await denied("createCropInstance", () =>
      cropService.createCropInstance(bob.db, bob.id, {
        field_id: field.id,
        crop_type: "wheat",
        sowing_date: "2026-11-01",
      })
    );
    await denied("createIrrigation", () =>
      irrigationService.createIrrigation(bob.db, bob.id, {
        crop_instance_id: crop.id,
        amount: 99,
      })
    );
    await denied("createFertilizer", () =>
      fertilizerService.createFertilizer(bob.db, bob.id, {
        crop_instance_id: crop.id,
        fertilizer_type: "DAP",
        quantity: 99,
      })
    );
    await denied("createCropState", () =>
      cropStateService.createCropState(bob.db, bob.id, {
        crop_instance_id: crop.id,
        phase: "flowering",
      })
    );
  });

  await t.test("another user cannot update or delete", async () => {
    await denied("updateField", () =>
      fieldService.updateField(bob.db, bob.id, field.id, {
        location_name: "Bob took this",
      })
    );
    await denied("deleteIrrigation", () =>
      irrigationService.deleteIrrigation(bob.db, bob.id, irrigation.id)
    );
    await denied("deleteFertilizer", () =>
      fertilizerService.deleteFertilizer(bob.db, bob.id, fertilizer.id)
    );
    await denied("deleteCropState", () =>
      cropStateService.deleteCropState(bob.db, bob.id, state.id)
    );

    // deleteField is the one that does NOT throw: a DELETE matching zero rows
    // is a successful DELETE, so the service returns { success: true } and the
    // caller is told a deletion happened. Nothing was destroyed, which is what
    // matters here - but the response is a lie, and worth fixing when the
    // central error handler lands.
    await cropService.deleteCrop(bob.db, bob.id, crop.id).catch(() => {});
    await fieldService.deleteField(bob.db, bob.id, field.id);

    const survivors = await fieldService.getAllFields(alice.db, alice.id);
    assert.equal(survivors.length, 1, "Alice's field must survive Bob's delete");

    const stillThere: any = await cropService.getCropById(
      alice.db,
      alice.id,
      crop.id
    );
    assert.equal(stillThere.id, crop.id, "Alice's crop must survive");
  });

  // ---- The regression guard ----------------------------------------------

  await t.test(
    "a client with no user session reads nothing at all",
    async () => {
      // This is the single assertion that would have caught the original
      // finding. Before this phase, eleven modules queried through exactly
      // this client - anon key, no JWT - and it could read every row in the
      // database. If this test starts returning rows, tenant isolation is
      // gone regardless of what the service layer says.
      for (const table of [
        "users",
        "fields",
        "crop_instances",
        "crop_states",
        "irrigation_actions",
        "fertilizer_actions",
        "crop_images",
      ] as const) {
        const { data, error } = await supabaseAnon.from(table).select("*");
        assert.equal(error, null, `${table}: unexpected error`);
        assert.deepEqual(
          data,
          [],
          `${table} is readable without a user session`
        );
      }
    }
  );
});
