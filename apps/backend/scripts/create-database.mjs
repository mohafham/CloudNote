import pg from "pg";

const { Client } = pg;

const adminConnectionString =
  process.env.POSTGRES_ADMIN_URL ?? "postgres://postgres:postgres@localhost:5432/postgres";
const databaseName = process.env.CREATE_DATABASE_NAME ?? "cloud_notes";

if (!/^[a-zA-Z0-9_]+$/.test(databaseName)) {
  console.error(
    `Invalid CREATE_DATABASE_NAME: ${databaseName}. Use only letters, numbers, and underscores.`
  );
  process.exit(1);
}

const client = new Client({
  connectionString: adminConnectionString
});

try {
  await client.connect();

  const exists = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [databaseName]);

  if (exists.rowCount && exists.rowCount > 0) {
    console.log(`Database ${databaseName} already exists.`);
  } else {
    await client.query(`CREATE DATABASE \"${databaseName}\"`);
    console.log(`Created database ${databaseName}.`);
  }
} catch (error) {
  console.error("Failed to create database.");
  console.error(error);
  process.exitCode = 1;
} finally {
  await client.end();
}
