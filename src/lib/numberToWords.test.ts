import { describe, expect, it } from "vitest";
import { valorPorExtenso } from "./numberToWords";

describe("valorPorExtenso", () => {
  it.each([
    [1, "um real"],
    [2, "dois reais"],
    [0.01, "um centavo"],
    [10.5, "dez reais e cinquenta centavos"],
    [833.33, "oitocentos e trinta e três reais e trinta e três centavos"],
    [1200, "mil e duzentos reais"],
    [1350, "mil e trezentos e cinquenta reais"],
  ])("gera texto pt-BR estável para R$ %s", (value, expected) => {
    expect(valorPorExtenso(value)).toBe(expected);
  });
});
