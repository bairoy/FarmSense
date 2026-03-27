// import { success } from "zod";
// import { supabase } from "../../config/supabase.ts";
// import {differenceInDays} from "date-fns";
// import { getHistoricalWeather } from "../../utils/weather.service";

// export const createCropState = async(
//   userId:string,
//   payload:{
//     crop_instance_id:string;
//     current_phase:string;
//     stress_score?:number;
//   }
// )=>{
//   const {data:crop,error:cropError} = await supabase.from("crop_instances")
//   .select(`id,sowing_date,fields!inner(user_id)`)
//   .eq("id",payload.crop_instance_id)
//   .eq("fields.user_id",userId)
//   .maybeSingle();

//   if(cropError || !crop){
//     throw new Error("Crop not found or unauthorized");
//   }
//   const today = new Date();
//   const sowing_date = new Date(crop.sowing_date);
//   const dayNumber = differenceInDays(today,sowing_date)+1;
  
//   const {data,error} = await supabase
//   .from("crop_states")
//   .insert({
//     crop_instance_id:payload.crop_instance_id,
//     day_number:dayNumber,
//     current_phase:payload.current_phase,
//     stress_score:payload.stress_score,
//     recorded_date:today
//   })
//   .select()
//   .single();

//   if(error) throw error;
//   return data;
// }

// export const getCropStates = async(
//   userId:string,
//   cropId:string,
// )=>{
//   const {data:crop} = await supabase
//   .from("crop_instances")
//   .select(`id,fields!inner(user_id)`)
//   .eq("id",cropId)
//   .eq("fields.user_id",userId)
//   .maybeSingle();

//   if(!crop) throw new Error("Crop not found");
//   const {data,error} = await supabase
//   .from("crop_states")
//   .select("*")
//   .eq("crop_instance_id",cropId)
//   .order("recorded_date",{ascending:false});

//   if(error) throw error;

//   return data;
// };

// export const deleteCropState = async(
//   userId:string,
//   stateId:string
// )=>{
//   const{data:state,error} = await supabase
//   .from("crop_states")
//   .select(`id,crop_instance_id,crop_instances!inner(fields!inner(user_id))`)
//   .eq("id",stateId)
//   .eq("crop_instances.fields.user_id",userId)
//   .maybeSingle();

//   if(error || !state){
//     throw new Error("Crop state not found");
//   }
//   const {error:deleteError} = await supabase
//   .from("crop_states")
//   .delete()
//   .eq("id",stateId);
//   if(deleteError) throw deleteError;
//   return {success:true};
// };

// // simple phase logic (we will improve later)
// function getPhase(cropType:string,das:number){
//   if(cropType === "rice"){
//     if(das <=15) return "establishment";
//     if(das <=45) return "vegetative";
//     if(das <=75) return "reproductive";
//     if(das <=95) return "grain_filling";
//     return "maturity";
//   }
//   if (cropType === "wheat"){
//     if(das <=15) return "establishment";
//     if (das<=80) return "vegetative";
//     if (das <=110) return "reproductive";
//     if (das <=150) return "grain_filling";
//     return "maturity";
//   }
//   return "unknown";
// }

// export const computeCropState = async(
//   userId: string,
//   cropId: string
// )=>{
//   // 1. get crop 
//   const {data:crop} = await supabase
//   .from("crop_instances")
//   .select(`id,crop_type,sowing_date,fields!inner(user_id,latitude,longitude)`)
//   .eq("id",cropId)
//   .eq("fields.user_id",userId)
//   .maybeSingle();

//   if(!crop) throw new Error("Crop not found");

//   //2. Compute DAS
//   const today = new Date();
//   const sowingDate = new Date(crop.sowing_date);
//   const dayNumber = differenceInDays(today,sowingDate) + 1;

//   //3. phase
//   const phase = getPhase(crop.crop_type, dayNumber);

//   // 4. Get irrigation history
//   const { data: irrigation } = await supabase
//     .from("irrigation_actions")
//     .select("action_date")
//     .eq("crop_instance_id", cropId)
//     .order("action_date", { ascending: false })
//     .limit(1);

