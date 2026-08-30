"use client";

import { usePathname } from "next/navigation";
import ProgressRail from "@/components/ProgressRail";

const STEP_BY_PATH = {
  "/kiosk": 0,
  "/kiosk/identify": 1,
  "/kiosk/consent": 2,
  "/kiosk/interview": 3,
  "/kiosk/documents": 4,
  "/kiosk/review": 5,
};

export default function KioskLayout({ children }) {
  const pathname = usePathname();
  const step = STEP_BY_PATH[pathname] ?? 0;

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <ProgressRail step={step} />
      <div style={{ flex: 1, display: "flex", justifyContent: "center", padding: "40px 20px" }}>
        <div style={{ width: "100%", maxWidth: 640 }}>{children}</div>
      </div>
    </div>
  );
}
