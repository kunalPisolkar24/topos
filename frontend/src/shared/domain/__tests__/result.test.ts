import { describe, expect, it } from "vitest";
import { err, flatMap, isErr, isOk, map, mapErr, ok, unwrapOr } from "../result";

describe("Result", () => {
  it("creates ok and err values with discriminants", () => {
    expect(ok(1)).toEqual({ ok: true, value: 1 });
    expect(err("e")).toEqual({ ok: false, error: "e" });
  });

  it("narrows with isOk and isErr", () => {
    const r = ok(2);
    if (isOk(r)) {
      expect(r.value).toBe(2);
    }
    const e = err("boom");
    if (isErr(e)) {
      expect(e.error).toBe("boom");
    }
  });

  it("maps the value when ok and leaves errors alone", () => {
    expect(map(ok(2), (v) => v * 3)).toEqual(ok(6));
    expect(
      map(err("x") as unknown as ReturnType<typeof ok<number>>, (v) => v * 3),
    ).toEqual(err("x") as unknown as ReturnType<typeof ok<number>>);
  });

  it("maps the error when err and leaves values alone", () => {
    expect(
      mapErr(err("x") as unknown as ReturnType<typeof err<string>>, (e) => `!${e}`),
    ).toEqual(err("!x"));
    expect(
      mapErr(ok(1) as unknown as ReturnType<typeof err<string>>, (e) => `!${e}`).ok,
    ).toBe(true);
  });

  it("falls back to default on err", () => {
    expect(unwrapOr(err("x") as unknown as ReturnType<typeof ok<number>>, 99)).toBe(99);
    expect(unwrapOr(ok(7), 99)).toBe(7);
  });

  it("flatMaps the value when ok and passes through errors", () => {
    expect(flatMap(ok(3), (v) => ok(v * 2))).toEqual(ok(6));
    const e = flatMap(err("e") as unknown as ReturnType<typeof ok<number>>, (v) => ok(v * 2));
    expect(e.ok).toBe(false);
    if (e.ok) return;
    expect(e.error).toBe("e");
  });
});
