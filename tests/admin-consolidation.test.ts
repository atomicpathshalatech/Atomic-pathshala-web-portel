import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  VALID_GLOBAL_ROLES,
  parseGlobalRole,
  ROLE_PERMISSION_DEFAULTS,
  PERMISSIONS,
} from "../src/lib/rbac/permissions";

describe("ATOMIC PATHSHALA — Admin Role Consolidation Verification Suite", () => {
  describe("Role Catalogue & Enum Consolidation", () => {
    test("SUPER_ADMIN is completely removed from VALID_GLOBAL_ROLES", () => {
      assert.equal(
        (VALID_GLOBAL_ROLES as readonly string[]).includes("SUPER_ADMIN"),
        false,
        "SUPER_ADMIN must not exist in VALID_GLOBAL_ROLES"
      );
      assert.equal(
        (VALID_GLOBAL_ROLES as readonly string[]).includes("ADMIN"),
        true,
        "ADMIN must be present in VALID_GLOBAL_ROLES"
      );
    });

    test("SUPER_ADMIN is removed from ROLE_PERMISSION_DEFAULTS", () => {
      assert.equal(
        "SUPER_ADMIN" in ROLE_PERMISSION_DEFAULTS,
        false,
        "SUPER_ADMIN must not exist as a key in ROLE_PERMISSION_DEFAULTS"
      );
      assert.equal(
        "ADMIN" in ROLE_PERMISSION_DEFAULTS,
        true,
        "ADMIN must exist as a key in ROLE_PERMISSION_DEFAULTS"
      );
    });

    test("ADMIN role has full access wildcard / all permissions in ROLE_PERMISSION_DEFAULTS", () => {
      const adminPerms = ROLE_PERMISSION_DEFAULTS["ADMIN"];
      assert.ok(Array.isArray(adminPerms), "ADMIN permissions must be an array");

      // Verify essential top-level permissions are all held by ADMIN
      const allPermValues = Object.values(PERMISSIONS);
      for (const perm of allPermValues) {
        assert.ok(
          adminPerms.includes(perm),
          `ADMIN must hold permission: ${perm}`
        );
      }
    });

    test("parseGlobalRole converts legacy SUPER_ADMIN / Super Admin inputs to ADMIN", () => {
      assert.equal(parseGlobalRole("SUPER_ADMIN"), "ADMIN");
      assert.equal(parseGlobalRole("Super Admin"), "ADMIN");
      assert.equal(parseGlobalRole("super-admin"), "ADMIN");
      assert.equal(parseGlobalRole("SUPER ADMIN"), "ADMIN");
      assert.equal(parseGlobalRole("ADMIN"), "ADMIN");
      assert.equal(parseGlobalRole("admin"), "ADMIN");
    });

    test("Other roles (TEACHER, SALES, FINANCE, HR, etc.) remain intact and uncorrupted", () => {
      assert.equal(parseGlobalRole("TEACHER"), "TEACHER");
      assert.equal(parseGlobalRole("FINANCE"), "FINANCE");
      assert.equal(parseGlobalRole("HR"), "HR");
      assert.equal(parseGlobalRole("SALES"), "SALES");
      assert.equal(parseGlobalRole("STUDENT"), "STUDENT");
      assert.equal(parseGlobalRole("FOUNDER"), "FOUNDER");
    });
  });
});
