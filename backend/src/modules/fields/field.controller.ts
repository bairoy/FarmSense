import type { Request, Response } from "../../types/http.ts";
import * as fieldService from "./field.service.ts";
import { createFieldSchema, updateFieldSchema } from "./field.validation.ts";

export const createFieldHandler = async (req: Request, res: Response) => {
  const body = createFieldSchema.parse(req.body);
  const field = await fieldService.createField(req.db!, req.user!.id, body);
  res.status(201).json(field);
};

export const getFieldsHandler = async (req: Request, res: Response) => {
  const fields = await fieldService.getAllFields(req.db!, req.user!.id);
  res.json(fields);
};

export const getFieldHandler = async (req: Request, res: Response) => {
  const { fieldId } = req.params;
  const field = await fieldService.getFieldById(req.db!, req.user!.id, fieldId);
  res.json(field);
};

export const udpateFieldHandler = async (req: Request, res: Response) => {
  const body = updateFieldSchema.parse(req.body);
  const { fieldId } = req.params;
  const field = await fieldService.updateField(req.db!, req.user!.id, fieldId, body);
  res.json(field);
};

export const deleteFieldHandler = async (req: Request, res: Response) => {
  const { fieldId } = req.params;
  await fieldService.deleteField(req.db!, req.user!.id, fieldId);
  res.json({ success: true });
};
