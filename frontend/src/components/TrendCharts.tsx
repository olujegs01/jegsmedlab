"use client";

import { useState, useEffect } from "react";
import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, ReferenceArea, Legend
} from "recharts";
import { TrendingUp, TrendingDown, Minus, Loader2, BarChart3, Activity } from "lucide-react";
import clsx from "clsx";

interface TrendPoint {
  date: string;
  value: number;
  status: string;
  reference_low?: number | null;
  reference_high?: number | null;
}

interface TrendData {
  test_name: string;
  unit: string | null;
  data_points: TrendPoint[];
  reference_low: number | null;
  reference_high: number | null;
  trend_direction: string;
  current_status: string;
  category?: string;
}

const statusDotColors: Record<string, string> = {
  normal: "#10b981",
  low: "#f59e0b",
  high: "#f97316",
  critical_low: "#ef4444",
  critical_high: "#ef4444",
};

const trendIcons: Record<string, React.ElementType> = {
  improving: TrendingUp,
  worsening: TrendingDown,
  stable: Minus,
  increasing: TrendingUp,
  decreasing: TrendingDown,
};

const trendColors: Record<string, string> = {
  improving: "text-emerald-600 bg-emerald-50",
  worsening: "text-red-600 bg-red-50",
  stable: "text-slate-600 bg-slate-100",
  increasing: "text-blue-600 bg-blue-50",
  decreasing: "text-amber-600 bg-amber-50",
};

const statusLineColor: Record<string, string> = {
  normal: "#3b82f6",
  low: "#f59e0b",
  high: "#f97316",
  critical_low: "#ef4444",
  critical_high: "#ef4444",
};

function CustomDot(props: any) {
  const { cx, cy, payload } = props;
  const color = statusDotColors[payload.status] || "#3b82f6";
  return (
    <circle cx={cx} cy={cy} r={5} fill={color} stroke="white" strokeWidth={2} />
  );
}

function CustomTooltip({ active, payload, unit, testName }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const statusLabel = d.status?.replace(/_/g, " ") || "—";
  const color = statusDotColors[d.status] || "#3b82f6";
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-lg text-xs">
      <p className="font-semibold text-slate-800 mb-1">{testName}</p>
      <p className="text-slate-600">{d.date}</p>
      <p className="text-lg font-bold mt-1" style={{ color }}>
        {d.value} <span className="text-sm font-normal text-slate-500">{unit || ""}</span>
      </p>
      <p className="mt-0.5 font-medium capitalize" style={{ color }}>{statusLabel}</p>
    </div>
  );
}

