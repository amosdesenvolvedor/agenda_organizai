import assert from "node:assert/strict";
import test from "node:test";
import {
  canInviteOrganizationRole,
  canManageOrganization,
  canViewOrganization,
} from "./organization-access.service.js";

test("OWNER e ADMIN gerenciam; MEMBER e externo não", () => {
  assert.equal(canManageOrganization("OWNER"), true);
  assert.equal(canManageOrganization("ADMIN"), true);
  assert.equal(canManageOrganization("MEMBER"), false);
  assert.equal(canManageOrganization(null), false);
});

test("somente OWNER pode convidar ADMIN", () => {
  assert.equal(canInviteOrganizationRole("OWNER", "ADMIN"), true);
  assert.equal(canInviteOrganizationRole("ADMIN", "ADMIN"), false);
  assert.equal(canInviteOrganizationRole("MEMBER", "MEMBER"), false);
});

test("ADMIN pode convidar MEMBER", () => {
  assert.equal(canInviteOrganizationRole("ADMIN", "MEMBER"), true);
});

test("organização privada exige associação ativa", () => {
  assert.equal(
    canViewOrganization({ isPublic: false, activeMember: true }),
    true,
  );
  assert.equal(
    canViewOrganization({ isPublic: false, activeMember: false }),
    false,
  );
  assert.equal(
    canViewOrganization({ isPublic: true, activeMember: false }),
    true,
  );
});
