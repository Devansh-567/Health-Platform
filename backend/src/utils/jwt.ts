import jwt from "jsonwebtoken";
import { env } from "../config/env";

export interface AccessTokenPayload {
  sub: string; // userId
  roleCode: string;
  hospitalId: string | null;
  permissions: string[]; // effective permission codes, resolved at issue time
}

export const signAccessToken = (payload: AccessTokenPayload) =>
  // @types/jsonwebtoken v9's `expiresIn` wants its own branded `StringValue`
  // template-literal type (e.g. "15m"), not a plain `string` — env.JWT_ACCESS_TTL
  // is validated as a non-empty string by zod but isn't typed that precisely.
  // This asserts the shape our config already guarantees at runtime.
  jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: env.JWT_ACCESS_TTL as jwt.SignOptions["expiresIn"] });

export const verifyAccessToken = (token: string) =>
  jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload & { iat: number; exp: number };
