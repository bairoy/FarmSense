import { supabase } from "../../config/supabase.ts";
import { fi } from "zod/v4/locales";

export const createCropInstance = async(
  userId:string,
  payload:{
    field_id:string;
    crop_type:string;
    sowing_date:string;
    irrigation_method?:string;
    status?:string;
  }
)=>{
  const {data:field,error:fieldError} = await supabase
  .from("fields")
  .select("id")
  .eq("id",payload.field_id)
  .eq("user_id",userId)
  .maybeSingle();

  if (fieldError || !field){
    throw new Error("Field not found or unauthorized");
  }
  const {data,error} = await supabase
  .from("crop_instances")
  .insert(payload)
  .select()
  .single();
  
  if(error) throw error;
  return data;
}
export const getCropsByField = async(userId:string,fieldId:string)=>{
  const {data:field} = await supabase
  .from("fields")
  .select("id")
  .eq("id",fieldId)
  .eq("user_id",userId)
  .maybeSingle()

  if(!field) throw new Error ("field not found");

  const {data,error} = await supabase
  .from("crop_instances")
  .select("*")
  .eq("field_id",fieldId)
  .order("created_at",{ascending:false});
  if (error) throw error;
  return data;
};
export const getCropById = async(
  userId:string,
  cropId:string,
)=>{
  const {data,error} = await supabase
  .from("crop_instances")
  .select(`*,fields!inner(user_id)`)
  .eq("id",cropId)
  .eq("fields.user_id",userId)
  .maybeSingle();

  if (error) throw error;
  if (!data) {
  throw new Error("Crop not found");
 }
  return data;
}

export const updateCrop = async(
  userId:string,
  cropId:string,
  payload:any
)=>{
  const crop = await getCropById(userId,cropId);
  const {data,error} = await supabase
  .from("crop_instances")
  .update(payload)
  .eq("id",cropId)
  .select()
  .single();
  if (error) throw Error;
  return data;
};

export const deleteCrop = async(
  userId:string,
  cropId:string,
)=>{
  await getCropById(userId,cropId);
  const {error} = await supabase
  .from("crop_instances")
  .delete()
  .eq("id",cropId);

  if (error) throw error;
  return {success:true};
}
