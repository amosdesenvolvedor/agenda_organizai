import assert from "node:assert/strict";
import test from "node:test";
import { canViewPost, visiblePostWhere } from "./social-access.service.js";

test("PUBLIC é visível pelo autor, conexão e usuário externo", () => {
  assert.equal(
    canViewPost({
      viewerId: "author",
      authorId: "author",
      visibility: "PUBLIC",
      connected: false,
    }),
    true,
  );
  assert.equal(
    canViewPost({
      viewerId: "friend",
      authorId: "author",
      visibility: "PUBLIC",
      connected: true,
    }),
    true,
  );
  assert.equal(
    canViewPost({
      viewerId: "external",
      authorId: "author",
      visibility: "PUBLIC",
      connected: false,
    }),
    true,
  );
});

test("NETWORK é visível somente pelo autor e conexões", () => {
  assert.equal(
    canViewPost({
      viewerId: "author",
      authorId: "author",
      visibility: "NETWORK",
      connected: false,
    }),
    true,
  );
  assert.equal(
    canViewPost({
      viewerId: "friend",
      authorId: "author",
      visibility: "NETWORK",
      connected: true,
    }),
    true,
  );
  assert.equal(
    canViewPost({
      viewerId: "external",
      authorId: "author",
      visibility: "NETWORK",
      connected: false,
    }),
    false,
  );
});

test("PRIVATE é visível somente pelo autor", () => {
  assert.equal(
    canViewPost({
      viewerId: "author",
      authorId: "author",
      visibility: "PRIVATE",
      connected: false,
    }),
    true,
  );
  assert.equal(
    canViewPost({
      viewerId: "friend",
      authorId: "author",
      visibility: "PRIVATE",
      connected: true,
    }),
    false,
  );
  assert.equal(
    canViewPost({
      viewerId: "external",
      authorId: "author",
      visibility: "PRIVATE",
      connected: false,
    }),
    false,
  );
});

test("filtro de banco inclui autor, público e NETWORK de conexões", () => {
  assert.deepEqual(visiblePostWhere("viewer", ["friend"]), {
    OR: [
      { authorId: "viewer" },
      { visibility: "PUBLIC" },
      { visibility: "NETWORK", authorId: { in: ["friend"] } },
    ],
  });
});
