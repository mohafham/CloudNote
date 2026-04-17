import bcrypt from "bcryptjs";
import { OAuth2Client } from "google-auth-library";
import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { env } from "../config/env.js";
import { pool } from "../db/pool.js";
import {
  hashToken,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken
} from "../services/authTokens.js";

export const authRouter = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(2).max(80)
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1)
});

const googleAuthSchema = z.object({
  credential: z.string().min(1)
});

const googleClient = env.GOOGLE_CLIENT_ID ? new OAuth2Client(env.GOOGLE_CLIENT_ID) : null;

authRouter.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ message: "Invalid registration payload.", issues: parsed.error.flatten() });
    return;
  }

  const { email, password, displayName } = parsed.data;
  const passwordHash = await bcrypt.hash(password, 12);

  try {
    const userInsert = await pool.query<{
      id: string;
      email: string;
      display_name: string;
    }>(
      `INSERT INTO users (email, display_name, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, email, display_name`,
      [email, displayName, passwordHash]
    );

    const user = userInsert.rows[0];
    const accessToken = signAccessToken({ id: user.id, email: user.email });
    const refreshToken = signRefreshToken({ id: user.id, email: user.email });

    await pool.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '30 days')`,
      [user.id, hashToken(refreshToken)]
    );

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name
      },
      tokens: {
        accessToken,
        refreshToken
      }
    });
  } catch (error: unknown) {
    const err = error as { code?: string };

    if (err.code === "23505") {
      res.status(409).json({ message: "An account with this email already exists." });
      return;
    }

    res.status(500).json({ message: "Failed to register user." });
  }
});

authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ message: "Invalid login payload.", issues: parsed.error.flatten() });
    return;
  }

  const { email, password } = parsed.data;

  const userQuery = await pool.query<{
    id: string;
    email: string;
    display_name: string;
    password_hash: string;
  }>(
    `SELECT id, email, display_name, password_hash
     FROM users
     WHERE email = $1`,
    [email]
  );

  if (userQuery.rowCount === 0) {
    res.status(401).json({ message: "Invalid credentials." });
    return;
  }

  const user = userQuery.rows[0];
  const isValid = await bcrypt.compare(password, user.password_hash);

  if (!isValid) {
    res.status(401).json({ message: "Invalid credentials." });
    return;
  }

  const accessToken = signAccessToken({ id: user.id, email: user.email });
  const refreshToken = signRefreshToken({ id: user.id, email: user.email });

  await pool.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, NOW() + INTERVAL '30 days')`,
    [user.id, hashToken(refreshToken)]
  );

  res.status(200).json({
    user: {
      id: user.id,
      email: user.email,
      displayName: user.display_name
    },
    tokens: {
      accessToken,
      refreshToken
    }
  });
});

authRouter.post("/refresh", async (req, res) => {
  const parsed = refreshSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ message: "Invalid refresh payload." });
    return;
  }

  const { refreshToken } = parsed.data;

  try {
    const payload = verifyRefreshToken(refreshToken);

    if (payload.type !== "refresh" || !payload.sub || !payload.email) {
      res.status(401).json({ message: "Invalid refresh token." });
      return;
    }

    const tokenHash = hashToken(refreshToken);
    const storedToken = await pool.query<{ id: string; user_id: string }>(
      `SELECT id, user_id
       FROM refresh_tokens
       WHERE token_hash = $1
         AND revoked_at IS NULL
         AND expires_at > NOW()
       ORDER BY created_at DESC
       LIMIT 1`,
      [tokenHash]
    );

    if (storedToken.rowCount === 0) {
      res.status(401).json({ message: "Refresh token is revoked or expired." });
      return;
    }

    await pool.query(
      `UPDATE refresh_tokens
       SET revoked_at = NOW()
       WHERE id = $1`,
      [storedToken.rows[0].id]
    );

    const userLookup = await pool.query<{ id: string; email: string; display_name: string }>(
      `SELECT id, email, display_name
       FROM users
       WHERE id = $1`,
      [storedToken.rows[0].user_id]
    );

    if (userLookup.rowCount === 0) {
      res.status(401).json({ message: "User account no longer exists." });
      return;
    }

    const user = userLookup.rows[0];
    const nextAccessToken = signAccessToken({ id: user.id, email: user.email });
    const nextRefreshToken = signRefreshToken({ id: user.id, email: user.email });

    await pool.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '30 days')`,
      [user.id, hashToken(nextRefreshToken)]
    );

    res.status(200).json({
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name
      },
      tokens: {
        accessToken: nextAccessToken,
        refreshToken: nextRefreshToken
      }
    });
  } catch {
    res.status(401).json({ message: "Invalid refresh token." });
  }
});

authRouter.post("/google", async (req, res) => {
  if (!googleClient || !env.GOOGLE_CLIENT_ID) {
    res.status(503).json({ message: "Google authentication is not configured." });
    return;
  }

  const parsed = googleAuthSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ message: "Invalid Google auth payload.", issues: parsed.error.flatten() });
    return;
  }

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: parsed.data.credential,
      audience: env.GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();
    const email = payload?.email?.toLowerCase();

    if (!payload?.email_verified || !email) {
      res.status(401).json({ message: "Google account email is not verified." });
      return;
    }

    let userLookup = await pool.query<{
      id: string;
      email: string;
      display_name: string;
    }>(
      `SELECT id, email, display_name
       FROM users
       WHERE email = $1
       LIMIT 1`,
      [email]
    );

    if (userLookup.rowCount === 0) {
      const generatedPasswordHash = await bcrypt.hash(uuidv4(), 10);
      const displayName = (payload.name ?? email.split("@")[0] ?? "Google User").slice(0, 80);

      try {
        userLookup = await pool.query<{
          id: string;
          email: string;
          display_name: string;
        }>(
          `INSERT INTO users (email, display_name, password_hash)
           VALUES ($1, $2, $3)
           RETURNING id, email, display_name`,
          [email, displayName, generatedPasswordHash]
        );
      } catch (error: unknown) {
        const err = error as { code?: string };

        if (err.code !== "23505") {
          throw error;
        }

        userLookup = await pool.query<{
          id: string;
          email: string;
          display_name: string;
        }>(
          `SELECT id, email, display_name
           FROM users
           WHERE email = $1
           LIMIT 1`,
          [email]
        );
      }
    }

    if (userLookup.rowCount === 0) {
      res.status(500).json({ message: "Failed to load Google account user." });
      return;
    }

    const user = userLookup.rows[0];
    const accessToken = signAccessToken({ id: user.id, email: user.email });
    const refreshToken = signRefreshToken({ id: user.id, email: user.email });

    await pool.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '30 days')`,
      [user.id, hashToken(refreshToken)]
    );

    res.status(200).json({
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name
      },
      tokens: {
        accessToken,
        refreshToken
      }
    });
  } catch {
    res.status(401).json({ message: "Google token verification failed." });
  }
});

authRouter.post("/guest", (_req, res) => {
  res.status(200).json({
    mode: "guest",
    guestId: uuidv4(),
    warning: "You will not receive cloud benefits."
  });
});
