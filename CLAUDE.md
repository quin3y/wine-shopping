# Wine Shopping

556 款葡萄酒的展示网站，数据来自 Excel 酒单 + Vivino 非官方 API。

## 技术栈

- **前端**: Next.js 14 (App Router) + Tailwind CSS + TypeScript
- **数据**: 静态 JSON (`data/wines.json`)，556 条，无数据库
- **部署**: Vercel

## 项目结构

```
scripts/fetch_vivino.py          # Vivino 数据抓取（curl + explore API + 模糊匹配）
scripts/fetch_vivino_browser.py  # Playwright 方案（已弃用，WAF 拦截）
data/wines.json                  # 完整酒款数据（Excel + Vivino 合并）
src/app/page.tsx                 # 主页面（客户端组件，筛选/排序/搜索）
src/app/types.ts                 # TypeScript 类型定义
src/app/utils.ts                 # 工具函数（颜色标准化、价格格式化等）
src/app/layout.tsx               # 根布局
src/app/globals.css              # 全局样式 + CSS 变量
wine list 2026.xlsx              # 原始 Excel 酒单
```

## 常用命令

```bash
npm run dev                              # 本地开发 http://localhost:3000
npm run build                            # 生产构建
python scripts/fetch_vivino.py --parse-only  # 仅解析 Excel → JSON
python scripts/fetch_vivino.py           # 抓取 Vivino 数据（增量，跳过已有）
```

## 数据说明

- Excel 字段为 `中文\nEnglish` 双语格式，解析后拆为 `{zh, en}`
- Vivino 数据通过 explore API 按国家+酒类分组浏览，模糊匹配酒庄名（60%权重）+ 酒名（40%权重）
- 当前 360/556 款有 Vivino 数据，剩余为小众酒庄或香槟
- `vivino` 字段为 `null` 表示未匹配到
