import { supabaseAdmin } from "../../config/supabase.ts";
import { supabase } from "../../config/supabase.ts";

export const signUp = async (name:string,email: string, password: string) => {
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm:true,
  });
  if (error) throw error;
  const user = data.user;
  if(!user) throw new Error ("User creation failed");

  const {error:dbError} = await supabaseAdmin
  .from("users")
  .insert({
    id:user.id,
    name,
    email:user.email
  });
  if (dbError) throw dbError;
  return user;
};
export const signIn = async (email: string, password: string) => {
  const { data, error } = await supabaseAdmin.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return {
    user:data.user,
    accessToken:data.session?.access_token,
    refreshToken:data.session?.refresh_token
  };
};

export const refreshSession = async(refreshToken:string)=>{
  const{data,error} = await supabase.auth.refreshSession({
    refresh_token:refreshToken,
  });
  if(error || !data.session){
    throw new Error("Invalid refresh token");
  }

  return{
    accessToken: data.session.access_token,
    refreshToken:data.session.refresh_token,
  }
};
