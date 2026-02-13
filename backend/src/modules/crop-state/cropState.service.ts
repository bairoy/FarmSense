import { success } from "zod";
import { supabase } from "../../config/supabase.ts";
import {differenceInDays} from "date-fns";

export const createCropState = async(
  userId:string,
  payload:{
    crop_instance_id:string;
    current_phase:string;
    stress_score?:number;
  }
)=>{
  const {data:crop,error:cropError} = await supabase.from("crop_instances")
  .select(`id,sowing_date,fields!inner(user_id)`)
  .eq("id",payload.crop_instance_id)
  .eq("fields.user_id",userId)
  .maybeSingle();

  if(cropError || !crop){
    throw new Error("Crop not found or unauthorized");
  }
  const today = new Date();
  const sowing_date = new Date(crop.sowing_date);
  const dayNumber = differenceInDays(today,sowing_date)+1;
  
  const {data,error} = await supabase
  .from("crop_states")
  .insert({
    crop_instance_id:payload.crop_instance_id,
    day_number:dayNumber,
    current_phase:payload.current_phase,
    stress_score:payload.stress_score,
    recorded_date:today
  })
  .select()
  .single();

  if(error) throw error;
  return data;
}

export const getCropStates = async(
  userId:string,
  cropId:string,
)=>{
  const {data:crop} = await supabase
  .from("crop_instances")
  .select(`id,fields!inner(user_id)`)
  .eq("id",cropId)
  .eq("fields.user_id",userId)
  .maybeSingle();

  if(!crop) throw new Error("Crop not found");
  const {data,error} = await supabase
  .from("crop_states")
  .select("*")
  .eq("crop_instance_id",cropId)
  .order("recorded_date",{ascending:false});

  if(error) throw error;

  return data;
};

export const deleteCropState = async(
  userId:string,
  stateId:string
)=>{
  const{data:state,error} = await supabase
  .from("crop_states")
  .select(`id,crop_instance_id,crop_instances!inner(fields!inner(user_id))`)
  .eq("id",stateId)
  .eq("crop_instances.fields.user_id",userId)
  .maybeSingle();

  if(error || !state){
    throw new Error("Crop state not found");
  }
  const {error:deleteError} = await supabase
  .from("crop_states")
  .delete()
  .eq("id",stateId);
  if(deleteError) throw deleteError;
  return {success:true};
};