import type {Request,Response} from "express";
import * as fertilizerService from "./fertilizer.service.ts";
import { createFertilizerSchema } from "./fertilizer.validation.ts";
import { create } from "zustand";

export const createFertilizerHandler = async(req:Request,res:Response)=>{
  try{
    const body = createFertilizerSchema.parse(req.body);
    const fertilizer = await fertilizerService.createFertilizer(req.user!.id,body);
    res.status(201).json(fertilizer);
  }
  catch(err:any){
    res.status(400).json({error:err.message});
  }
};

export const getFertilizerHandler = async(req:Request,res:Response)=>{
  try{
    const {cropId} = req.params;

    const data = await fertilizerService.getFertilizerByCrop(
      req.user!.id,
      cropId
    )
    res.json(data);

  }
  catch(err:any){
    res.status(400).json({error:err.message});
  }
}

export const deleteFertilizerHandler = async(req:Request,res:Response)=>{
  try{
    const {fertilizerId} = req.params;

    await fertilizerService.deleteFertilizer(
      req.user!.id,
      fertilizerId
    );
    res.json({success:true});
  }
  catch(err:any){
    res.status(400).json({error:err.message});
  }
}