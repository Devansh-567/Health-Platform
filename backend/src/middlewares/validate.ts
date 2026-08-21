import { NextFunction, Request, Response } from "express";
import { AnyZodObject } from "zod";

export const validate = (schema: AnyZodObject) => (req: Request, _res: Response, next: NextFunction) => {
  const result = schema.parse({ body: req.body, query: req.query, params: req.params });
  req.body = result.body ?? req.body;
  next();
};
