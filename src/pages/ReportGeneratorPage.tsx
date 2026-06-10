import { ArrowRight, Calendar, Home, MapPin, Ruler, Sparkles } from "lucide-react";
import { FormEvent, useState } from "react";
import { validateReportInput } from "../domain/reports";
import type { PropertyReport, PropertyReportInput } from "../types";

const initialInput: PropertyReportInput = {
  address: "",
  propertyType: "Terrace House",
  sqft: 2500,
  bedrooms: 4,
  bathrooms: 3,
  yearBuilt: 2018,
};

export default function ReportGeneratorPage({
  reports,
  onCreateReport,
}: {
  reports: PropertyReport[];
  onCreateReport: (input: PropertyReportInput) => Promise<PropertyReport>;
}) {
  const [input, setInput] = useState<PropertyReportInput>(initialInput);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [latest, setLatest] = useState<PropertyReport | null>(reports[0] ?? null);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const validation = validateReportInput(input);
    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }

    setSaving(true);
    try {
      const report = await onCreateReport(input);
      setLatest(report);
      setErrors({});
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="page">
      <h1 className="section-title">Generate Property Report</h1>
      <p className="mt-4 text-xl text-slate-600">Complete the parameters below to generate a predictive analysis.</p>

      <div className="my-12 grid grid-cols-3 items-center text-center">
        {["Property Details", "Market Parameters", "Social Sentiment"].map((label, index) => (
          <div key={label} className="relative">
            <div className="h-1 bg-slate-300 absolute left-0 right-0 top-5 -z-0" />
            <div
              className={`relative mx-auto grid h-10 w-10 place-items-center rounded-full border font-extrabold ${
                index === 0 ? "bg-[#041627] text-white border-[#041627]" : "bg-slate-200 border-slate-400"
              }`}
            >
              {index + 1}
            </div>
            <p className={`mt-3 font-bold ${index === 0 ? "text-[#041627]" : "text-slate-500"}`}>{label}</p>
          </div>
        ))}
      </div>

      <form className="card p-6 md:p-10" onSubmit={(event) => void submit(event)}>
        <div className="flex items-center gap-3 border-b border-slate-200 pb-6">
          <Home size={32} aria-hidden="true" />
          <h2 className="m-0 text-3xl font-extrabold">Property Details</h2>
        </div>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          <label className="form-field md:col-span-2">
            <span className="form-label">Property Address *</span>
            <span className="relative">
              <MapPin size={22} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden="true" />
              <input
                className="input pl-11"
                placeholder="Start typing address..."
                value={input.address}
                onChange={(event) => setInput({ ...input, address: event.target.value })}
              />
            </span>
            {errors.address ? <span className="text-sm text-red-600">{errors.address}</span> : null}
          </label>

          <label className="form-field">
            <span className="form-label">Property Type</span>
            <select
              className="select"
              value={input.propertyType}
              onChange={(event) => setInput({ ...input, propertyType: event.target.value })}
            >
              <option>Terrace House</option>
              <option>Condo</option>
              <option>Single Family Residential</option>
              <option>Shoplot</option>
              <option>Market Brief</option>
            </select>
          </label>

          <label className="form-field">
            <span className="form-label">Total Square Footage</span>
            <span className="relative">
              <Ruler size={22} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden="true" />
              <input
                className="input pl-11"
                type="number"
                value={input.sqft}
                onChange={(event) => setInput({ ...input, sqft: Number(event.target.value) })}
              />
            </span>
            {errors.sqft ? <span className="text-sm text-red-600">{errors.sqft}</span> : null}
          </label>

          <label className="form-field">
            <span className="form-label">Bedrooms</span>
            <input
              className="input"
              type="number"
              value={input.bedrooms}
              onChange={(event) => setInput({ ...input, bedrooms: Number(event.target.value) })}
            />
            {errors.bedrooms ? <span className="text-sm text-red-600">{errors.bedrooms}</span> : null}
          </label>

          <label className="form-field">
            <span className="form-label">Bathrooms</span>
            <input
              className="input"
              type="number"
              step="0.5"
              value={input.bathrooms}
              onChange={(event) => setInput({ ...input, bathrooms: Number(event.target.value) })}
            />
          </label>

          <label className="form-field md:col-span-2">
            <span className="form-label">Year Built</span>
            <span className="relative">
              <Calendar size={22} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden="true" />
              <input
                className="input pl-11"
                type="number"
                value={input.yearBuilt}
                onChange={(event) => setInput({ ...input, yearBuilt: Number(event.target.value) })}
              />
            </span>
            {errors.yearBuilt ? <span className="text-sm text-red-600">{errors.yearBuilt}</span> : null}
          </label>
        </div>

        <div className="mt-10 border-t border-slate-200 pt-6 flex justify-end">
          <button className="primary-button min-w-48" type="submit" disabled={saving}>
            {saving ? "Generating" : "Generate Report"}
            <ArrowRight size={20} aria-hidden="true" />
          </button>
        </div>
      </form>

      {latest ? (
        <section className="card mt-8 p-6 md:p-8">
          <div className="flex items-start gap-4">
            <div className="brand-mark !w-12 !h-12">
              <Sparkles size={24} aria-hidden="true" />
            </div>
            <div>
              <p className="eyebrow">Latest Report</p>
              <h2 className="m-0 mt-1 text-2xl font-extrabold">{latest.title}</h2>
              <p className="mt-2 text-slate-700">{latest.marketSignal}</p>
              <p className="mt-1 text-slate-700">{latest.sentimentSummary}</p>
            </div>
          </div>
        </section>
      ) : null}
    </main>
  );
}
