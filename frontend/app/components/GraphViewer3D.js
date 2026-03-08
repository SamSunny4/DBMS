"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";

// ═══════════════════════════════════════════════════════════════════════
// Color utilities
// ═══════════════════════════════════════════════════════════════════════

/** Improved risk gradient: 0 → teal/green, 50 → yellow, 100 → red. */
function riskColor(score) {
  const s = Math.max(0, Math.min(100, score || 0));
  const hue = Math.round(120 - s * 1.2); // 120 → 0 → −20 (clamped)
  return `hsl(${Math.max(0, hue)}, 85%, 60%)`;
}

/** Golden-angle cluster color. */
function clusterColor(clusterId) {
  const hue = (clusterId * 137.508) % 360;
  return `hsl(${Math.round(hue)}, 70%, 55%)`;
}

/** Fraud pattern → distinct color. */
const FRAUD_COLORS = {
  fanout: "hsl(30, 95%, 60%)",    // orange
  fanin: "hsl(280, 80%, 60%)",    // purple
  circular: "hsl(0, 90%, 55%)",   // red
  hub: "hsl(200, 90%, 65%)",      // cyan
  mixer: "hsl(320, 80%, 60%)",    // magenta
  normal: null, // fallback to risk/cluster color
};

/** Parse an `hsl(h, s%, l%)` string into { r, g, b } 0-255. */
function parseColor(str) {
  const m = str.match(/hsl\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*\)/);
  if (m) return hslToRgb(parseFloat(m[1]) / 360, parseFloat(m[2]) / 100, parseFloat(m[3]) / 100);
  return { r: 100, g: 100, b: 255 };
}

function hslToRgb(h, s, l) {
  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const hue2rgb = (pp, qq, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return pp + (qq - pp) * 6 * t;
      if (t < 1 / 2) return qq;
      if (t < 2 / 3) return pp + (qq - pp) * (2 / 3 - t) * 6;
      return pp;
    };
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
}

// ═══════════════════════════════════════════════════════════════════════
// Glow texture (canvas radial gradient)
// ═══════════════════════════════════════════════════════════════════════

function createGlowTexture(color, intensity = 1, size = 128) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const { r, g, b } = parseColor(color);
  const cx = size / 2;
  const rad = size / 2;

  const grad = ctx.createRadialGradient(cx, cx, 0, cx, cx, rad);
  const a = Math.min(1, 0.5 + intensity * 0.5);
  grad.addColorStop(0, `rgba(${r},${g},${b},${a})`);
  grad.addColorStop(0.2, `rgba(${r},${g},${b},${a * 0.75})`);
  grad.addColorStop(0.5, `rgba(${r},${g},${b},${a * 0.25})`);
  grad.addColorStop(1, `rgba(${r},${g},${b},0)`);

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return canvas;
}

// ═══════════════════════════════════════════════════════════════════════
// Starfield generator
// ═══════════════════════════════════════════════════════════════════════

function createStarfield(T, count = 3000, radius = 2000) {
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    // Uniform sphere distribution
    const u = Math.random() * 2 - 1;
    const theta = Math.random() * Math.PI * 2;
    const r = radius * (0.3 + Math.random() * 0.7);
    const s = Math.sqrt(1 - u * u);
    positions[i * 3] = r * s * Math.cos(theta);
    positions[i * 3 + 1] = r * s * Math.sin(theta);
    positions[i * 3 + 2] = r * u;
    sizes[i] = 0.5 + Math.random() * 1.5;
  }
  const geo = new T.BufferGeometry();
  geo.setAttribute("position", new T.BufferAttribute(positions, 3));
  geo.setAttribute("size", new T.BufferAttribute(sizes, 1));

  const mat = new T.PointsMaterial({
    color: 0xaabbff,
    size: 1.2,
    transparent: true,
    opacity: 0.4,
    sizeAttenuation: true,
    depthWrite: false,
  });
  return new T.Points(geo, mat);
}

