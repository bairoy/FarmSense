import type {Request,Response} from "express";
import * as cropStateService from "./cropState.service.ts";
import { createCropStateSchema } from "./cropState.validation.ts";

export const createCropStateHandler = async(req:Request,res:Response)=>{
  try{
    const body = createCropStateSchema.parse(req.body);
    const state = await cropStateService.createCropState(req.user!.id,body);
    res.status(201).json(state);
  }
  catch(err:any){
    res.status(400).json({error:err.message});
  }
};
export const getCropStatesHandler = async(req:Request,res:Response)=>{
  try{
    const {cropId} = req.params;
    const states = await cropStateService.getCropStates(
      req.user!.id,
      cropId
    );
    res.json(states);

  }
  catch(err:any){
    res.status(400).json({error:err.message});
  }
}
export const deleteCropStateHandler = async(req:Request,res:Response)=>{
  try{
    const {stateId} = req.params;
    await cropStateService.deleteCropState(
      req.user!.id,
      stateId
    );
    res.json({success:true});
  }
  catch(err:any){
    res.status(400).json({error:err.message});
  }
}