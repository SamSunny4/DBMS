"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Filter, Route, AlertCircle } from "lucide-react";
import GraphViewer from "../components/GraphViewer";
import LoadingSpinner from "../components/LoadingSpinner";
import { getGraph, getTransactionPath } from "@/lib/api";

export default function GraphExplorerPage() {
  const router = useRouter();
  const [elements, setElements] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [graphInfo, setGraphInfo] = useState(null);
  const [highlightPath, setHighlightPath] = useState([]);

  // Filters
  const [nodeLimit, setNodeLimit] = useState(200);
  const [coinFilter, setCoinFilter] = useState("");
  const [centerAddress, setCenterAddress] = useState("");

  // Path finder
  const [pathFrom, setPathFrom] = useState("");
  const [pathTo, setPathTo] = useState("");
  const [pathLoading, setPathLoading] = useState(false);
  const [pathError, setPathError] = useState(null);

  const fetchGraph = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getGraph({
        limit: nodeLimit,
        coinType: coinFilter || undefined,
        address: centerAddress || undefined,
      });
      setElements(data.elements);
      setGraphInfo(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [nodeLimit, coinFilter, centerAddress]);

  useEffect(() => {
    fetchGraph();
  }, [fetchGraph]);

  const handleNodeClick = (address) => {
    router.push(`/wallet/${encodeURIComponent(address)}`);
  };

  const findPath = async () => {
    if (!pathFrom.trim() || !pathTo.trim()) return;
    setPathLoading(true);
    setPathError(null);
    setHighlightPath([]);

    try {
      const data = await getTransactionPath(pathFrom.trim(), pathTo.trim());
      if (data.found) {
        setElements(data.elements);
        setHighlightPath(data.pathNodeIds);
      } else {
        setPathError(data.message);
      }
    } catch (err) {
      setPathError(err.message);
    } finally {
      setPathLoading(false);
    }
  };

  return (
    <div className="flex h-screen flex-col">
      {/* Header bar */}
      <div className="flex flex-wrap items-center gap-4 border-b border-card-border bg-card px-6 py-3">
        <h1 className="text-lg font-bold tracking-tight">Graph Explorer</h1>

        {graphInfo && (
          <span className="text-xs text-muted">
            {graphInfo.nodeCount} nodes · {graphInfo.edgeCount} edges
            {graphInfo.truncated && " (truncated)"}
          </span>
        )}

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {/* Filters */}
          <div className="flex items-center gap-1.5">
            <Filter size={14} className="text-muted" />
            <input
              type="text"
              placeholder="Coin (e.g. BTC)"
              value={coinFilter}
              onChange={(e) => setCoinFilter(e.target.value.toUpperCase())}
              className="w-28 rounded border border-card-border bg-background px-2 py-1 text-xs focus:border-accent focus:outline-none"
            />
            <input
              type="text"
              placeholder="Center wallet"
              value={centerAddress}
              onChange={(e) => setCenterAddress(e.target.value)}
              className="w-36 rounded border border-card-border bg-background px-2 py-1 text-xs focus:border-accent focus:outline-none"
            />
            <input
              type="number"
              min={10}
              max={1000}
              value={nodeLimit}
              onChange={(e) => setNodeLimit(parseInt(e.target.value) || 200)}
              className="w-16 rounded border border-card-border bg-background px-2 py-1 text-xs focus:border-accent focus:outline-none"
            />
            <button
              onClick={fetchGraph}
              className="rounded bg-accent px-3 py-1 text-xs font-medium text-white hover:bg-accent-hover"
            >
              Apply
            </button>
          </div>
        </div>
      </div>

      {/* Path finder */}
      <div className="flex flex-wrap items-center gap-2 border-b border-card-border bg-background px-6 py-2">
        <Route size={14} className="text-muted" />
        <span className="text-xs text-muted">Path Finder:</span>
        <input
          type="text"
          placeholder="From wallet"
          value={pathFrom}
          onChange={(e) => setPathFrom(e.target.value)}
          className="w-36 rounded border border-card-border bg-card px-2 py-1 text-xs focus:border-accent focus:outline-none"
        />
        <span className="text-xs text-muted">&rarr;</span>
        <input
          type="text"
          placeholder="To wallet"
          value={pathTo}
          onChange={(e) => setPathTo(e.target.value)}
          className="w-36 rounded border border-card-border bg-card px-2 py-1 text-xs focus:border-accent focus:outline-none"
        />
        <button
          onClick={findPath}
          disabled={pathLoading}
          className="rounded bg-warning/80 px-3 py-1 text-xs font-medium text-black hover:bg-warning disabled:opacity-50"
        >
          {pathLoading ? "Finding..." : "Find Path"}
        </button>
        {pathError && (
          <span className="flex items-center gap-1 text-xs text-danger">
            <AlertCircle size={12} /> {pathError}
          </span>
        )}
      </div>

      {/* Graph */}
      <div className="flex-1">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <LoadingSpinner text="Loading graph data..." />
          </div>
        ) : error ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <p className="text-sm text-danger">{error}</p>
              <p className="mt-1 text-xs text-muted">
                Ensure the backend server is running
              </p>
            </div>
          </div>
        ) : elements &&
          (elements.nodes?.length > 0 || elements.edges?.length > 0) ? (
          <GraphViewer
            elements={elements}
            onNodeClick={handleNodeClick}
            highlightPath={highlightPath}
            style={{ width: "100%", height: "100%" }}
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <p className="text-sm text-muted">No graph data available</p>
              <p className="mt-1 text-xs text-muted">
                Upload transaction data first from the Upload page
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
