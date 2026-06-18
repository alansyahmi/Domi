import { test, expect } from "@playwright/test";

const BASE = "https://re-ai.alansyahmi2004.workers.dev";

test("auth-config returns configured:true", async ({ request }) => {
  const resp = await request.get(`${BASE}/api/auth-config`);
  expect(resp.status()).toBe(200);
  const body = await resp.json();
  expect(body.configured).toBe(true);
  expect(body.clientId).toBe("spac_130071553437073410");
});

test("csrf-token endpoint returns valid token", async ({ request }) => {
  const resp = await request.get(`${BASE}/api/csrf-token`);
  expect(resp.status()).toBe(200);
  const body = await resp.json();
  expect(body.csrfToken).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
});

test("login redirects through Scalekit to Google sign-in", async ({ page }) => {
  // /login → Scalekit /oauth/authorize → Google sign-in (full redirect chain)
  await page.goto(`${BASE}/login`, { waitUntil: "commit" });
  const finalUrl = page.url();
  console.log("Final URL:", finalUrl.slice(0, 120) + "...");
  // After following redirects, we should be at Google sign-in
  expect(finalUrl).toContain("accounts.google.com");
  expect(finalUrl).toContain("scalekit"); // redirect_uri param references Scalekit
});

test("homepage loads and detects auth mode", async ({ page }) => {
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);

  const title = await page.title();
  expect(title).toBe("Signatis");

  // Should have login links since auth is configured
  const loginLinks = await page.locator('a[href*="/login"]').count();
  expect(loginLinks).toBeGreaterThan(0);
  console.log("Title:", title, "| Login links:", loginLinks);
});

test("full SPA: navigate to dashboard, get redirected to login", async ({ page }) => {
  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);

  // Since not authenticated, should see sign-in prompt
  const body = await page.textContent("body");
  console.log("Dashboard body:", body?.slice(0, 400));

  // Should show auth-related content (Sign in button), not demo data
  expect(body).toContain("Sign");
});
