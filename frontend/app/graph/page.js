"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { Filter, Route, AlertCircle, Box, Grid2x2, Palette, Timer, Crosshair, Zap, Settings } from "lucide-react";

// Dynamic import — force-graph uses canvas/D3 APIs not available server-side
const GraphViewer = dynamic(() => import("../components/GraphViewer"), { ssr: false });
import { getGraph, getTransactionPath, getMyPreferences, saveMyPreferences } from "@/lib/api";
import { useAuth } from "@/lib/authContext";

// Dynamic import for 3D viewer (not SSR-compatible due to WebGL/Three.js)
const GraphViewer3D = dynamic(() => import("../components/GraphViewer3D"), { ssr: false });

export default function GraphExplorerPageWrapper() {
  return <GraphExplorerPage />;
}

function GraphExplorerPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, selectedDatasetId } = useAuth();
  const [elements, setElements] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [graphInfo, setGraphInfo] = useState(null);
  const [highlightPath, setHighlightPath] = useState([]);

  // View mode
  const [viewMode, setViewMode] = useState("3d"); // "2d" | "3d"

  // Filters
  const [nodeLimit, setNodeLimit] = useState(200);
  const [coinFilter, setCoinFilter] = useState("");
  // Multi-wallet: array of wallet addresses to center the graph on
  const [centerAddresses, setCenterAddresses] = useState(() => {
    const a = searchParams?.get('address');
    return a ? [a] : [];
  });

  // "Applied" filter state — only updated on Apply button click, drives fetchGraph
  const [appliedNodeLimit, setAppliedNodeLimit] = useState(200);
  const [appliedCoinFilter, setAppliedCoinFilter] = useState("");
  const [appliedCenterAddresses, setAppliedCenterAddresses] = useState(() => {
    const a = searchParams?.get('address');
    return a ? [a] : [];
  });

  const [addressInput, setAddressInput] = useState("");
  const [volumeThreshold, setVolumeThreshold] = useState(0);
  const [colorMode, setColorMode] = useState("risk"); // "risk" | "cluster"
  const [animateTime, setAnimateTime] = useState(false);
  const [layoutMode, setLayoutMode] = useState("force"); // "force" | "fraud"
  const [reduceAnimations, setReduceAnimations] = useState(false);
  const [showVizSettings, setShowVizSettings] = useState(false);
  const [vizSettings, setVizSettings] = useState({
    fogDensity: 0.0015,
    particleSpeed: 0.003,
    glowIntensity: 1.0,
    particleCount: 4,
    orbitSpeed: 0.0008,
    gravity: 0.015,
  });

  // URL-derived focus node (camera flies to this address on load)
  const focusNodeId = searchParams?.get('address') || null;

  // Load persisted viz settings from the database (localStorage as instant-restore cache)
  useEffect(() => {
    if (!user?.username) return;
    // Apply localStorage immediately so the graph doesn't flash defaults
    try {
      const cached = localStorage.getItem(`viz_settings_${user.username}`);
      if (cached) setVizSettings(JSON.parse(cached));
    } catch {}
    // Then fetch authoritative copy from DB and apply if different
    getMyPreferences()
      .then(({ preferences }) => {
        if (preferences?.vizSettings) {
          setVizSettings(preferences.vizSettings);
          localStorage.setItem(`viz_settings_${user.username}`, JSON.stringify(preferences.vizSettings));
        }
      })
      .catch(() => {}); // silently fall back to cached/defaults
  }, [user?.username]);

  // Save viz settings to DB (debounced 800 ms) and keep localStorage in sync
  useEffect(() => {
    if (!user?.username) return;
    localStorage.setItem(`viz_settings_${user.username}`, JSON.stringify(vizSettings));
    const timer = setTimeout(() => {
      saveMyPreferences({ vizSettings }).catch(() => {});
    }, 800);
    return () => clearTimeout(timer);
  }, [vizSettings, user?.username]);

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
        limit: appliedNodeLimit,
        coinType: appliedCoinFilter || undefined,
        addresses: appliedCenterAddresses.length > 0 ? appliedCenterAddresses : undefined,
        datasetId: selectedDatasetId,
      });
      setElements(data.elements);
      setGraphInfo(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [appliedNodeLimit, appliedCoinFilter, appliedCenterAddresses, selectedDatasetId]);

  useEffect(() => {
    fetchGraph();
  }, [fetchGraph]);

  const handleNodeClick = useCallback((address) => {
    router.push(`/wallet/${encodeURIComponent(address)}`);
  }, [router]);

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
    <div className="flex h-screen flex-col overflow-hidden">
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
            {/* Multi-wallet chip input */}
            <div
              className="flex flex-wrap items-center gap-1 rounded border border-card-border bg-background px-2 py-0.5 min-w-32 max-w-xs focus-within:border-accent transition-colors"
            >
              {centerAddresses.map((addr) => (
                <span
                  key={addr}
                  className="inline-flex items-center gap-0.5 rounded bg-accent/20 px-1.5 py-0.5 text-[10px] font-mono text-accent"
                >
                  {addr.length > 14 ? addr.slice(0, 6) + "\u2026" + addr.slice(-4) : addr}
                  <button
                    onClick={() => setCenterAddresses((prev) => prev.filter((a) => a !== addr))}
                    className="ml-0.5 leading-none text-accent/60 hover:text-accent"
                  >
                    &times;
                  </button>
                </span>
              ))}
              <input
                type="text"
                placeholder={centerAddresses.length === 0 ? "Wallet(s)\u2026" : "+wallet"}
                value={addressInput}
                onChange={(e) => setAddressInput(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.key === "Enter" || e.key === ",") && addressInput.trim()) {
                    e.preventDefault();
                    const val = addressInput.trim().replace(/,+$/, "");
                    if (val && !centerAddresses.includes(val)) {
                      setCenterAddresses((prev) => [...prev, val]);
                    }
                    setAddressInput("");
                  } else if (e.key === "Backspace" && !addressInput && centerAddresses.length > 0) {
                    setCenterAddresses((prev) => prev.slice(0, -1));
                  }
                }}
                className="min-w-20 flex-1 bg-transparent py-0.5 text-xs focus:outline-none"
              />
            </div>
            <input
              type="number"
              min={10}
              max={1000}
              value={nodeLimit}
              onChange={(e) => setNodeLimit(parseInt(e.target.value) || 200)}
              className="w-16 rounded border border-card-border bg-background px-2 py-1 text-xs focus:border-accent focus:outline-none"
            />
            <button
              onClick={() => {
                setAppliedNodeLimit(nodeLimit);
                setAppliedCoinFilter(coinFilter);
                setAppliedCenterAddresses(centerAddresses);
              }}
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

          {/* Reduce animations toggle (3D mode) */}
          {viewMode === "3d" && (
            <div className="flex items-center gap-1.5 border-l border-card-border pl-2">
              <Zap size={12} className="text-muted" />
              <button
                onClick={() => setReduceAnimations(!reduceAnimations)}
                className={`rounded border px-2 py-0.5 text-[10px] font-medium transition-colors ${
                  reduceAnimations
                    ? "border-green-500 bg-green-500/20 text-green-400"
                    : "border-card-border bg-background text-muted hover:text-foreground"
                }`}
              >
                {reduceAnimations ? "Lite Mode ✓" : "Lite Mode"}
              </button>
            </div>
          )}

          {/* Visualization settings (3D mode) */}
          {viewMode === "3d" && (
            <div className="relative flex items-center gap-1.5 border-l border-card-border pl-2">
              <Settings size={12} className="text-muted" />
              <button
                onClick={() => setShowVizSettings(!showVizSettings)}
                className={`rounded border px-2 py-0.5 text-[10px] font-medium transition-colors ${
                  showVizSettings
                    ? "border-accent bg-accent/20 text-accent"
                    : "border-card-border bg-background text-muted hover:text-foreground"
                }`}
              >
                Viz Settings
              </button>
              {showVizSettings && (
                <div className="absolute top-full right-0 z-50 mt-2 w-64 rounded-lg border border-card-border bg-card p-3 shadow-xl backdrop-blur-sm">
                  <div className="mb-2 text-[11px] font-semibold text-foreground uppercase tracking-wider">
                    Visualization Settings
                  </div>

                  {/* Fog Density */}
                  <div className="mb-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] text-muted">Fog Density</label>
                      <span className="text-[10px] font-mono text-muted">{vizSettings.fogDensity.toFixed(4)}</span>
                    </div>
                    <input
                      type="range" min="0" max="0.005" step="0.0001"
                      value={vizSettings.fogDensity}
                      onChange={(e) => setVizSettings(prev => ({ ...prev, fogDensity: parseFloat(e.target.value) }))}
                      className="mt-0.5 h-1 w-full cursor-pointer accent-accent"
                    />
                  </div>

                  {/* Particle Speed */}
                  <div className="mb-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] text-muted">Particle Speed</label>
                      <span className="text-[10px] font-mono text-muted">{vizSettings.particleSpeed.toFixed(4)}</span>
                    </div>
                    <input
                      type="range" min="0" max="0.01" step="0.0005"
                      value={vizSettings.particleSpeed}
                      onChange={(e) => setVizSettings(prev => ({ ...prev, particleSpeed: parseFloat(e.target.value) }))}
                      className="mt-0.5 h-1 w-full cursor-pointer accent-accent"
                    />
                  </div>

                  {/* Particle Count */}
                  <div className="mb-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] text-muted">Particle Count</label>
                      <span className="text-[10px] font-mono text-muted">{vizSettings.particleCount}</span>
                    </div>
                    <input
                      type="range" min="0" max="10" step="1"
                      value={vizSettings.particleCount}
                      onChange={(e) => setVizSettings(prev => ({ ...prev, particleCount: parseInt(e.target.value) }))}
                      className="mt-0.5 h-1 w-full cursor-pointer accent-accent"
                    />
                  </div>

                  {/* Glow Intensity */}
                  <div className="mb-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] text-muted">Glow Intensity</label>
                      <span className="text-[10px] font-mono text-muted">{vizSettings.glowIntensity.toFixed(1)}</span>
                    </div>
                    <input
                      type="range" min="0" max="2" step="0.1"
                      value={vizSettings.glowIntensity}
                      onChange={(e) => setVizSettings(prev => ({ ...prev, glowIntensity: parseFloat(e.target.value) }))}
                      className="mt-0.5 h-1 w-full cursor-pointer accent-accent"
                    />
                  </div>

                  {/* Orbit Speed */}
                  <div className="mb-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] text-muted">Orbit Speed</label>
                      <span className="text-[10px] font-mono text-muted">{vizSettings.orbitSpeed.toFixed(4)}</span>
                    </div>
                    <input
                      type="range" min="0" max="0.003" step="0.0001"
                      value={vizSettings.orbitSpeed}
                      onChange={(e) => setVizSettings(prev => ({ ...prev, orbitSpeed: parseFloat(e.target.value) }))}
                      className="mt-0.5 h-1 w-full cursor-pointer accent-accent"
                    />
                  </div>

                  {/* Gravity */}
                  <div className="mb-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] text-muted">Gravity</label>
                      <span className="text-[10px] font-mono text-muted">{(vizSettings.gravity ?? 0.015).toFixed(3)}</span>
                    </div>
                    <input
                      type="range" min="0" max="0.08" step="0.001"
                      value={vizSettings.gravity ?? 0.015}
                      onChange={(e) => setVizSettings(prev => ({ ...prev, gravity: parseFloat(e.target.value) }))}
                      className="mt-0.5 h-1 w-full cursor-pointer accent-accent"
                    />
                  </div>

                  {/* Reset button */}
                  <button
                    onClick={() => setVizSettings({ fogDensity: 0.0015, particleSpeed: 0.003, glowIntensity: 1.0, particleCount: 4, orbitSpeed: 0.0008, gravity: 0.015 })}
                    className="mt-1 w-full rounded border border-card-border bg-background px-2 py-1 text-[10px] font-medium text-muted hover:text-foreground transition-colors"
                  >
                    Reset Defaults
                  </button>
                </div>
              )}
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
      <div className="flex-1 min-h-0 overflow-hidden">
        {loading && !elements ? (
          <div className="flex h-full items-center justify-center bg-[#050816]">
            <p className="text-xs font-medium tracking-widest text-indigo-300/50 uppercase animate-pulse">
              Fetching data
            </p>
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
              highlightedNodes={centerAddresses}
              volumeThreshold={volumeThreshold}
              colorMode={colorMode}
              animateTime={animateTime}
              layoutMode={layoutMode}
              reduceAnimations={reduceAnimations}
              vizSettings={vizSettings}
              focusNodeId={centerAddresses.length === 1 ? (focusNodeId || centerAddresses[0]) : undefined}
              style={{ width: "100%", height: "100%" }}
            />
          ) : (
            <GraphViewer
              elements={elements}
              onNodeClick={handleNodeClick}
              highlightPath={highlightPath}
              highlightedNodes={centerAddresses}
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
