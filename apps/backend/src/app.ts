import cors from "cors";
import express, { type Request, type Response } from "express";
import * as helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env.js";
import { authRouter } from "./routes/auth.js";
import { foldersRouter } from "./routes/folders.js";
import { notesRouter } from "./routes/notes.js";
import { searchRouter } from "./routes/search.js";
import { sharedRouter } from "./routes/shared.js";

export const app = express();

app.use(helmet.default());
app.use(
  cors({
    origin: env.CLIENT_ORIGIN,
    credentials: true
  })
);
app.use(morgan("dev"));
app.use(express.json({ limit: "2mb" }));

app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    service: "cloud-notes-api"
  });
});

app.use("/auth", authRouter);
app.use("/folders", foldersRouter);
app.use("/notes", notesRouter);
app.use("/search", searchRouter);
app.use("/shared", sharedRouter);

app.use((error: Error, _req: Request, res: Response, _next: () => void) => {
  res.status(500).json({
    message: "Unexpected server error.",
    detail: env.NODE_ENV === "development" ? error.message : undefined
  });
});
