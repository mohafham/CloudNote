import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../services/authTokens.js";

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const headerValue = req.header("authorization");

  if (!headerValue || !headerValue.startsWith("Bearer ")) {
    res.status(401).json({ message: "Missing or invalid authorization header." });
    return;
  }

  const token = headerValue.slice("Bearer ".length);

  try {
    const payload = verifyAccessToken(token);

    if (payload.type !== "access" || !payload.sub || !payload.email) {
      res.status(401).json({ message: "Invalid access token payload." });
      return;
    }

    req.user = {
      id: payload.sub,
      email: payload.email
    };

    next();
  } catch {
    res.status(401).json({ message: "Token verification failed." });
  }
}
