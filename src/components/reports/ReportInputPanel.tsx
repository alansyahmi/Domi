import { BadgeDollarSign, ChevronDown, Clock, Home, Link, MapPin, NotebookPen, RefreshCw, Ruler, Sparkles, Trash2 } from "lucide-react";
import { type FormEvent, useState } from "react";
import ReportWorkflowStatus from "./ReportWorkflowStatus";

import { matchesPropertyName, validateReportInput } from "../../domain/reports";
import { formatDateTime } from "../../lib/format";
import type { PropertyReport, PropertyReportInput } from "../../types";

const initialInput: PropertyReportInput = {
  propertyName: "",
  address: "",
  propertyType: "",
  listingIntent: undefined,
  tenure: undefined,
  askingPriceRm: undefined,
  sqft: undefined,
  bedrooms: undefined,
  bathrooms: undefined,
  yearBuilt: undefined,
  sourceUrl: "",
  sourceNotes: "",
};

function numericValue(value: number | undefined): string | number {
  return value ?? "";
}

function parseOptionalNumber(value: string): number | undefined {
  return value.trim() ? Number(value) : undefined;
}

export default function ReportInputPanel({
  onCreateReport,
  onReportCreated,
  onGeneratingChange,
  onGenerationStart,
  cachedReports,
  onDeletePropertyCache,
  generating,
  startTime,
}: {
  onCreateReport: (input: PropertyReportInput) => Promise<PropertyReport>;
  onReportCreated: (report: PropertyReport) => void;
  onGeneratingChange: (generating: boolean) => void;
  onGenerationStart?: (startTime: number) => void;
  cachedReports?: PropertyReport[];
  onDeletePropertyCache: (propertyName: string) => Promise<void>;
  generating: boolean;
  startTime?: number;
}) {
  const [input, setInput] = useState<PropertyReportInput>(initialInput);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Filter cached reports matching current property name input
  const suggestions = (cachedReports ?? [])
    .filter((report) => {
      if (!input.propertyName?.trim()) return false;
      return matchesPropertyName(input.propertyName, report.propertyName) || matchesPropertyName(input.propertyName, report.address);
    })
    .slice(0, 5);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const validation = validateReportInput(input);
    if (!validation.valid) {
      setErrors(validation.errors);
      setSubmitError(null);
      return;
    }

    setSaving(true);
    setSubmitError(null);
    onGeneratingChange(true);
    onGenerationStart?.(Date.now());
    try {
      const report = await onCreateReport(input);
      onReportCreated(report);
      setErrors({});
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Unable to generate report.");
    } finally {
      setSaving(false);
      onGeneratingChange(false);
    }
  }

  async function refreshData() {
    const validation = validateReportInput(input);
    if (!validation.valid) {
      setErrors(validation.errors);
      setSubmitError(null);
      return;
    }

    setSaving(true);
    setSubmitError(null);
    onGeneratingChange(true);
    onGenerationStart?.(Date.now());
    try {
      const report = await onCreateReport({ ...input, bypassCache: true });
      onReportCreated(report);
      setErrors({});
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Unable to refresh report data.");
    } finally {
      setSaving(false);
      onGeneratingChange(false);
    }
  }

  async function removeCache() {
    if (!input.propertyName?.trim()) return;
    const confirmed = window.confirm(`Are you sure you want to remove all cache and report data for "${input.propertyName}"?`);
    if (!confirmed) return;

    setSaving(true);
    setSubmitError(null);
    try {
      await onDeletePropertyCache(input.propertyName);
      setInput(initialInput);
      setErrors({});
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Unable to remove cache.");
    } finally {
      setSaving(false);
    }
  }


  return (
    <form className="card report-input-panel p-6 md:p-8" onSubmit={(event) => void submit(event)}>
      <div className="flex items-start gap-4 border-b border-slate-200 pb-6">
        <div className="brand-mark h-12 w-12">
          <Sparkles size={24} aria-hidden="true" />
        </div>
        <div>
          <h2 className="m-0 text-2xl font-extrabold">Generate Property Report</h2>
          <p className="m-0 mt-2 text-slate-600">Start with the property name. Index lookup and live search can fill in missing listing details later.</p>
        </div>
      </div>

      <div className="mt-7 grid gap-6">
        <div className="grid gap-5">
          <label className="form-field">
            <span className="form-label">Property name *</span>
            <span className="relative">
              <Home size={22} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden="true" />
              <input
                className="input pl-12 text-lg"
                placeholder="The Estate KL"
                value={input.propertyName ?? ""}
                onChange={(event) => setInput({ ...input, propertyName: event.target.value })}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              />
            </span>
            {errors.propertyName ? <span className="text-sm text-red-600">{errors.propertyName}</span> : null}
            {showSuggestions && suggestions.length > 0 && (
              <div className="suggestions-dropdown" role="listbox" aria-label="Previously analyzed properties">
                {suggestions.map((report) => (
                  <button
                    key={report.id}
                    className="suggestions-dropdown-item"
                    role="option"
                    type="button"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      setInput({
                        ...input,
                        propertyName: report.propertyName,
                        address: report.address || undefined,
                        propertyType: report.propertyType || undefined,
                        sqft: report.sqft || undefined,
                        bedrooms: report.bedrooms || undefined,
                        bathrooms: report.bathrooms || undefined,
                        yearBuilt: report.yearBuilt || undefined,
                      });
                      setShowSuggestions(false);
                    }}
                  >
                    <span className="suggestions-dropdown-item-name">
                      <Clock size={14} aria-hidden="true" />
                      {report.propertyName}
                    </span>
                    <span className="suggestions-dropdown-item-meta">
                      {report.cacheStatus === "hit" ? "Cached" : report.cacheStatus === "refreshed" ? "Refreshed" : "Generated"} — {formatDateTime(report.generatedAt)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </label>
        </div>

        <button
          aria-expanded={advancedOpen}
          className="report-advanced-toggle"
          onClick={() => setAdvancedOpen((value) => !value)}
          type="button"
        >
          <span>Optional property details</span>
          <ChevronDown className={advancedOpen ? "rotate-180" : ""} size={18} aria-hidden="true" />
        </button>

        {advancedOpen ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <label className="form-field md:col-span-2">
              <span className="form-label">Address or location</span>
              <span className="relative">
                <MapPin size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden="true" />
                <input
                  className="input pl-12"
                  placeholder="Jalan Ampang, Kuala Lumpur"
                  value={input.address ?? ""}
                  onChange={(event) => setInput({ ...input, address: event.target.value })}
                />
              </span>
            </label>

            <label className="form-field">
              <span className="form-label">Property type</span>
              <select
                className="select"
                value={input.propertyType ?? ""}
                onChange={(event) => setInput({ ...input, propertyType: event.target.value })}
              >
                <option value="">Auto-detect from lookup</option>
                <option value="Condo">Condo</option>
                <option value="Serviced Residence">Serviced Residence</option>
                <option value="Terrace House">Terrace House</option>
                <option value="Semi-D">Semi-D</option>
                <option value="Bungalow">Bungalow</option>
                <option value="Shoplot">Shoplot</option>
                <option value="Residential Property">Residential Property</option>
              </select>
            </label>

            <label className="form-field">
              <span className="form-label">Asking price RM</span>
              <span className="relative">
                <BadgeDollarSign size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden="true" />
                <input
                  className="input pl-12"
                  min={1}
                  placeholder="1250000"
                  type="number"
                  value={numericValue(input.askingPriceRm)}
                  onChange={(event) => setInput({ ...input, askingPriceRm: parseOptionalNumber(event.target.value) })}
                />
              </span>
              {errors.askingPriceRm ? <span className="text-sm text-red-600">{errors.askingPriceRm}</span> : null}
            </label>

            <label className="form-field">
              <span className="form-label">Listing intent</span>
              <select
                className="select"
                value={input.listingIntent ?? ""}
                onChange={(event) => setInput({ ...input, listingIntent: event.target.value ? event.target.value as PropertyReportInput["listingIntent"] : undefined })}
              >
                <option value="">Auto-detect from lookup</option>
                <option value="sale">Sale</option>
                <option value="rent">Rent</option>
                <option value="auction">Auction</option>
                <option value="valuation">Valuation</option>
              </select>
              {errors.listingIntent ? <span className="text-sm text-red-600">{errors.listingIntent}</span> : null}
            </label>

            <label className="form-field">
              <span className="form-label">Tenure</span>
              <select
                className="select"
                value={input.tenure ?? ""}
                onChange={(event) => setInput({ ...input, tenure: event.target.value ? event.target.value as PropertyReportInput["tenure"] : undefined })}
              >
                <option value="">Auto-detect from lookup</option>
                <option value="freehold">Freehold</option>
                <option value="leasehold">Leasehold</option>
                <option value="unknown">Unknown</option>
              </select>
              {errors.tenure ? <span className="text-sm text-red-600">{errors.tenure}</span> : null}
            </label>

            <label className="form-field">
              <span className="form-label">Total square footage</span>
              <span className="relative">
                <Ruler size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden="true" />
                <input
                  className="input pl-12"
                  min={0}
                  type="number"
                  value={numericValue(input.sqft)}
                  onChange={(event) => setInput({ ...input, sqft: parseOptionalNumber(event.target.value) })}
                />
              </span>
              {errors.sqft ? <span className="text-sm text-red-600">{errors.sqft}</span> : null}
            </label>

            <label className="form-field">
              <span className="form-label">Bedrooms</span>
              <input
                className="input"
                min={0}
                type="number"
                value={numericValue(input.bedrooms)}
                onChange={(event) => setInput({ ...input, bedrooms: parseOptionalNumber(event.target.value) })}
              />
              {errors.bedrooms ? <span className="text-sm text-red-600">{errors.bedrooms}</span> : null}
            </label>

            <label className="form-field">
              <span className="form-label">Bathrooms</span>
              <input
                className="input"
                min={0}
                step="0.5"
                type="number"
                value={numericValue(input.bathrooms)}
                onChange={(event) => setInput({ ...input, bathrooms: parseOptionalNumber(event.target.value) })}
              />
              {errors.bathrooms ? <span className="text-sm text-red-600">{errors.bathrooms}</span> : null}
            </label>

            <label className="form-field md:col-span-2">
              <span className="form-label">Year built</span>
              <input
                className="input"
                type="number"
                value={numericValue(input.yearBuilt)}
                onChange={(event) => setInput({ ...input, yearBuilt: parseOptionalNumber(event.target.value) })}
              />
              {errors.yearBuilt ? <span className="text-sm text-red-600">{errors.yearBuilt}</span> : null}
            </label>

            <label className="form-field md:col-span-2">
              <span className="form-label">Source URL</span>
              <span className="relative">
                <Link size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden="true" />
                <input
                  className="input pl-12"
                  placeholder="https://..."
                  value={input.sourceUrl ?? ""}
                  onChange={(event) => setInput({ ...input, sourceUrl: event.target.value })}
                />
              </span>
              {errors.sourceUrl ? <span className="text-sm text-red-600">{errors.sourceUrl}</span> : null}
            </label>

            <label className="form-field md:col-span-2">
              <span className="form-label">Agent notes</span>
              <span className="relative">
                <NotebookPen size={20} className="absolute left-3 top-5 text-slate-500" aria-hidden="true" />
                <textarea
                  className="input min-h-24 resize-y pl-12 pt-3"
                  placeholder="Nearby LRT, renovated kitchen, motivated seller..."
                  value={input.sourceNotes ?? ""}
                  onChange={(event) => setInput({ ...input, sourceNotes: event.target.value })}
                />
              </span>
            </label>
          </div>
        ) : null}

        <div className="flex justify-end gap-3 border-t border-slate-200 pt-6">
          {input.propertyName?.trim() && (
            <button
              className="secondary-button btn-danger px-3 flex items-center justify-center"
              style={{
                minWidth: "auto",
                background: "rgba(239, 68, 68, 0.15)",
                border: "1px solid rgba(239, 68, 68, 0.4)",
                color: "#fca5a5"
              }}
              title="Remove Cache & Reports for this property"
              disabled={saving}
              onClick={() => void removeCache()}
              type="button"
            >
              <Trash2 size={18} aria-hidden="true" />
            </button>
          )}
          <button className="secondary-button min-w-40" disabled={saving} onClick={() => void refreshData()} type="button">
            <RefreshCw size={18} aria-hidden="true" />
            {saving ? "Refreshing..." : "Refresh Data"}
          </button>
          <button className="primary-button min-w-52" disabled={saving} type="submit">
            {saving ? "Generating" : "Generate Report"}
          </button>
        </div>
        {submitError ? <div className="px-4 py-3 rounded-lg" style={{ background: "rgba(220,38,38,0.1)", border: "1px solid rgba(220,38,38,0.3)", color: "#fca5a5" }}>{submitError}</div> : null}
        {generating && (
          <div className="mt-6 border-t border-slate-200 pt-6">
            <ReportWorkflowStatus active={generating} startTime={startTime} />
          </div>
        )}
      </div>
    </form>
  );
}
