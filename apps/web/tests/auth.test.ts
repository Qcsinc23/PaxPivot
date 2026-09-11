// @vitest-environment node
/**
 * The human → web boundary (ADR-005): signed session, fail-closed configuration, the proxy
 * guard, and the sign-in route handler. The web → API boundary is covered by api-client.test.ts.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { describe, expect, test, vi } from "vitest";
import { POST as signIn } from "@/app/auth/session/route";
import { POST as signOut } from "@/app/auth/logout/route";
import { accessConfig } from "@/lib/auth/config";
import { guard, isPublicPath, safeNextPath } from "@/lib/auth/guard";
import {
  SESSION_COOKIE,
  SESSION_TTL_MS,
  issueSession,
  timingSafeEqual,
  verifySession,
} from "@/lib/auth/session";
import { proxy } from "@/proxy";

const SECRET = "session-secret-with-at-least-32-characters!";
const PASSPHRASE = "correct-horse-battery-staple-pilot";
const CONFIGURED = {
  PAXPIVOT_SESSION_SECRET: SECRET,
  PAXPIVOT_PILOT_PASSPHRASE: PASSPHRASE,
  NODE_ENV: "production",
};
const NOW = new Date("2026-09-11T12:00:00Z");

function withEnv<T>(
  env: Record<string, string | undefined>,
  run: () => Promise<T>,
): Promise<T> {
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v as string);
  return run().finally(() => vi.unstubAllEnvs());
}

describe("session token", () => {
  test("verifies its own signature, rejects tampering, wrong secret and expiry", async () => {
    const token = await issueSession(SECRET, NOW);
    expect(await verifySession(SECRET, token, NOW)).toBe(true);
    expect(
      await verifySession(
        SECRET,
        token,
        new Date(NOW.getTime() + SESSION_TTL_MS),
      ),
    ).toBe(true);
    expect(
      await verifySession(
        SECRET,
        token,
        new Date(NOW.getTime() + SESSION_TTL_MS + 1),
      ),
    ).toBe(false);
    expect(
      await verifySession(SECRET, token, new Date(NOW.getTime() - 1)),
    ).toBe(false); // from the future
    expect(
      await verifySession(
        "another-secret-with-at-least-32-chars!!",
        token,
        NOW,
      ),
    ).toBe(false);
    const [issued, sig] = token.split(".");
    expect(
      await verifySession(SECRET, `${Number(issued) + 1}.${sig}`, NOW),
    ).toBe(false);
    expect(
      await verifySession(
        SECRET,
        `${issued}.${sig!.replace(/^./, (c) => (c === "0" ? "1" : "0"))}`,
        NOW,
      ),
    ).toBe(false);
    for (const bad of [undefined, "", "x", "1.2.3", "abc.def", `${issued}.`]) {
      expect(await verifySession(SECRET, bad, NOW)).toBe(false);
    }
    expect(timingSafeEqual("abc", "abc")).toBe(true);
    expect(timingSafeEqual("abc", "abd")).toBe(false);
    expect(timingSafeEqual("abc", "ab")).toBe(false);
    expect(timingSafeEqual("", "")).toBe(true);
    expect(timingSafeEqual("", "a")).toBe(false);
    expect(timingSafeEqual("a\u0000", "a")).toBe(false);
    expect(timingSafeEqual("a", "a\u0000")).toBe(false);
  });
});

describe("access configuration", () => {
  test("fails closed in production and stays open only in development without any secret", () => {
    expect(accessConfig({ NODE_ENV: "production" })).toEqual({
      mode: "misconfigured",
      reason: "access_not_configured",
    });
    expect(accessConfig({ NODE_ENV: "development" })).toEqual({
      mode: "development_open",
    });
    expect(
      accessConfig({ NODE_ENV: "development", PAXPIVOT_SESSION_SECRET: SECRET })
        .mode,
    ).toBe("misconfigured");
    expect(
      accessConfig({ ...CONFIGURED, PAXPIVOT_SESSION_SECRET: "short" }),
    ).toEqual({ mode: "misconfigured", reason: "session_secret_too_short" });
    expect(
      accessConfig({ ...CONFIGURED, PAXPIVOT_PILOT_PASSPHRASE: "short" }),
    ).toEqual({ mode: "misconfigured", reason: "passphrase_too_short" });
    expect(accessConfig(CONFIGURED)).toEqual({
      mode: "configured",
      passphrase: PASSPHRASE,
      sessionSecret: SECRET,
    });
  });
});

describe("guard decisions", () => {
  test("public paths, sessions, anonymous and misconfigured deployments", async () => {
    const configured = accessConfig(CONFIGURED);
    const token = await issueSession(SECRET, NOW);
    for (const path of [
      "/login",
      "/auth/session",
      "/auth/logout",
      "/_next/static/x.js",
      "/favicon.ico",
    ]) {
      expect(isPublicPath(path)).toBe(true);
      expect(await guard(path, undefined, configured, NOW)).toEqual({
        action: "allow",
      });
    }
    for (const path of [
      "/",
      "/terminals",
      "/terminals/abc",
      "/advanced",
      "/showcase/plan",
      "/api/anything",
    ]) {
      expect(isPublicPath(path)).toBe(false);
      expect(await guard(path, undefined, configured, NOW)).toEqual({
        action: "login",
        next: path,
      });
      expect(await guard(path, token, configured, NOW)).toEqual({
        action: "allow",
      });
      expect(await guard(path, "forged.token", configured, NOW)).toEqual({
        action: "login",
        next: path,
      });
      expect(
        await guard(path, token, accessConfig({ NODE_ENV: "production" }), NOW),
      ).toEqual({
        action: "refuse",
        reason: "access_not_configured",
      });
      expect(
        await guard(
          path,
          undefined,
          accessConfig({ NODE_ENV: "development" }),
          NOW,
        ),
      ).toEqual({ action: "allow" });
    }
    expect(safeNextPath("/terminals/x")).toBe("/terminals/x");
    expect(safeNextPath("/terminals?filter=x")).toBe("/terminals?filter=x");
    for (const bad of [
      undefined,
      null,
      "",
      "https://evil.invalid/",
      "//evil.invalid",
      "/\\evil.invalid/",
      "/\t/evil.invalid/",
      "/\n/evil.invalid",
      "/..//evil.invalid/",
      "/a/..//evil.invalid/",
      "/.//evil.invalid/",
      "/%2e%2e//evil.invalid/",
      "/./\\evil.invalid",
      "///",
      "//[",
      "//a:99999/",
      "terminals",
      "javascript:alert(1)",
      ["/a", "/b"],
    ]) {
      expect(safeNextPath(bad)).toBe("/");
    }
  });
});

describe("proxy", () => {
  test("redirects anonymous private requests to /login, passes sessions, refuses misconfiguration", async () => {
    await withEnv(CONFIGURED, async () => {
      const anonymous = await proxy(
        new NextRequest("http://pilot.invalid/terminals/abc"),
      );
      expect(anonymous.status).toBe(307);
      expect(anonymous.headers.get("location")).toBe(
        "/login?next=%2Fterminals%2Fabc",
      );
      const token = await issueSession(SECRET);
      const signed = await proxy(
        new NextRequest("http://pilot.invalid/terminals", {
          headers: { cookie: `${SESSION_COOKIE}=${token}` },
        }),
      );
      expect(signed.status).toBe(200);
      expect(signed.headers.get("location")).toBeNull();
      const asset = await proxy(
        new NextRequest("http://pilot.invalid/_next/static/chunk.js"),
      );
      expect(asset.status).toBe(200);
    });
    await withEnv(
      {
        NODE_ENV: "production",
        PAXPIVOT_SESSION_SECRET: undefined,
        PAXPIVOT_PILOT_PASSPHRASE: undefined,
      },
      async () => {
        const refused = await proxy(
          new NextRequest("http://pilot.invalid/terminals"),
        );
        expect(refused.status).toBe(503);
        expect(await refused.text()).not.toMatch(/PAXPIVOT_|secret|token/i);
        // The login page itself stays reachable so the failure is explainable.
        expect(
          (await proxy(new NextRequest("http://pilot.invalid/login"))).status,
        ).toBe(200);
      },
    );
  });
});

describe("sign-in route", () => {
  function post(body: Record<string, string>): Request {
    const form = new URLSearchParams(body);
    return new Request("https://pilot.invalid/auth/session", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });
  }

  test("issues an HttpOnly cookie for the passphrase and nothing for anything else", async () => {
    await withEnv(CONFIGURED, async () => {
      const ok = await signIn(
        post({ passphrase: PASSPHRASE, next: "/advanced" }),
      );
      expect(ok.status).toBe(303);
      expect(ok.headers.get("location")).toBe("/advanced");
      const cookie = ok.headers.get("set-cookie") ?? "";
      expect(cookie).toMatch(
        new RegExp(`^${SESSION_COOKIE}=\\d+\\.[0-9a-f]{64};`),
      );
      expect(cookie).toMatch(/HttpOnly/i);
      expect(cookie).toMatch(/Secure/i);
      expect(cookie).toMatch(/SameSite=lax/i);
      expect(cookie).not.toContain(PASSPHRASE);
      const token = cookie.split(";")[0]!.slice(SESSION_COOKIE.length + 1);
      expect(await verifySession(SECRET, token)).toBe(true);

      const wrong = await signIn(
        post({
          passphrase: "wrong-passphrase-of-similar-length",
          next: "/advanced",
        }),
      );
      expect(wrong.status).toBe(303);
      expect(wrong.headers.get("location")).toBe(
        "/login?error=1&next=%2Fadvanced",
      );
      expect(wrong.headers.get("set-cookie")).toBeNull();

      const open = await signIn(
        post({ passphrase: PASSPHRASE, next: "https://evil.invalid/" }),
      );
      expect(open.headers.get("location")).toBe("/");

      const malformed = await signIn(
        new Request("https://pilot.invalid/auth/session", {
          method: "POST",
          body: "{}",
        }),
      );
      expect(malformed.status).toBe(400);
      expect(malformed.headers.get("set-cookie")).toBeNull();

      const out = await signOut(
        new Request("https://pilot.invalid/auth/logout", { method: "POST" }),
      );
      expect(out.status).toBe(303);
      expect(out.headers.get("set-cookie")).toMatch(/Max-Age=0/i);
      expect(out.headers.get("set-cookie")).toMatch(/HttpOnly/i);
      expect(out.headers.get("set-cookie")).toMatch(/Secure/i);
    });
    await withEnv(
      {
        NODE_ENV: "production",
        PAXPIVOT_SESSION_SECRET: undefined,
        PAXPIVOT_PILOT_PASSPHRASE: undefined,
      },
      async () => {
        expect((await signIn(post({ passphrase: PASSPHRASE }))).status).toBe(
          503,
        );
      },
    );
  });
});

describe("secrets stay server-side", () => {
  test("only the two server-only modules read secret environment variables", () => {
    const root = process.cwd();
    const walk = (dir: string): string[] =>
      readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);
        return statSync(path).isDirectory() ? walk(path) : [path];
      });
    const files = [
      ...walk(join(root, "app")),
      ...walk(join(root, "components")),
      ...walk(join(root, "lib")),
      join(root, "proxy.ts"),
    ].filter((f) => /\.(ts|tsx)$/.test(f));
    const readers = files.filter((f) =>
      /PAXPIVOT_(API_TOKEN|SESSION_SECRET|PILOT_PASSPHRASE)/.test(
        readFileSync(f, "utf8"),
      ),
    );
    expect(readers.map((f) => f.slice(root.length + 1)).sort()).toEqual([
      "lib/api/client.ts",
      "lib/auth/config.ts",
    ]);
    // Neither is a client component, and nothing exposes a secret as NEXT_PUBLIC_.
    for (const f of readers)
      expect(readFileSync(f, "utf8")).not.toMatch(/"use client"|NEXT_PUBLIC_/);
    for (const f of files)
      expect(readFileSync(f, "utf8")).not.toMatch(/NEXT_PUBLIC_PAXPIVOT/);
  });
});
