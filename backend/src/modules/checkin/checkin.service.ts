import { differenceInDays } from "date-fns";
// Service-role client, deliberately. `farmer_checkins` has RLS enabled, and
// its policy is written against `auth.uid()` - which is null on the anon
// client, so every insert is denied. Ownership here is enforced in code by
// joining through `crop_instances -> fields.user_id`, exactly as every other
// module does. Keeping RLS on means a leaked anon key still cannot read a
// farmer's check-ins directly; it is defence in depth, not the primary check.
import { supabaseAdmin as supabase } from "../../config/supabase.ts";
import { loadRegionConfig } from "../rules/rules.loader.ts";
import { env } from "../../config/env.ts";

/**
 * The farmer as a sensor.
 *
 * We have no field hardware and no budget for any, but there is already a
 * human standing in the field every day. A single yes/no question answered
 * once a week is a real, in-situ observation - the same class of input as a
 * satellite pass, and considerably more current.
 *
 * Design constraints that shaped this:
 *   - One question at a time. A form is homework; a single tap is not.
 *   - Binary or three-way answers only. "Rate stress 1-10" produces noise.
 *   - Ask only what the model cannot already infer. Never ask about rainfall
 *     (we have that) - ask about standing water, which no free data source
 *     tells us reliably at plot scale.
 *   - Questions are targeted at the model's current blind spot, so an answer
 *     always changes something.
 */

export type CheckinQuestion = {
  key: string;
  question: string;
  question_ne: string;
  options: { value: string; label: string; label_ne: string }[];
  /** Which model assumption this answer tests. */
  corrects: string;
  priority: number;
};

/**
 * Picks the question worth asking right now.
 *
 * Ordered by how much the answer would move the estimate. Asking a wheat
 * farmer whether the field is flooded wastes the one question we get.
 */
export const selectQuestion = (
  cropType: string,
  phase: string,
  latestState: any
): CheckinQuestion => {
  const region = loadRegionConfig(env.defaultRegion);
  const isPaddy = region.crops[cropType]?.water_model === "paddy";

  const questions: CheckinQuestion[] = [];

  if (isPaddy) {
    // The single highest-value question for rice. The paddy model's whole
    // state is ponded depth, and percolation rate - our largest unknown -
    // is what determines how fast it drains.
    questions.push({
      key: "field_flooded",
      question: "Is there standing water in your field today?",
      question_ne: "आज तपाईंको खेतमा पानी जमेको छ?",
      options: [
        { value: "yes_deep", label: "Yes, ankle deep or more", label_ne: "छ, गोलिगाँठोसम्म वा बढी" },
        { value: "yes_shallow", label: "Yes, but very shallow", label_ne: "छ, तर धेरै कम" },
        { value: "no", label: "No, the field is drained", label_ne: "छैन, खेत सुकेको छ" },
      ],
      corrects: "paddy ponded depth and percolation rate",
      priority: 100,
    });
  } else {
    questions.push({
      key: "soil_dry",
      question: "Is the soil surface cracked or dusty?",
      question_ne: "माटोको सतह फुटेको वा धुलो छ?",
      options: [
        { value: "cracked", label: "Yes, visibly cracked", label_ne: "छ, स्पष्ट फुटेको" },
        { value: "dry", label: "Dry but not cracked", label_ne: "सुक्खा तर फुटेको छैन" },
        { value: "moist", label: "Still moist", label_ne: "अझै ओसिलो" },
      ],
      corrects: "root-zone depletion estimate",
      priority: 90,
    });
  }

  // Asked when the simulation is claiming health but has not been checked
  // against anything the farmer can see.
  questions.push({
    key: "crop_appearance",
    question: "Does the crop look stressed - yellowing, wilting, or stunted?",
    question_ne: "बालीमा तनाव देखिन्छ - पहेंलो, ओइलाएको, वा नबढेको?",
    options: [
      { value: "healthy", label: "Looks healthy", label_ne: "स्वस्थ देखिन्छ" },
      { value: "patchy", label: "Some patches look bad", label_ne: "केही ठाउँमा नराम्रो" },
      { value: "widespread", label: "Most of the field looks bad", label_ne: "अधिकांश खेत नराम्रो" },
    ],
    corrects: "overall health score against direct observation",
    priority: 80,
  });

  if (["flowering", "reproductive", "panicle_initiation"].includes(phase)) {
    questions.push({
      key: "flowering_confirm",
      question: "Has the crop started flowering (panicles emerging)?",
      question_ne: "बालीमा बाला निस्कन थालेको छ?",
      options: [
        { value: "yes", label: "Yes", label_ne: "छ" },
        { value: "not_yet", label: "Not yet", label_ne: "अझै छैन" },
      ],
      // GDD phase boundaries are calibrated averages. A direct confirmation
      // re-anchors the whole phenology model, which every later phase
      // boundary and Kc value depends on.
      corrects: "GDD phase boundary calibration",
      priority: 95,
    });
  }

  // If the model already thinks the crop is stressed, confirming that with
  // the farmer is worth more than any other question.
  if (latestState?.water_stress) {
    questions[0].priority = 110;
  }

  return questions.sort((a, b) => b.priority - a.priority)[0];
};

