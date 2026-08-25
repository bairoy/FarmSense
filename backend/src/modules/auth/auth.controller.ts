import type { Request, Response } from "../../types/http.ts";
import * as authService from "./auth.service.ts";
import { signupSchema, loginSchema } from "./auth.validation.ts";
import { ValidationError } from "../../utils/errors.ts";

export const signupHandler = async (req: Request, res: Response) => {
  const body = signupSchema.parse(req.body);
  const user = await authService.signUp(body.name, body.email, body.password);
  res.status(201).json({
    message: "User created",
    user,
  });
};

export const loginHandler = async (req: Request, res: Response) => {
  const body = loginSchema.parse(req.body);
  const data = await authService.signIn(body.email, body.password);
  res.json(data);
};

export const refreshHandler = async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    throw new ValidationError("Refresh token required");
  }
  const data = await authService.refreshSession(refreshToken);
  res.json(data);
};
