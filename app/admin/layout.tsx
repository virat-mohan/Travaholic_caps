import { Anton, Instrument_Serif, Inter } from "next/font/google";
import { AdminShell } from "@/components/admin/shell/AdminShell";

const display = Anton({ subsets: ["latin"], weight: "400", variable: "--admin-display", display: "swap" });
const serif = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--admin-serif", display: "swap" });
const sans = Inter({ subsets: ["latin"], variable: "--admin-sans", display: "swap" });

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${display.variable} ${serif.variable} ${sans.variable}`}>
      <AdminShell>{children}</AdminShell>
    </div>
  );
}
