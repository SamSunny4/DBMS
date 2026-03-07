"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  RefreshCw,
  Eye,
  AlertTriangle,
  ArrowRightLeft,
  Repeat,
  GitFork,
  Users,
} from "lucide-react";
import LoadingSpinner from "../components/LoadingSpinner";
import { getSuspicious } from "@/lib/api";

const DETECTION_TYPES = [
  {
    key: "circular",
    label: "Circular Transfers",
    icon: Repeat,
    description: "Funds cycling back to the originator (A → B → C → A)",
  },
  {
    key: "fanout",
    label: "High Fan-Out",
    icon: GitFork,
    description: "One wallet distributing to many recipients",
  },
  {
    key: "fanin",
    label: "High Fan-In",
    icon: Users,
    description: "Many wallets funneling into one recipient",
  },
  {
    key: "rapid",
    label: "Rapid Transfers",
    icon: ArrowRightLeft,
    description: "Consecutive transfers within a short time window",
  },
  {
    key: "cluster",
    label: "Dense Clusters",
    icon: AlertTriangle,
    description: "Wallets with both high fan-in and fan-out",
  },
];

export default function SuspiciousPage() {
  const router = useRouter();
  const [activeType, setActiveType] = useState("circular");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [threshold, setThreshold] = useState(3);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getSuspicious({ type: activeType, threshold, limit: 30 })
      .then((data) => setResults(data.suspiciousWallets || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [activeType, threshold]);

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">
          Suspicious Activity
        </h1>
        <p className="mt-1 text-sm text-muted">
          Detect fraud patterns in the transaction graph
        </p>
      </div>

      {/* Detection type tabs */}
      <div className="mb-6 flex flex-wrap gap-2">
        {DETECTION_TYPES.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveType(key)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              activeType === key
                ? "bg-accent text-white"
                : "bg-card text-muted hover:text-foreground border border-card-border"
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* Active type description + threshold */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-card-border bg-card p-4">
        <div>
          <p className="text-sm font-medium">
            {DETECTION_TYPES.find((t) => t.key === activeType)?.description}
          </p>
        </div>
        {(activeType === "fanout" ||
          activeType === "fanin" ||
          activeType === "cluster") && (
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted">Threshold:</label>
            <input
              type="number"
              min={2}
              max={100}
              value={threshold}
              onChange={(e) => setThreshold(parseInt(e.target.value) || 3)}
              className="w-16 rounded border border-card-border bg-background px-2 py-1 text-xs focus:border-accent focus:outline-none"
            />
          </div>
        )}
      </div>

      {/* Results */}
      {loading ? (
        <LoadingSpinner text="Running detection query..." />
      ) : error ? (
        <div className="rounded-lg border border-danger/30 bg-danger/5 p-4">
          <p className="text-sm text-danger">{error}</p>
        </div>
      ) : results.length === 0 ? (
        <div className="rounded-lg border border-card-border bg-card p-8 text-center">
          <p className="text-sm text-muted">
            No suspicious patterns detected for this category
          </p>
          <p className="mt-1 text-xs text-muted">
            Try adjusting the threshold or upload more transaction data
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-card-border">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                {activeType === "rapid" ? (
                  <>
                    <th>From</th>
                    <th>Via</th>
                    <th>To</th>
                    <th>Amount 1</th>
                    <th>Amount 2</th>
                  </>
                ) : (
                  <>
                    <th>Wallet</th>
                    {activeType === "circular" && <th>Cycle Depth</th>}
                    {activeType === "fanout" && (
                      <>
                        <th>Out-Degree</th>
                        <th>Total Sent</th>
                      </>
                    )}
                    {activeType === "fanin" && (
                      <>
                        <th>In-Degree</th>
                        <th>Total Received</th>
                      </>
                    )}
                    {activeType === "cluster" && (
                      <>
                        <th>In-Degree</th>
                        <th>Out-Degree</th>
                        <th>Total</th>
                      </>
                    )}
                  </>
                )}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {results.map((item, i) => (
                <tr key={i}>
                  <td className="text-xs text-muted">{i + 1}</td>
                  {activeType === "rapid" ? (
                    <>
                      <td>
                        <WalletLink
                          address={item.from}
                          router={router}
                        />
                      </td>
                      <td>
                        <WalletLink
                          address={item.via}
                          router={router}
                        />
                      </td>
                      <td>
                        <WalletLink
                          address={item.to}
                          router={router}
                        />
                      </td>
                      <td className="font-mono text-xs">{item.amount1}</td>
                      <td className="font-mono text-xs">{item.amount2}</td>
                    </>
                  ) : (
                    <>
                      <td>
                        <WalletLink
                          address={item.address}
                          router={router}
                        />
                      </td>
                      {activeType === "circular" && (
                        <td className="text-xs">{item.depth}</td>
                      )}
                      {activeType === "fanout" && (
                        <>
                          <td className="font-mono text-xs">
                            {item.outDegree}
                          </td>
                          <td className="font-mono text-xs">
                            {item.totalSent?.toLocaleString(undefined, {
                              maximumFractionDigits: 4,
                            })}
                          </td>
                        </>
                      )}
                      {activeType === "fanin" && (
                        <>
                          <td className="font-mono text-xs">
                            {item.inDegree}
                          </td>
                          <td className="font-mono text-xs">
                            {item.totalReceived?.toLocaleString(undefined, {
                              maximumFractionDigits: 4,
                            })}
                          </td>
                        </>
                      )}
                      {activeType === "cluster" && (
                        <>
                          <td className="font-mono text-xs">
                            {item.inDegree}
                          </td>
                          <td className="font-mono text-xs">
                            {item.outDegree}
                          </td>
                          <td className="font-mono text-xs font-bold">
                            {item.totalDegree}
                          </td>
                        </>
                      )}
                    </>
                  )}
                  <td>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          const addr =
                            item.address || item.via || item.from;
                          router.push(
                            `/wallet/${encodeURIComponent(addr)}`
                          );
                        }}
                        className="flex items-center gap-1 rounded px-2 py-1 text-xs text-accent hover:bg-accent/10"
                      >
                        <Eye size={12} /> Inspect
                      </button>
                      <button
                        onClick={() => {
                          const addr =
                            item.address || item.via || item.from;
                          router.push(
                            `/graph?address=${encodeURIComponent(addr)}`
                          );
                        }}
                        className="flex items-center gap-1 rounded px-2 py-1 text-xs text-warning hover:bg-warning/10"
                      >
                        <RefreshCw size={12} /> Visualize
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function WalletLink({ address, router }) {
  return (
    <button
      onClick={() =>
        router.push(`/wallet/${encodeURIComponent(address)}`)
      }
      className="font-mono text-xs text-accent hover:underline"
    >
      {address?.slice(0, 16)}...
    </button>
  );
}