export const createCheckin = async (cropId: string, question: CheckinQuestion) => {
  const { data, error } = await supabase
    .from("farmer_checkins")
    .insert({
      crop_instance_id: cropId,
      question_key: question.key,
      question_text: question.question,
      asked_at: new Date().toISOString(),
    } as any)
    .select()
    .single();

  if (error) throw error;
  return { ...(data as any), question };
};

/**
 * Records an answer and states what the model should do with it.
 *
 * `correction` is stored alongside the raw answer rather than applied
 * immediately. The timeline engine recomputes from scratch on every request,
 * so the durable record of the observation is what matters - the same
 * philosophy as satellite_observations.
 */
export const recordAnswer = async (
  userId: string,
  checkinId: string,
  answer: string
) => {
  const { data: checkin, error } = await supabase
    .from("farmer_checkins")
    .select("*,crop_instances!inner(id,crop_type,fields!inner(user_id))")
    .eq("id", checkinId)
    .eq("crop_instances.fields.user_id", userId)
    .maybeSingle();

  if (error || !checkin) throw new Error("Check-in not found");

  const correction = interpretAnswer((checkin as any).question_key, answer);

  const { data, error: updateError } = await supabase
    .from("farmer_checkins")
    .update({
      answer,
      responded_at: new Date().toISOString(),
      model_correction: correction as any,
    } as any)
    .eq("id", checkinId)
    .select()
    .single();

  if (updateError) throw updateError;
  return { ...(data as any), correction };
};

/**
 * Translates a farmer's answer into a concrete model adjustment.
 *
 * Kept as a pure function so it is unit-testable and so the mapping from
 * "farmer said the field is dry" to "set ponded depth to 0" is auditable in
 * one place rather than scattered through the engine.
 */
export const interpretAnswer = (
  questionKey: string,
  answer: string
): Record<string, unknown> => {
  switch (questionKey) {
    case "field_flooded":
      if (answer === "yes_deep") {
        return { set_ponded_depth_mm: 50, confidence: 0.9, note: "Farmer confirms deep standing water." };
      }
      if (answer === "yes_shallow") {
        return { set_ponded_depth_mm: 15, confidence: 0.85, note: "Farmer reports shallow standing water." };
      }
      return {
        set_ponded_depth_mm: 0,
        confidence: 0.9,
        note: "Farmer reports the paddy is drained. If the model predicted standing water, the percolation rate is too low.",
        recalibrate: "percolation_mm_per_day",
      };

    case "soil_dry":
      if (answer === "cracked") {
        // Visible cracking in clay loam means depletion is at or past TAW.
        // This is a strong signal and overrides the simulated value.
        return { depletion_at_least_fraction_of_TAW: 0.9, confidence: 0.85, note: "Cracked soil indicates severe depletion." };
      }
      if (answer === "dry") {
        return { depletion_at_least_fraction_of_TAW: 0.6, confidence: 0.7, note: "Dry surface suggests depletion past RAW." };
      }
      return { depletion_at_most_fraction_of_TAW: 0.4, confidence: 0.7, note: "Moist soil indicates the model may be over-drying." };

    case "crop_appearance":
      if (answer === "widespread") {
        return { health_score_ceiling: 55, confidence: 0.85, note: "Farmer reports widespread visible stress." };
      }
      if (answer === "patchy") {
        return { health_score_ceiling: 75, confidence: 0.7, note: "Farmer reports patchy stress." };
      }
      return { health_score_floor: 70, confidence: 0.75, note: "Farmer reports the crop looks healthy." };

    case "flowering_confirm":
      return answer === "yes"
        ? { confirm_phase: "flowering", confidence: 0.95, note: "Flowering confirmed in the field; GDD phase boundary re-anchored." }
        : { phase_not_reached: "flowering", confidence: 0.9, note: "Flowering not yet reached; the GDD model is running ahead of the crop." };

    default:
      return { note: "No model correction is defined for this question." };
  }
};

export const getPendingCheckin = async (userId: string, cropId: string) => {
  const { data } = await supabase
    .from("farmer_checkins")
    .select("*,crop_instances!inner(fields!inner(user_id))")
    .eq("crop_instance_id", cropId)
    .eq("crop_instances.fields.user_id", userId)
    .is("responded_at", null)
    .order("asked_at", { ascending: false })
    .limit(1);

  return data?.[0] ?? null;
};

export const getCheckinHistory = async (userId: string, cropId: string) => {
  const { data, error } = await supabase
    .from("farmer_checkins")
    .select("*,crop_instances!inner(fields!inner(user_id))")
    .eq("crop_instance_id", cropId)
    .eq("crop_instances.fields.user_id", userId)
    .order("asked_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
};

/** Whether it is time to ask again. Weekly cadence: often enough to be useful,
 *  rare enough that farmers keep answering. */
export const isCheckinDue = async (cropId: string): Promise<boolean> => {
  const { data } = await supabase
    .from("farmer_checkins")
    .select("asked_at")
    .eq("crop_instance_id", cropId)
    .order("asked_at", { ascending: false })
    .limit(1);

  const last = data?.[0] as any;
  if (!last) return true;

  return differenceInDays(new Date(), new Date(last.asked_at)) >= 7;
};
