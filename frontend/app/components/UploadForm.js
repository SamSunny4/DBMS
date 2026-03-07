"use client";

import { useState, useRef } from "react";
import { Upload, FileText, CheckCircle, AlertCircle } from "lucide-react";
import { uploadTransactions } from "@/lib/api";

export default function UploadForm() {
  const [dragover, setDragover] = useState(false);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  const handleFile = (f) => {
    setFile(f);
    setResult(null);
    setError(null);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragover(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);
    setResult(null);

    try {
      const data = await uploadTransactions(file);
      setResult(data);
      setFile(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Drop zone */}
      <div
        className={`upload-zone flex flex-col items-center justify-center gap-4 p-12 text-center ${
          dragover ? "dragover" : ""
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragover(true);
        }}
        onDragLeave={() => setDragover(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <Upload size={40} className="text-muted" />
        <div>
          <p className="text-sm font-medium text-foreground">
            Drop your transaction file here
          </p>
          <p className="mt-1 text-xs text-muted">
            Supports CSV and JSON formats (max 50MB)
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
      </div>

      {/* Selected file */}
      {file && (
        <div className="flex items-center justify-between rounded-lg border border-card-border bg-card p-4">
          <div className="flex items-center gap-3">
            <FileText size={20} className="text-accent" />
            <div>
              <p className="text-sm font-medium">{file.name}</p>
              <p className="text-xs text-muted">
                {(file.size / 1024).toFixed(1)} KB
              </p>
            </div>
          </div>
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
          >
            {uploading ? "Uploading..." : "Upload & Process"}
          </button>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="rounded-lg border border-success/30 bg-success/5 p-5">
          <div className="flex items-center gap-2 text-success">
            <CheckCircle size={18} />
            <span className="text-sm font-semibold">Upload Successful</span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Total Rows" value={result.totalRows} />
            <Stat label="Valid Transactions" value={result.validTransactions} />
            <Stat label="Processed" value={result.transactionsProcessed} />
            <Stat label="Batches" value={result.batches} />
          </div>
          {result.parseErrors?.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-medium text-warning">
                {result.parseErrors.length} parse warning(s):
              </p>
              <ul className="mt-1 space-y-0.5">
                {result.parseErrors.slice(0, 5).map((err, i) => (
                  <li key={i} className="text-xs text-muted">
                    {err}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/5 p-4">
          <AlertCircle size={18} className="mt-0.5 shrink-0 text-danger" />
          <p className="text-sm text-danger">{error}</p>
        </div>
      )}

      {/* Format reference */}
      <div className="rounded-lg border border-card-border bg-card p-5">
        <h3 className="text-sm font-semibold">Expected Format</h3>
        <p className="mt-1 text-xs text-muted">
          CSV or JSON with these fields:
        </p>
        <code className="mt-2 block rounded bg-background p-3 font-mono text-xs text-muted">
          wallet_from, wallet_to, amount, timestamp, coin_type, transaction_id
        </code>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-lg bg-background p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-0.5 text-lg font-bold">{value}</p>
    </div>
  );
}
