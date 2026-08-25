import { randomUUID } from "node:crypto";

export class AppError extends Error {
  readonly statusCode: number;
  readonly isOperational: boolean;
  readonly requestId: string;

  constructor(message: string, statusCode: number, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.requestId = randomUUID().slice(0, 8);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 404);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Access denied") {
    super(message, 403);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Authentication required") {
    super(message, 401);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409);
  }
}

export class RateLimitError extends AppError {
  constructor(message = "Too many requests") {
    super(message, 429);
  }
}

export class PayloadTooLargeError extends AppError {
  constructor(message = "Payload too large") {
    super(message, 413);
  }
}

export class UnsupportedMediaError extends AppError {
  constructor(message: string) {
    super(message, 415);
  }
}
