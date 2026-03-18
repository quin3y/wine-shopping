"use client";

import { useState, useMemo, useCallback } from "react";
import winesData from "../../data/wines.json";
import { Wine, SortField, SortDirection, Filters } from "./types";
import {
  normalizeColor,
  getColorBadge,
  getUniqueValues,
  formatPrice,
  getPriceRange,
  getTopVarieties,
} from "./utils";

const wines = winesData as Wine[];

// Precompute filter options
const countries = getUniqueValues(wines, "country");
const colors = getUniqueValues(wines, "color");
const topVarieties = getTopVarieties(wines, 20);
const [minPrice, maxPrice] = getPriceRange(wines);

const defaultFilters: Filters = {
  search: "",
  countries: [],
  colors: [],
  varieties: [],
  priceRange: [minPrice, maxPrice],
  ratingRange: [0, 5],
};

export default function Home() {
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [sortField, setSortField] = useState<SortField>("retailPrice");
  const [sortDir, setSortDir] = useState<SortDirection>("asc");
  const [showFilters, setShowFilters] = useState(true);

  const updateFilter = useCallback(
    <K extends keyof Filters>(key: K, value: Filters[K]) => {
      setFilters((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const toggleArrayFilter = useCallback(
    (key: "countries" | "colors" | "varieties", value: string) => {
      setFilters((prev) => {
        const arr = prev[key];
        const next = arr.includes(value)
          ? arr.filter((v) => v !== value)
          : [...arr, value];
        return { ...prev, [key]: next };
      });
    },
    []
  );

  const resetFilters = useCallback(() => setFilters(defaultFilters), []);

  const filtered = useMemo(() => {
    let result = wines;

    // Search
    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter(
        (w) =>
          w.name.zh.toLowerCase().includes(q) ||
          w.name.en.toLowerCase().includes(q) ||
          w.winery.zh.toLowerCase().includes(q) ||
          w.winery.en.toLowerCase().includes(q) ||
          w.id.toLowerCase().includes(q)
      );
    }

    // Country filter
    if (filters.countries.length > 0) {
      result = result.filter((w) => filters.countries.includes(w.country.en));
    }

    // Color filter
    if (filters.colors.length > 0) {
      result = result.filter((w) =>
        filters.colors.includes(normalizeColor(w.color.en))
      );
    }

    // Variety filter
    if (filters.varieties.length > 0) {
      result = result.filter((w) => filters.varieties.includes(w.variety.en));
    }

    // Price filter
    if (
      filters.priceRange[0] > minPrice ||
      filters.priceRange[1] < maxPrice
    ) {
      result = result.filter(
        (w) =>
          w.retailPrice !== null &&
          w.retailPrice >= filters.priceRange[0] &&
          w.retailPrice <= filters.priceRange[1]
      );
    }

    // Rating filter
    if (filters.ratingRange[0] > 0 || filters.ratingRange[1] < 5) {
      result = result.filter(
        (w) =>
          w.vivino?.rating != null &&
          w.vivino.rating >= filters.ratingRange[0] &&
          w.vivino.rating <= filters.ratingRange[1]
      );
    }

    // Sort (nulls always last)
    result = [...result].sort((a, b) => {
      let aVal: number | null = null;
      let bVal: number | null = null;
      switch (sortField) {
        case "retailPrice":
          aVal = a.retailPrice;
          bVal = b.retailPrice;
          break;
        case "tradePrice":
          aVal = a.tradePrice;
          bVal = b.tradePrice;
          break;
        case "rating":
          aVal = a.vivino?.rating ?? null;
          bVal = b.vivino?.rating ?? null;
          break;
        case "name":
          return sortDir === "asc"
            ? a.name.zh.localeCompare(b.name.zh, "zh")
            : b.name.zh.localeCompare(a.name.zh, "zh");
      }
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      const cmp = aVal - bVal;
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [filters, sortField, sortDir]);

  const activeFilterCount =
    filters.countries.length +
    filters.colors.length +
    filters.varieties.length +
    (filters.search ? 1 : 0) +
    (filters.priceRange[0] > minPrice || filters.priceRange[1] < maxPrice
      ? 1
      : 0) +
    (filters.ratingRange[0] > 0 || filters.ratingRange[1] < 5 ? 1 : 0);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-[#722F37] text-white shadow-lg">
        <div className="max-w-[1800px] mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                🍷 精选酒单
              </h1>
              <p className="text-sm text-white/70 mt-0.5">
                {filtered.length} / {wines.length} 款葡萄酒
              </p>
            </div>
            <div className="flex items-center gap-3">
              {/* Search */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="搜索酒名、酒庄..."
                  value={filters.search}
                  onChange={(e) => updateFilter("search", e.target.value)}
                  className="w-48 sm:w-72 pl-9 pr-3 py-2 rounded-lg bg-white/15 border border-white/20 text-white placeholder-white/50 text-sm focus:outline-none focus:bg-white/20 focus:border-white/40 transition-colors"
                />
                <svg
                  className="absolute left-2.5 top-2.5 w-4 h-4 text-white/50"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
              {/* Filter toggle */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/15 border border-white/20 text-sm hover:bg-white/25 transition-colors"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                  />
                </svg>
                筛选
                {activeFilterCount > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 rounded-full bg-white/30 text-xs font-medium">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-[1800px] mx-auto flex">
        {/* Filter sidebar */}
        {showFilters && (
          <aside className="w-64 shrink-0 sticky top-[72px] h-[calc(100vh-72px)] overflow-y-auto p-4 bg-white border-r border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-700">筛选条件</h2>
              {activeFilterCount > 0 && (
                <button
                  onClick={resetFilters}
                  className="text-xs text-[#722F37] hover:underline"
                >
                  清除全部
                </button>
              )}
            </div>

            {/* Sort */}
            <FilterSection title="排序">
              <select
                value={`${sortField}-${sortDir}`}
                onChange={(e) => {
                  const [f, d] = e.target.value.split("-") as [
                    SortField,
                    SortDirection,
                  ];
                  setSortField(f);
                  setSortDir(d);
                }}
                className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-md bg-white focus:outline-none focus:border-[#722F37]"
              >
                <option value="retailPrice-asc">零售价 ↑</option>
                <option value="retailPrice-desc">零售价 ↓</option>
                <option value="tradePrice-asc">经销价 ↑</option>
                <option value="tradePrice-desc">经销价 ↓</option>
                <option value="rating-desc">Vivino 评分 ↓</option>
                <option value="rating-asc">Vivino 评分 ↑</option>
                <option value="name-asc">酒名 A-Z</option>
                <option value="name-desc">酒名 Z-A</option>
              </select>
            </FilterSection>

            {/* Country */}
            <FilterSection title="国家 Country">
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {countries.map((c) => (
                  <CheckboxItem
                    key={c}
                    label={c}
                    checked={filters.countries.includes(c)}
                    count={
                      wines.filter((w) => w.country.en === c).length
                    }
                    onChange={() => toggleArrayFilter("countries", c)}
                  />
                ))}
              </div>
            </FilterSection>

            {/* Color */}
            <FilterSection title="类型 Color">
              <div className="space-y-1">
                {colors.map((c) => {
                  const badge = getColorBadge(c);
                  return (
                    <CheckboxItem
                      key={c}
                      label={c}
                      checked={filters.colors.includes(c)}
                      count={
                        wines.filter(
                          (w) => normalizeColor(w.color.en) === c
                        ).length
                      }
                      onChange={() => toggleArrayFilter("colors", c)}
                      dotColor={badge.dot}
                    />
                  );
                })}
              </div>
            </FilterSection>

            {/* Variety */}
            <FilterSection title="葡萄品种 Variety">
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {topVarieties.map((v) => (
                  <CheckboxItem
                    key={v}
                    label={v}
                    checked={filters.varieties.includes(v)}
                    count={
                      wines.filter((w) => w.variety.en === v).length
                    }
                    onChange={() => toggleArrayFilter("varieties", v)}
                  />
                ))}
              </div>
            </FilterSection>

            {/* Price range */}
            <FilterSection title={`零售价 ¥${filters.priceRange[0]}–¥${filters.priceRange[1]}`}>
              <div className="px-1 space-y-2">
                <input
                  type="range"
                  min={minPrice}
                  max={maxPrice}
                  step={10}
                  value={filters.priceRange[0]}
                  onChange={(e) =>
                    updateFilter("priceRange", [
                      Number(e.target.value),
                      filters.priceRange[1],
                    ])
                  }
                  className="w-full accent-[#722F37]"
                />
                <input
                  type="range"
                  min={minPrice}
                  max={maxPrice}
                  step={10}
                  value={filters.priceRange[1]}
                  onChange={(e) =>
                    updateFilter("priceRange", [
                      filters.priceRange[0],
                      Number(e.target.value),
                    ])
                  }
                  className="w-full accent-[#722F37]"
                />
              </div>
            </FilterSection>
          </aside>
        )}

        {/* Main content */}
        <main className="flex-1 p-4 sm:p-6">
          {filtered.length === 0 ? (
            <div className="text-center py-20 text-gray-400">
              <p className="text-lg">没有找到匹配的酒款</p>
              <button
                onClick={resetFilters}
                className="mt-2 text-[#722F37] hover:underline text-sm"
              >
                清除筛选条件
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
              {filtered.map((wine) => (
                <WineCard key={wine.id} wine={wine} />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

/* ---- Sub-components ---- */

function FilterSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-5">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
        {title}
      </h3>
      {children}
    </div>
  );
}

function CheckboxItem({
  label,
  checked,
  count,
  onChange,
  dotColor,
}: {
  label: string;
  checked: boolean;
  count: number;
  onChange: () => void;
  dotColor?: string;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer py-0.5 group">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="w-3.5 h-3.5 rounded border-gray-300 text-[#722F37] focus:ring-[#722F37] accent-[#722F37]"
      />
      {dotColor && (
        <span className={`w-2.5 h-2.5 rounded-full ${dotColor}`} />
      )}
      <span className="text-sm text-gray-700 group-hover:text-gray-900 flex-1 truncate">
        {label}
      </span>
      <span className="text-xs text-gray-400">{count}</span>
    </label>
  );
}

function WineCard({ wine }: { wine: Wine }) {
  const badge = getColorBadge(wine.color.en);
  const normalColor = normalizeColor(wine.color.en);
  const hasVivino = wine.vivino !== null;
  const rating = wine.vivino?.rating;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow group">
      {/* Wine image or placeholder */}
      <div className={`relative ${wine.vivino?.imageUrl ? "h-48" : "h-24"} bg-gradient-to-b from-gray-50 to-gray-100 flex items-center justify-center overflow-hidden`}>
        {wine.vivino?.imageUrl ? (
          <img
            src={wine.vivino.imageUrl}
            alt={wine.name.en}
            className="h-44 object-contain group-hover:scale-105 transition-transform"
          />
        ) : (
          <div className="text-4xl opacity-15">🍷</div>
        )}
        {/* NEW badge */}
        {wine.isNew && (
          <span className="absolute top-2 left-2 px-2 py-0.5 bg-emerald-500 text-white text-xs font-bold rounded-full">
            NEW
          </span>
        )}
        {/* Rating badge */}
        {rating != null && (
          <div className="absolute top-2 right-2 bg-[#722F37] text-white px-2 py-1 rounded-lg">
            <div className="text-sm font-bold leading-none">{rating.toFixed(1)}</div>
            <div className="text-[10px] opacity-70">Vivino</div>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3.5">
        {/* Color + Classification */}
        <div className="flex items-center gap-1.5 mb-1.5">
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
            {normalColor === "Red" ? "红" : normalColor === "White" ? "白" : normalColor === "Rosé" ? "桃红" : normalColor === "Sparkling" ? "起泡" : normalColor === "Sweet" ? "甜" : normalColor === "Orange" ? "橘" : wine.color.zh}
          </span>
          {wine.classification && (
            <span className="text-xs text-gray-400 truncate">
              {wine.classification}
            </span>
          )}
        </div>

        {/* Name */}
        <h3 className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2 mb-0.5">
          {wine.name.zh}
        </h3>
        <p className="text-xs text-gray-400 line-clamp-1 mb-1.5">
          {wine.name.en}
        </p>

        {/* Winery + Region */}
        <p className="text-xs text-gray-500 mb-2 truncate">
          {wine.winery.zh} · {wine.region.zh}
          {wine.appellation.zh && wine.appellation.zh !== wine.region.zh
            ? ` · ${wine.appellation.zh}`
            : ""}
        </p>

        {/* Variety */}
        <p className="text-xs text-gray-400 mb-3 truncate">
          {wine.variety.zh}
          {wine.variety.en && wine.variety.en !== wine.variety.zh
            ? ` ${wine.variety.en}`
            : ""}
        </p>

        {/* Taste bars (if available) */}
        {wine.vivino?.taste && <TasteBars taste={wine.vivino.taste} />}

        {/* Flavors */}
        {wine.vivino?.flavors && wine.vivino.flavors.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {wine.vivino.flavors.slice(0, 4).map((f) => (
              <span
                key={f}
                className="px-1.5 py-0.5 bg-gray-50 text-gray-500 text-[10px] rounded"
              >
                {f}
              </span>
            ))}
          </div>
        )}

        {/* Prices */}
        <div className="flex items-end justify-between pt-2 border-t border-gray-100">
          <div>
            <span className="text-lg font-bold text-[#722F37]">
              {formatPrice(wine.retailPrice)}
            </span>
            {wine.tradePrice && (
              <span className="text-xs text-gray-400 ml-1.5">
                经销 {formatPrice(wine.tradePrice)}
              </span>
            )}
          </div>
          {wine.vivino?.vivinoUrl && (
            <a
              href={wine.vivino.vivinoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[#722F37]/60 hover:text-[#722F37] transition-colors"
            >
              Vivino →
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function TasteBars({ taste }: { taste: Wine["vivino"] extends null ? never : NonNullable<NonNullable<Wine["vivino"]>["taste"]> }) {
  if (!taste) return null;
  const bars: { label: string; value: number | null }[] = [
    { label: "酸度", value: taste.acidity },
    { label: "甜度", value: taste.sweetness },
    { label: "单宁", value: taste.tannin },
    { label: "酒体", value: taste.intensity },
  ];
  const hasBars = bars.some((b) => b.value != null && b.value > 0);
  if (!hasBars) return null;

  return (
    <div className="space-y-1 mb-3">
      {bars.map(
        (b) =>
          b.value != null &&
          b.value > 0 && (
            <div key={b.label} className="flex items-center gap-1.5">
              <span className="text-[10px] text-gray-400 w-6">{b.label}</span>
              <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#C5A572] rounded-full"
                  style={{ width: `${(b.value / 5) * 100}%` }}
                />
              </div>
            </div>
          )
      )}
    </div>
  );
}
