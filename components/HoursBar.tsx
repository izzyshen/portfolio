"use client";

interface Segment {
  start: number;
  end: number;
  label: string;
  color: string;
}

const segments: Segment[] = [
  { start: 0, end: 6, label: "Sleep", color: "#e5e5e5" },
  { start: 6, end: 9, label: "Morning", color: "#fde68a" },
  { start: 9, end: 18, label: "Work", color: "#bfdbfe" },
  { start: 18, end: 22, label: "Projects", color: "#bbf7d0" },
  { start: 22, end: 24, label: "Wind down", color: "#e5e5e5" },
];

export default function HoursBar() {
  return (
    <div className="flex w-full h-6 rounded-sm overflow-hidden gap-px">
      {segments.map((seg) => {
        const width = ((seg.end - seg.start) / 24) * 100;
        return (
          <div
            key={seg.label}
            style={{ width: `${width}%`, background: seg.color }}
            title={`${seg.label} (${seg.start}:00–${seg.end}:00)`}
            className="transition-opacity hover:opacity-60 cursor-default"
          />
        );
      })}
    </div>
  );
}