// ═══════════════════════════════════════════════════════════════════════
// Fraud-pattern layout positions
// ═══════════════════════════════════════════════════════════════════════

function computeFraudLayout(nodes, links) {
  // Group nodes by fraud pattern
  const groups = { fanout: [], fanin: [], circular: [], hub: [], mixer: [], normal: [] };
  for (const n of nodes) groups[n.fraudPattern]?.push(n) ?? groups.normal.push(n);

  // Assign positions by pattern type
  const positions = new Map(); // id → { fx, fy, fzOverride }
  const SPREAD = 200;

  // Fan-out → radial star (center + ring)
  layoutStar(groups.fanout, -SPREAD * 1.5, 0, 0, positions);

  // Fan-in → inverted star
  layoutStar(groups.fanin, SPREAD * 1.5, 0, 0, positions);

  // Circular → ring layout
  layoutRing(groups.circular, 0, SPREAD * 1.5, 0, positions);

  // Hubs → large central positions
  layoutCluster(groups.hub, 0, 0, SPREAD * 0.5, positions);

  // Mixers → tight cluster
  layoutCluster(groups.mixer, 0, -SPREAD * 1.5, 0, positions);

  // Normal → force-directed (no fixed pos)
  // (leave them out of positions map)

  return positions;
}

function layoutStar(nodeList, cx, cy, cz, posMap) {
  if (nodeList.length === 0) return;
  // Sort by volume descending — biggest is center
  const sorted = [...nodeList].sort((a, b) => b.totalVolume - a.totalVolume);
  posMap.set(sorted[0].id, { fx: cx, fy: cy, fzOverride: cz });
  const R = 50 + sorted.length * 3;
  for (let i = 1; i < sorted.length; i++) {
    const angle = ((i - 1) / (sorted.length - 1)) * Math.PI * 2;
    posMap.set(sorted[i].id, {
      fx: cx + R * Math.cos(angle),
      fy: cy + R * Math.sin(angle),
      fzOverride: cz + (Math.random() - 0.5) * 30,
    });
  }
}

function layoutRing(nodeList, cx, cy, cz, posMap) {
  if (nodeList.length === 0) return;
  const R = 30 + nodeList.length * 5;
  for (let i = 0; i < nodeList.length; i++) {
    const angle = (i / nodeList.length) * Math.PI * 2;
    posMap.set(nodeList[i].id, {
      fx: cx + R * Math.cos(angle),
      fy: cy + R * Math.sin(angle),
      fzOverride: cz,
    });
  }
}

