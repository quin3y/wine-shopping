import { Wine } from "./types";

/** Normalize color values to a standard set */
export function normalizeColor(color: string): string {
  const lower = color.toLowerCase().trim();
  if (lower.includes("red") || lower === "rouge") return "Red";
  if (lower.includes("white") || lower === "blanc") return "White";
  if (lower.includes("rose") || lower === "rosé") return "Rosé";
  if (lower.includes("sparkling")) return "Sparkling";
  if (lower.includes("sweet")) return "Sweet";
  if (lower.includes("orange")) return "Orange";
  if (lower.includes("off-white")) return "Off-White";
  return color;
}

/** Get display color for wine type */
export function getColorBadge(color: string): { bg: string; text: string; dot: string } {
  const norm = normalizeColor(color);
  switch (norm) {
    case "Red":
      return { bg: "bg-red-50", text: "text-red-800", dot: "bg-red-500" };
    case "White":
      return { bg: "bg-amber-50", text: "text-amber-800", dot: "bg-amber-400" };
    case "Rosé":
      return { bg: "bg-pink-50", text: "text-pink-800", dot: "bg-pink-400" };
    case "Sparkling":
      return { bg: "bg-yellow-50", text: "text-yellow-800", dot: "bg-yellow-400" };
    case "Sweet":
      return { bg: "bg-orange-50", text: "text-orange-800", dot: "bg-orange-400" };
    case "Orange":
      return { bg: "bg-orange-50", text: "text-orange-800", dot: "bg-orange-500" };
    case "Off-White":
      return { bg: "bg-lime-50", text: "text-lime-800", dot: "bg-lime-400" };
    default:
      return { bg: "bg-gray-50", text: "text-gray-800", dot: "bg-gray-400" };
  }
}

/** Get unique sorted values from wines for a bilingual field */
export function getUniqueValues(wines: Wine[], field: keyof Wine): string[] {
  const values = new Set<string>();
  for (const w of wines) {
    const val = w[field];
    if (val && typeof val === "object" && "en" in val) {
      const norm = field === "color" ? normalizeColor(val.en) : val.en;
      if (norm) values.add(norm);
    }
  }
  return Array.from(values).sort();
}

/** Format price in CNY */
export function formatPrice(price: number | null): string {
  if (price === null) return "—";
  return `¥${price.toLocaleString()}`;
}

/** Get price range from wines */
export function getPriceRange(wines: Wine[]): [number, number] {
  const prices = wines
    .map((w) => w.tradePrice)
    .filter((p): p is number => p !== null);
  return [Math.min(...prices), Math.max(...prices)];
}

/** Compute top varieties (by count), returning at most `limit` */
export function getTopVarieties(wines: Wine[], limit: number = 20): string[] {
  const counts = new Map<string, number>();
  for (const w of wines) {
    const v = w.variety.en;
    if (v) {
      // Some varieties have percentages like "48.6%美乐\n8.2%品丽珠..."
      // Use the full string as-is if it doesn't contain % signs
      if (!v.includes("%")) {
        counts.set(v, (counts.get(v) || 0) + 1);
      }
    }
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name]) => name);
}