function TrendCard({ trend, chartType }: { trend: TrendData; chartType: "line" | "area" }) {
  const TrendIcon = trendIcons[trend.trend_direction] || Minus;
  const trendClass = trendColors[trend.trend_direction] || trendColors.stable;
  const latest = trend.data_points[trend.data_points.length - 1];
  const lineColor = statusLineColor[trend.current_status] || "#3b82f6";

  const chartData = trend.data_points.map((p) => ({
    date: new Date(p.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    value: p.value,
    status: p.status,
  }));

  const allValues = trend.data_points.map((p) => p.value);
  const minVal = Math.min(...allValues);
  const maxVal = Math.max(...allValues);
  const padding = (maxVal - minVal) * 0.25 || 2;

  const refLow = trend.reference_low;
  const refHigh = trend.reference_high;

  const yMin = Math.min(minVal - padding, refLow != null ? refLow - padding : Infinity);
  const yMax = Math.max(maxVal + padding, refHigh != null ? refHigh + padding : -Infinity);
  const yDomain = [isFinite(yMin) ? yMin : minVal - padding, isFinite(yMax) ? yMax : maxVal + padding];

  const chartProps = {
    data: chartData,
    margin: { top: 5, right: 8, bottom: 5, left: 0 },
  };

  const axisProps = {
    xAxis: (
      <XAxis
        dataKey="date"
        tick={{ fontSize: 9, fill: "#94a3b8" }}
        axisLine={false}
        tickLine={false}
      />
    ),
    yAxis: (
      <YAxis
        domain={yDomain}
        tick={{ fontSize: 9, fill: "#94a3b8" }}
        axisLine={false}
        tickLine={false}
        width={38}
      />
    ),
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow">
      <div className="px-5 py-4 border-b border-slate-100">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold text-slate-900 text-sm">{trend.test_name}</h3>
            {trend.unit && <p className="text-xs text-slate-400 mt-0.5">{trend.unit}</p>}
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {latest && (
              <span
                className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{
                  backgroundColor: `${statusDotColors[latest.status] || "#6b7280"}20`,
                  color: statusDotColors[latest.status] || "#6b7280",
                }}
              >
                {latest.status.replace(/_/g, " ")}
              </span>
            )}
            <span className={clsx("flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium", trendClass)}>
              <TrendIcon className="w-3 h-3" />
              {trend.trend_direction}
            </span>
          </div>
        </div>
        {latest && (
          <p className="text-2xl font-bold text-slate-900 mt-2" style={{ color: lineColor }}>
            {latest.value}
            {trend.unit && <span className="text-sm font-normal text-slate-400 ml-1">{trend.unit}</span>}
          </p>
        )}
        {refLow != null && refHigh != null && (
          <p className="text-xs text-slate-400 mt-0.5">
            Normal range: {refLow}–{refHigh} {trend.unit || ""}
          </p>
        )}
      </div>

      {trend.data_points.length > 1 ? (
        <div className="p-4 pb-3">
          <ResponsiveContainer width="100%" height={160}>
            {chartType === "area" ? (
              <AreaChart {...chartProps}>
                <defs>
                  <linearGradient id={`grad-${trend.test_name}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={lineColor} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={lineColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                {axisProps.xAxis}
                {axisProps.yAxis}
                <Tooltip content={<CustomTooltip unit={trend.unit} testName={trend.test_name} />} />
                {/* Reference range band */}
                {refLow != null && refHigh != null && (
                  <ReferenceArea
                    y1={refLow}
                    y2={refHigh}
                    fill="#10b981"
                    fillOpacity={0.06}
                    strokeOpacity={0}
                  />
                )}
                {refLow != null && (
                  <ReferenceLine y={refLow} stroke="#10b981" strokeDasharray="4 4" strokeWidth={1.5}
                    label={{ value: "Low", position: "right", fontSize: 8, fill: "#10b981" }}
                  />
                )}
                {refHigh != null && (
                  <ReferenceLine y={refHigh} stroke="#ef4444" strokeDasharray="4 4" strokeWidth={1.5}
                    label={{ value: "High", position: "right", fontSize: 8, fill: "#ef4444" }}
                  />
                )}
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={lineColor}
                  strokeWidth={2.5}
                  fill={`url(#grad-${trend.test_name})`}
                  dot={<CustomDot />}
                  activeDot={{ r: 7, strokeWidth: 2 }}
                />
              </AreaChart>
            ) : (
              <LineChart {...chartProps}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                {axisProps.xAxis}
                {axisProps.yAxis}
                <Tooltip content={<CustomTooltip unit={trend.unit} testName={trend.test_name} />} />
                {refLow != null && refHigh != null && (
                  <ReferenceArea y1={refLow} y2={refHigh} fill="#10b981" fillOpacity={0.06} strokeOpacity={0} />
                )}
                {refLow != null && (
                  <ReferenceLine y={refLow} stroke="#10b981" strokeDasharray="4 4" strokeWidth={1.5}
                    label={{ value: "Low", position: "right", fontSize: 8, fill: "#10b981" }}
                  />
                )}
                {refHigh != null && (
                  <ReferenceLine y={refHigh} stroke="#ef4444" strokeDasharray="4 4" strokeWidth={1.5}
                    label={{ value: "High", position: "right", fontSize: 8, fill: "#ef4444" }}
                  />
                )}
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={lineColor}
                  strokeWidth={2.5}
                  dot={<CustomDot />}
                  activeDot={{ r: 7, strokeWidth: 2 }}
                />
              </LineChart>
            )}
          </ResponsiveContainer>
          <p className="text-[10px] text-slate-400 text-center mt-0.5">
            {trend.data_points.length} data point{trend.data_points.length !== 1 ? "s" : ""}
            {refLow != null && refHigh != null && " · Green band = normal range"}
          </p>
        </div>
      ) : (
        <div className="p-4 text-center">
          <p className="text-xs text-slate-400">Upload more reports to see trends</p>
        </div>
      )}
    </div>
  );
}

export default function TrendCharts({ patientId = "demo-patient" }: { patientId?: string }) {
  const [trends, setTrends] = useState<TrendData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const [chartType, setChartType] = useState<"line" | "area">("area");

  useEffect(() => {
    setLoading(true);
    setError(false);
    fetch(`/api/trends?patient_id=${patientId}`)
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((d) => Array.isArray(d) ? setTrends(d) : setTrends([]))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [patientId]);

  const getCategory = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes("cholesterol") || n.includes("ldl") || n.includes("hdl") || n.includes("triglyceride")) return "Lipid";
    if (n.includes("glucose") || n.includes("hba1c") || n.includes("a1c")) return "Diabetes";
    if (n.includes("tsh") || n.includes("thyroid") || n.includes(" t3") || n.includes(" t4")) return "Thyroid";
    if (n.includes("hemoglobin") || n.includes("wbc") || n.includes("rbc") || n.includes("platelet")) return "CBC";
    if (n.includes("creatinine") || n.includes("bun") || n.includes("egfr")) return "Kidney";
    if (n.includes("alt") || n.includes("ast") || n.includes("bilirubin") || n.includes("albumin")) return "Liver";
    if (n.includes("vitamin") || n.includes("b12") || n.includes("ferritin") || n.includes("folate")) return "Vitamins";
    if (n.includes("sodium") || n.includes("potassium") || n.includes("calcium") || n.includes("magnesium")) return "Electrolytes";
    return "Other";
  };

  const categories = ["all", ...Array.from(new Set(trends.map((t) => getCategory(t.test_name))))];

  const filteredTrends = filter === "all"
    ? trends
    : trends.filter((t) => getCategory(t.test_name) === filter);

  // Summary stats
  const criticalTrends = trends.filter((t) => t.current_status.startsWith("critical")).length;
  const worseningTrends = trends.filter((t) => t.trend_direction === "worsening").length;
  const improvingTrends = trends.filter((t) => t.trend_direction === "improving").length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-teal-600" />
            Lab Trends
          </h1>
          <p className="text-slate-500 mt-1">
            Track your lab values over time with interactive charts.
          </p>
        </div>

        {/* Chart type toggle */}
        {trends.length > 0 && (
          <div className="flex bg-slate-100 rounded-lg p-1 gap-1">
            <button
              onClick={() => setChartType("area")}
              className={clsx(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                chartType === "area" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500"
              )}
            >
              <Activity className="w-3.5 h-3.5" />
              Area
            </button>
            <button
              onClick={() => setChartType("line")}
              className={clsx(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                chartType === "line" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500"
              )}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              Line
            </button>
          </div>
        )}
      </div>

      {/* Summary stats row */}
      {trends.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-slate-900">{trends.length}</p>
            <p className="text-xs text-slate-500 mt-0.5">Tests Tracked</p>
          </div>
          <div className={clsx("border rounded-xl p-4 text-center", worseningTrends > 0 ? "bg-red-50 border-red-200" : "bg-white border-slate-200")}>
            <p className={clsx("text-2xl font-bold", worseningTrends > 0 ? "text-red-600" : "text-slate-400")}>{worseningTrends}</p>
            <p className="text-xs text-slate-500 mt-0.5">Worsening</p>
          </div>
          <div className={clsx("border rounded-xl p-4 text-center", improvingTrends > 0 ? "bg-emerald-50 border-emerald-200" : "bg-white border-slate-200")}>
            <p className={clsx("text-2xl font-bold", improvingTrends > 0 ? "text-emerald-600" : "text-slate-400")}>{improvingTrends}</p>
            <p className="text-xs text-slate-500 mt-0.5">Improving</p>
          </div>
        </div>
      )}

      {/* Category Filter */}
      {trends.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={clsx(
                "text-xs px-3 py-1.5 rounded-full font-medium border transition-all",
                filter === cat
                  ? "bg-teal-600 text-white border-teal-600"
                  : "bg-white text-slate-600 border-slate-200 hover:border-teal-300"
              )}
            >
              {cat === "all" ? `All (${trends.length})` : `${cat} (${trends.filter(t => getCategory(t.test_name) === cat).length})`}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <Loader2 className="w-6 h-6 text-teal-500 animate-spin mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Loading trend data...</p>
        </div>
      ) : error ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-12 text-center">
          <BarChart3 className="w-10 h-10 text-amber-300 mx-auto mb-4" />
          <p className="text-amber-700 font-medium">Server is starting up</p>
          <p className="text-amber-600 text-sm mt-1">The AI backend may be warming up. Please wait a moment and refresh.</p>
          <button onClick={() => { setLoading(true); setError(false); fetch(`/api/trends?patient_id=${patientId}`).then(r => r.ok ? r.json() : []).then(d => setTrends(d)).catch(() => setError(true)).finally(() => setLoading(false)); }} className="mt-4 text-sm font-medium text-amber-700 underline">Try again</button>
        </div>
      ) : trends.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <BarChart3 className="w-10 h-10 text-slate-200 mx-auto mb-4" />
          <p className="text-slate-400 font-medium">No trend data yet</p>
          <p className="text-slate-300 text-sm mt-1">
            Upload multiple lab reports over time to see trends
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredTrends.map((t) => (
            <TrendCard key={t.test_name} trend={t} chartType={chartType} />
          ))}
        </div>
      )}
    </div>
  );
}
