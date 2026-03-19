"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
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
  const [sortField, setSortField] = useState<SortField>("tradePrice");
  const [sortDir, setSortDir] = useState<SortDirection>("asc");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const asideRef = useRef<HTMLElement>(null);

  // Scrollbar auto-hide for sidebar
  useEffect(() => {
    const aside = asideRef.current;
    if (!aside) return;
    let timer: ReturnType<typeof setTimeout>;
    const onScroll = () => {
      aside.classList.add("is-scrolling");
      clearTimeout(timer);
      timer = setTimeout(() => aside.classList.remove("is-scrolling"), 800);
    };
    aside.addEventListener("scroll", onScroll, true);
    return () => {
      aside.removeEventListener("scroll", onScroll, true);
      clearTimeout(timer);
    };
  }, []);

  // Close drawer on resize to desktop
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const handler = () => { if (mq.matches) setDrawerOpen(false); };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

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

    if (filters.countries.length > 0) {
      result = result.filter((w) => filters.countries.includes(w.country.en));
    }

    if (filters.colors.length > 0) {
      result = result.filter((w) =>
        filters.colors.includes(normalizeColor(w.color.en))
      );
    }

    if (filters.varieties.length > 0) {
      result = result.filter((w) => filters.varieties.includes(w.variety.en));
    }

    if (
      filters.priceRange[0] > minPrice ||
      filters.priceRange[1] < maxPrice
    ) {
      result = result.filter(
        (w) =>
          w.tradePrice !== null &&
          w.tradePrice >= filters.priceRange[0] &&
          w.tradePrice <= filters.priceRange[1]
      );
    }

    if (filters.ratingRange[0] > 0 || filters.ratingRange[1] < 5) {
      result = result.filter(
        (w) =>
          w.vivino?.rating != null &&
          w.vivino.rating >= filters.ratingRange[0] &&
          w.vivino.rating <= filters.ratingRange[1]
      );
    }

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

  // Collect active filter chips
  const activeChips: { label: string; onRemove: () => void }[] = [];
  for (const c of filters.countries) {
    activeChips.push({ label: c, onRemove: () => toggleArrayFilter("countries", c) });
  }
  for (const c of filters.colors) {
    activeChips.push({ label: c, onRemove: () => toggleArrayFilter("colors", c) });
  }
  for (const v of filters.varieties) {
    activeChips.push({ label: v, onRemove: () => toggleArrayFilter("varieties", v) });
  }
  if (filters.priceRange[0] > minPrice || filters.priceRange[1] < maxPrice) {
    activeChips.push({
      label: `¥${filters.priceRange[0]}–¥${filters.priceRange[1]}`,
      onRemove: () => updateFilter("priceRange", [minPrice, maxPrice]),
    });
  }
  if (filters.ratingRange[0] > 0 || filters.ratingRange[1] < 5) {
    activeChips.push({
      label: `评分 ${filters.ratingRange[0].toFixed(1)}–${filters.ratingRange[1].toFixed(1)}`,
      onRemove: () => updateFilter("ratingRange", [0, 5]),
    });
  }

  const filterPanel = (
    <div className="space-y-5">
      {/* Price range */}
      <FilterSection title={`经销价 ¥${filters.priceRange[0]}–¥${filters.priceRange[1]}`}>
        <div className="px-1 space-y-2">
          <div>
            <div className="flex justify-between text-[10px] text-gray-400 mb-0.5">
              <span>最低价</span>
              <span>¥{filters.priceRange[0]}</span>
            </div>
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
          </div>
          <div>
            <div className="flex justify-between text-[10px] text-gray-400 mb-0.5">
              <span>最高价</span>
              <span>¥{filters.priceRange[1]}</span>
            </div>
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
        </div>
      </FilterSection>

      {/* Rating range */}
      <FilterSection title={`Vivino 评分 ${filters.ratingRange[0].toFixed(1)}–${filters.ratingRange[1].toFixed(1)}`}>
        <div className="px-1 space-y-2">
          <div>
            <div className="flex justify-between text-[10px] text-gray-400 mb-0.5">
              <span>最低分</span>
              <span>{filters.ratingRange[0].toFixed(1)}</span>
            </div>
            <input
              type="range"
              min={0}
              max={5}
              step={0.1}
              value={filters.ratingRange[0]}
              onChange={(e) =>
                updateFilter("ratingRange", [
                  Number(e.target.value),
                  filters.ratingRange[1],
                ])
              }
              className="w-full accent-[#722F37]"
            />
          </div>
          <div>
            <div className="flex justify-between text-[10px] text-gray-400 mb-0.5">
              <span>最高分</span>
              <span>{filters.ratingRange[1].toFixed(1)}</span>
            </div>
            <input
              type="range"
              min={0}
              max={5}
              step={0.1}
              value={filters.ratingRange[1]}
              onChange={(e) =>
                updateFilter("ratingRange", [
                  filters.ratingRange[0],
                  Number(e.target.value),
                ])
              }
              className="w-full accent-[#722F37]"
            />
          </div>
        </div>
      </FilterSection>

      {/* Country */}
      <FilterSection title="国家 Country">
        <div className="space-y-1">
          {countries.map((c) => (
            <CheckboxItem
              key={c}
              label={c}
              checked={filters.countries.includes(c)}
              count={wines.filter((w) => w.country.en === c).length}
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
                  wines.filter((w) => normalizeColor(w.color.en) === c).length
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
        <div className="space-y-1">
          {topVarieties.map((v) => (
            <CheckboxItem
              key={v}
              label={v}
              checked={filters.varieties.includes(v)}
              count={wines.filter((w) => w.variety.en === v).length}
              onChange={() => toggleArrayFilter("varieties", v)}
            />
          ))}
        </div>
      </FilterSection>

    </div>
  );

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Header */}
      <header className="shrink-0 bg-[#722F37] text-white shadow-lg z-30">
        <div className="max-w-[1800px] mx-auto px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-lg font-bold tracking-tight shrink-0">
              🍷 接着奏乐接着舞
            </h1>
            <div className="relative flex-1 max-w-sm">
              <input
                type="text"
                placeholder="搜索酒名、酒庄..."
                value={filters.search}
                onChange={(e) => updateFilter("search", e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-white/15 border border-white/20 text-white placeholder-white/50 text-sm focus:outline-none focus:bg-white/20 focus:border-white/40 transition-colors"
              />
              <svg
                className="absolute left-2.5 top-2 w-4 h-4 text-white/50"
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
            {/* Mobile filter button */}
            <button
              onClick={() => setDrawerOpen(true)}
              className="md:hidden flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/15 border border-white/20 text-sm shrink-0"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              筛选
              {activeFilterCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-white/30 text-xs font-medium">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-[1800px] w-full mx-auto flex flex-1 overflow-hidden">
        {/* Desktop sidebar */}
        <aside ref={asideRef} className="hidden md:block w-64 shrink-0 overflow-y-auto p-4 bg-white border-r border-gray-200">
          {filterPanel}
        </aside>

        {/* Mobile drawer overlay */}
        {drawerOpen && (
          <div className="fixed inset-0 z-40 md:hidden">
            <div
              className="absolute inset-0 bg-black/40"
              onClick={() => setDrawerOpen(false)}
            />
            <div className="absolute left-0 top-0 bottom-0 w-72 bg-white shadow-xl overflow-y-auto p-4 animate-slide-in">
              <div className="flex items-center justify-between mb-4">
                <span className="font-semibold text-gray-700">筛选</span>
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="p-1 rounded-md hover:bg-gray-100"
                >
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              {activeFilterCount > 0 && (
                <div className="mb-4">
                  <button
                    onClick={resetFilters}
                    className="text-xs text-[#722F37] hover:underline"
                  >
                    清除全部筛选
                  </button>
                </div>
              )}
              {filterPanel}
            </div>
          </div>
        )}

        {/* Main content */}
        <main className="flex-1 overflow-y-auto">
          {/* Toolbar: result count + sort */}
          <div className="sticky top-0 z-10 bg-[#F5F0EB] border-b border-gray-200 px-4 sm:px-6 py-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="text-sm text-gray-500 shrink-0">
                {filtered.length} 款
              </span>
              {/* Active filter chips */}
              {activeChips.length > 0 && (
                <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
                  {activeChips.map((chip, i) => (
                    <button
                      key={i}
                      onClick={chip.onRemove}
                      className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-gray-200 rounded-full text-xs text-gray-600 shrink-0 hover:border-[#722F37] hover:text-[#722F37] transition-colors"
                    >
                      {chip.label}
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  ))}
                  <button
                    onClick={resetFilters}
                    className="text-xs text-[#722F37] hover:underline shrink-0"
                  >
                    清除
                  </button>
                </div>
              )}
            </div>
            <select
              value={`${sortField}-${sortDir}`}
              onChange={(e) => {
                const [f, d] = e.target.value.split("-") as [SortField, SortDirection];
                setSortField(f);
                setSortDir(d);
              }}
              className="shrink-0 px-2 py-1 text-xs border border-gray-200 rounded-md bg-white focus:outline-none focus:border-[#722F37]"
            >
              <option value="tradePrice-asc">经销价 ↑</option>
              <option value="tradePrice-desc">经销价 ↓</option>
              <option value="rating-desc">评分 ↓</option>
              <option value="rating-asc">评分 ↑</option>
              <option value="name-asc">酒名 A-Z</option>
              <option value="name-desc">酒名 Z-A</option>
            </select>
          </div>

          {/* Wine grid */}
          <div className="p-4 sm:p-6">
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
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-4">
                {filtered.map((wine) => (
                  <WineCard key={wine.id} wine={wine} />
                ))}
              </div>
            )}
          </div>
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
    <div>
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
  const rating = wine.vivino?.rating;
  const colorLabel = normalColor === "Red" ? "红" : normalColor === "White" ? "白" : normalColor === "Rosé" ? "桃红" : normalColor === "Sparkling" ? "起泡" : normalColor === "Sweet" ? "甜" : normalColor === "Orange" ? "橘" : wine.color.zh;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 group flex flex-col">
      {/* Wine image or placeholder */}
      <div className="relative h-36 sm:h-48 bg-gradient-to-b from-gray-50 to-gray-100 flex items-center justify-center overflow-hidden">
        {wine.vivino?.imageUrl ? (
          <img
            src={wine.vivino.imageUrl}
            alt={wine.name.en}
            className="h-32 sm:h-44 object-contain group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="flex flex-col items-center gap-1 opacity-30">
            <div className="text-3xl sm:text-4xl">🍷</div>
            <div className="text-[10px] sm:text-xs text-gray-500">暂无图片</div>
          </div>
        )}
        {/* NEW badge */}
        {wine.isNew && (
          <span className="absolute top-2 left-2 px-1.5 sm:px-2 py-0.5 bg-emerald-500 text-white text-[10px] sm:text-xs font-bold rounded-full">
            NEW
          </span>
        )}
        {/* Rating badge */}
        {rating != null && (
          <div className="absolute top-2 right-2 bg-[#722F37] text-white px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-lg text-center">
            <div className="text-xs sm:text-sm font-bold leading-none">{rating.toFixed(1)}</div>
            <div className="text-[8px] sm:text-[10px] opacity-70">Vivino</div>
          </div>
        )}
        {/* Color badge on image */}
        <span
          className={`absolute bottom-2 left-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] sm:text-xs font-medium ${badge.bg} ${badge.text}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
          {colorLabel}
        </span>
      </div>

      {/* Info */}
      <div className="p-2.5 sm:p-3.5 flex flex-col flex-1">
        {/* Name */}
        <h3 className="text-xs sm:text-sm font-semibold text-gray-900 leading-snug line-clamp-2 mb-0.5">
          {wine.name.en}
        </h3>
        <p className="text-[10px] sm:text-xs text-gray-400 line-clamp-1 mb-1">
          {wine.name.zh}
        </p>

        {/* Winery + Region */}
        <p className="text-[10px] sm:text-xs text-gray-500 mb-1.5 truncate">
          {wine.winery.zh} · {wine.region.zh}
          {wine.appellation.zh && wine.appellation.zh !== wine.region.zh
            ? ` · ${wine.appellation.zh}`
            : ""}
        </p>

        {/* Variety */}
        <p className="text-[10px] sm:text-xs text-gray-400 mb-2 truncate">
          {wine.variety.zh}
          {wine.variety.en && wine.variety.en !== wine.variety.zh
            ? ` ${wine.variety.en}`
            : ""}
        </p>

        {/* Taste bars */}
        {wine.vivino?.taste && <TasteBars taste={wine.vivino.taste} />}

        {/* Flavors */}
        {wine.vivino?.flavors && wine.vivino.flavors.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2 sm:mb-3">
            {wine.vivino.flavors.slice(0, 3).map((f) => (
              <span
                key={f}
                className="px-1.5 py-0.5 bg-gray-50 text-gray-500 text-[9px] sm:text-[10px] rounded"
              >
                {f}
              </span>
            ))}
          </div>
        )}

        {/* Spacer to push price to bottom */}
        <div className="flex-1" />

        {/* Prices */}
        <div className="flex items-end justify-between pt-2 border-t border-gray-100">
          <div>
            <span className="text-sm sm:text-lg font-bold text-[#722F37]">
              {formatPrice(wine.tradePrice)}
            </span>
            {wine.retailPrice && (
              <span className="text-[10px] sm:text-xs text-gray-400 ml-1">
                零售 {formatPrice(wine.retailPrice)}
              </span>
            )}
          </div>
          {wine.vivino?.vivinoUrl && (
            <a
              href={wine.vivino.vivinoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] sm:text-xs text-[#722F37]/60 hover:text-[#722F37] transition-colors"
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
    <div className="space-y-1 mb-2 sm:mb-3">
      {bars.map(
        (b) =>
          b.value != null &&
          b.value > 0 && (
            <div key={b.label} className="flex items-center gap-1.5">
              <span className="text-[9px] sm:text-[10px] text-gray-400 w-5 sm:w-6">{b.label}</span>
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