function layoutCluster(nodeList, cx, cy, cz, posMap) {
  if (nodeList.length === 0) return;
  for (let i = 0; i < nodeList.length; i++) {
    const angle = (i / Math.max(1, nodeList.length)) * Math.PI * 2;
    const r = 20 + i * 4;
    posMap.set(nodeList[i].id, {
      fx: cx + r * Math.cos(angle),
      fy: cy + r * Math.sin(angle),
      fzOverride: cz + (Math.random() - 0.5) * 40,
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════════════

export default function GraphViewer3D({
  elements,
  onNodeClick,
  highlightedNodes = [],
  highlightPath = [],
  volumeThreshold = 0,
  colorMode = "risk",      // "risk" | "cluster"
  animateTime = false,
  layoutMode = "force",     // "force" | "fraud"
  style,
}) {
  const containerRef = useRef(null);
  const graphRef = useRef(null);
  const animFrameRef = useRef(null);
  const orbitRef = useRef(null);
  const sceneExtrasRef = useRef([]); // track added scene objects for cleanup
  const [ForceGraph3DModule, setForceGraph3DModule] = useState(null);

  // Dynamically import 3d-force-graph
  useEffect(() => {
    let cancelled = false;
    import("3d-force-graph").then((mod) => {
      if (!cancelled) setForceGraph3DModule(() => mod.default);
    });
    return () => { cancelled = true; };
  }, []);

  // Expose THREE globally
  useEffect(() => {
    import("three").then((THREE) => { window.__THREE__ = THREE; });
  }, []);

  // ── Data transformation ──────────────────────────────────────────
  const graphData = useMemo(() => {
    if (!elements) return { nodes: [], links: [] };

    const nodeMap = new Map();
    const nodes = [];
    const links = [];

    // ── Node size scale factor ──
    let maxVol = 0;
    for (const n of elements.nodes || []) {
      const v = parseFloat(n.data?.totalVolume ?? n.data?.value_lossless ?? 0);
      if (v > maxVol) maxVol = v;
    }
    const scaleFactor = maxVol > 0 ? Math.sqrt(maxVol) / 13 : 1;

    // ── Edge width scale ──
    let maxLogAmt = 0;
    for (const e of elements.edges || []) {
      const la = parseFloat(e.data?.logAmount ?? 0);
      if (la > maxLogAmt) maxLogAmt = la;
    }
    const edgeWidthScale = maxLogAmt > 0 ? 4 / maxLogAmt : 1;

    for (const n of elements.nodes || []) {
      const normVol = parseFloat(n.data?.normalizedVolume ?? 0);
      const totalVol = parseFloat(n.data?.totalVolume ?? n.data?.value_lossless ?? 0);
      const logVol = parseFloat(n.data?.logVolume ?? 0);
      const risk = n.data?.riskScore || 0;
      const clusterId = n.data?.clusterId ?? -1;
      const fraudPattern = n.data?.fraudPattern || "normal";

      // Threshold filter
      if (volumeThreshold > 0 && normVol < volumeThreshold) continue;

      const isHighlighted =
        highlightedNodes.includes(n.data.id) || highlightedNodes.includes(n.data.label);
      const isOnPath =
        highlightPath.includes(n.data.id) || highlightPath.includes(n.data.label);

      // ── Color ──
      let color;
      if (isOnPath) {
        color = "hsl(45, 100%, 60%)";
      } else if (isHighlighted) {
        color = "hsl(0, 85%, 55%)";
      } else if (colorMode === "cluster" && clusterId >= 0) {
        color = clusterColor(clusterId);
      } else if (FRAUD_COLORS[fraudPattern]) {
        color = FRAUD_COLORS[fraudPattern];
      } else {
        color = riskColor(risk);
      }

      const nodeSize = 3 + Math.sqrt(totalVol) / scaleFactor;

      const node = {
        id: n.data.id,
        label: n.data.label || n.data.id,
        nodeType: n.data.nodeType,
        totalVolume: totalVol,
        logVolume: logVol,
        normalizedVolume: normVol,
        riskScore: risk,
        clusterId,
        fraudPattern,
        color,
        isHighlighted,
        isOnPath,
        fz: normVol * 300 - 150,
        nodeSize,
        glowIntensity: normVol,
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
        label: e.data.label,
        normalizedTime: parseFloat(e.data?.normalizedTime ?? 0),
        color: isPathEdge ? "rgba(245, 158, 11, 0.8)" : "rgba(100, 120, 160, 0.35)",
        width: isPathEdge ? 3 : Math.max(0.3, logAmt * edgeWidthScale),
        isPathEdge,
      });
    }

    return { nodes, links };
  }, [elements, highlightedNodes, highlightPath, volumeThreshold, colorMode]);

  // ── 3D Graph init & update ─────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || !ForceGraph3DModule) return;

    const container = containerRef.current;

    // Destroy previous instance
    if (graphRef.current) {
      graphRef.current._destructor?.();
      graphRef.current = null;
      while (container.firstChild) container.removeChild(container.firstChild);
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (orbitRef.current) {
      cancelAnimationFrame(orbitRef.current);
      orbitRef.current = null;
    }
    sceneExtrasRef.current = [];

    // ── Fraud pattern layout (pre-assign positions) ──
    let fraudPositions = null;
    if (layoutMode === "fraud") {
      fraudPositions = computeFraudLayout(graphData.nodes, graphData.links);
      for (const node of graphData.nodes) {
        const pos = fraudPositions.get(node.id);
        if (pos) {
          node.fx = pos.fx;
          node.fy = pos.fy;
          node.fz = pos.fzOverride;
        }
      }
    } else {
      // Clear any pinned positions from previous fraud layout
      for (const node of graphData.nodes) {
        delete node.fx;
        delete node.fy;
      }
    }

    const Graph = ForceGraph3DModule()(container)
      .backgroundColor("#050816")
      .showNavInfo(false)

      // ── Curved edges ──
      .linkCurvature(0.25)
      .linkCurveRotation(0)

      // ── Nodes ──
      .nodeThreeObject((node) => {
        const T = window.__THREE__;
        if (!T) return undefined;

        const s = node.nodeSize || 5;
        const { r, g, b } = parseColor(node.color);
        const col = new T.Color(r / 255, g / 255, b / 255);

        // Core sphere — MeshStandardMaterial with emissive
        const geo = new T.SphereGeometry(s * 0.5, 24, 24);
        const mat = new T.MeshStandardMaterial({
          color: col,
          emissive: col,
          emissiveIntensity: 0.5,
          roughness: 0.4,
          metalness: 0.2,
          transparent: true,
          opacity: 0.92,
        });
        const sphere = new T.Mesh(geo, mat);

        // Glow sprite — scaled by volume
        const glowScale = 1 + node.normalizedVolume * 3;
        const canvas = createGlowTexture(node.color, node.glowIntensity);
        const tex = new T.CanvasTexture(canvas);
        const spriteMat = new T.SpriteMaterial({
          map: tex,
          transparent: true,
          blending: T.AdditiveBlending,
          depthWrite: false,
        });
        const sprite = new T.Sprite(spriteMat);
        sprite.scale.set(s * 2.2 * glowScale, s * 2.2 * glowScale, 1);

        const group = new T.Group();
        group.add(sphere);
        group.add(sprite);
        return group;
      })
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

      // ── Edges — animated directional particles ──
      .linkColor((link) => link.color)
      .linkWidth((link) => link.width)
      .linkOpacity(0.55)
      .linkDirectionalParticles(4)
      .linkDirectionalParticleWidth(2)
      .linkDirectionalParticleSpeed(0.003)
      .linkDirectionalParticleColor((link) =>
        link.isPathEdge ? "#f59e0b" : "rgba(140, 160, 210, 0.5)"
      )

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
        container.style.cursor = node ? "pointer" : "default";
      });

    // ── Improved physics forces ──
    Graph.d3Force("charge").strength(-220);
    Graph.d3Force("link").distance(120).strength(0.25);

    // Collision force — prevent node overlap
    import("d3-force-3d").then((d3) => {
      if (!graphRef.current) return;
      Graph.d3Force(
        "collision",
        d3.forceCollide((node) => (node.nodeSize || 5) * 1.4)
      );
    }).catch(() => {
      // d3-force-3d bundled inside 3d-force-graph; if import fails, skip collision
    });

    // Custom Z-force — bias toward log-volume
    if (layoutMode === "force") {
      Graph.d3Force("z", (alpha) => {
        for (const node of graphData.nodes) {
          if (node.fz !== undefined && node.fx === undefined) {
            node.vz += (node.fz - (node.z || 0)) * alpha * 0.3;
          }
        }
      });
    }

    // Mild cluster gravity — pull nodes towards cluster centroid
    Graph.d3Force("cluster", (alpha) => {
      const centroids = new Map();
      const counts = new Map();
      for (const n of graphData.nodes) {
        if (n.clusterId < 0) continue;
        if (!centroids.has(n.clusterId)) {
          centroids.set(n.clusterId, { x: 0, y: 0, z: 0 });
          counts.set(n.clusterId, 0);
        }
        const c = centroids.get(n.clusterId);
        c.x += n.x || 0;
        c.y += n.y || 0;
        c.z += n.z || 0;
        counts.set(n.clusterId, counts.get(n.clusterId) + 1);
      }
      for (const [cid, c] of centroids) {
        const cnt = counts.get(cid);
        c.x /= cnt;
        c.y /= cnt;
        c.z /= cnt;
      }
      const strength = alpha * 0.05;
      for (const n of graphData.nodes) {
        if (n.clusterId < 0 || n.fx !== undefined) continue;
        const c = centroids.get(n.clusterId);
        if (!c) continue;
        n.vx = (n.vx || 0) + (c.x - (n.x || 0)) * strength;
        n.vy = (n.vy || 0) + (c.y - (n.y || 0)) * strength;
        n.vz = (n.vz || 0) + (c.z - (n.z || 0)) * strength;
      }
    });

    Graph.graphData(graphData);

    // ── Scene enhancements (lighting, fog, starfield) ──
    setTimeout(() => {
      const scene = Graph.scene?.();
      const T = window.__THREE__;
      if (!scene || !T) return;

      // Ambient light
      const ambient = new T.AmbientLight(0xffffff, 0.6);
      scene.add(ambient);
      sceneExtrasRef.current.push(ambient);

      // Point light at camera-ish position
      const pointLight = new T.PointLight(0xffffff, 1, 0);
      pointLight.position.set(200, 200, 400);
      scene.add(pointLight);
      sceneExtrasRef.current.push(pointLight);

      // Secondary accent light
      const accentLight = new T.PointLight(0x6366f1, 0.4, 0);
      accentLight.position.set(-300, -100, -200);
      scene.add(accentLight);
      sceneExtrasRef.current.push(accentLight);

      // Depth fog
      scene.fog = new T.FogExp2(0x050816, 0.0015);

      // Starfield background
      const stars = createStarfield(T, 4000, 2000);
      scene.add(stars);
      sceneExtrasRef.current.push(stars);
    }, 100);

    // Camera initial position
    setTimeout(() => {
      Graph.cameraPosition({ x: 0, y: 0, z: 500 }, { x: 0, y: 0, z: 0 }, 1000);
    }, 500);

    graphRef.current = Graph;

    // ── Camera auto-orbit ──
    let orbitAngle = 0;
    let userInteracted = false;
    const onInteract = () => { userInteracted = true; };
    container.addEventListener("pointerdown", onInteract);
    container.addEventListener("wheel", onInteract);

    const orbitTick = () => {
      if (!graphRef.current) return;
      if (!userInteracted) {
        orbitAngle += 0.0008;
        const r = 500;
        graphRef.current.cameraPosition(
          { x: r * Math.sin(orbitAngle), y: 50 * Math.sin(orbitAngle * 0.5), z: r * Math.cos(orbitAngle) },
          { x: 0, y: 0, z: 0 }
        );
      }
      orbitRef.current = requestAnimationFrame(orbitTick);
    };
    // Start orbit after layout settles
    setTimeout(() => {
      orbitRef.current = requestAnimationFrame(orbitTick);
    }, 3000);

    // ── Temporal animation ──
    if (animateTime && graphData.links.length > 0) {
      const sorted = [...graphData.links].sort((a, b) => a.normalizedTime - b.normalizedTime);
      const DURATION = 8000;
      const start = performance.now();
      const tick = () => {
        const elapsed = performance.now() - start;
        const t = Math.min(1, elapsed / DURATION);
        const cutoff = sorted.findIndex((l) => l.normalizedTime > t);
        const visibleLinks = cutoff === -1 ? sorted : sorted.slice(0, cutoff);
        Graph.graphData({ nodes: graphData.nodes, links: visibleLinks });
        if (t < 1) animFrameRef.current = requestAnimationFrame(tick);
      };
      animFrameRef.current = requestAnimationFrame(tick);
    }

    // Resize
    const resizeObs = new ResizeObserver(() => {
      if (graphRef.current) {
        graphRef.current.width(container.clientWidth);
        graphRef.current.height(container.clientHeight);
      }
    });
    resizeObs.observe(container);

    return () => {
      container.removeEventListener("pointerdown", onInteract);
      container.removeEventListener("wheel", onInteract);
      resizeObs.disconnect();
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (orbitRef.current) cancelAnimationFrame(orbitRef.current);
      // Clean up scene extras
      const scene = graphRef.current?.scene?.();
      if (scene) {
        for (const obj of sceneExtrasRef.current) scene.remove(obj);
      }
      if (graphRef.current) {
        graphRef.current._destructor?.();
        graphRef.current = null;
      }
    };
  }, [ForceGraph3DModule, graphData, onNodeClick, animateTime, layoutMode]);

  // ── Legend ──
  const riskGradient =
    "linear-gradient(to right, hsl(120,85%,60%), hsl(60,85%,60%), hsl(0,85%,60%))";
  const clusterCount = new Set(graphData.nodes.map((n) => n.clusterId)).size;
  const fraudCounts = {};
  for (const n of graphData.nodes) {
    if (n.fraudPattern !== "normal") {
      fraudCounts[n.fraudPattern] = (fraudCounts[n.fraudPattern] || 0) + 1;
    }
  }

  return (
    <div className="relative" style={style}>
      <div
        ref={containerRef}
        className="graph-container-3d"
        style={{ width: "100%", height: "100%" }}
      />

      {/* Legend */}
      <div className="absolute bottom-3 left-3 rounded-lg border border-card-border bg-card/90 px-3 py-2 backdrop-blur-sm">
        {colorMode === "risk" ? (
          <>
            <div className="mb-1 text-[10px] font-semibold text-muted uppercase tracking-wider">
              Risk Score
            </div>
            <div className="flex items-center gap-1">
              <div className="h-2 w-16 rounded-sm" style={{ background: riskGradient }} />
              <span className="text-[9px] text-muted ml-1">0 → 100</span>
            </div>
          </>
        ) : (
          <>
            <div className="mb-1 text-[10px] font-semibold text-muted uppercase tracking-wider">
              Communities ({clusterCount})
            </div>
            <div className="flex flex-wrap gap-1">
              {Array.from({ length: Math.min(clusterCount, 6) }, (_, i) => (
                <span
                  key={i}
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: clusterColor(i) }}
                />
              ))}
              {clusterCount > 6 && <span className="text-[9px] text-muted">+{clusterCount - 6}</span>}
            </div>
          </>
        )}

        {/* Fraud patterns detected */}
        {Object.keys(fraudCounts).length > 0 && (
          <div className="mt-1.5 border-t border-card-border pt-1.5">
            <div className="mb-0.5 text-[10px] font-semibold text-muted uppercase tracking-wider">
              Fraud Patterns
            </div>
            {Object.entries(fraudCounts).map(([pat, cnt]) => (
              <div key={pat} className="flex items-center gap-1.5">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: FRAUD_COLORS[pat] || "#888" }}
                />
                <span className="text-[9px] text-muted">
                  {pat} ({cnt})
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="mt-1 text-[10px] text-muted">
          Z = log-volume · Size = √volume · Glow = volume
        </div>
        <div className="mt-1 flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-yellow-400" />
          <span className="text-[9px] text-muted">Path</span>
          <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
          <span className="text-[9px] text-muted">Suspicious</span>
        </div>
      </div>

      {/* Controls hint */}
      <div className="absolute bottom-3 right-3 rounded-lg border border-card-border bg-card/90 px-3 py-2 backdrop-blur-sm">
        <div className="text-[10px] text-muted leading-relaxed">
          <span className="font-medium text-foreground">Controls:</span>{" "}
          Left-drag rotate · Right-drag pan · Scroll zoom
          <br />
          <span className="text-[9px] opacity-60">Camera auto-orbits until you interact</span>
        </div>
      </div>
    </div>
  );
}
