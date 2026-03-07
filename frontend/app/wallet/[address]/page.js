"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  ArrowDownLeft,
  ShieldAlert,
  Coins,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import LoadingSpinner from "../../components/LoadingSpinner";
import GraphViewer from "../../components/GraphViewer";
import { getWallet, getGraph } from "@/lib/api";

export default function WalletDetailPage({ params }) {
  const { address } = use(params);
  const decodedAddress = decodeURIComponent(address);
  const router = useRouter();
  const [wallet, setWallet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [graphElements, setGraphElements] = useState(null);
  const [page, setPage] = useState(0);
  const pageSize = 20;

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getWallet(decodedAddress, { skip: page * pageSize, limit: pageSize }),
      getGraph({ address: decodedAddress, limit: 50 }),
    ])
      .then(([walletData, graphData]) => {
        setWallet(walletData);
        setGraphElements(graphData.elements);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [decodedAddress, page]);

  if (loading) {
    return (
      <div className="p-6 lg:p-8">
        <LoadingSpinner text="Loading wallet details..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 lg:p-8">
        <div className="rounded-lg border border-danger/30 bg-danger/5 p-4">
          <p className="text-sm text-danger">{error}</p>
        </div>
      </div>
    );
  }

  const riskLevel =
    wallet.riskScore >= 60 ? "high" : wallet.riskScore >= 30 ? "medium" : "low";

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.back()}
          className="mb-3 flex items-center gap-1 text-xs text-muted hover:text-foreground"
        >
          <ChevronLeft size={14} /> Back
        </button>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-mono text-lg font-bold tracking-tight">
            {decodedAddress}
          </h1>
          <span className={`risk-badge risk-${riskLevel}`}>
            <ShieldAlert size={12} />
            Risk: {wallet.riskScore}/100
          </span>
        </div>
      </div>

      {/* Stats row */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MiniStat
          icon={ArrowUpRight}
          label="Total Sent"
          value={wallet.totalSent.toLocaleString(undefined, {
            maximumFractionDigits: 4,
          })}
          sub={`${wallet.outgoingCount} transactions`}
          color="text-danger"
        />
        <MiniStat
          icon={ArrowDownLeft}
          label="Total Received"
          value={wallet.totalReceived.toLocaleString(undefined, {
            maximumFractionDigits: 4,
          })}
          sub={`${wallet.incomingCount} transactions`}
          color="text-success"
        />
        <MiniStat
          icon={Coins}
          label="Coins Used"
          value={wallet.coins?.join(", ") || "—"}
          sub={`${wallet.coins?.length || 0} type(s)`}
          color="text-warning"
        />
        <MiniStat
          icon={ShieldAlert}
          label="Risk Score"
          value={`${wallet.riskScore}/100`}
          sub={riskLevel.toUpperCase()}
          color={
            riskLevel === "high"
              ? "text-danger"
              : riskLevel === "medium"
              ? "text-warning"
              : "text-success"
          }
        />
      </div>

      {/* Mini graph */}
      {graphElements &&
        (graphElements.nodes?.length > 0 ||
          graphElements.edges?.length > 0) && (
          <div className="mb-6">
            <h2 className="mb-3 text-sm font-semibold">
              Transaction Neighborhood
            </h2>
            <GraphViewer
              elements={graphElements}
              onNodeClick={(addr) =>
                router.push(`/wallet/${encodeURIComponent(addr)}`)
              }
              highlightedNodes={
                wallet.riskScore >= 30 ? [decodedAddress] : []
              }
              style={{ height: "350px" }}
            />
          </div>
        )}

      {/* Transaction table */}
      <div>
        <h2 className="mb-3 text-sm font-semibold">Transactions</h2>
        <div className="overflow-x-auto rounded-lg border border-card-border">
          <table className="data-table">
            <thead>
              <tr>
                <th>Direction</th>
                <th>Counterparty</th>
                <th>Amount</th>
                <th>Coin</th>
                <th>Timestamp</th>
                <th>TX ID</th>
              </tr>
            </thead>
            <tbody>
              {wallet.transactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center text-sm text-muted">
                    No transactions found
                  </td>
                </tr>
              ) : (
                wallet.transactions.map((tx, i) => (
                  <tr key={i}>
                    <td>
                      <span
                        className={`inline-flex items-center gap-1 text-xs font-medium ${
                          tx.direction === "sent"
                            ? "text-danger"
                            : "text-success"
                        }`}
                      >
                        {tx.direction === "sent" ? (
                          <ArrowUpRight size={12} />
                        ) : (
                          <ArrowDownLeft size={12} />
                        )}
                        {tx.direction}
                      </span>
                    </td>
                    <td>
                      <button
                        onClick={() =>
                          router.push(
                            `/wallet/${encodeURIComponent(tx.counterparty)}`
                          )
                        }
                        className="font-mono text-xs text-accent hover:underline"
                      >
                        {tx.counterparty?.slice(0, 16)}...
                      </button>
                    </td>
                    <td className="font-mono text-xs">
                      {tx.amount?.toLocaleString(undefined, {
                        maximumFractionDigits: 8,
                      })}
                    </td>
                    <td className="text-xs">{tx.coin_type}</td>
                    <td className="text-xs text-muted">{tx.timestamp}</td>
                    <td className="max-w-[120px] truncate font-mono text-xs text-muted">
                      {tx.txid}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="mt-3 flex items-center justify-between">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="flex items-center gap-1 rounded px-3 py-1 text-xs text-muted hover:text-foreground disabled:opacity-30"
          >
            <ChevronLeft size={14} /> Previous
          </button>
          <span className="text-xs text-muted">Page {page + 1}</span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={wallet.transactions.length < pageSize}
            className="flex items-center gap-1 rounded px-3 py-1 text-xs text-muted hover:text-foreground disabled:opacity-30"
          >
            Next <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

function MiniStat({ icon: Icon, label, value, sub, color }) {
  return (
    <div className="rounded-xl border border-card-border bg-card p-4">
      <div className="flex items-center gap-2">
        <Icon size={16} className={color} />
        <span className="text-xs text-muted">{label}</span>
      </div>
      <p className="mt-1 text-lg font-bold">{value}</p>
      <p className="text-xs text-muted">{sub}</p>
    </div>
  );
}
