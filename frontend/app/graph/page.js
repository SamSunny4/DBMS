"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Filter, Route, AlertCircle, Box, Grid2x2, Palette, Timer, Crosshair } from "lucide-react";
import GraphViewer from "../components/GraphViewer";
import LoadingSpinner from "../components/LoadingSpinner";
import { getGraph, getTransactionPath } from "@/lib/api";

// Dynamic import for 3D viewer (not SSR-compatible due to WebGL/Three.js)
const GraphViewer3D = dynamic(() => import("../components/GraphViewer3D"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center">
      <LoadingSpinner text="Loading 3D engine..." />
    </div>
  ),
});

export default function GraphExplorerPage() {
  const router = useRouter();
  const [elements, setElements] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [graphInfo, setGraphInfo] = useState(null);
  const [highlightPath, setHighlightPath] = useState([]);

  // View mode
  const [viewMode, setViewMode] = useState("3d"); // "2d" | "3d"

  // Filters
  const [nodeLimit, setNodeLimit] = useState(200);
  const [coinFilter, setCoinFilter] = useState("");
  const [centerAddress, setCenterAddress] = useState("");
  const [volumeThreshold, setVolumeThreshold] = useState(0);
  const [colorMode, setColorMode] = useState("risk"); // "risk" | "cluster"
  const [animateTime, setAnimateTime] = useState(false);
  const [layoutMode, setLayoutMode] = useState("force"); // "force" | "fraud"

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

        {/* 2D / 3D toggle */}
        <div className="flex items-center rounded-md border border-card-border bg-background">
          <button
            onClick={() => setViewMode("2d")}
            className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium transition-colors ${
              viewMode === "2d"
                ? "bg-accent text-white"
                : "text-muted hover:text-foreground"
            } rounded-l-md`}
          >
            <Grid2x2 size={12} /> 2D
          </button>
          <button
            onClick={() => setViewMode("3d")}
            className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium transition-colors ${
              viewMode === "3d"
                ? "bg-accent text-white"
                : "text-muted hover:text-foreground"
            } rounded-r-md`}
          >
            <Box size={12} /> 3D
          </button>
        </div>

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

          {/* value_lossless threshold (3D mode) */}
          {viewMode === "3d" && (
            <div className="flex items-center gap-1.5 border-l border-card-border pl-2">
              <span className="text-[10px] text-muted whitespace-nowrap">Vol-threshold</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volumeThreshold}
                onChange={(e) =>
                  setVolumeThreshold(parseFloat(e.target.value))
                }
                className="h-1 w-20 cursor-pointer accent-accent"
              />
              <span className="w-8 text-right text-[10px] font-mono text-muted">
                {(volumeThreshold * 100).toFixed(0)}%
              </span>
            </div>
          )}

          {/* Color mode toggle (3D mode) */}
          {viewMode === "3d" && (
            <div className="flex items-center gap-1.5 border-l border-card-border pl-2">
              <Palette size={12} className="text-muted" />
              <button
                onClick={() => setColorMode(colorMode === "risk" ? "cluster" : "risk")}
                className="rounded border border-card-border bg-background px-2 py-0.5 text-[10px] font-medium text-muted hover:text-foreground transition-colors"
              >
                {colorMode === "risk" ? "Risk" : "Cluster"}
              </button>
            </div>
          )}

          {/* Temporal animation toggle (3D mode) */}
          {viewMode === "3d" && (
            <div className="flex items-center gap-1.5 border-l border-card-border pl-2">
              <Timer size={12} className="text-muted" />
              <button
                onClick={() => setAnimateTime(!animateTime)}
                className={`rounded border px-2 py-0.5 text-[10px] font-medium transition-colors ${
                  animateTime
                    ? "border-accent bg-accent/20 text-accent"
                    : "border-card-border bg-background text-muted hover:text-foreground"
                }`}
              >
                {animateTime ? "Timeline ▶" : "Timeline"}
              </button>
            </div>
          )}

          {/* Layout mode toggle (3D mode) */}
          {viewMode === "3d" && (
            <div className="flex items-center gap-1.5 border-l border-card-border pl-2">
              <Crosshair size={12} className="text-muted" />
              <button
                onClick={() => setLayoutMode(layoutMode === "force" ? "fraud" : "force")}
                className={`rounded border px-2 py-0.5 text-[10px] font-medium transition-colors ${
                  layoutMode === "fraud"
                    ? "border-warning bg-warning/20 text-warning"
                    : "border-card-border bg-background text-muted hover:text-foreground"
                }`}
              >
                {layoutMode === "fraud" ? "⚠ Fraud Layout" : "Force Layout"}
              </button>
            </div>
          )}
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
          viewMode === "3d" ? (
            <GraphViewer3D
              elements={elements}
              onNodeClick={handleNodeClick}
              highlightPath={highlightPath}
              volumeThreshold={volumeThreshold}
              colorMode={colorMode}
              animateTime={animateTime}
              layoutMode={layoutMode}
              style={{ width: "100%", height: "100%" }}
            />
          ) : (
            <GraphViewer
              elements={elements}
              onNodeClick={handleNodeClick}
              highlightPath={highlightPath}
              style={{ width: "100%", height: "100%" }}
            />
          )
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
