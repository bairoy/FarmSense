import type {Request,Response} from "express";
import * as cropService from "./crop.service.ts";
import {createCropSchema,
  updateCropSchema
} from "./crop.validation.ts";

export const createCropHandler = async(req:Request,res:Response) =>{
  try{
    const body = createCropSchema.parse(req.body);
    const crop = await cropService.createCropInstance(
      req.user!.id,
      body
    );
    res.status(201).json(crop);
  }
  catch(err:any){
    res.status(400).json({error:err.message});
  }
};
export const getCropsByFieldHandler = async(req:Request,res:Response)=>{
  try{
    const {fieldId} = req.params;
    const crops = await cropService.getCropsByField(
      req.user!.id,
      fieldId
    );
    res.json(crops);
  }catch(err:any){
  res.status(400).json({error:err.message})
  }
};

export const getCropHandler  = async(req:Request,res:Response)=>{
  try{
    const {cropId} = req.params;
    const crop = await cropService.getCropById(
      req.user!.id,
      cropId
    );
    res.json(crop);
  }
  catch(err:any){
    res.status(404).json({error:err.message});
  }
};
export const updateCropHandler = async(req:Request,res:Response)=>{
  try{
    const body = updateCropSchema.parse(req.body);
    const {cropId} = req.params;
    const crop = await cropService.updateCrop(
      req.user!.id,
      cropId,
      body
    );
    res.json(crop);
  }
  
  catch(err:any){
    res.status(400).json({error:err.message});
  }
};
export const deleteCropHandler = async(req:Request,res:Response)=>{
  try{
    const {cropId} = req.params;
    await cropService.deleteCrop(req.user!.id,cropId);
    res.json({success:true});
  }
  catch(err:any){
    res.status(400).json({error:err.message});
  }
};
