import { defineConfig } from "prisma/config";
import path from "path";
import fs from "fs";

// Simple fallback parser for .env file to ensure DATABASE_URL is loaded
function loadEnv() {
  try {
    const envPath = path.resolve(process.cwd(), ".env");
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf-8");
      for (const line of content.split("\n")) {
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (match) {
          const key = match[1];
          let value = match[2] || "";
          if (value.startsWith('"') && value.endsWith('"')) {
            value = value.slice(1, -1);
          } else if (value.startsWith("'") && value.endsWith("'")) {
            value = value.slice(1, -1);
          }
          process.env[key] = value;
        }
      }
    }
  } catch (err) {
    console.error("Error loading .env file:", err);
  }
}

loadEnv();

export default defineConfig({
  schema: path.resolve(process.cwd(), "prisma/schema.prisma"),
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
