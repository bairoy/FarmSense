import {supabase} from "../../config/supabase.ts";

export const createIrrigation = async(
  userId:string,
  payload:{
    crop_instance_id:string;
    amount:number;
    action_date?:string;
  }
)=>{
  const {data:crop,error:cropError} = await supabase
  .from("crop_instances")
  .select(`id,fields!inner(user_id)`)
  .eq("id",payload.crop_instance_id)
  .eq("fields.user_id",userId)
  .maybeSingle();

  if(cropError || !crop){
    throw new Error("crop not found or unauthorized");
  }
  const action_date = payload.action_date
  ? new Date(payload.action_date)
  : new Date()

   
  const {data,error} = await supabase
  .from("irrigation_actions")
  .insert({
    crop_instance_id:payload.crop_instance_id,
    amount:payload.amount,
    action_date:action_date
  })
  .select()
  .single();
  if(error) throw error;

  return data;
};

export const getIrrigationByCrop = async(
  userId:string,
  cropId:string
)=>{
  const {data:crop} = await supabase
  .from("crop_instances")
  .select(`id,fields!inner(user_id)`)
  .eq("id",cropId)
  .eq("fields.user_id",userId)
  .maybeSingle();

  if(!crop) throw new Error("Crop not found");

  const {data,error} = await supabase
  .from("irrigation_actions")
  .select("*")
  .eq("crop_instance_id",cropId)
  .order("action_date",{ascending:false});

  if(error) throw error;

  return data;

}

export const deleteIrrigation = async(userId:string,irrigationId:string)=>{
  const {data:irrigation,error} = await supabase
  .from("irrigation_actions")
  .select(
    `id,crop_instance_id,crop_instances!inner(fields!inner(user_id))`
  )
  .eq("id",irrigationId)
  .eq("crop_instances.fields.user_id",userId)
  .maybeSingle();

  if(error || !irrigation){
    throw new Error("Irrigation entry not found");
  }
  const {error:deleteError} = await supabase
  .from("irrigation_actions")
  .delete()
  .eq("id",irrigationId);

  if(deleteError) throw deleteError;

  return {success:true};
};