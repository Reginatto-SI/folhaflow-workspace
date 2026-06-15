// Comentário: utilitário isolado de conversão de valor monetário em texto por extenso
// (pt-BR). Usado APENAS para exibição no recibo de pagamento — não interfere em
// nenhum cálculo da folha.
// Comentário: vocabulário local e determinístico; não usa API externa, DOM, navegador ou locale ambíguo.

const UNIDADES = [
  "", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove",
  "dez", "onze", "doze", "treze", "catorze", "quinze", "dezesseis",
  "dezessete", "dezoito", "dezenove",
];
const DEZENAS = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
const CENTENAS = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];

function trecentos(n: number): string {
  if (n === 0) return "";
  if (n === 100) return "cem";
  const c = Math.floor(n / 100);
  const r = n % 100;
  const parts: string[] = [];
  if (c > 0) parts.push(CENTENAS[c]);
  if (r > 0) {
    if (r < 20) parts.push(UNIDADES[r]);
    else {
      const d = Math.floor(r / 10);
      const u = r % 10;
      parts.push(u > 0 ? `${DEZENAS[d]} e ${UNIDADES[u]}` : DEZENAS[d]);
    }
  }
  return parts.join(" e ");
}

function inteiroPorExtenso(n: number): string {
  if (n === 0) return "zero";
  const milhoes = Math.floor(n / 1_000_000);
  const milhares = Math.floor((n % 1_000_000) / 1000);
  const resto = n % 1000;
  const parts: string[] = [];
  if (milhoes > 0) parts.push(milhoes === 1 ? "um milhão" : `${trecentos(milhoes)} milhões`);
  if (milhares > 0) parts.push(milhares === 1 ? "mil" : `${trecentos(milhares)} mil`);
  if (resto > 0) parts.push(trecentos(resto));
  return parts.join(" e ");
}

export function valorPorExtenso(valor: number): string {
  const v = Math.max(0, Math.round(Number(valor || 0) * 100) / 100);
  const inteiro = Math.floor(v);
  const centavos = Math.round((v - inteiro) * 100);

  const partes: string[] = [];
  if (inteiro > 0) {
    partes.push(`${inteiroPorExtenso(inteiro)} ${inteiro === 1 ? "real" : "reais"}`);
  }
  if (centavos > 0) {
    if (partes.length > 0) partes.push("e");
    partes.push(`${inteiroPorExtenso(centavos)} ${centavos === 1 ? "centavo" : "centavos"}`);
  }
  if (partes.length === 0) return "zero real";
  return partes.join(" ");
}
