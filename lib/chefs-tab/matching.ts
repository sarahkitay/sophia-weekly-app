/**
 * Ingredient matching: exact normalized, alias, fuzzy.
 * Do not auto-apply low-confidence matches.
 */
import type { Ingredient, InvoiceLineItem } from "./types";
import type { IngredientMatch } from "./types";
import { normalizeIngredientName } from "./normalize";

/** Simple similarity: 0–1. Uses normalized strings and character overlap. */
function stringSimilarity(a: string, b: string): number {
  const na = normalizeIngredientName(a);
  const nb = normalizeIngredientName(b);
  if (na === nb) return 1;
  if (na.length === 0 || nb.length === 0) return 0;
  if (na.includes(nb) || nb.includes(na)) {
    const longer = na.length > nb.length ? na : nb;
    const shorter = na.length > nb.length ? nb : na;
    return shorter.length / longer.length;
  }
  // Levenshtein-based ratio: 1 - (distance / maxLen)
  const maxLen = Math.max(na.length, nb.length);
  const dist = levenshtein(na, nb);
  return 1 - dist / maxLen;
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[m][n];
}

const CONFIDENCE_EXACT = 1;
const CONFIDENCE_ALIAS = 0.95;
const FUZZY_THRESHOLD = 0.6;

/**
 * Find best matching ingredient for a line item. Returns matches with confidence.
 * Priority: exact normalized, alias, fuzzy above threshold.
 */
export function matchLineItemToIngredients(
  lineItem: Pick<InvoiceLineItem, "rawItemName" | "normalizedItemName">,
  ingredients: Ingredient[]
): IngredientMatch[] {
  const raw = lineItem.rawItemName || "";
  const norm = (lineItem.normalizedItemName || normalizeIngredientName(raw)).trim();
  if (!norm) return [];

  const matches: IngredientMatch[] = [];

  for (const ing of ingredients) {
    const ingNorm = ing.normalizedName;
    if (ingNorm === norm) {
      matches.push({
        ingredientId: ing.id,
        canonicalName: ing.canonicalName,
        confidence: CONFIDENCE_EXACT,
        source: "exact",
      });
      continue;
    }
    for (const alias of ing.aliases || []) {
      const aliasNorm = normalizeIngredientName(alias);
      if (aliasNorm === norm || aliasNorm === ingNorm) {
        matches.push({
          ingredientId: ing.id,
          canonicalName: ing.canonicalName,
          confidence: CONFIDENCE_ALIAS,
          source: "alias",
        });
        break;
      }
    }
  }

  if (matches.length > 0) return matches;

  for (const ing of ingredients) {
    const sim = stringSimilarity(raw, ing.canonicalName);
    if (sim >= FUZZY_THRESHOLD) {
      const aliasSim = Math.max(...(ing.aliases || []).map((a) => stringSimilarity(raw, a)), 0);
      const confidence = Math.max(sim, aliasSim);
      matches.push({
        ingredientId: ing.id,
        canonicalName: ing.canonicalName,
        confidence: Math.round(confidence * 100) / 100,
        source: "fuzzy",
      });
    }
  }

  matches.sort((a, b) => b.confidence - a.confidence);
  return matches.slice(0, 5);
}

export function isHighConfidence(confidence: number): boolean {
  return confidence >= 0.9;
}
