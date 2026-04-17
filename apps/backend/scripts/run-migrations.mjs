import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Client } = pg;

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is required to run migrations.");
  process.exit(1);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, "../../..");
const migrationsDir = path.join(workspaceRoot, "infra", "db", "migrations");

const client = new Client({
  connectionString: databaseUrl
});

try {
  await client.connect();

  const migrationFiles = (await readdir(migrationsDir))
    .filter((fileName) => fileName.endsWith(".sql"))
    .sort();

  for (const migrationFile of migrationFiles) {
    const migrationPath = path.join(migrationsDir, migrationFile);
    const sql = await readFile(migrationPath, "utf8");

    console.log(`Applying ${migrationFile}`);
    await client.query(sql);
  }

  console.log("All migrations applied successfully.");
} catch (error) {
  console.error("Migration execution failed.");
  console.error(error);
  process.exitCode = 1;
} finally {
  await client.end();
}
