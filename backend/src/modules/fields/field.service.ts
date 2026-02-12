import {supabase} from "../../config/supabase.ts";

export const createField = async(
  userId:string,
  payload:{
    location_name:string;
    latitude:number;
    longitude:number;
    soil_type:string;
    area?:number;
  }
)=>{
  const {data,error} = await supabase
  .from("fields")
  .insert({
    user_id:userId,
    ...payload
  })
  .select()
  .single();
  if(error) throw error;
  return data;
};

export const getAllFields = async(userId:string)=>{
  const {data,error} = await supabase
  .from("fields")
  .select("*")
  .eq("user_id",userId)
  
  if (error) throw error;
  return data;

};
export const updateField = async(
  userId:string,
  fieldId:string,
  payload:any
)=>{
  const {data,error} = await supabase
  .from("fields")
  .update(payload)
  .eq("id",fieldId)
  .eq("user_id",userId)
  .select()
  .single();
  if(error) throw error;
  return data;
}
export const deleteField = async(
  userId:string,
  fieldId:string
)=>{
  const {error} = await supabase
  .from("fields")
  .delete()
  .eq("id",fieldId)
  .eq("user_id",userId);
  if (error) throw error;
  return {success:true};
};


export const getFieldById = async (
  userId: string,
  fieldId: string
) => {
  const { data, error } = await supabase
    .from("fields")
    .select("*")
    .eq("id", fieldId)
    .eq("user_id", userId)
    .single();

  if (error) throw error;

  return data;
};