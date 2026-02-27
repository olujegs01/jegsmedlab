"use client";

import { Activity, Stethoscope, Leaf, FlaskConical, UserRound, Pill, Eye, CheckCircle } from "lucide-react";
import clsx from "clsx";

interface ActionItem {
  timeframe: string;
  category: string;
  action: string;
  reason: string;
  priority: string;
}

interface Props {
  items: ActionItem[];
}

const CATEGORY_CONFIG: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  lifestyle:   { icon: Leaf,        color: "text-emerald-600", bg: "bg-emerald-100" },
  medical:     { icon: Stethoscope, color: "text-blue-600",    bg: "bg-blue-100"    },
  retest:      { icon: FlaskConical,color: "text-indigo-600",  bg: "bg-indigo-100"  },
  specialist:  { icon: UserRound,   color: "text-purple-600",  bg: "bg-purple-100"  },
  medication:  { icon: Pill,        color: "text-amber-600",   bg: "bg-amber-100"   },
  monitoring:  { icon: Eye,         color: "text-teal-600",    bg: "bg-teal-100"    },
};

const PRIORITY_BORDER: Record<string, string> = {
  high:   "border-l-red-400",
  medium: "border-l-amber-400",
  low:    "border-l-slate-300",
};

const PRIORITY_LABEL: Record<string, string> = {
  high:   "bg-red-100 text-red-700",
  medium: "bg-amber-100 text-amber-700",
  low:    "bg-slate-100 text-slate-600",
};

export default function ActionPlanTimeline({ items }: Props) {
  if (!items || items.length === 0) return null;

  return (
    <div className="mt-6 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3 bg-gradient-to-r from-teal-50 to-emerald-50">
        <div className="w-9 h-9 rounded-xl bg-teal-600 flex items-center justify-center">
          <CheckCircle className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="font-semibold text-slate-800">Your Action Plan</h3>
          <p className="text-xs text-slate-500">Personalised steps based on your results</p>
        </div>
      </div>

      {/* Timeline */}
      <div className="p-5 space-y-0">
        {items.map((item, idx) => {
          const cfg = CATEGORY_CONFIG[item.category] || CATEGORY_CONFIG.medical;
          const Icon = cfg.icon;
          const isLast = idx === items.length - 1;

          return (
            <div key={idx} className="flex gap-4">
              {/* Left spine */}
              <div className="flex flex-col items-center">
                <div className={clsx("w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 mt-1", cfg.bg)}>
                  <Icon className={clsx("w-4 h-4", cfg.color)} />
                </div>
                {!isLast && <div className="w-0.5 bg-slate-200 flex-1 my-1" />}
              </div>

              {/* Card */}
              <div className={clsx(
                "flex-1 mb-4 bg-slate-50 rounded-xl border-l-4 px-4 py-3",
                PRIORITY_BORDER[item.priority] || "border-l-slate-300",
              )}>
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    {item.timeframe}
                  </span>
                  <span className={clsx(
                    "text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide",
                    PRIORITY_LABEL[item.priority] || "bg-slate-100 text-slate-600",
                  )}>
                    {item.priority}
                  </span>
                </div>
                <p className="mt-1 text-sm font-medium text-slate-800">{item.action}</p>
                <p className="mt-0.5 text-xs text-slate-500">{item.reason}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
