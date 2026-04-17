import { createHash } from "node:crypto";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { env } from "../config/env.js";

export interface TokenUser {
  id: string;
  email: string;
}

interface ParsedToken extends JwtPayload {
  sub: string;
  email: string;
  type: "access" | "refresh" | "realtime";
  noteId?: string;
  accessLevel?: "view" | "edit" | "owner";
}

export function signAccessToken(user: TokenUser): string {
  return jwt.sign(
    {
      email: user.email,
      type: "access"
    },
    env.JWT_ACCESS_SECRET,
    {
      subject: user.id,
      expiresIn: "15m"
    }
  );
}

export function signRefreshToken(user: TokenUser): string {
  return jwt.sign(
    {
      email: user.email,
      type: "refresh"
    },
    env.JWT_REFRESH_SECRET,
    {
      subject: user.id,
      expiresIn: "30d"
    }
  );
}

export function signRealtimeToken(args: {
  userId: string;
  email: string;
  noteId: string;
  accessLevel: "view" | "edit" | "owner";
}): string {
  return jwt.sign(
    {
      email: args.email,
      noteId: args.noteId,
      accessLevel: args.accessLevel,
      type: "realtime"
    },
    env.REALTIME_JWT_SECRET,
    {
      subject: args.userId,
      expiresIn: "2h"
    }
  );
}

export function verifyAccessToken(token: string): ParsedToken {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as ParsedToken;
}

export function verifyRefreshToken(token: string): ParsedToken {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as ParsedToken;
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
