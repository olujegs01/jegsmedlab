"use client";

import { useState } from "react";
import clsx from "clsx";

export const REGION_TO_SYSTEM: Record<string, string> = {
  head: "Brain & Nerves",
  chest: "Heart & Lungs",
  abdomen: "Digestive",
  left_arm: "Muscles & Joints",
  right_arm: "Muscles & Joints",
  left_leg: "Muscles & Joints",
  right_leg: "Muscles & Joints",
};

const REGION_LABELS: Record<string, string> = {
  head: "Head & Neck",
  chest: "Chest",
  abdomen: "Abdomen",
  left_arm: "Left Arm",
  right_arm: "Right Arm",
  left_leg: "Left Leg",
  right_leg: "Right Leg",
};

interface BodyMapProps {
  selectedRegions: string[];
  onRegionClick: (region: string, system: string) => void;
}

export default function BodyMap({ selectedRegions, onRegionClick }: BodyMapProps) {
  const [hovered, setHovered] = useState<string | null>(null);

  const fill = (region: string) => {
    if (selectedRegions.includes(region)) return "#7C3AED"; // purple-600
    if (hovered === region) return "#A78BFA";               // purple-400
    return "#CBD5E1";                                       // slate-300
  };

  const stroke = (region: string) =>
    selectedRegions.includes(region) ? "#5B21B6" : hovered === region ? "#7C3AED" : "#94A3B8";

  const rp = (region: string) => ({
    fill: fill(region),
    stroke: stroke(region),
    strokeWidth: 1,
    onClick: () => onRegionClick(region, REGION_TO_SYSTEM[region]),
    onMouseEnter: () => setHovered(region),
    onMouseLeave: () => setHovered(null),
    className: "cursor-pointer transition-all",
  });

  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-xs text-slate-500 font-medium">Click a body region</p>
      <svg
        viewBox="0 0 100 210"
        className="w-24 select-none"
        aria-label="Interactive body map"
      >
        {/* ── Head & Neck ── */}
        <g {...rp("head")}>
          <circle cx="50" cy="13" r="11" />
          <rect x="44" y="24" width="12" height="9" rx="2" />
          <title>Head & Neck → Brain & Nerves</title>
        </g>

        {/* ── Chest (upper torso) ── */}
        <g {...rp("chest")}>
          <rect x="30" y="33" width="40" height="34" rx="4" />
          <title>Chest → Heart & Lungs</title>
        </g>

        {/* ── Abdomen (lower torso) ── */}
        <g {...rp("abdomen")}>
          <rect x="30" y="67" width="40" height="28" rx="4" />
          <title>Abdomen → Digestive</title>
        </g>

        {/* ── Left Arm (viewer's right) ── */}
        <g {...rp("left_arm")}>
          <rect x="16" y="33" width="13" height="62" rx="5" />
          <title>Left Arm → Muscles & Joints</title>
        </g>

        {/* ── Right Arm (viewer's left) ── */}
        <g {...rp("right_arm")}>
          <rect x="71" y="33" width="13" height="62" rx="5" />
          <title>Right Arm → Muscles & Joints</title>
        </g>

        {/* ── Left Leg ── */}
        <g {...rp("left_leg")}>
          <rect x="30" y="95" width="18" height="80" rx="5" />
          <title>Left Leg → Muscles & Joints</title>
        </g>

        {/* ── Right Leg ── */}
        <g {...rp("right_leg")}>
          <rect x="52" y="95" width="18" height="80" rx="5" />
          <title>Right Leg → Muscles & Joints</title>
        </g>
      </svg>

      {/* Hover / selected label */}
      <div className="h-5">
        {(hovered || selectedRegions.length > 0) && (
          <p className="text-xs text-purple-600 font-medium text-center">
            {hovered
              ? `${REGION_LABELS[hovered]} → ${REGION_TO_SYSTEM[hovered]}`
              : selectedRegions.map((r) => REGION_LABELS[r]).join(", ")}
          </p>
        )}
      </div>
    </div>
  );
}
