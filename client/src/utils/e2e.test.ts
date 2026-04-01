import { describe, it, expect, beforeAll, afterAll } from "vitest";

// E2E tests require:
// 1. DATABASE_URL to be configured
// 2. Network access to scrape real URLs  
// 3. Explicit opt-in via RUN_E2E_TESTS=true
const hasDatabase = !!process.env.DATABASE_URL;
const runE2E = process.env.RUN_E2E_TESTS === "true";
const shouldRunE2E = hasDatabase && runE2E;

let server: any;
let baseUrl = "";
let testToken = "";
let app: any;

// Use a valid UUID format for test user
const TEST_USER_UUID = "00000000-0000-0000-0000-000000000001";

beforeAll(async () => {
  if (!shouldRunE2E) return;

  const [{ default: serverApp }, jwtModule] = await Promise.all([
    import("../../../server/src/server.ts"),
    import("../../../server/src/lib/utils/jwt.ts"),
  ]);

  app = serverApp;

  // Create a test token for authentication (using valid UUID format)
  testToken = jwtModule.signUserToken({ userId: TEST_USER_UUID, tier: "observer" });

  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      baseUrl = `http://127.0.0.1:${addr.port}`;
      resolve();
    });
  });
});

afterAll(async () => {
  if (!shouldRunE2E || !server) return;

  await new Promise<void>((resolve, reject) =>
    server.close((err: any) => (err ? reject(err) : resolve()))
  );
});

describe("POST /api/analyze", () => {
  it.skipIf(!shouldRunE2E)("should return a valid analysis response for a real URL", async () => {
    const response = await fetch(`${baseUrl}/api/analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${testToken}`,
      },
      body: JSON.stringify({ url: "https://example.com" }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();

    expect(data).toHaveProperty("visibility_score");
    expect(data).toHaveProperty("ai_platform_scores");
    expect(data).toHaveProperty("recommendations");
    expect(data).toHaveProperty("schema_markup");
    expect(data).toHaveProperty("content_analysis");
    expect(data).toHaveProperty("analyzed_at");
  });
});
