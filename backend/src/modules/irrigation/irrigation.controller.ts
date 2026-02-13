import type {Request,Response} from "express";
import * as irrigationService from "./irrigation.service.ts";

import { createIrrigationSchema } from "./irrigation.validation.ts";

export const createIrrigationHandler = async(req:Request,res:Response)=>{
  try{
    const body = createIrrigationSchema.parse(req.body);
    const irrigation = await irrigationService.createIrrigation(req.user!.id,body);
    res.status(201).json(irrigation);
  }
  catch(err:any){
    res.status(400).json({error:err.message});
  };
}

export const getIrrigationHandler = async(req:Request,res:Response)=>{
  try{
    const {cropId} = req.params;
    const data = await irrigationService.getIrrigationByCrop(req.user!.id,cropId);

    res.json(data);
  }
  catch(err:any){
    res.status(400).json({error:err.message});
  }
}
export const deleteIrrigationHandler = async(req:Request,res:Response)=>{
  try{
    const {irrigationId} = req.params;
    await irrigationService.deleteIrrigation(req.user!.id,irrigationId);
    res.json({success:true});
  }
  catch(err:any){
    res.status(400).json({error:err.message});
  }
};
