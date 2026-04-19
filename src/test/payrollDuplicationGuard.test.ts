import { describe, expect, it } from "vitest";
import { stripDerivedRubricsFromPayload } from "@/lib/payrollDuplicationGuard";

describe("stripDerivedRubricsFromPayload", () => {
  it("remove rubricas derivadas mesmo quando chegam no payload de duplicação", () => {
    const derivedRubricIds = ["r-der-1", "r-der-2", "r-der-3"];

    const sourcePayload = {
      "r-base-1": 1500,
      "r-base-2": 200,
      "r-der-1": 1700,
      "r-der-2": 300,
      "r-der-3": 1400,
    };

    const duplicatedPayload = stripDerivedRubricsFromPayload(sourcePayload, derivedRubricIds);

    expect(duplicatedPayload).toEqual({
      "r-base-1": 1500,
      "r-base-2": 200,
    });
  });

  it("retorna payload vazio quando só existem rubricas derivadas", () => {
    const derivedRubricIds = ["d1", "d2", "d3"];
    const sourcePayload = {
      d1: 1,
      d2: 2,
      d3: 3,
    };

    expect(stripDerivedRubricsFromPayload(sourcePayload, derivedRubricIds)).toEqual({});
  });
});
