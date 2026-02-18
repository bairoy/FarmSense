import type { Request,Response } from "express";
import * as authService from "./auth.service.ts";
import { signupSchema,loginSchema } from "./auth.validation.ts";

export const signupHandler = async(req:Request,res:Response) =>{
  try{

    const body = signupSchema.parse(req.body);
    const user = await authService.signUp(
      body.name,
      body.email,
      body.password
    );
    res.status(201).json({
      message:"User created",
      user
    });
  }
  
  catch(err:any){
    res.status(400).json({error:err.message})
  }

}

export const loginHandler = async(req:Request,res:Response)=>{
  try{
   const body = loginSchema.parse(req.body);
   const data = await authService.signIn(
    body.email,
    body.password
   );
   res.json(data);
  }
  catch(err:any){
    res.status(400).json({error:err.message})
  }
}

export const refreshHandler = async(req:Request,res:Response)=>{
try{
  const {refreshToken} = req.body;

  if(!refreshToken){
    return res.status(400).json({error: "Refresh token required"});
  }
  const data = await authService.refreshSession(refreshToken);

  res.json(data);
}
catch(err:any){
  res.status(401).json({error: err.message});
}

};