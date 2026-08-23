import type { ItemCategory } from "./schema";

const RULES: Array<[ItemCategory, RegExp]> = [
  ["shoes", /\b(trainers?|sneakers?|shoes?|boots?|loafers?|sandals?|slides?|clogs?|mules?|runners?|oxfords?|derby|derbies|brogues?|espadrilles?|slippers?|heels?|pumps?|footwear)\b/i],
  ["jacket", /\b(jackets?|coats?|parkas?|overshirts?|gilets?|blazers?|anoraks?|windbreakers?|puffers?|trench|bombers?|shackets?|overcoats?|raincoats?|vests?|waistcoats?|fleece jacket|outerwear)\b/i],
  ["trousers", /\b(trousers?|jeans|pants|shorts|chinos?|joggers?|cargos?|sweatpants|slacks|leggings|culottes|skirts?|denim|track ?pants|bottoms)\b/i],
  ["accessory", /\b(bags?|backpacks?|totes?|caps?|hats?|beanies?|belts?|wallets?|scarf|scarves|socks?|sunglasses|glasses|watch(es)?|gloves?|jewell?ery|necklaces?|rings?|bracelets?|earrings?|keyrings?|umbrellas?|ties?|bandanas?|balaclavas?|phone case|card ?holder|pouch|crossbody|bucket hat)\b/i],
  ["top", /\b(t-?shirts?|tees?|shirts?|jumpers?|sweaters?|hoodies?|sweatshirts?|tops?|polos?|cardigans?|fleeces?|knits?|knitwear|crewnecks?|pullovers?|blouses?|tank|vest top|dress(es)?|longsleeve|long sleeve|turtlenecks?|rollnecks?|jerseys?)\b/i],
];

/** Deterministic keyword guess from a product name / URL slug. "other" when unsure. */
export function guessCategory(...texts: Array<string | null | undefined>): ItemCategory {
  const text = texts.filter(Boolean).join(" ");
  if (!text) return "other";
  for (const [cat, re] of RULES) if (re.test(text)) return cat;
  return "other";
}
