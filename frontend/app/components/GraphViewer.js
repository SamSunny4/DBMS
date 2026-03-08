"use client";

import { useEffect, useRef, useMemo, useState } from "react";

// ── Color utilities (consistent with GraphViewer3D) ──────────────────

function riskColor(score) {
  const s = Math.max(0, Math.min(100, score || 0));
  return `hsl(${Math.max(0, Math.round(120 - s * 1.2))}, 85%, 60%)`;
}

function clusterColor(clusterId) {
  return `hsl(${Math.round((clusterId * 137.508) % 360)}, 70%, 55%)`;
}

const FRAUD_COLORS = {
  fanout: "hsl(30, 95%, 60%)",
  fanin: "hsl(280, 80%, 60%)",
  circular: "hsl(0, 90%, 55%)",
  hub: "hsl(200, 90%, 65%)",
  mixer: "hsl(320, 80%, 60%)",
  normal: null,
};

/** Convert `hsl(h, s%, l%)` → `hsla(h, s%, l%, alpha)` for canvas gradients. */
function withAlpha(hslColor, alpha) {
  return hslColor.replace(/^hsl\(/, "hsla(").replace(/\)$/, `, ${alpha})`);
}

export default function GraphViewer({
  elements,
  onNodeClick,
  highlightedNodes = [],
  highlightPath = [],
  style,
}) {
  const containerRef = useRef(null);
  const graphRef = useRef(null);
  const [ForceGraphModule, setForceGraphModule] = useState(null);

  // Dynamically import force-graph (canvas API — not SSR-compatible).
  // d3-zoom (used by force-graph) imports {interrupt} from "d3-transition",
  // which patches Selection.prototype.interrupt as a side effect. Loading
  // d3-transition explicitly first ensures the patch is definitely applied
  // before ForceGraph() is called, regardless of bundler evaluation order.
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      import("d3-transition"),
      import("force-graph"),
    ]).then(([, fgMod]) => {
      if (!cancelled) setForceGraphModule(() => fgMod.default);
    });
    return () => { cancelled = true; };
  }, []);

  // ── Data transformation (mirrors GraphViewer3D) ──────────────────
  const graphData = useMemo(() => {
    if (!elements) return { nodes: [], links: [] };

    const nodeMap = new Map();
    const nodes = [];
    const links = [];

    let maxVol = 0;
    for (const n of elements.nodes || []) {
      const v = parseFloat(n.data?.totalVolume ?? n.data?.value_lossless ?? 0);
      if (v > maxVol) maxVol = v;
    }
    const scaleFactor = maxVol > 0 ? Math.sqrt(maxVol) / 13 : 1;

    let maxLogAmt = 0;
    for (const e of elements.edges || []) {
      const la = parseFloat(e.data?.logAmount ?? 0);
      if (la > maxLogAmt) maxLogAmt = la;
    }
    const edgeWidthScale = maxLogAmt > 0 ? 4 / maxLogAmt : 1;

    for (const n of elements.nodes || []) {
      const totalVol = parseFloat(n.data?.totalVolume ?? n.data?.value_lossless ?? 0);
      const logVol = parseFloat(n.data?.logVolume ?? 0);
      const risk = n.data?.riskScore || 0;
      const clusterId = n.data?.clusterId ?? -1;
      const fraudPattern = n.data?.fraudPattern || "normal";

      const isHighlighted =
        highlightedNodes.includes(n.data.id) || highlightedNodes.includes(n.data.label);
      const isOnPath =
        highlightPath.includes(n.data.id) || highlightPath.includes(n.data.label);

      let color;
      if (isOnPath) color = "hsl(45, 100%, 60%)";
      else if (isHighlighted) color = "hsl(0, 85%, 55%)";
      else if (FRAUD_COLORS[fraudPattern]) color = FRAUD_COLORS[fraudPattern];
      else color = riskColor(risk);

      const rawSize = 4 + Math.sqrt(totalVol) / scaleFactor;
      const nodeSize = Math.max(4, Math.min(rawSize, 20));

      const node = {
        id: n.data.id,
        label: n.data.label || n.data.id,
        nodeType: n.data.nodeType,
        totalVolume: totalVol,
        logVolume: logVol,
        riskScore: risk,
        clusterId,
        fraudPattern,
        color,
        isHighlighted,
        isOnPath,
        nodeSize,
      };
      nodes.push(node);
      nodeMap.set(n.data.id, node);
    }

    for (const e of elements.edges || []) {
      if (!nodeMap.has(e.data.source) || !nodeMap.has(e.data.target)) continue;

      const isPathEdge =
        highlightPath.length > 1 &&
        highlightPath.includes(e.data.source) &&
        highlightPath.includes(e.data.target);

      const logAmt = parseFloat(e.data?.logAmount ?? 0);

      links.push({
        source: e.data.source,
        target: e.data.target,
        edgeType: e.data.edgeType,
        amount: e.data.amount,
        coin_type: e.data.coin_type,
        timestamp: e.data.timestamp,
        txid: e.data.txid || e.data.id,
        label: e.data.label,
        color: isPathEdge ? "rgba(245, 158, 11, 0.8)" : "rgba(100, 120, 160, 0.35)",
        width: isPathEdge ? 3 : Math.max(0.3, logAmt * edgeWidthScale),
        isPathEdge,
      });
    }

    return { nodes, links };
  }, [elements, highlightedNodes, highlightPath]);

  // ── Graph init & update ───────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || !ForceGraphModule) return;

    const container = containerRef.current;

    if (graphRef.current) {
      graphRef.current._destructor?.();
      graphRef.current = null;
      while (container.firstChild) container.removeChild(container.firstChild);
    }

    const Graph = ForceGraphModule()(container)
      .backgroundColor("#050816")
      .width(container.clientWidth)
      .height(container.clientHeight)

      // ── Custom node canvas rendering ──
      .nodeCanvasObjectMode(() => "replace")
      .nodeCanvasObject((node, ctx, globalScale) => {
        const r = (node.nodeSize || 5) / 2;
        const x = node.x ?? 0;
        const y = node.y ?? 0;

        // Outer glow
        const grd = ctx.createRadialGradient(x, y, 0, x, y, r * 3.5);
        grd.addColorStop(0, withAlpha(node.color, 0.35));
        grd.addColorStop(1, withAlpha(node.color, 0));
        ctx.beginPath();
        ctx.arc(x, y, r * 3.5, 0, Math.PI * 2);
        ctx.fillStyle = grd;
        ctx.fill();

        // Core circle
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = node.color;
        ctx.fill();

        // Highlight/path ring
        if (node.isOnPath || node.isHighlighted) {
          ctx.beginPath();
          ctx.arc(x, y, r + 2 / globalScale, 0, Math.PI * 2);
          ctx.strokeStyle = node.isOnPath ? "#f59e0b" : "#ef4444";
          ctx.lineWidth = 2 / globalScale;
          ctx.stroke();
        }

        // Label (visible when zoomed in)
        if (globalScale >= 1.5) {
          const label = node.label?.length > 12
            ? node.label.slice(0, 10) + "\u2026"
            : node.label;
          const fontSize = Math.max(6, 10 / globalScale);
          ctx.font = `${fontSize}px monospace`;
          ctx.fillStyle = "#a1a1aa";
          ctx.textAlign = "center";
          ctx.textBaseline = "top";
          ctx.fillText(label, x, y + r + 2 / globalScale);
        }
      })

      // ── Node tooltip ──
      .nodeLabel((node) => {
        const addr =
          node.label?.length > 20
            ? node.label.slice(0, 10) + "\u2026" + node.label.slice(-6)
            : node.label;
        const vol =
          node.totalVolume > 1e15
            ? (node.totalVolume / 1e18).toFixed(4) + " ETH"
            : node.totalVolume.toLocaleString() + " Wei";
        const riskHue = Math.max(0, Math.round(120 - (node.riskScore || 0) * 1.2));
        const patternBadge =
          node.fraudPattern !== "normal"
            ? `<div style="margin-top:2px;color:${FRAUD_COLORS[node.fraudPattern] || "#fff"};font-weight:700;">\u26a0 ${node.fraudPattern.toUpperCase()}</div>`
            : "";
        return `<div style="background:rgba(5,8,22,0.92);color:#e4e4e7;padding:8px 12px;border-radius:8px;font-size:12px;font-family:monospace;border:1px solid #27272a;pointer-events:none;max-width:300px;">
          <div style="font-weight:700;margin-bottom:4px;">${addr}</div>
          <div style="color:#a1a1aa;">Volume: <span style="color:${node.color}">${vol}</span></div>
          <div style="color:#a1a1aa;">LogVol: <span style="color:#818cf8">${node.logVolume.toFixed(2)}</span></div>
          <div style="color:#a1a1aa;">Risk: <span style="color:hsl(${riskHue}, 85%, 60%)">${node.riskScore}</span></div>
          <div style="color:#a1a1aa;">Cluster: <span style="color:${clusterColor(node.clusterId)}">#${node.clusterId}</span></div>
          ${patternBadge}
        </div>`;
      })

      // ── Link styling ──
      .linkColor((link) => link.color)
      .linkWidth((link) => link.width)
      .linkDirectionalArrowLength(6)
      .linkDirectionalArrowRelPos(1)
      .linkDirectionalArrowColor((link) => link.color)
      .linkCurvature(0.15)
      .linkDirectionalParticles((link) => (link.isPathEdge ? 4 : 1))
      .linkDirectionalParticleWidth(2)
      .linkDirectionalParticleSpeed(0.003)
      .linkDirectionalParticleColor((link) =>
        link.isPathEdge ? "#f59e0b" : "rgba(140, 160, 210, 0.6)"
      )

      // ── Link tooltip ──
      .linkLabel((link) => {
        const src =
          typeof link.source === "object"
            ? link.source.label || link.source.id
            : link.source;
        const tgt =
          typeof link.target === "object"
            ? link.target.label || link.target.id
            : link.target;
        const shortSrc = src?.length > 16 ? src.slice(0, 8) + "\u2026" + src.slice(-6) : src;
        const shortTgt = tgt?.length > 16 ? tgt.slice(0, 8) + "\u2026" + tgt.slice(-6) : tgt;
        const amt =
          link.amount != null
            ? `${Number(link.amount).toLocaleString()} ${link.coin_type || ""}`.trim()
            : "\u2014";
        const ts = link.timestamp
          ? new Date(link.timestamp).toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            })
          : null;
        const txShort =
          link.txid?.length > 20
            ? link.txid.slice(0, 10) + "\u2026" + link.txid.slice(-6)
            : link.txid;
        const pathBadge = link.isPathEdge
          ? `<div style="margin-top:4px;color:#f59e0b;font-weight:700;">&#9654; Path edge</div>`
          : "";
        return `<div style="background:rgba(5,8,22,0.92);color:#e4e4e7;padding:8px 12px;border-radius:8px;font-size:12px;font-family:monospace;border:1px solid #27272a;pointer-events:none;max-width:320px;">
          <div style="font-weight:700;margin-bottom:4px;color:#818cf8;">&#8594; Transfer</div>
          <div style="color:#a1a1aa;">From: <span style="color:#e4e4e7">${shortSrc}</span></div>
          <div style="color:#a1a1aa;">To: &nbsp;&nbsp;<span style="color:#e4e4e7">${shortTgt}</span></div>
          <div style="color:#a1a1aa;margin-top:4px;">Amount: <span style="color:#34d399">${amt}</span></div>
          ${ts ? `<div style="color:#a1a1aa;">Date: <span style="color:#e4e4e7">${ts}</span></div>` : ""}
          ${txShort ? `<div style="color:#a1a1aa;">TxID: <span style="color:#71717a">${txShort}</span></div>` : ""}
          ${pathBadge}
        </div>`;
      })

      // ── Physics ──
      .d3AlphaDecay(0.02)
      .d3VelocityDecay(0.3)
      .warmupTicks(100)
      .cooldownTicks(200)

      // ── Interaction ──
      .onNodeClick((node) => {
        if (onNodeClick && node.nodeType === "Wallet") {
          onNodeClick(node.label || node.id);
        }
      })
      .onNodeHover((node) => {
        window.dispatchEvent(
          new CustomEvent("graph-node-hover", { detail: { node: node || null } })
        );
      });

    // Middle-click: open wallet in new tab
    const handleAuxClick = (e) => {
      if (e.button !== 1 || !graphRef.current) return;
      e.preventDefault();
      const rect = container.getBoundingClientRect();
      const offsetX = e.clientX - rect.left;
      const offsetY = e.clientY - rect.top;
      const graphCoords = graphRef.current.screen2GraphCoords(offsetX, offsetY);
      const nodes = graphRef.current.graphData().nodes;
      let closest = null;
      let minDist = Infinity;
      for (const n of nodes) {
        const dx = (n.x ?? 0) - graphCoords.x;
        const dy = (n.y ?? 0) - graphCoords.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < minDist) { minDist = dist; closest = n; }
      }
      if (closest && closest.nodeType === "Wallet" && minDist < (closest.nodeSize || 5) * 3) {
        window.open(`/wallet/${encodeURIComponent(closest.label || closest.id)}`, "_blank", "noopener,noreferrer");
      }
    };
    container.addEventListener("auxclick", handleAuxClick);

    Graph.d3Force("charge").strength(-80);
    Graph.d3Force("link").distance(50).strength(0.6);

    Graph.graphData(graphData);

    const resizeObs = new ResizeObserver(() => {
      if (graphRef.current) {
        graphRef.current
          .width(container.clientWidth)
          .height(container.clientHeight);
      }
    });
    resizeObs.observe(container);

    graphRef.current = Graph;

    return () => {
      container.removeEventListener("auxclick", handleAuxClick);
      resizeObs.disconnect();
      if (graphRef.current) {
        graphRef.current._destructor?.();
        graphRef.current = null;
      }
    };
  }, [ForceGraphModule, graphData, onNodeClick]);

  return (
    <div className="relative" style={style}>
      <div
        ref={containerRef}
        className="graph-container-2d"
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
}