//   let water_stress = false;
//   let stress_factors: string[] = [];

//   if (irrigation && irrigation.length > 0) {
//     const lastIrrigation = new Date(irrigation[0].action_date);
//     const daysSince = differenceInDays(today, lastIrrigation);

//     if (daysSince > 5) {
//       water_stress = true;
//       stress_factors.push("irrigation delayed");
//     }
//   } else {
//     water_stress = true;
//     stress_factors.push("no irrigation data");
//   }

//   // 5. Simple health score
//   let health_score = 100;

//   if (water_stress) health_score -= 30;

//   const status =
//     health_score > 80
//       ? "healthy"
//       : health_score > 60
//       ? "mild_stress"
//       : health_score > 40
//       ? "moderate_stress"
//       : "critical";

//   return {
//     crop_instance_id: cropId,
//     day_number: dayNumber,
//     phase,
//     health_score,
//     status,
//     water_stress,
//     nutrient_stress: false,
//     disease_risk: 0,
//     stress_factors,
//     confidence_score: 0.6
//   };
// }


import { supabase } from "../../config/supabase.ts";
import { differenceInDays } from "date-fns";
import { getHistoricalWeather } from "../../utils/weather.service.ts";
import { computeCropTimeline } from "./timeline.engine.ts";


// =========================
// CREATE STATE (UNCHANGED)
// =========================
export const createCropState = async (
  userId: string,
  payload: {
    crop_instance_id: string;
    current_phase: string;
    stress_score?: number;
  }
) => {
  const { data: crop, error: cropError } = await supabase
    .from("crop_instances")
    .select(`id,sowing_date,fields!inner(user_id)`)
    .eq("id", payload.crop_instance_id)
    .eq("fields.user_id", userId)
    .maybeSingle();

  if (cropError || !crop) {
    throw new Error("Crop not found or unauthorized");
  }

  const today = new Date();
  const sowing_date = new Date(crop.sowing_date);
  const dayNumber = differenceInDays(today, sowing_date) + 1;

  const { data, error } = await supabase
    .from("crop_states")
    .insert({
      crop_instance_id: payload.crop_instance_id,
      day_number: dayNumber,
      current_phase: payload.current_phase,
      stress_score: payload.stress_score,
      recorded_date: today
    })
    .select()
    .single();

  if (error) throw error;
  return data;
};

// =========================
// GET STATES (UNCHANGED)
// =========================
export const getCropStates = async (userId: string, cropId: string) => {
  const { data: crop } = await supabase
    .from("crop_instances")
    .select(`id,fields!inner(user_id)`)
    .eq("id", cropId)
    .eq("fields.user_id", userId)
    .maybeSingle();

  if (!crop) throw new Error("Crop not found");

  const { data, error } = await supabase
    .from("crop_states")
    .select("*")
    .eq("crop_instance_id", cropId)
    .order("recorded_date", { ascending: false });

  if (error) throw error;

  return data;
};

// =========================
// DELETE STATE (UNCHANGED)
// =========================
export const deleteCropState = async (userId: string, stateId: string) => {
  const { data: state, error } = await supabase
    .from("crop_states")
    .select(
      `id,crop_instance_id,crop_instances!inner(fields!inner(user_id))`
    )
    .eq("id", stateId)
    .eq("crop_instances.fields.user_id", userId)
    .maybeSingle();

  if (error || !state) {
    throw new Error("Crop state not found");
  }

  const { error: deleteError } = await supabase
    .from("crop_states")
    .delete()
    .eq("id", stateId);

  if (deleteError) throw deleteError;

  return { success: true };
};

// =========================
// PHASE LOGIC
// =========================
function getPhase(cropType: string, das: number) {
  if (cropType === "rice") {
    if (das <= 15) return "establishment";
    if (das <= 45) return "vegetative";
    if (das <= 75) return "reproductive";
    if (das <= 95) return "grain_filling";
    return "maturity";
  }

  if (cropType === "wheat") {
    if (das <= 15) return "establishment";
    if (das <= 80) return "vegetative";
    if (das <= 110) return "reproductive";
    if (das <= 150) return "grain_filling";
    return "maturity";
  }

  return "unknown";
}

