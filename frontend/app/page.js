"use client";

import { useEffect, useState } from "react";
import { Wallet, ArrowRightLeft, Coins, ShieldAlert } from "lucide-react";
import StatCard from "./components/StatCard";
import SearchBar from "./components/SearchBar";
import LoadingSpinner from "./components/LoadingSpinner";
import { getStats } from "@/lib/api";

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    getStats()
      .then(setStats)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted">
          Overview of your blockchain transaction analysis
        </p>
      </div>

      {/* Search */}
      <div className="mb-8">
        <SearchBar placeholder="Search for a wallet address..." />
      </div>

      {/* Stats */}
      {loading ? (
        <LoadingSpinner text="Loading statistics..." />
      ) : error ? (
        <div className="rounded-lg border border-danger/30 bg-danger/5 p-4">
          <p className="text-sm text-danger">
            Could not connect to backend: {error}
          </p>
          <p className="mt-1 text-xs text-muted">
            Make sure the Fastify server is running on{" "}
            {process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Wallets"
            value={stats?.wallets?.toLocaleString() ?? 0}
            icon={Wallet}
            color="text-accent"
          />
          <StatCard
            title="Transactions"
            value={stats?.transactions?.toLocaleString() ?? 0}
            icon={ArrowRightLeft}
            color="text-blue-400"
          />
          <StatCard
            title="Cryptocurrencies"
            value={stats?.coins ?? 0}
            icon={Coins}
            color="text-warning"
          />
          <StatCard
            title="Suspicious Wallets"
            value={stats?.suspiciousWallets ?? 0}
            icon={ShieldAlert}
            color="text-danger"
          />
        </div>
      )}

      {/* Quick actions */}
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <QuickAction
          href="/upload"
          title="Upload Data"
          description="Import transaction datasets in CSV or JSON"
        />
        <QuickAction
          href="/graph"
          title="Explore Graph"
          description="Visualize wallet transaction networks"
        />
        <QuickAction
          href="/suspicious"
          title="Fraud Detection"
          description="Analyze suspicious transaction patterns"
        />
      </div>
    </div>
  );
}

function QuickAction({ href, title, description }) {
  return (
    <a
      href={href}
      className="group rounded-xl border border-card-border bg-card p-5 transition-colors hover:border-accent/50"
    >
      <h3 className="text-sm font-semibold group-hover:text-accent">
        {title}
      </h3>
      <p className="mt-1 text-xs text-muted">{description}</p>
    </a>
  );
}
