import { describe, expect, it } from "vitest";
import { buildPaginationMeta, parsePagination } from "@/lib/pagination";

describe("pagination helper", () => {
  it("keeps pagination disabled when page and limit params are absent", () => {
    const parsed = parsePagination(new URLSearchParams("search=alice"));
    expect(parsed).toEqual({
      enabled: false,
      page: 1,
      limit: 25,
      skip: 0,
    });
  });

  it("clamps invalid page/limit bounds when enabled", () => {
    const parsed = parsePagination(new URLSearchParams("page=0&limit=500"), {
      defaultLimit: 20,
      maxLimit: 100,
    });
    expect(parsed).toEqual({
      enabled: true,
      page: 1,
      limit: 100,
      skip: 0,
    });
  });

  it("computes skip and totalPages cleanly", () => {
    const parsed = parsePagination(new URLSearchParams("page=3&limit=20"));
    expect(parsed.skip).toBe(40);
    expect(buildPaginationMeta(parsed.page, parsed.limit, 45)).toEqual({
      page: 3,
      limit: 20,
      total: 45,
      totalPages: 3,
    });
    expect(buildPaginationMeta(1, 20, 0).totalPages).toBe(1);
  });
});
