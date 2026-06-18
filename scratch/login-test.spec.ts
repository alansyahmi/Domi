import { test, expect } from "@playwright/test";

const BASE = "https://re-ai.alansyahmi2004.workers.dev";

test("auth-config returns configured:true", async ({ request }) => {
  const resp = await request.get(`${BASE}/api/auth-config`);
  expect(resp.status()).toBe(200);
  const body = await resp.json();
  expect(body.configured).toBe(true);
  expect(body.clientId).toBe("spac_130071553437073410");
});

test("csrf-token returns valid token", async ({ request }) => {
  const resp = await request.get(`${BASE}/api/csrf-token`);
  expect(resp.status()).toBe(200);
  const body = await resp.json();
  expect(body.csrfToken).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
});

test("/login redirects through Scalekit to Google", async ({ page }) => {
  await page.goto(`${BASE}/login`, { waitUntil: "commit" });
  const finalUrl = page.url();
  console.log("Final URL:", finalUrl.slice(0, 120) + "...");
  expect(finalUrl).toContain("accounts.google.com");
});

test("/dashboard stays at /dashboard (no redirect)", async ({ page }) => {
  const resp = await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);

  const finalUrl = page.url();
  console.log("Final URL:", finalUrl);
  console.log("Title:", await page.title());

  // Should STAY at /dashboard, NOT redirect to /
  expect(finalUrl).toContain("/dashboard");

  // Should NOT show the landing page (it's at /dashboard, not /)
  const body = await page.textContent("body");
  expect(body).not.toMatch(/Built for Malaysian property agents/);
});

test("sign-in prompt appears at /dashboard when not authenticated", async ({ page }) => {
  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);

  const body = await page.textContent("body");
  console.log("Dashboard body:", body?.slice(0, 500));

  // Should show the "Sign in with Scalekit" prompt
  expect(body).toContain("Sign in with Scalekit");
  expect(body).toContain("Sign in to access your real estate workspace");
});

test("/ renders landing page", async ({ page }) => {
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);

  const body = await page.textContent("body");
  expect(body).toMatch(/Built for Malaysian property agents/);
  console.log("Landing page loads correctly at /");
});
