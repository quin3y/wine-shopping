export interface BilingualText {
  zh: string;
  en: string;
}

export interface VivinoTaste {
  acidity: number | null;
  sweetness: number | null;
  tannin: number | null;
  intensity: number | null;
  fizziness: number | null;
}

export interface VivinoData {
  rating: number | null;
  ratingsCount: number | null;
  taste: VivinoTaste | null;
  flavors: string[] | null;
  imageUrl: string | null;
  vivinoUrl: string | null;
  vivinoWineName?: string;
}

export interface Wine {
  id: string;
  country: BilingualText;
  region: BilingualText;
  appellation: BilingualText;
  winery: BilingualText;
  name: BilingualText;
  variety: BilingualText;
  color: BilingualText;
  classification: string | null;
  tradePrice: number | null;
  retailPrice: number | null;
  isNew: boolean;
  vivino: VivinoData | null;
}

export type SortField = "retailPrice" | "tradePrice" | "rating" | "name";
export type SortDirection = "asc" | "desc";

export interface Filters {
  search: string;
  countries: string[];
  colors: string[];
  varieties: string[];
  priceRange: [number, number];
  ratingRange: [number, number];
}
