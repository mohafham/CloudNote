import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Express } from "express";
import { Client } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, "../../../../");
const migrationsDir = path.join(workspaceRoot, "infra", "db", "migrations");

const pgHost = "localhost";
const pgPort = 5432;
const pgUser = "postgres";
const pgPassword = "postgres";
const testDatabaseName = "cloud_notes_test";

let app: Express;
let poolRef: { pool: { end: () => Promise<void> } };
let accessToken = "";
let folderId = "";
let noteId = "";
let shareToken = "";

function setTestEnvironment(): void {
  process.env.NODE_ENV = "test";
  process.env.API_PORT = "4100";
  process.env.CLIENT_ORIGIN = "http://localhost:5173";
  process.env.DATABASE_URL = `postgres://${pgUser}:${pgPassword}@${pgHost}:${pgPort}/${testDatabaseName}`;
  process.env.JWT_ACCESS_SECRET = "test-access-secret-123456789";
  process.env.JWT_REFRESH_SECRET = "test-refresh-secret-123456789";
  process.env.REALTIME_JWT_SECRET = "test-realtime-secret-123456789";
  process.env.S3_ENDPOINT = "http://localhost:9000";
  process.env.S3_REGION = "us-east-1";
  process.env.S3_ACCESS_KEY = "minioadmin";
  process.env.S3_SECRET_KEY = "minioadmin";
  process.env.S3_BUCKET = "note-attachments";
  process.env.S3_FORCE_PATH_STYLE = "true";
  process.env.MAX_UPLOAD_BYTES = "10485760";
}

async function recreateTestDatabase(): Promise<void> {
  const adminClient = new Client({
    host: pgHost,
    port: pgPort,
    user: pgUser,
    password: pgPassword,
    database: "postgres"
  });

  await adminClient.connect();

  await adminClient.query(
    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()",
    [testDatabaseName]
  );
  await adminClient.query(`DROP DATABASE IF EXISTS ${testDatabaseName}`);
  await adminClient.query(`CREATE DATABASE ${testDatabaseName}`);

  await adminClient.end();
}

async function applyMigrations(): Promise<void> {
  const migrationClient = new Client({
    host: pgHost,
    port: pgPort,
    user: pgUser,
    password: pgPassword,
    database: testDatabaseName
  });

  await migrationClient.connect();

  const migrationFiles = (await readdir(migrationsDir))
    .filter((fileName) => fileName.endsWith(".sql"))
    .sort();

  for (const migrationFile of migrationFiles) {
    const sqlPath = path.join(migrationsDir, migrationFile);
    const sql = await readFile(sqlPath, "utf8");
    await migrationClient.query(sql);
  }

  await migrationClient.end();
}

beforeAll(async () => {
  setTestEnvironment();
  await recreateTestDatabase();
  await applyMigrations();

  const appModule = await import("../../src/app.ts");
  const poolModule = await import("../../src/db/pool.ts");

  app = appModule.app;
  poolRef = poolModule;
});

afterAll(async () => {
  await poolRef.pool.end();
});

describe("Backend route integration", () => {
  it("returns health status", async () => {
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ok");
  });

  it("registers and logs in user", async () => {
    const email = `integration-${Date.now()}@example.com`;

    const registerResponse = await request(app).post("/auth/register").send({
      email,
      password: "Passw0rd123!",
      displayName: "Integration User"
    });

    expect(registerResponse.status).toBe(201);
    expect(registerResponse.body.tokens.accessToken).toBeTypeOf("string");
    accessToken = registerResponse.body.tokens.accessToken;

    const loginResponse = await request(app).post("/auth/login").send({
      email,
      password: "Passw0rd123!"
    });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.tokens.refreshToken).toBeTypeOf("string");
  });

  it("supports folders, notes, and title-first search", async () => {
    const folderResponse = await request(app)
      .post("/folders")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        name: "Integration Folder",
        icon: "folder",
        color: "#4E5D94"
      });

    expect(folderResponse.status).toBe(201);
    folderId = folderResponse.body.folder.id;

    const titleMatchNote = await request(app)
      .post("/notes")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        type: "note",
        title: "Sync strategy",
        content: "Primary implementation details",
        folderId
      });

    expect(titleMatchNote.status).toBe(201);
    noteId = titleMatchNote.body.note.id;

    const bodyMatchNote = await request(app)
      .post("/notes")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        type: "note",
        title: "Architecture draft",
        content: "This note mentions sync in body only"
      });

    expect(bodyMatchNote.status).toBe(201);

    const searchResponse = await request(app)
      .get("/search")
      .query({ q: "sync" })
      .set("Authorization", `Bearer ${accessToken}`);

    expect(searchResponse.status).toBe(200);
    expect(searchResponse.body.results.length).toBeGreaterThanOrEqual(2);
    expect(searchResponse.body.results[0].id).toBe(noteId);
  });

  it("creates share links and attachment metadata", async () => {
    const shareResponse = await request(app)
      .post(`/notes/${noteId}/share`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ accessLevel: "view" });

    expect(shareResponse.status).toBe(201);
    shareToken = shareResponse.body.shareLink.token;

    const sharedResponse = await request(app).get(`/shared/${shareToken}`);
    expect(sharedResponse.status).toBe(200);
    expect(sharedResponse.body.note.id).toBe(noteId);

    const attachmentResponse = await request(app)
      .post(`/notes/${noteId}/attachments`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        fileName: "diagram.png",
        mimeType: "image/png",
        sizeBytes: 1024
      });

    expect(attachmentResponse.status).toBe(201);
    expect(attachmentResponse.body.attachment.mimeType).toBe("image/png");
    expect(attachmentResponse.body.uploadUrl).toContain("note-attachments");
  });
});
