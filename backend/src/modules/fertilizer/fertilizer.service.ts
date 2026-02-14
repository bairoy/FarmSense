import { success } from "zod";
import {supabase} from "../../config/supabase.ts";

export const createFertilizer = async(
  userId:string,
  payload:{
  crop_instance_id:string;
  fertilizer_type:string;
  quantity:number;
  action_date?:string;
})=>{
  const {data:crop,error:cropError} = await supabase
  .from("crop_instances")
  .select(`id,fields!inner(user_id)`)
  .eq("id",payload.crop_instance_id)
  .eq("fields.user_id",userId)
  .maybeSingle();

  if(cropError || !crop){
    throw new Error("Crop not found or unauthorized");
  }

  const actionDate = payload.action_date?new Date(payload.action_date):new Date();

  const {data,error} = await supabase
  .from("fertilizer_actions")
  .insert({
    crop_instance_id:payload.crop_instance_id,
    fertilizer_type:payload.fertilizer_type,
    quantity:payload.quantity,
    action_date:actionDate
  })
  .select()
  .single();

  if(error) throw error;

  return data;
}

export const getFertilizerByCrop = async(userId:string,cropId:string)=>{
  const {data:crop} = await supabase
  .from("crop_instances")
  .select(`id, fields!inner(user_id)`)
  .eq("id",cropId)
  .eq("fields.user_id",userId)
  .maybeSingle();

  if(!crop) throw new Error("crop not found");
  const {data,error} = await supabase
  .from("fertilizer_actions")
  .select("*")
  .eq("crop_instance_id",cropId)
  .order("action_date",{ascending:false});

  if(error) throw error;

  return data;
}

export const deleteFertilizer = async(
  userId:string,
  fertilizerId:string
)=>{
  const {data:fertilizer,error} = await supabase
  .from("fertilizer_actions")
  .select(`
    id,
    crop_instance_id,
    crop_instances!inner(fields!inner(user_id))`)
  .eq("id",fertilizerId)
  .eq("crop_instances.fields.user_id",userId)
  .maybeSingle();

  if(error || !fertilizer){
    throw new Error("Fertilizer entry not found");
  }

  const {error:deleteError} = await supabase
  .from("fertilizer_actions")
  .delete()
  .eq("id",fertilizerId);

  if(deleteError) throw deleteError;
  return {success:true};
}