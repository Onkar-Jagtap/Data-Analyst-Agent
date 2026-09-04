# Data Studio by PJA

> **Enterprise-Grade AI Exploratory Data Analysis & Deterministic Business Intelligence**  
> Built for reliable, privacy-first corporate analytics with zero hallucination.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.0-61dafb.svg)](https://reactjs.org/)
[![Express](https://img.shields.io/badge/Express-4.21-lightgrey.svg)](https://expressjs.com/)
[![Plotly.js](https://img.shields.io/badge/Plotly.js-Interactive_Charts-blueviolet.svg)](https://plotly.com/javascript/)
[![Audit Suite](https://img.shields.io/badge/Tests-43%2F43_Passing_(100%25)-brightgreen.svg)](scripts/audit_suite.ts)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## Table of Contents

- [Overview](#overview)
- [How It Works (Architecture)](#how-it-works-architecture)
  - [Zero-Hallucination Math Engine](#1-zero-hallucination-math-engine)
  - [Privacy Shield & Air-Gapped Metadata](#2-privacy-shield--air-gapped-metadata)
  - [Session Isolation & Multi-Tenancy](#3-session-isolation--multi-tenancy)
  - [Automated Multi-Type Profiler](#4-automated-multi-type-profiler)
  - [Formula Engine Sandbox & Security](#5-formula-engine-sandbox--security)
- [Key Features](#key-features)
  - [Executive Strategic Report & Action Plan ("What Needs To Be Done")](#1-executive-strategic-report--action-plan-what-needs-to-be-done)
  - [Executive Financial & Business Calculations](#2-executive-financial--business-calculations)
  - [Interactive Visual Studio (10 Chart Engines)](#3-interactive-visual-studio-10-chart-engines)
  - [Natural Language AI Analyst & Pinning Workflow](#4-natural-language-ai-analyst--pinning-workflow)
  - [Data Quality Audit & Business Rule Assertions](#5-data-quality-audit--business-rule-assertions)
  - [Data Transformation & Feature Engineering](#6-data-transformation--feature-engineering)
  - [Reproducible Python & SQL Export](#7-reproducible-python--sql-export)
- [Multi-Dataset Test Suite (43/43 Passing)](#multi-dataset-test-suite-4343-passing)
- [Security & Production Readiness](#security--production-readiness)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Variables](#environment-variables)
  - [Running the App](#running-the-app)
  - [Running the Audit Tests](#running-the-audit-tests)
  - [Production Deployment & Containerization](#production-deployment--containerization)
- [Tech Stack](#tech-stack)
- [Branding & Authorship](#branding--authorship)
- [License](#license)

---

## Overview

**Data Studio by PJA** is an enterprise autonomous Business Intelligence and exploratory data science studio. 

Traditional LLM data tools suffer from a fatal flaw: language models frequently hallucinate mathematical calculations, round numbers unpredictably, and risk sending sensitive customer records to external APIs. **Data Studio resolves this completely** by strictly separating **Semantic Planning** (powered by Gemini) from **Deterministic Computation** (executed in-memory by verified TypeScript statistical routines).

Upload any CSV or Excel file, or explore built-in enterprise sample datasets, and instantly receive:
- Comprehensive **Whole Executive Strategy Report** with narrative briefs, audited KPIs, 4 interactive visual analyses, and a 30/60/90-day action plan.
- Real-time **executive KPI dashboards** and financial metrics (Revenue, Profit Margins, AOV, Pareto concentration).
- High-resolution, interactive **Plotly visual analytics** (Dual-Axis Combo, Treemaps, Sunbursts, Scatter Correlations, Time Trends).
- Automated **Data Quality audits** and configurable business assertions.
- Reproducible **Python (pandas/NumPy) and SQL code** exports for every visual query.

---

## How It Works (Architecture)

```
       ┌────────────────────────────────────────────────────────┐
       │             User Browser / Client Session              │
       │   (React 19 + Tailwind CSS + Plotly.js + Lucide)       │
       └───────────────────────────┬────────────────────────────┘
                                   │ HTTP / REST (X-Session-ID)
                                   ▼
       ┌────────────────────────────────────────────────────────┐
       │                   Express Server                       │
       │             (In-Memory Isolated Store)                 │
       ├───────────────────────────┬────────────────────────────┤
       │                           │                            │
       ▼                           ▼                            ▼
┌──────────────┐          ┌─────────────────┐          ┌─────────────────┐
│ Google Gemini│          │  Deterministic  │          │ Data Quality    │
│  (AI Studio) │          │  Stats & Math   │          │ & Rule Engine   │
│              │          │  Engine (TS)    │          │                 │
│  Translates  │          │ Computes exact  │          │ Validates min,  │
│  natural     │          │ sums, means,    │          │ max, nulls,     │
│  language to │          │ margins, trends,│          │ uniqueness,     │
│  structured  │          │ regressions,    │          │ and business    │
│  JSON plans  │          │ and distributions│         │ assertions.     │
└──────────────┘          └─────────────────┘          └─────────────────┘
```

### 1. Zero-Hallucination Math Engine
When a user asks a question like *"What is our quarterly profit margin across the Western region?"*, the Gemini model is **never** tasked with summing or averaging numbers. Instead:
1. The **Planner Engine** (`server/ai_agent.ts`) analyzes the schema and generates a typed, declarative execution plan (`AnalysisPlan`).
2. The **Executor Engine** (`server/analyzer.ts` & `server/dashboard.ts`) filters, groups, aggregates, and computes exact figures using pure deterministic TypeScript functions.
3. Every metric, percentage, and ratio is calculated with mathematical precision, preventing rounding bugs or arithmetic hallucinations.

### 2. Privacy Shield & Air-Gapped Metadata
Your raw data rows never leave the execution environment. The platform features an active **Privacy Shield**:
- Only anonymized column names, detected data types, and high-level statistical summaries (e.g. min, max, null count) are shared with the LLM planner.
- No PII, customer records, or financial row values are sent to external API endpoints.

### 3. Session Isolation & Multi-Tenancy
All datasets, transformations, and pinned dashboard layouts are scoped to an isolated session cookie or header (`x-session-id`). Datasets uploaded in one browser tab or session are strictly invisible to others and automatically purged upon session termination.

### 4. Automated Multi-Type Profiler
The ingestion pipeline automatically inspects every column and categorizes it into:
- **Currencies & Accounting Figures**: Handles bracketed negative currencies `($1,200.00)`, formatted symbols (`$`, `€`, `£`, `¥`), commas, and trailing suffixes (`k`, `M`, `B`).
- **Percentages & Ratios**: Parses `%` symbols and scales floats accurately.
- **Dates & Timestamps**: Detects ISO-8601, RFC 2822, and standard US/EU date notations.
- **Categorical & High-Cardinality Fields**: Computes value frequencies, cardinality ratios, and identifies primary keys.
- **Statistical Moments**: Calculates Min, Max, Mean, Median, Variance, Standard Deviation, Interquartile Range (IQR), Skewness, Kurtosis, and detects Z-score & Tukey outliers.

### 5. Formula Engine Sandbox & Security
The transformation engine allows calculated columns (e.g. `Revenue * 1.15` or `Profit / Revenue * 100`) while maintaining enterprise sandboxing:
- Strict regex verification allows only valid tokens, math symbols (`+ - * / % ( ) .`), and numeric values.
- Blocks arbitrary code execution, `eval`, and unsafe prototype modifications.

---

## Key Features

### 1. Executive Strategic Report & Action Plan ("What Needs To Be Done")
The dedicated **Full Report** tab provides an end-to-end strategic dossier:
- **C-Suite Narrative Brief**: Executive headline, macro context, audited strengths, and sensitivity warnings.
- **Audited Financial KPIs**: Gross Revenue, Net Margin %, Average Order Value (AOV), Leading Category Share, Pareto 80/20 Concentration, and Schema Health.
- **4 Analytical Plotly Visualizations**:
  - *Volume & Profit Margin Trajectory*: Dual-axis bar and line combo chart.
  - *Pareto 80/20 Concentration*: Cumulative percentage curve isolating top accounts.
  - *Bivariate Correlation & Operational Elasticity*: Scatter plot with Pearson correlation coefficient ($r$).
  - *Time Series & Growth Velocity*: Run-rate momentum tracking over time.
  - Each visual includes an executive summary explaining **what the chart reveals** and the **strategic takeaway**.
- **Actionable Strategic Roadmap**:
  - **Immediate 30-Day Priorities**: Tactical margin recovery, deduplication, and risk controls.
  - **60–90 Day Optimization Playbook**: Pricing tier restructuring and order value uplift initiatives.
  - **Governance & Quality Directives**: Automated schema validation and pipeline safeguards.
  - Each action specifies priority, expected impact, and responsible corporate owner (CRO, CFO, Principal Data Architect).
- **Multi-Format Export**: One-click **Print / PDF dossier**, **Markdown export**, **JSON report**, and reproducible scripts.

### 2. Executive Financial & Business Calculations
The dashboard immediately aggregates and displays critical business metrics:
- **Total Revenue / Primary Metric**: Formatted compact totals (`$8.45M`) with zero-variance safety.
- **Net Profit & Profit Margin %**: Real-time margin calculation `(Profit / Revenue) * 100`.
- **Average Order Value (AOV) / Average Transaction Value (ATV)**: Per-transaction volume metric.
- **Pareto Principle (80/20 Rule)**: Automatically calculates the exact share of revenue generated by the top 20% of contributors or categories.
- **Period-over-Period Growth**: Period trend calculation comparing adjacent time slices (e.g., `+14.2%` MoM or QoQ).
- **Return & Refund Detection**: Identifies negative transactions or adjustments and tracks both row count and total dollar adjustments.
- **Capital Efficiency Ratio**: Secondary to primary metric ratio multiplier.

### 3. Interactive Visual Studio (10 Chart Engines)
The dashboard and visual analytics studio offer 10 dedicated chart types powered by Plotly:
1. **Dual-Axis Combo Chart**: Combines primary metric bars on Y1 with secondary metric trend lines on Y2.
2. **Hierarchical Treemap**: Interactive nested rectangular tree showing multi-level revenue distribution.
3. **Multi-Level Sunburst**: Radial hierarchy drilldown for category/subcategory trees.
4. **Scatter Correlation Plot**: Includes Pearson correlation coefficient ($r$) with color-coded category markers.
5. **Time Series Trend**: Continuous line and area charts with automatic time-grain aggregation (Year, Quarter, Month, Week, Day).
6. **Distribution Histogram**: Configurable binning for inspecting distribution spread and skewness.
7. **Box-and-Whisker Plot**: Highlights median, quartiles, and statistical Tukey outliers.
8. **Ranked Horizontal Bar Chart**: Top $N$ categories sorted by business volume.
9. **Donut / Share Breakdown**: Percentage share of total volume with percentage hover labels.
10. **Cross-Dimensional Heatmap**: 2D density matrix of categorical combinations.

### 4. Natural Language AI Analyst & Pinning Workflow
- Ask complex business questions in plain English (*"Show monthly revenue trend"*, *"Which region has highest margin?"*).
- Gemini plans the query; deterministic TypeScript code filters and aggregates the data.
- Directly pin any generated visualization from Ask Data or Visual Studio into your persistent **Executive BI Dashboard**.

### 5. Data Quality Audit & Business Rule Assertions
- **Automated Scorecard**: Produces a 0–100 completeness and quality score based on null density, duplicate records, type conflicts, and zero-variance anomalies.
- **Custom Business Assertions Engine**:
  - `range`: Ensures values stay within logical business thresholds (e.g., `Revenue >= 0`).
  - `not_null`: Enforces mandatory fields like `Customer_ID`.
  - `unique`: Verifies unique constraints on transactional keys.
  - `allowed_list`: Checks values against an approved categorical domain list.
- **Automated Cleaner**: One-click deduplication, string trimming, null imputation, and outlier treatment.

### 6. Data Transformation & Feature Engineering
- **Calculated Columns (Safe Math)**: Compute custom expressions like `Profit_Margin = Profit / Revenue * 100` or `Net_Price = Unit_Price * (1 - Discount)` with built-in protection against division-by-zero.
- **DateTime Extractions**: Extract `year`, `quarter`, `month`, and `day_of_week` as standalone analytical columns.
- **Text Operations**: Split delimited strings (e.g., email or full names) and execute regex/substring replacements.

### 7. Reproducible Python & SQL Export
Every insight, chart, or analysis generated by the studio includes:
- **Reproducible Python Code**: Ready-to-run pandas, NumPy, and Plotly scripts that reproduce the exact calculation locally.
- **Standard SQL Query**: Portable SQL with `GROUP BY`, `ORDER BY`, and aggregation functions.
- **Data Dictionary Export**: Download comprehensive Markdown/CSV data dictionaries documenting column types, null counts, distinct counts, and descriptive statistics.

---

## Multi-Dataset Test Suite (43/43 Passing)

The project includes an extensive audit suite in `scripts/audit_suite.ts` that stress-tests the engine against edge cases and dirty data:

```bash
npm run test:audit
```

### Verified Test Matrix:
1. **Dataset 1 — B2B Sales (526 rows, 10 columns)**: Verifies profiler stats, quality audit, automated insight generation, correlation matrices, and dashboard KPI generation.
2. **Dataset 2 — All-Numeric Edge Case (100 rows, 5 numeric, 0 text, 0 date)**: Verifies zero-variance columns, Pearson correlation handling without `NaN`, and categorical fallback.
3. **Dataset 3 — All-Text Edge Case (80 rows, 4 categorical, 0 numeric)**: Verifies frequency histograms, empty numeric handling, and non-crashing dashboard fallbacks.
4. **Dataset 4 — Messy / Dirty Data (50 rows)**: Verifies bracketed accounting negatives `($1,500.00)`, trailing percentage signs, inconsistent casing, whitespace trimming, and duplicate row removal.
5. **Dataset 5 — Minimal Boundary Case (2 rows, 2 columns)**: Verifies variance calculations and chart rendering on minimal 2-row datasets without divide-by-zero errors.
6. **Dataset 6 — Hierarchical Data**: Verifies multi-level Treemap and Sunburst aggregation logic.
7. **Chart Engine Suite**: Verifies generation across all 10 chart types.
8. **Transformation Suite**: Verifies formula evaluations, delimiter splits, find-and-replace, and date extractions.
9. **Business Assertions Suite**: Verifies range, null, and uniqueness rule enforcement.
10. **REST API Endpoint Suite**: Verifies `/api/health`, `/api/datasets`, `/api/dashboard/:id`, `/api/chart/:id`, `/api/transform/:id`, and `/api/data-dictionary/:id`.

**Current Status**: `43 / 43 tests passing (100% success rate)`.

---

## Security & Production Readiness

| Dimension | Implementation |
|---|---|
| **API Key Security** | All calls to Google Gemini are strictly proxied server-side in Node.js/Express. No keys are ever shipped to the browser bundle or exposed in frontend client code. |
| **Privacy Shield** | Only column names, detected types, and aggregated numeric moments are sent to the AI planner. Raw customer rows and PII are never sent to external LLM APIs. |
| **Safe Formula Execution** | Calculated columns strictly validate arithmetic syntax using whitelisted regexes to prevent arbitrary code execution or code injection. |
| **Upload Limits** | Multer in-memory storage enforced with a 50MB file size ceiling and sanitized filenames to prevent path traversal attacks. |
| **Multi-Tenant Isolation** | Session-isolated in-memory storage partitioned by `x-session-id`, preventing cross-user data leakage. |
| **Error Handling** | Structured JSON responses with sanitized error messages and descriptive fallback states. |

---

## Getting Started

### Prerequisites
- **Node.js**: Version 18.0.0 or higher
- **npm** or **bun**

### Installation
Clone the repository and install all dependencies:
```bash
git clone https://github.com/your-username/data-studio.git
cd data-studio
npm install
```

### Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Configure your environment variables:
```env
# Required for Gemini AI Natural Language Analyst & Executive Briefs
# In Google AI Studio, this is automatically injected via user secrets
GEMINI_API_KEY=your_google_gemini_api_key_here

# App URL (automatically configured on Cloud Run deployment)
APP_URL=http://localhost:3000
```

### Running the App

#### Development Mode:
Starts the Express server with Vite middleware on port 3000:
```bash
npm run dev
```
Open your browser and navigate to `http://localhost:3000`.

#### Production Build:
Compiles the frontend with Vite and packages the backend into a standalone CommonJS bundle via `esbuild`:
```bash
npm run build
npm start
```

### Running the Audit Tests
Execute the complete multi-dataset audit test suite:
```bash
npm run test:audit
```

### Production Deployment & Containerization

#### Deploying on Vercel
Data Studio includes a zero-configuration Vercel configuration (`vercel.json`) with an autonomous in-browser analytics engine (`clientEngine.ts`):
1. Import the repository into your Vercel dashboard.
2. The framework will automatically detect Vite. The build command is `npm run build` with output directory `dist`.
3. Set `GEMINI_API_KEY` in your Vercel Project Environment Variables.
4. **Dual-Mode Reliability**: In serverless environments where server endpoints experience cold-start latency or restricted function quotas, Data Studio seamlessly engages its verified client-side deterministic analytics engine in the browser without any interruptions, ensuring instant sample loading, profiling, and interactive charting everywhere.

#### Deploying on Google Cloud Run, AWS ECS, or Docker
Data Studio is fully container-ready:
1. Ensure the container exposes port `3000`.
2. Provide the `GEMINI_API_KEY` secret in your container environment.
3. Run `npm run build` during the build phase.
4. Run `npm start` (`node dist/server.cjs`) as the container entrypoint.

---

## Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend UI** | React 19, TypeScript, Tailwind CSS v4, Motion, Lucide Icons |
| **Visual Analytics** | Plotly.js (`plotly.js-dist-min`) |
| **Backend Service** | Node.js, Express, tsx, esbuild |
| **AI Planning** | Google Gen AI SDK (`@google/genai`), Gemini 2.5 Flash |
| **File Parsing** | PapaParse (CSV), SheetJS / xlsx (Excel) |
| **Test Runner** | tsx Native Audit Harness (`scripts/audit_suite.ts`) |

---

## Branding & Authorship

**Data Studio by PJA**  
Designed and built with pride by **PJA**.

---

## License

MIT License. Free for commercial and private use.
