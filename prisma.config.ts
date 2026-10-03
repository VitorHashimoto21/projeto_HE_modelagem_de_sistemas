import "dotenv/config";
import { defineConfig } from "prisma/config";

// A CLI (migrações) usa a conexão direta; a aplicação usa DATABASE_URL (com pooling) pelo adaptador pg.
// Em desenvolvimento e no CI, sem pooler, DIRECT_URL pode ficar vazia e vale a DATABASE_URL.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DIRECT_URL || process.env.DATABASE_URL,
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },
});