// =========================
// MAIN INTELLIGENCE ENGINE
// =========================
export const computeCropState = async (
  userId: string,
  cropId: string
) => {
  // 1. Get crop + location
  const { data: crop } = await supabase
    .from("crop_instances")
    .select(
      `id,crop_type,sowing_date,fields!inner(user_id,latitude,longitude)`
    )
    .eq("id", cropId)
    .eq("fields.user_id", userId)
    .maybeSingle();

  if (!crop) throw new Error("Crop not found");

  // const today = new Date();
  // const sowingDate = new Date(crop.sowing_date);
  // const dayNumber = differenceInDays(today, sowingDate) + 1;

  // const phase = getPhase(crop.crop_type, dayNumber);

  // // =========================
  // // 2. FETCH WEATHER
  // // =========================
  // const startDate = sowingDate.toISOString().split("T")[0];
  // const endDate = today.toISOString().split("T")[0];

  // const weatherMap = await getHistoricalWeather(
  //   crop.fields.latitude,
  //   crop.fields.longitude,
  //   startDate,
  //   endDate
  // );

  // const todayStr = today.toISOString().split("T")[0];
  // const weather = weatherMap.get(todayStr);

  // const rainfall = weather?.rainfall || 0;
  // const tempMax = weather?.temp_max || 0;
  // const humidity = weather?.humidity || 0;

  // // =========================
  // // 3. IRRIGATION LOGIC
  // // =========================
  // const { data: irrigation } = await supabase
  //   .from("irrigation_actions")
  //   .select("action_date")
  //   .eq("crop_instance_id", cropId)
  //   .order("action_date", { ascending: false })
  //   .limit(1);

  // let water_stress = false;
  // let stress_factors: string[] = [];

  // let daysSinceIrrigation = 999;

  // if (irrigation && irrigation.length > 0) {
  //   const lastIrrigation = new Date(irrigation[0].action_date);
  //   daysSinceIrrigation = differenceInDays(today, lastIrrigation);
  // }

  // // 🌧️ Smart water logic (RAIN + IRRIGATION)
  // if (rainfall > 10) {
  //   // heavy rain → no stress
  //   water_stress = false;
  // } else if (daysSinceIrrigation > 5) {
  //   water_stress = true;
  //   stress_factors.push("water deficit");
  // }

  // // =========================
  // // 4. HEAT STRESS
  // // =========================
  // let heat_stress = false;

  // if (tempMax > 35) {
  //   heat_stress = true;
  //   stress_factors.push("high temperature");
  // }

  // // =========================
  // // 5. DISEASE RISK
  // // =========================
  // let disease_risk = 0;

  // if (humidity > 80 && tempMax > 25 && tempMax < 35) {
  //   disease_risk = 0.7;
  // } else if (humidity > 60) {
  //   disease_risk = 0.4;
  // } else {
  //   disease_risk = 0.1;
  // }

  // // =========================
  // // 6. HEALTH SCORE
  // // =========================
  // let health_score = 100;

  // if (water_stress) health_score -= 30;
  // if (heat_stress) health_score -= 20;
  // if (disease_risk > 0.6) health_score -= 15;

  // const status =
  //   health_score > 80
  //     ? "healthy"
  //     : health_score > 60
  //     ? "mild_stress"
  //     : health_score > 40
  //     ? "moderate_stress"
  //     : "critical";

  // // =========================
  // // FINAL OUTPUT
  // // =========================
  // return {
  //   crop_instance_id: cropId,
  //   day_number: dayNumber,
  //   phase,

  //   health_score,
  //   status,

  //   water_stress,
  //   heat_stress,
  //   nutrient_stress: false,

  //   disease_risk,

  //   weather: {
  //     rainfall,
  //     tempMax,
  //     humidity
  //   },

  //   stress_factors,

  //   confidence_score: 0.75
  // };
  const timeline = await computeCropTimeline(crop);

const todayState = timeline[timeline.length - 1];

return {
  ...todayState,
  crop_instance_id: cropId,
  confidence_score: 0.85
};
};