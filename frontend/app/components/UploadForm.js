"use client";

import { useState, useRef, useEffect } from "react";
import {
  Upload, FileText, CheckCircle, AlertCircle, Trash2,
  Database, User, Plus, Calendar, Rows3,
} from "lucide-react";
import {
  uploadTransactions, uploadUserData,
  getUserDatasets, deleteUserDataset, clearDatabase,
} from "@/lib/api";
import { useAuth } from "@/lib/authContext";

export default function UploadForm() {
  const { isAdmin, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState("personal");

  // ── Admin tab state ──────────────────────────────────────────────────────
  const [adminFile, setAdminFile] = useState(null);
  const [adminDragover, setAdminDragover] = useState(false);
  const [adminUploading, setAdminUploading] = useState(false);
  const [adminResult, setAdminResult] = useState(null);
  const [adminError, setAdminError] = useState(null);
  const [clearing, setClearing] = useState(false);
  const [clearResult, setClearResult] = useState(null);
  const adminInputRef = useRef(null);

  // ── Personal tab state ───────────────────────────────────────────────────
  const [personalFile, setPersonalFile] = useState(null);
  const [personalDragover, setPersonalDragover] = useState(false);
  const [datasetName, setDatasetName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [uploadError, setUploadError] = useState(null);
  const [userDatasets, setUserDatasets] = useState([]);
  const [datasetsLoading, setDatasetsLoading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const personalInputRef = useRef(null);

  useEffect(() => {
    if (!authLoading) loadDatasets();
  }, [authLoading]);

  const loadDatasets = async () => {
    setDatasetsLoading(true);
    try {
      const { datasets } = await getUserDatasets();
      setUserDatasets(datasets);
    } catch { /* silently ignore */ } finally {
      setDatasetsLoading(false);
    }
  };

  const handleAdminUpload = async () => {
    if (!adminFile) return;
    setAdminUploading(true);
    setAdminError(null);
    setAdminResult(null);
    try {
      const data = await uploadTransactions(adminFile);
      setAdminResult(data);
      setAdminFile(null);
    } catch (err) {
      setAdminError(err.message);
    } finally {
      setAdminUploading(false);
    }
  };

  const handlePersonalUpload = async () => {
    if (!personalFile) return;
    setUploading(true);
    setUploadError(null);
    setUploadResult(null);
    try {
      const name = datasetName.trim() || personalFile.name.replace(/\.[^.]+$/, "");
      const data = await uploadUserData(personalFile, name);
      setUploadResult(data);
      setPersonalFile(null);
      setDatasetName("");
      await loadDatasets();
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDataset = async (id) => {
    if (!window.confirm("Delete this dataset and all its data? This cannot be undone.")) return;
    setDeletingId(id);
    try {
      await deleteUserDataset(id);
      setUserDatasets((prev) => prev.filter((d) => d.id !== id));
    } catch { /* silently ignore */ } finally {
      setDeletingId(null);
    }
  };

  const handleClear = async () => {
    if (!window.confirm("Delete ALL nodes and transactions from the shared database? This cannot be undone.")) return;
    setClearing(true);
    setClearResult(null);
    setAdminError(null);
    try {
      const data = await clearDatabase();
      setClearResult(data);
    } catch (err) {
      setAdminError(err.message);
    } finally {
      setClearing(false);
    }
  };

  if (authLoading) return null;

  return (
    <div className="space-y-6">
      {/* Tab bar */}
      <div className="flex rounded-lg border border-card-border bg-card p-1 gap-1">
        {isAdmin && (
          <button
            onClick={() => setActiveTab("main")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === "main" ? "bg-accent text-white" : "text-muted hover:text-foreground"
            }`}
          >
            <Database size={14} />
            Main Database
            <span className="rounded bg-danger/20 px-1.5 py-0.5 text-[10px] font-semibold text-danger">
              ADMIN
            </span>
          </button>
        )}
        <button
          onClick={() => setActiveTab("personal")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "personal" ? "bg-accent text-white" : "text-muted hover:text-foreground"
          }`}
        >
          <User size={14} />
          My Datasets
        </button>
      </div>

      {/* ── Admin Tab ───────────────────────────────────────────────────── */}
      {activeTab === "main" && isAdmin && (
        <div className="space-y-4">
          {/* Drop zone */}
          <div
            className={`upload-zone flex flex-col items-center justify-center gap-4 p-12 text-center ${adminDragover ? "dragover" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setAdminDragover(true); }}
            onDragLeave={() => setAdminDragover(false)}
            onDrop={(e) => {
              e.preventDefault();
              setAdminDragover(false);
              const f = e.dataTransfer.files?.[0];
              if (f) { setAdminFile(f); setAdminResult(null); setAdminError(null); }
            }}
            onClick={() => adminInputRef.current?.click()}
          >
            <Upload size={40} className="text-muted" />
            <div>
              <p className="text-sm font-medium text-foreground">
                Drop transaction file here to update the Main Database
              </p>
              <p className="mt-1 text-xs text-muted">CSV or JSON · max 50 MB · admin only</p>
            </div>
            <input
              ref={adminInputRef}
              type="file"
              accept=".csv,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) { setAdminFile(f); setAdminResult(null); setAdminError(null); }
              }}
            />
          </div>

          {adminFile && (
            <div className="flex items-center justify-between rounded-lg border border-card-border bg-card p-4">
              <div className="flex items-center gap-3">
                <FileText size={20} className="text-accent" />
                <div>
                  <p className="text-sm font-medium">{adminFile.name}</p>
                  <p className="text-xs text-muted">{(adminFile.size / 1024).toFixed(1)} KB</p>
                </div>
              </div>
              <button
                onClick={handleAdminUpload}
                disabled={adminUploading}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
              >
                {adminUploading ? "Uploading…" : "Upload & Process"}
              </button>
            </div>
          )}

          {adminResult && <UploadResult result={adminResult} />}
          {adminError && <UploadError error={adminError} />}

          {/* Clear shared database */}
          <div className="flex items-center justify-between rounded-lg border border-card-border bg-card p-4">
            <div>
              <p className="text-sm font-medium">Clear Shared Database</p>
              <p className="text-xs text-muted">Remove all shared nodes and transactions</p>
            </div>
            <button
              onClick={handleClear}
              disabled={clearing}
              className="rounded-lg bg-danger px-4 py-2 text-sm font-medium text-white hover:opacity-80 disabled:opacity-50"
            >
              {clearing ? "Clearing…" : "Clear Database"}
            </button>
          </div>

          {clearResult && (
            <div className="rounded-lg border border-success/30 bg-success/5 p-4">
              <div className="flex items-center gap-2 text-success">
                <CheckCircle size={18} />
                <span className="text-sm font-semibold">
                  Database cleared — {clearResult.nodesDeleted} node(s) deleted
                </span>
              </div>
            </div>
          )}

          <FormatGuide />
        </div>
      )}

      {/* ── Personal Tab ────────────────────────────────────────────────── */}
      {activeTab === "personal" && (
        <div className="space-y-6">
          {/* Upload new dataset */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Upload New Dataset</h3>
            <input
              type="text"
              placeholder="Dataset name (optional — defaults to filename)"
              value={datasetName}
              onChange={(e) => setDatasetName(e.target.value)}
              className="w-full rounded-lg border border-card-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none"
            />
            <div
              className={`upload-zone flex flex-col items-center justify-center gap-4 p-10 text-center ${personalDragover ? "dragover" : ""}`}
              onDragOver={(e) => { e.preventDefault(); setPersonalDragover(true); }}
              onDragLeave={() => setPersonalDragover(false)}
              onDrop={(e) => {
                e.preventDefault();
                setPersonalDragover(false);
                const f = e.dataTransfer.files?.[0];
                if (f) setPersonalFile(f);
              }}
              onClick={() => personalInputRef.current?.click()}
            >
              <Upload size={36} className="text-muted" />
              <div>
                <p className="text-sm font-medium text-foreground">Drop your transaction file here</p>
                <p className="mt-1 text-xs text-muted">CSV or JSON · max 50 MB</p>
              </div>
              <input
                ref={personalInputRef}
                type="file"
                accept=".csv,.json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) setPersonalFile(f);
                }}
              />
            </div>

            {personalFile && (
              <div className="flex items-center justify-between rounded-lg border border-card-border bg-card p-4">
                <div className="flex items-center gap-3">
                  <FileText size={20} className="text-accent" />
                  <div>
                    <p className="text-sm font-medium">{personalFile.name}</p>
                    <p className="text-xs text-muted">{(personalFile.size / 1024).toFixed(1)} KB</p>
                  </div>
                </div>
                <button
                  onClick={handlePersonalUpload}
                  disabled={uploading}
                  className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
                >
                  {uploading ? "Uploading…" : "Upload & Process"}
                </button>
              </div>
            )}

            {uploadResult && (
              <UploadResult
                result={uploadResult}
                extra={
                  <p className="mt-1 text-xs text-success">
                    Dataset &ldquo;{uploadResult.dataset?.name}&rdquo; created — switch to the Graph
                    Explorer to analyze it.
                  </p>
                }
              />
            )}
            {uploadError && <UploadError error={uploadError} />}
          </div>

          {/* Existing datasets list */}
          <div>
            <h3 className="mb-3 text-sm font-semibold">My Uploaded Datasets</h3>
            {datasetsLoading ? (
              <p className="text-xs text-muted">Loading…</p>
            ) : userDatasets.length === 0 ? (
              <div className="rounded-lg border border-card-border bg-card p-6 text-center">
                <Plus size={24} className="mx-auto mb-2 text-muted" />
                <p className="text-sm text-muted">No datasets yet.</p>
                <p className="mt-1 text-xs text-muted">Upload your first dataset above to start analyzing it.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {userDatasets.map((ds) => (
                  <div
                    key={ds.id}
                    className="flex items-center justify-between rounded-lg border border-card-border bg-card p-4"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Database size={18} className="shrink-0 text-accent" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{ds.name}</p>
                        <div className="flex flex-wrap items-center gap-3 mt-0.5">
                          <span className="flex items-center gap-1 text-xs text-muted">
                            <FileText size={10} />
                            {ds.filename}
                          </span>
                          <span className="flex items-center gap-1 text-xs text-muted">
                            <Rows3 size={10} />
                            {ds.rowCount?.toLocaleString()} rows
                          </span>
                          <span className="flex items-center gap-1 text-xs text-muted">
                            <Calendar size={10} />
                            {ds.createdAt ? new Date(ds.createdAt).toLocaleDateString() : "—"}
                          </span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteDataset(ds.id)}
                      disabled={deletingId === ds.id}
                      className="ml-4 shrink-0 flex items-center gap-1.5 rounded-lg border border-danger/30 bg-danger/5 px-3 py-1.5 text-xs font-medium text-danger hover:bg-danger/10 disabled:opacity-50 transition-colors"
                    >
                      <Trash2 size={12} />
                      {deletingId === ds.id ? "Deleting…" : "Delete"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <FormatGuide />
        </div>
      )}
    </div>
  );
}

function UploadResult({ result, extra }) {
  return (
    <div className="rounded-lg border border-success/30 bg-success/5 p-5">
      <div className="flex items-center gap-2 text-success">
        <CheckCircle size={18} />
        <span className="text-sm font-semibold">Upload Successful</span>
      </div>
      {extra}
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Total Rows" value={result.totalRows} />
        <Stat label="Valid" value={result.validTransactions} />
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
              <li key={i} className="text-xs text-muted">{err}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function UploadError({ error }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/5 p-4">
      <AlertCircle size={18} className="mt-0.5 shrink-0 text-danger" />
      <p className="text-sm text-danger">{error}</p>
    </div>
  );
}

function FormatGuide() {
  return (
    <div className="rounded-lg border border-card-border bg-card p-5 space-y-4">
      <h3 className="text-sm font-semibold">Required Upload Format</h3>

      <div>
        <p className="text-xs font-semibold text-accent uppercase tracking-wide mb-1">
          Standard Format — CSV or JSON
        </p>
        <p className="mb-2 text-xs text-muted">
          Required columns (header names are case-insensitive):
        </p>
        <code className="block rounded bg-background p-3 font-mono text-xs text-foreground">
          transaction_id &nbsp;·&nbsp; wallet_from &nbsp;·&nbsp; wallet_to &nbsp;·&nbsp; amount
          &nbsp;·&nbsp; coin_type &nbsp;·&nbsp; timestamp
        </code>
        <p className="mt-2 text-xs text-muted">
          Optional column: <code className="text-foreground">value_lossless</code> — raw integer
          amount for high-precision display (e.g. Wei for ETH).
        </p>
      </div>

      <div>
        <p className="text-xs font-semibold text-accent uppercase tracking-wide mb-1">
          Example CSV
        </p>
        <pre className="rounded bg-background p-3 font-mono text-xs text-muted overflow-x-auto whitespace-pre">{`transaction_id,wallet_from,wallet_to,amount,coin_type,timestamp
tx_001,0xABC123,0xDEF456,1.5,ETH,2024-01-15T10:30:00Z
tx_002,0xDEF456,0x789ABC,0.025,BTC,2024-01-15T11:00:00Z
tx_003,0x111222,0x333444,500,USDT,2024-01-15T11:30:00Z`}</pre>
      </div>

      <div>
        <p className="text-xs font-semibold text-accent uppercase tracking-wide mb-1">
          Example JSON
        </p>
        <pre className="rounded bg-background p-3 font-mono text-xs text-muted overflow-x-auto whitespace-pre">{`[
  {
    "transaction_id": "tx_001",
    "wallet_from": "0xABC123",
    "wallet_to": "0xDEF456",
    "amount": "1.5",
    "coin_type": "ETH",
    "timestamp": "2024-01-15T10:30:00Z"
  }
]`}</pre>
      </div>

      <div>
        <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-1">
          Also supported — BigQuery Ethereum Export
        </p>
        <code className="block rounded bg-background p-3 font-mono text-xs text-muted">
          transaction_hash, from_address, to_address, value (Wei), block_timestamp, …
        </code>
        <p className="mt-1 text-xs text-muted">
          Auto-detected · Wei values converted to ETH · coin_type forced to ETH
        </p>
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


export default function UploadForm() {
  const { isAdmin, loading: authLoading } = useAuth();
  const [dragover, setDragover] = useState(false);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [clearing, setClearing] = useState(false);
  const [clearResult, setClearResult] = useState(null);
  const inputRef = useRef(null);

  if (authLoading) return null;

  if (!isAdmin) {
    return (
      <div className="rounded-xl border border-card-border bg-card p-10 text-center">
        <ShieldOff size={36} className="mx-auto mb-4 text-muted" />
        <p className="text-sm font-semibold text-foreground">Admin access required</p>
        <p className="mt-1 text-xs text-muted">Only administrators can upload transaction data.</p>
      </div>
    );
  }

  const handleClear = async () => {
    if (!window.confirm('Delete ALL nodes and transactions from the database? This cannot be undone.')) return;
    setClearing(true);
    setClearResult(null);
    setError(null);
    try {
      const data = await clearDatabase();
      setClearResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setClearing(false);
    }
  };

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

      {/* Clear database */}
      <div className="flex items-center justify-between rounded-lg border border-card-border bg-card p-4">
        <div>
          <p className="text-sm font-medium">Clear Database</p>
          <p className="text-xs text-muted">Remove all nodes and transactions from Neo4j</p>
        </div>
        <button
          onClick={handleClear}
          disabled={clearing}
          className="rounded-lg bg-danger px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-80 disabled:opacity-50"
        >
          {clearing ? 'Clearing...' : 'Clear Database'}
        </button>
      </div>

      {clearResult && (
        <div className="rounded-lg border border-success/30 bg-success/5 p-4">
          <div className="flex items-center gap-2 text-success">
            <CheckCircle size={18} />
            <span className="text-sm font-semibold">Database cleared — {clearResult.nodesDeleted} node(s) deleted</span>
          </div>
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
        <h3 className="text-sm font-semibold">Supported Formats</h3>
        <p className="mt-3 text-xs font-medium text-muted uppercase tracking-wide">Internal format (CSV / JSON)</p>
        <code className="mt-1 block rounded bg-background p-3 font-mono text-xs text-muted">
          transaction_id, wallet_from, wallet_to, amount, coin_type, timestamp
        </code>
        <p className="mt-3 text-xs font-medium text-muted uppercase tracking-wide">BigQuery Ethereum export (CSV)</p>
        <code className="mt-1 block rounded bg-background p-3 font-mono text-xs text-muted">
          transaction_hash, from_address, to_address, value (Wei), block_timestamp, block_number, …
        </code>
        <p className="mt-2 text-xs text-muted">
          BigQuery rows are auto-detected and normalised — Wei values are converted to ETH, coin type is set to ETH.
        </p>
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
