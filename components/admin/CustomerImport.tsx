"use client";

import { useState } from "react";
import Papa from "papaparse";

type Mapping = {
  name: string;
  phone: string;
  email: string;
  purchaseDate: string;
  purchaseValue: string;
  quantity: string;
};

const EMPTY_MAPPING: Mapping = {
  name: "",
  phone: "",
  email: "",
  purchaseDate: "",
  purchaseValue: "",
  quantity: "",
};

const FIELD_LABELS: { key: keyof Mapping; label: string; required?: boolean }[] = [
  { key: "phone", label: "Phone", required: true },
  { key: "name", label: "Name" },
  { key: "email", label: "Email" },
  { key: "purchaseDate", label: "Purchase Date" },
  { key: "purchaseValue", label: "Purchase Value (₹)" },
  { key: "quantity", label: "Quantity / Caps Bought" },
];

function guessColumn(headers: string[], candidates: string[]) {
  const lower = headers.map((h) => h.toLowerCase());
  for (const candidate of candidates) {
    const idx = lower.findIndex((h) => h.includes(candidate));
    if (idx !== -1) return headers[idx];
  }
  return "";
}

export function CustomerImport({ onImported }: { onImported: () => void }) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Mapping>(EMPTY_MAPPING);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleFile(file: File) {
    setFileName(file.name);
    setResult(null);
    setError(null);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const detectedHeaders = results.meta.fields ?? [];
        setHeaders(detectedHeaders);
        setRows(results.data);
        setMapping({
          name: guessColumn(detectedHeaders, ["name"]),
          phone: guessColumn(detectedHeaders, ["phone", "mobile", "contact"]),
          email: guessColumn(detectedHeaders, ["email"]),
          purchaseDate: guessColumn(detectedHeaders, ["date"]),
          purchaseValue: guessColumn(detectedHeaders, ["value", "amount", "total", "spend"]),
          quantity: guessColumn(detectedHeaders, ["qty", "quantity", "units", "caps"]),
        });
      },
      error: (err) => setError(err.message),
    });
  }

  async function runImport() {
    if (!mapping.phone) {
      setError("Map a Phone column before importing — it's how customers get deduplicated.");
      return;
    }
    setImporting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/customers/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows, mapping, sourceFile: fileName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import failed");
      setResult(`Imported ${data.imported} record(s)${data.skipped ? `, skipped ${data.skipped} without a valid phone` : ""}.`);
      setRows([]);
      setHeaders([]);
      setFileName(null);
      onImported();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="border-t border-divider pt-6">
      <p className="text-caption uppercase tracking-[0.1em] text-secondary-text">
        Import Customer Data (CSV)
      </p>
      <p className="mt-1 max-w-lg text-micro text-secondary-text/70">
        Works with any export — map your file&apos;s columns below. Imported purchases are kept
        separate from real orders but merged into the customer totals here.
      </p>

      <label className="mt-4 block cursor-pointer border border-dashed border-ink/30 px-6 py-8 text-center transition-colors hover:border-ink">
        <span className="block font-sans text-body-s uppercase tracking-[0.1em] text-ink">
          {fileName ?? "Choose CSV File"}
        </span>
        <input
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
      </label>

      {headers.length > 0 && (
        <div className="mt-6">
          <p className="text-caption text-secondary-text">{rows.length} rows detected. Map columns:</p>
          <div className="mt-3 grid grid-cols-2 gap-4 md:grid-cols-3">
            {FIELD_LABELS.map((field) => (
              <div key={field.key}>
                <label className="block text-micro uppercase tracking-[0.05em] text-secondary-text">
                  {field.label}
                  {field.required && " *"}
                </label>
                <select
                  value={mapping[field.key]}
                  onChange={(e) => setMapping((m) => ({ ...m, [field.key]: e.target.value }))}
                  className="mt-1 w-full border border-divider bg-surface px-2 py-1.5 text-body-s text-ink"
                >
                  <option value="">— none —</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <button
            onClick={runImport}
            disabled={importing}
            className="mt-5 border border-ink px-5 py-2 font-sans text-caption font-bold uppercase tracking-[0.05em] text-ink transition-colors duration-300 hover:bg-ink hover:text-cream disabled:opacity-50"
          >
            {importing ? "Importing..." : `Import ${rows.length} Rows`}
          </button>
        </div>
      )}

      {result && <p className="mt-3 text-body-s text-tan-gold">{result}</p>}
      {error && <p className="mt-3 text-body-s text-paint-orange">{error}</p>}
    </div>
  );
}
