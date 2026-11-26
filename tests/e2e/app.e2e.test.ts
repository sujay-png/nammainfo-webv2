import test from "node:test";
import assert from "node:assert/strict";
import { chromium, request as pwRequest } from "playwright";

const BASE_URL = process.env.E2E_BASE_URL || "http://127.0.0.1:3000";

test("E2E: protected APIs enforce 401/403 and UI portals render cleanly", async (t) => {
  // Check whether local Next.js server is already listening; skip cleanly if not started
  let serverReachable = false;
  try {
    const ping = await fetch(`${BASE_URL}/`);
    serverReachable = ping.status < 500;
  } catch {
    serverReachable = false;
  }

  if (!serverReachable) {
    t.skip(`No running server at ${BASE_URL}; start Next.js server and re-run npm run test:e2e.`);
    return;
  }

  const apiCtx = await pwRequest.newContext({ baseURL: BASE_URL });
  const endpoints: Array<{ method: "GET" | "POST" | "PATCH" | "DELETE"; path: string; body?: any }> = [
    { method: "GET", path: "/api/staff/fulfillment" },
    { method: "PATCH", path: "/api/staff/fulfillment/00000000-0000-0000-0000-000000000000/stage", body: { stage: "printed_ready" } },
    { method: "GET", path: "/api/staff/notifications" },
    { method: "PATCH", path: "/api/staff/notifications", body: { markAllRead: true } },
    { method: "GET", path: "/api/staff/followups" },
    { method: "POST", path: "/api/staff/followups", body: {} },
    { method: "POST", path: "/api/team/card-spec", body: { action: "save_company_template", templateUrl: null } },
    { method: "GET", path: "/api/user/orders" },
    { method: "PATCH", path: "/api/user/orders", body: { orderId: "x", designUrl: "https://example.com/a.png" } },
    { method: "DELETE", path: "/api/user/orders?id=x" },
    { method: "GET", path: "/api/admin/orders" },
    { method: "PATCH", path: "/api/admin/orders", body: { orderId: "x", status: "delivered" } },
    { method: "DELETE", path: "/api/admin/orders?id=x" },
  ];

  for (const ep of endpoints) {
    const res = await apiCtx.fetch(ep.path, {
      method: ep.method,
      ...(ep.body ? { data: ep.body } : {}),
    });
    assert.ok(
      res.status() === 401 || res.status() === 403,
      `Expected 401/403 for ${ep.method} ${ep.path}, got ${res.status()}`
    );
  }
  await apiCtx.dispose();

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));

    await page.goto(`${BASE_URL}/admin/login`, { waitUntil: "domcontentloaded" });
    await page.locator("input[type='email'], input[name='email']").first().waitFor({ state: "visible" });

    await page.goto(`${BASE_URL}/partner/login`, { waitUntil: "domcontentloaded" });
    await page.locator("input[type='email'], input[name='email']").first().waitFor({ state: "visible" });

    await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });
    assert.deepEqual(pageErrors, []);
  } finally {
    await browser.close();
  }
});
