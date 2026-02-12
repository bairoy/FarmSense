import type {Request,Response} from "express";
import * as fieldService from "./field.service.ts";
import {
  createFieldSchema,
  updateFieldSchema
} from "./field.validation.ts";

export const createFieldHandler = async(req:Request,res:Response)=>{
  try{
    const body = createFieldSchema.parse(req.body);
    const field = await fieldService.createField(
      req.user!.id,
      body
    );
    res.status(201).json(field);
  }
  catch(err:any){
    res.status(400).json({error:err.message});
  }
};
export const getFieldsHandler = async(req:Request,res:Response)=>{
  try{
    const fields = await fieldService.getAllFields(req.user!.id);
    res.json(fields);
  }
  catch(err:any){
    res.status(400).json({error:err.message});
  }
};
export const getFieldHandler = async(req:Request,res:Response)=>{
  try{
    const {fieldId} = req.params;
    const field = await fieldService.getFieldById(
      req.user!.id,
      fieldId
    );
    res.json(field);
  }
  catch(err:any){
    res.status(404).json({error:"Field not found"});
  }
};
export const udpateFieldHandler = async (req:Request,res:Response)=>{
  try{
    const body = updateFieldSchema.parse(req.body);
    const {fieldId} = req.params;

    const field = await fieldService.updateField(
      req.user!.id,
      fieldId,
      body
    );
    res.json(field);
  }
  catch(err:any){
    res.status(400).json({error:err.message});
  }
};
export const deleteFieldHandler = async(req:Request,res:Response)=>{
  try{
    const {fieldId} = req.params;
    await fieldService.deleteField(req.user!.id,fieldId);
    res.json({success:true});
  }
  catch(err:any){
    res.status(400).json({error:err.message});
  }
};
