import test from "node:test";
import assert from "node:assert/strict";

import { LruCache } from "../lib/lru-cache.ts";

test("LruCache stores and retrieves values", () => {
  const cache = new LruCache<string, number>(2);

  cache.set("a", 1);

  assert.equal(cache.get("a"), 1);
  assert.equal(cache.get("missing"), undefined);
});

test("LruCache refreshes recency when reading", () => {
  const cache = new LruCache<string, number>(2);

  cache.set("a", 1);
  cache.set("b", 2);
  cache.get("a");
  cache.set("c", 3);

  assert.equal(cache.get("a"), 1);
  assert.equal(cache.get("b"), undefined);
  assert.equal(cache.get("c"), 3);
});

test("LruCache evicts the oldest entry when capacity is exceeded", () => {
  const cache = new LruCache<string, number>(2);

  cache.set("a", 1);
  cache.set("b", 2);
  cache.set("c", 3);

  assert.equal(cache.get("a"), undefined);
  assert.equal(cache.get("b"), 2);
  assert.equal(cache.get("c"), 3);
});
