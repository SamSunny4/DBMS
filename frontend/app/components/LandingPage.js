"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ShieldAlert,
  Network,
  Search,
  Zap,
  Eye,
  Activity,
  ArrowRight,
  ChevronRight,
  Terminal,
  Lock,
  GitBranch,
  Cpu,
  Database,
  BarChart3,
  AlertTriangle,
  Globe,
  Code2,
  Layers,
  TrendingUp,
  Clock,
  Box,
  Link2,
  Hash,
} from "lucide-react";

import CyberNetworkCanvas from "./CyberNetworkCanvas";
import { ShaderAnimation } from "./ShaderLines";

// Legacy NetworkCanvas replaced by CyberNetworkCanvas
/*
function NetworkCanvas({ className }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const nodesRef = useRef([]);
  const mouseRef = useRef({ x: -1000, y: -1000 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const resize = () => {
      canvas.width = canvas.offsetWidth * (window.devicePixelRatio || 1);
      canvas.height = canvas.offsetHeight * (window.devicePixelRatio || 1);
      ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
    };
    resize();

    const W = () => canvas.offsetWidth;
    const H = () => canvas.offsetHeight;

    // Initialize nodes
    const NODE_COUNT = 65;
    const nodes = [];
    for (let i = 0; i < NODE_COUNT; i++) {
      const suspicious = Math.random() < 0.12;
      nodes.push({
        x: Math.random() * W(),
        y: Math.random() * H(),
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        r: suspicious ? 3 + Math.random() * 3 : 1.5 + Math.random() * 2.5,
        suspicious,
        pulsePhase: Math.random() * Math.PI * 2,
        opacity: 0.3 + Math.random() * 0.5,
      });
    }
    nodesRef.current = nodes;

    // Edges (fixed topology)
    const edges = [];
    for (let i = 0; i < nodes.length; i++) {
      const conns = 1 + Math.floor(Math.random() * 2);
      for (let c = 0; c < conns; c++) {
        const j = (i + 1 + Math.floor(Math.random() * 8)) % nodes.length;
        if (i !== j) edges.push([i, j]);
      }
    }

    // Particles along edges
    const particles = [];
    for (let i = 0; i < 30; i++) {
      const edge = edges[Math.floor(Math.random() * edges.length)];
      particles.push({
        edge,
        t: Math.random(),
        speed: 0.001 + Math.random() * 0.003,
        suspicious: nodes[edge[0]].suspicious || nodes[edge[1]].suspicious,
      });
    }

    const animate = () => {
      const w = W();
      const h = H();
      ctx.clearRect(0, 0, w, h);

      const time = performance.now() * 0.001;
      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;

      // Update nodes
      for (const node of nodes) {
        node.x += node.vx;
        node.y += node.vy;
        if (node.x < 0 || node.x > w) node.vx *= -1;
        if (node.y < 0 || node.y > h) node.vy *= -1;
        node.x = Math.max(0, Math.min(w, node.x));
        node.y = Math.max(0, Math.min(h, node.y));

        // Gentle mouse repulsion
        const ddx = node.x - mx;
        const ddy = node.y - my;
        const dist = Math.sqrt(ddx * ddx + ddy * ddy);
        if (dist < 150 && dist > 0) {
          const force = (150 - dist) / 150 * 0.3;
          node.vx += (ddx / dist) * force;
          node.vy += (ddy / dist) * force;
        }

        // Speed damping
        const speed = Math.sqrt(node.vx * node.vx + node.vy * node.vy);
        if (speed > 0.6) {
          node.vx *= 0.6 / speed;
          node.vy *= 0.6 / speed;
        }
      }

      // Draw edges
      for (const [i, j] of edges) {
        const a = nodes[i];
        const b = nodes[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > 220) continue;
        const alpha = (1 - d / 220) * 0.12;
        const isSusp = a.suspicious || b.suspicious;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = isSusp
          ? `rgba(239, 68, 68, ${alpha * 1.5})`
          : `rgba(99, 102, 241, ${alpha})`;
        ctx.lineWidth = isSusp ? 0.8 : 0.5;
        ctx.stroke();
      }

      // Draw particles
      for (const p of particles) {
        p.t += p.speed;
        if (p.t > 1) {
          p.t = 0;
          const newEdge = edges[Math.floor(Math.random() * edges.length)];
          p.edge = newEdge;
          p.suspicious = nodes[newEdge[0]].suspicious || nodes[newEdge[1]].suspicious;
        }
        const a = nodes[p.edge[0]];
        const b = nodes[p.edge[1]];
        const px = a.x + (b.x - a.x) * p.t;
        const py = a.y + (b.y - a.y) * p.t;
        ctx.beginPath();
        ctx.arc(px, py, p.suspicious ? 1.5 : 1, 0, Math.PI * 2);
        ctx.fillStyle = p.suspicious
          ? `rgba(245, 158, 11, 0.8)`
          : `rgba(99, 102, 241, 0.6)`;
        ctx.fill();
      }

      // Draw nodes
      for (const node of nodes) {
        const pulse = 1 + Math.sin(time * 2 + node.pulsePhase) * 0.3;

        // Glow
        if (node.suspicious) {
          ctx.beginPath();
          ctx.arc(node.x, node.y, node.r * 3 * pulse, 0, Math.PI * 2);
          const grad = ctx.createRadialGradient(
            node.x, node.y, 0,
            node.x, node.y, node.r * 3 * pulse
          );
          grad.addColorStop(0, "rgba(239, 68, 68, 0.15)");
          grad.addColorStop(1, "rgba(239, 68, 68, 0)");
          ctx.fillStyle = grad;
          ctx.fill();
        }

        ctx.beginPath();
        ctx.arc(node.x, node.y, node.r * pulse, 0, Math.PI * 2);
        ctx.fillStyle = node.suspicious
          ? `rgba(239, 68, 68, ${node.opacity})`
          : `rgba(99, 102, 241, ${node.opacity * 0.7})`;
        ctx.fill();
      }

      animRef.current = requestAnimationFrame(animate);
    };

    const onMouse = (e) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    canvas.addEventListener("mousemove", onMouse);

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    animRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animRef.current);
      canvas.removeEventListener("mousemove", onMouse);
      ro.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ width: "100%", height: "100%" }}
    />
  );
}
*/

// ═══════════════════════════════════════════════════════════════════════
// Terminal typing animation
// ═══════════════════════════════════════════════════════════════════════

const TERMINAL_LINES = [
  { text: "$ dbms --init blockchain-analysis-engine", delay: 0 },
  { text: "[OK] Connecting to Neo4j graph database...", delay: 1200, color: "text-green-400" },
  { text: "[OK] Loading wallet network topology (1,847 nodes)...", delay: 2400, color: "text-green-400" },
  { text: "[>>] Running Louvain community detection...", delay: 3600, color: "text-cyan-400" },
  { text: "[!!] 12 communities identified — 3 flagged suspicious", delay: 4800, color: "text-amber-400" },
  { text: "[!!] Circular transfer pattern detected: depth=4, wallets=6", delay: 6000, color: "text-red-400" },
  { text: "[>>] Computing risk scores via fan-out/fan-in analysis...", delay: 7200, color: "text-cyan-400" },
  { text: "[OK] 23 wallets scored HIGH risk (>60/100)", delay: 8400, color: "text-red-400" },
  { text: "[OK] Visualization engine ready — 3D force graph loaded", delay: 9600, color: "text-green-400" },
  { text: "$ _", delay: 10800, blink: true },
];

function TerminalAnimation({ onComplete }) {
  // Each entry: { text, color, blink, typed }
  const [lines, setLines] = useState([]);
  const timersRef = useRef([]);
  // Keep onComplete in a ref so the effect never re-runs when the parent re-renders
  const onCompleteRef = useRef(onComplete);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

  useEffect(() => {
    const timers = timersRef.current;

    TERMINAL_LINES.forEach((line, lineIdx) => {
      const t = setTimeout(() => {
        setLines((prev) => [...prev, { ...line, typed: line.blink ? line.text : "" }]);

        if (line.blink) {
          onCompleteRef.current?.();
          return;
        }

        // Type each character individually into stable slot [lineIdx]
        const typeChar = (ci) => {
          if (ci >= line.text.length) return;
          const id = setTimeout(() => {
            setLines((prev) => {
              const copy = [...prev];
              if (copy[lineIdx]) {
                copy[lineIdx] = { ...copy[lineIdx], typed: line.text.slice(0, ci + 1) };
              }
              return copy;
            });
            typeChar(ci + 1);
          }, 14 + Math.random() * 18);
          timers.push(id);
        };
        typeChar(0);
      }, line.delay);

      timers.push(t);
    });

    // run once on mount only
  }, []);

  return (
    <div className="landing-terminal">
      <div className="landing-terminal-header">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red-500/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-green-500/80" />
        </div>
        <span className="text-[10px] text-zinc-500 font-mono">dbms@blockchain:~</span>
      </div>
      <div className="landing-terminal-body">
        {lines.map((line, i) => (
          <div
            key={i}
            className={`font-mono text-xs leading-relaxed ${line.color || "text-zinc-400"} ${
              line.blink ? "landing-blink" : ""
            }`}
          >
            {line.blink ? line.text : line.typed}
            {i === lines.length - 1 && !line.blink && (
              <span className="landing-cursor">▎</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Scan-line / matrix-rain decorative overlay
// ═══════════════════════════════════════════════════════════════════════

function ScanlineOverlay() {
  return <div className="landing-scanlines" aria-hidden="true" />;
}

// ═══════════════════════════════════════════════════════════════════════
// Live log feed (decorative)
// ═══════════════════════════════════════════════════════════════════════

const LOG_ENTRIES = [
  { ts: "14:32:07.213", msg: "Wallet 0x3f…8a2d flagged: fan-out=12", level: "WARN" },
  { ts: "14:32:07.415", msg: "Circular path detected: 4 hops", level: "ALERT" },
  { ts: "14:32:08.001", msg: "Community #7 modularity gain: +0.034", level: "INFO" },
  { ts: "14:32:08.192", msg: "Risk score updated: 0x9b…1fc7 → 78/100", level: "WARN" },
  { ts: "14:32:08.534", msg: "New TRANSFER edge: 2.41 ETH", level: "INFO" },
  { ts: "14:32:09.117", msg: "Rapid transfer chain: A→B→C in 14s", level: "ALERT" },
  { ts: "14:32:09.302", msg: "Cluster gravity recalculated (13 centroids)", level: "INFO" },
  { ts: "14:32:09.788", msg: "Dense cluster detected: in=8, out=11", level: "WARN" },
  { ts: "14:32:10.044", msg: "Graph snapshot: 1,847 nodes, 3,214 edges", level: "INFO" },
  { ts: "14:32:10.331", msg: "Wallet 0xab…ef12 risk escalated to HIGH", level: "ALERT" },
];

function LiveLogFeed() {
  const [entries, setEntries] = useState([]);

  useEffect(() => {
    let idx = 0;
    const interval = setInterval(() => {
      setEntries((prev) => {
        const next = [...prev, LOG_ENTRIES[idx % LOG_ENTRIES.length]];
        if (next.length > 6) next.shift();
        return next;
      });
      idx++;
    }, 1800);
    return () => clearInterval(interval);
  }, []);

  const levelColor = (l) =>
    l === "ALERT" ? "text-red-400" : l === "WARN" ? "text-amber-400" : "text-zinc-500";

  return (
    <div className="landing-log-feed">
      <div className="landing-log-header">
        <Activity size={12} className="text-green-400" />
        <span>LIVE ANALYSIS FEED</span>
        <span className="landing-log-dot" />
      </div>
      <div className="landing-log-body">
        {entries.map((e, i) => (
          <div key={i} className="landing-log-entry">
            <span className="text-zinc-600">{e.ts}</span>
            <span className={`font-semibold ${levelColor(e.level)}`}>[{e.level}]</span>
            <span className="text-zinc-400">{e.msg}</span>
          </div>
        ))}
        {entries.length === 0 && (
          <div className="text-zinc-600 text-xs font-mono">Awaiting data stream...</div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Stats counter
// ═══════════════════════════════════════════════════════════════════════

function AnimatedCounter({ target, duration = 2000, suffix = "" }) {
  const [value, setValue] = useState(0);
  const ref = useRef(null);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started) setStarted(true);
      },
      { threshold: 0.3 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [started]);

  useEffect(() => {
    if (!started) return;
    const start = performance.now();
    const tick = () => {
      const elapsed = performance.now() - start;
      const progress = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
      setValue(Math.round(eased * target));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [started, target, duration]);

  return (
    <span ref={ref}>
      {value.toLocaleString()}
      {suffix}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Feature card
// ═══════════════════════════════════════════════════════════════════════

function FeatureCard({ icon: Icon, title, description, accent }) {
  return (
    <div className="landing-feature-card group">
      <div className={`landing-feature-icon ${accent}`}>
        <Icon size={22} />
      </div>
      <h3 className="text-sm font-bold text-zinc-100 mt-4 mb-2 tracking-wide uppercase">
        {title}
      </h3>
      <p className="text-xs text-zinc-500 leading-relaxed">{description}</p>
      <div className={`landing-feature-glow ${accent}`} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Demo section — terminal + live feed → video reveal
// ═══════════════════════════════════════════════════════════════════════

function DemoSection() {
  const [terminalDone, setTerminalDone] = useState(false);
  const [videoVisible, setVideoVisible] = useState(false);
  const videoRef = useRef(null);
  const handleComplete = useCallback(() => setTerminalDone(true), []);

  useEffect(() => {
    if (!terminalDone) return;
    // Double-rAF: mount the element first, then trigger the CSS transition
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(() => setVideoVisible(true))
    );
    return () => cancelAnimationFrame(id);
  }, [terminalDone]);

  useEffect(() => {
    if (videoVisible && videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
  }, [videoVisible]);

  return (
    <section id="demo" className="landing-section">
      <div className="landing-section-inner">
        <div className="text-center mb-12">
          <span className="landing-section-tag">
            <Cpu size={12} /> INTERACTIVE CONSOLE
          </span>
          <h2 className="landing-section-title">See It In Action</h2>
          <p className="landing-section-sub">
            A real-time terminal console analyzing blockchain transaction graphs.
          </p>
        </div>

        {/* Terminal + side panel grid */}
        <div className="landing-demo-grid">
          <div className="landing-demo-main">
            <TerminalAnimation onComplete={handleComplete} />
          </div>

          <div className="landing-demo-side">
            <LiveLogFeed />
            <div className="landing-mini-panel">
              <div className="landing-mini-panel-header">
                <BarChart3 size={12} className="text-red-500" />
                <span>ANALYSIS METRICS</span>
              </div>
              <div className="landing-mini-panel-body">
                <div className="landing-mini-stat">
                  <span className="text-zinc-500">Nodes Scanned</span>
                  <span className="text-red-500 font-bold">
                    <AnimatedCounter target={1847} />
                  </span>
                </div>
                <div className="landing-mini-stat">
                  <span className="text-zinc-500">Edges Analyzed</span>
                  <span className="text-red-500 font-bold">
                    <AnimatedCounter target={3214} />
                  </span>
                </div>
                <div className="landing-mini-stat">
                  <span className="text-zinc-500">Threats Found</span>
                  <span className="text-red-400 font-bold">
                    <AnimatedCounter target={23} />
                  </span>
                </div>
                <div className="landing-mini-stat">
                  <span className="text-zinc-500">Communities</span>
                  <span className="text-cyan-400 font-bold">
                    <AnimatedCounter target={12} />
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Video player — only mounted after terminal completes ── */}
        {terminalDone && (
        <div
          className="landing-demo-video-wrap"
          style={{
            opacity: videoVisible ? 1 : 0,
            transform: videoVisible ? "translateY(0)" : "translateY(20px)",
            transition: "opacity 0.8s ease, transform 0.8s ease",
          }}
        >
          {/* window chrome */}
          <div className="landing-demo-video-chrome">
            <div className="landing-demo-video-chrome-header">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-red-500/80" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
                <span className="h-2.5 w-2.5 rounded-full bg-green-500/80" />
              </div>
              <span className="landing-demo-video-title">
                <Eye size={11} className="inline-block mr-1.5 text-red-500" />
                SYSTEM DEMO // LIVE REPLAY
              </span>
              <span className="landing-demo-video-badge">
                <span className="landing-status-dot" style={{ width: 5, height: 5 }} />
                REC
              </span>
            </div>

            {/* video */}
            <div className="landing-demo-video-body">
              <video
                ref={videoRef}
                src="/demo.mp4"
                muted
                loop
                playsInline
                preload="metadata"
                className="landing-demo-video"
              />
              {/* scanline overlay on video */}
              <div className="landing-demo-video-scanlines" aria-hidden="true" />
            </div>
          </div>
        </div>
        )}
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Main Landing Page
// ═══════════════════════════════════════════════════════════════════════

export default function LandingPage() {
  const router = useRouter();
  const [scrollY, setScrollY] = useState(0);

  // Shader intro: "playing" → "fading" → "done"
  const [introPhase, setIntroPhase] = useState("playing");
  const [redProgress, setRedProgress] = useState(0);
  // Letters: D . B . M . S — we track how many visible (7 → 0)
  const letters = ["D", ".", "B", ".", "M", ".", "S"];
  const [visibleCount, setVisibleCount] = useState(7);

  // Scroll/wheel drives the red transition + letter removal
  useEffect(() => {
    if (introPhase !== "playing") return;
    let accumulated = 0;
    const maxScroll = 1400;

    const advance = (delta) => {
      accumulated += delta;
      const progress = Math.min(accumulated / maxScroll, 1);
      setRedProgress(progress);

      // Letters disappear one by one: last letter goes at ~15%, next at ~30%, etc.
      const lettersGone = Math.floor(progress * 9); // 0-7 range across 0-0.78 progress
      setVisibleCount(Math.max(0, 7 - lettersGone));

      if (progress >= 1) {
        setIntroPhase("fading");
        setTimeout(() => setIntroPhase("done"), 1200);
      }
    };

    const onWheel = (e) => {
      e.preventDefault();
      advance(Math.abs(e.deltaY));
    };
    let touchY = null;
    const onTouchStart = (e) => { touchY = e.touches[0].clientY; };
    const onTouchMove = (e) => {
      if (touchY === null) return;
      e.preventDefault();
      const delta = Math.abs(e.touches[0].clientY - touchY);
      touchY = e.touches[0].clientY;
      advance(delta);
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
    };
  }, [introPhase]);

  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Lock scroll during intro
  useEffect(() => {
    if (introPhase !== "done") {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [introPhase]);

  return (
    <div className="landing-root">

      {/* ════════════ SHADER INTRO OVERLAY ════════════ */}
      {introPhase !== "done" && (
        <div className={`shader-intro-overlay ${
          introPhase === "fading" ? "shader-intro-fading" : ""
        }`}>
          <ShaderAnimation redProgress={redProgress} />
          {/* Black overlay that fades in as you scroll, creating shader→black */}
          <div className="shader-black-overlay" style={{ opacity: Math.pow(redProgress, 2.5) }} />
          <div className="shader-intro-content">
            <h1 className="shader-intro-title">
              {letters.map((ch, i) => (
                <span
                  key={i}
                  className="shader-letter"
                  style={{
                    opacity: i < visibleCount ? 1 : 0,
                    transform: i < visibleCount ? "translateY(0)" : "translateY(-20px)",
                  }}
                >
                  {ch}
                </span>
              ))}
            </h1>
            <div className={`shader-intro-sub ${
              visibleCount < 5 ? "shader-intro-sub-hide" : ""
            }`}>
              <span className="shader-intro-line" />
              <span className="font-mono text-xs tracking-[0.3em] text-white/40 uppercase">
                Distributed Blockchain Monitoring System
              </span>
              <span className="shader-intro-line" />
            </div>
            {visibleCount === 7 && redProgress < 0.05 && (
              <div className="shader-scroll-hint">
                <span className="shader-scroll-text">SCROLL</span>
                <div className="shader-scroll-arrow" />
              </div>
            )}
          </div>
          <div className="shader-intro-scanlines" aria-hidden="true" />
        </div>
      )}

      {/* Only mount landing once fading/done — fade in from black */}
      {introPhase !== "playing" && (
      <div className={`landing-fade-in ${introPhase === "done" ? "landing-visible" : ""}`}>
      <>
      {/* ════════════ Full-screen cyber network background ════════════ */}
      <div className="cyber-network-bg" aria-hidden="true">
        <CyberNetworkCanvas />
      </div>

      <ScanlineOverlay />

      {/* ════════════════════ NAV ════════════════════ */}
      <nav
        className={`landing-nav ${scrollY > 50 ? "landing-nav-scrolled" : ""}`}
      >
        <div className="landing-nav-inner">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-800/80 shadow-lg shadow-red-900/20">
              <ShieldAlert size={16} className="text-white" />
            </div>
            <div>
              <span className="text-sm font-bold tracking-tight text-white font-mono">
                DBMS
              </span>
              <span className="hidden sm:inline text-[10px] text-zinc-500 ml-2 font-mono">
                v2.0 // DISTRIBUTED BLOCKCHAIN MONITORING
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a href="#features" className="hidden sm:inline text-xs text-zinc-400 hover:text-white transition-colors font-mono">
              FEATURES
            </a>
            <a href="#demo" className="hidden sm:inline text-xs text-zinc-400 hover:text-white transition-colors font-mono">
              DEMO
            </a>
            <a href="#schema" className="hidden sm:inline text-xs text-zinc-400 hover:text-white transition-colors font-mono">
              SCHEMA
            </a>
            <a href="#detection" className="hidden sm:inline text-xs text-zinc-400 hover:text-white transition-colors font-mono">
              DETECTION
            </a>
            <a href="#risk" className="hidden sm:inline text-xs text-zinc-400 hover:text-white transition-colors font-mono">
              SCORING
            </a>
            <button
              onClick={() => router.push("/login")}
              className="landing-btn-ghost"
            >
              Log In
            </button>
            <button
              onClick={() => router.push("/login")}
              className="landing-btn-primary"
            >
              Get Started <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </nav>

      {/* ════════════════════ HERO ════════════════════ */}
      <section className="landing-hero">
        {/* Background overlay — network is now global behind the page */}
        <div className="absolute inset-0 z-0">
          {/* Radial gradient overlay for readability */}
          <div className="absolute inset-0 bg-linear-to-b from-transparent via-[#000000]/30 to-[#000000]/70" />
          {/* Grid overlay */}
          <div className="landing-grid-overlay" />
        </div>

        <div className="relative z-10 landing-hero-content">
          {/* Status badge */}
          <div className="landing-status-badge">
            <span className="landing-status-dot" />
            <span className="font-mono text-[11px] text-zinc-400">
              SYSTEM ONLINE — ANALYSIS ENGINE ACTIVE
            </span>
          </div>

          {/* Headline */}
          <h1 className="landing-hero-title">
            <span className="landing-glitch" data-text="Distributed Blockchain">
              Distributed Blockchain
            </span>
            <br />
            <span className="landing-hero-accent">
              Monitoring System
            </span>
          </h1>

          <p className="landing-hero-sub">
            Visualize financial networks. Detect laundering patterns.
            <br className="hidden sm:block" />
            Analyze transaction flows in real time with graph-powered forensics.
          </p>

          {/* CTA */}
          <div className="flex flex-wrap items-center justify-center gap-4 mt-10">
            <button
              onClick={() => router.push("/login")}
              className="landing-btn-hero"
            >
              <Terminal size={16} />
              Launch Console
              <ChevronRight size={16} className="ml-1" />
            </button>
            <a
              href="#demo"
              className="landing-btn-outline"
            >
              <Eye size={16} />
              Live Preview
            </a>
          </div>

          {/* Hero stats */}
          <div className="landing-hero-stats">
            <div className="landing-hero-stat">
              <span className="landing-hero-stat-value">
                <AnimatedCounter target={5} suffix="+" />
              </span>
              <span className="landing-hero-stat-label">Detection Algorithms</span>
            </div>
            <div className="landing-hero-stat-divider" />
            <div className="landing-hero-stat">
              <span className="landing-hero-stat-value">
                <AnimatedCounter target={3} suffix="D" />
              </span>
              <span className="landing-hero-stat-label">Graph Visualization</span>
            </div>
            <div className="landing-hero-stat-divider" />
            <div className="landing-hero-stat">
              <span className="landing-hero-stat-value">
                <AnimatedCounter target={100} suffix="/100" />
              </span>
              <span className="landing-hero-stat-label">Risk Scoring</span>
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════ INTERACTIVE DEMO ════════════════════ */}
      <DemoSection />



      {/* ════════════════════ FEATURES ════════════════════ */}
      <section id="features" className="landing-section landing-section-alt">
        <div className="landing-section-inner">
          <div className="text-center mb-12">
            <span className="landing-section-tag">
              <Zap size={12} /> CAPABILITIES
            </span>
            <h2 className="landing-section-title">
              Built for Blockchain Forensics
            </h2>
            <p className="landing-section-sub">
              Every tool you need to investigate, visualize, and score suspicious
              blockchain activity — from raw transactions to actionable intelligence.
            </p>
          </div>

          <div className="landing-features-grid">
            <FeatureCard
              icon={Network}
              title="3D Graph Visualization"
              description="Interactive force-directed 3D graph with WASD navigation, volume-scaled Z-axis, curved edges, and animated particles. Inspect wallet clusters from every angle."
              accent="text-red-500"
            />
            <FeatureCard
              icon={ShieldAlert}
              title="Fraud Pattern Detection"
              description="Automatic identification of fan-out, fan-in, circular transfers, mixing hubs, and rapid relay chains using graph topology analysis."
              accent="text-red-400"
            />
            <FeatureCard
              icon={Search}
              title="Path Finding"
              description="Trace shortest fund-flow paths between any two wallets. Highlights every hop in the graph with directional particle animations."
              accent="text-amber-400"
            />
            <FeatureCard
              icon={GitBranch}
              title="Community Detection"
              description="Louvain algorithm clusters wallets into communities by transaction density. Reveals coordinated behavior invisible in raw data."
              accent="text-cyan-400"
            />
            <FeatureCard
              icon={Activity}
              title="Risk Scoring Engine"
              description="Composite 0-100 risk scores combining fan-out/fan-in degree, cycle involvement, and total connectivity. Color-coded from green (safe) to red (danger)."
              accent="text-green-400"
            />
            <FeatureCard
              icon={Database}
              title="Neo4j Graph Database"
              description="Powered by Neo4j with indexed Cypher queries, batch ingestion (1000 tx/batch), and UNWIND-based bulk scoring for real-time analysis."
              accent="text-purple-400"
            />
          </div>
        </div>
      </section>

      {/* ════════════════════ HOW IT WORKS ════════════════════ */}
      <section className="landing-section">
        <div className="landing-section-inner">
          <div className="text-center mb-12">
            <span className="landing-section-tag">
              <Globe size={12} /> PIPELINE
            </span>
            <h2 className="landing-section-title">
              From Raw Data to Actionable Intelligence
            </h2>
          </div>

          <div className="landing-pipeline">
            {[
              { step: "01", icon: Database, title: "INGEST", desc: "Upload CSV/JSON transaction data. Parser auto-detects BigQuery Ethereum, standard formats, and normalizes Wei → ETH." },
              { step: "02", icon: GitBranch, title: "GRAPH", desc: "Neo4j builds the wallet network. Wallets become nodes, transfers become edges with amount, timestamp, and coin type." },
              { step: "03", icon: Cpu, title: "ANALYZE", desc: "Louvain community detection, fan-out/in scoring, circular transfer detection, and rapid-relay chain identification." },
              { step: "04", icon: Eye, title: "VISUALIZE", desc: "Interactive 2D/3D graph with risk coloring, volume Z-axis, fraud layout mode, and temporal animation of transaction flow." },
            ].map((item) => (
              <div key={item.step} className="landing-pipeline-step">
                <div className="landing-pipeline-num">{item.step}</div>
                <item.icon size={20} className="text-red-500 mb-3" />
                <h3 className="text-xs font-bold text-zinc-200 tracking-widest mb-2">
                  {item.title}
                </h3>
                <p className="text-[11px] text-zinc-500 leading-relaxed">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════ TECH STACK ════════════════════ */}
      <section id="tech" className="landing-section landing-section-alt">
        <div className="landing-section-inner">
          <div className="text-center mb-12">
            <span className="landing-section-tag">
              <Layers size={12} /> TECHNOLOGY STACK
            </span>
            <h2 className="landing-section-title">Built on Modern Infrastructure</h2>
            <p className="landing-section-sub">
              Purpose-selected tools forming a cohesive blockchain forensics platform — from raw CSV ingestion to interactive 3D graph rendering.
            </p>
          </div>
          <div className="landing-tech-grid">
            {[
              { name: "Neo4j", category: "Graph Database", desc: "Native property graph with Cypher. Unique constraints on Wallet.address & Coin.name, indexes on TRANSFER.timestamp and txid, MERGE-based idempotent batch ingestion (1 000 tx/batch).", color: "text-green-400", bg: "bg-green-400/10", badge: "bolt://localhost:7687" },
              { name: "Next.js 14", category: "Frontend Framework", desc: "React App Router with client-side auth context, dynamic /wallet/[address] routing, role-based page guards, and lazy-loaded Three.js via dynamic import to avoid SSR bundle bloat.", color: "text-blue-400", bg: "bg-blue-400/10", badge: "port 3000" },
              { name: "Fastify", category: "Backend API", desc: "High-throughput Node.js server. 50 MB multipart file uploads, JWT middleware on every protected route, 10 REST endpoints: graph, detection, wallet, upload, admin, users, logs, stats, settings.", color: "text-amber-400", bg: "bg-amber-400/10", badge: "port 4000" },
              { name: "Cytoscape.js", category: "2D Graph Engine", desc: "Cola constraint-based layout — repulsion + spring forces, avoidOverlap, 500 ms cap. Risk-HSL node coloring (green→red), dashed USES edges, click-to-wallet navigation.", color: "text-cyan-400", bg: "bg-cyan-400/10", badge: "cytoscape-cola" },
              { name: "Three.js / WebGL", category: "3D Rendering", desc: "SphereGeometry nodes sized by √volume, AdditiveBlending radial-gradient glow sprites, OrbitControls camera, directional animated particles on highlighted path edges.", color: "text-purple-400", bg: "bg-purple-400/10", badge: "3d-force-graph" },
              { name: "d3-force-3d", category: "Physics Simulation", desc: "Barnes-Hut many-body simulation with charge + link + center forces and a custom Z-force biasing node height by log-normalized transaction volume. αDecay=0.02, friction=0.3.", color: "text-red-500", bg: "bg-red-500/10", badge: "α-decay 0.02" },
              { name: "Louvain Algorithm", category: "Community Detection", desc: "In-memory modularity-maximizing clustering on the already-fetched subgraph. No GDS plugin needed. O(E × 20 iterations). Golden-angle hue spacing for maximum cluster color separation.", color: "text-pink-400", bg: "bg-pink-400/10", badge: "community.js" },
              { name: "JWT / bcrypt", category: "Auth & Security", desc: "Role-based access control (admin / user), 24-hour expiring tokens stored in localStorage. Passwords hashed with bcrypt and stored as User nodes directly in the Neo4j graph.", color: "text-red-400", bg: "bg-red-400/10", badge: "24 h expiry" },
            ].map((tech) => (
              <div key={tech.name} className="landing-tech-card">
                <span className={`landing-tech-badge ${tech.bg} ${tech.color}`}>{tech.category}</span>
                <h3 className={`text-sm font-bold mt-3 mb-1.5 ${tech.color} font-mono`}>{tech.name}</h3>
                <p className="text-[11px] text-zinc-500 leading-relaxed mb-3">{tech.desc}</p>
                <code className="text-[10px] text-zinc-600 font-mono">{tech.badge}</code>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════ DATABASE SCHEMA ════════════════════ */}
      <section id="schema" className="landing-section">
        <div className="landing-section-inner">
          <div className="text-center mb-12">
            <span className="landing-section-tag">
              <Database size={12} /> DATABASE SCHEMA
            </span>
            <h2 className="landing-section-title">Neo4j Graph Data Model</h2>
            <p className="landing-section-sub">
              A directed multigraph where wallets are nodes, transactions are edges, and fraud signals emerge from topology rather than content.
            </p>
          </div>
          <div className="landing-schema-layout">
            {/* Node types */}
            <div className="landing-schema-card">
              <div className="landing-schema-card-header text-green-400">
                <Box size={14} /> NODE TYPES
              </div>
              <div className="landing-schema-table">
                <div className="landing-schema-row landing-schema-header">
                  <span>Label</span><span>Key Property</span><span>Description</span>
                </div>
                {[
                  { label: "Wallet", key: "address", desc: "Blockchain wallet — unique hash identifier", color: "text-cyan-400" },
                  { label: "Coin", key: "name", desc: "Crypto type: ETH, BTC, etc.", color: "text-amber-400" },
                  { label: "User", key: "username", desc: "App user — role, bcrypt hash, ban flag, preferences", color: "text-purple-400" },
                ].map((n) => (
                  <div key={n.label} className="landing-schema-row">
                    <span className={`font-mono font-bold ${n.color}`}>{n.label}</span>
                    <span className="font-mono text-zinc-400 text-[10px]">{n.key}</span>
                    <span className="text-zinc-500">{n.desc}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Relationship types */}
            <div className="landing-schema-card">
              <div className="landing-schema-card-header text-red-500">
                <Link2 size={14} /> RELATIONSHIP TYPES
              </div>
              <div className="landing-schema-table">
                <div className="landing-schema-row landing-schema-header">
                  <span>Type</span><span>Pattern</span><span>Key Properties</span>
                </div>
                {[
                  { type: "TRANSFER", pattern: "(Wallet)→(Wallet)", props: "txid · amount · value_lossless · timestamp · coin_type", color: "text-red-400" },
                  { type: "USES", pattern: "(Wallet)→(Coin)", props: "(none — structural edge only)", color: "text-zinc-500" },
                ].map((r) => (
                  <div key={r.type} className="landing-schema-row">
                    <span className={`font-mono font-bold ${r.color}`}>{r.type}</span>
                    <span className="font-mono text-zinc-400 text-[10px]">{r.pattern}</span>
                    <span className="text-zinc-500 text-[10px]">{r.props}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Constraints & Indexes */}
            <div className="landing-schema-card">
              <div className="landing-schema-card-header text-amber-400">
                <Hash size={14} /> CONSTRAINTS &amp; INDEXES
              </div>
              <div className="landing-schema-table">
                <div className="landing-schema-row landing-schema-header">
                  <span>Name</span><span>Target</span><span>Type</span>
                </div>
                {[
                  { name: "wallet_address", target: "Wallet.address", type: "UNIQUE", color: "text-cyan-400" },
                  { name: "coin_name", target: "Coin.name", type: "UNIQUE", color: "text-amber-400" },
                  { name: "user_username", target: "User.username", type: "UNIQUE", color: "text-purple-400" },
                  { name: "user_email", target: "User.email", type: "UNIQUE", color: "text-purple-400" },
                  { name: "transfer_timestamp", target: "TRANSFER.timestamp", type: "INDEX", color: "text-zinc-400" },
                  { name: "transfer_txid", target: "TRANSFER.txid", type: "INDEX", color: "text-zinc-400" },
                ].map((c) => (
                  <div key={c.name} className="landing-schema-row">
                    <span className={`font-mono text-[10px] ${c.color}`}>{c.name}</span>
                    <span className="font-mono text-zinc-500 text-[10px]">{c.target}</span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${c.type === "UNIQUE" ? "bg-green-400/10 text-green-400" : "bg-blue-400/10 text-blue-400"}`}>{c.type}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Ingestion Cypher */}
            <div className="landing-schema-card landing-schema-cypher-card">
              <div className="landing-schema-card-header text-cyan-400">
                <Code2 size={14} /> INGESTION CYPHER — idempotent batch of 1 000 transactions
              </div>
              <pre className="landing-cypher-block">{`UNWIND $transactions AS tx
MERGE (from:Wallet {address: tx.wallet_from})
MERGE (to:Wallet   {address: tx.wallet_to})
MERGE (c:Coin      {name: tx.coin_type})
MERGE (from)-[:USES]->(c)
MERGE (to)-[:USES]->(c)
MERGE (from)-[t:TRANSFER {txid: tx.transaction_id}]->(to)
ON CREATE SET
  t.amount         = toFloat(tx.amount),
  t.value_lossless = tx.value_lossless,
  t.timestamp      = tx.timestamp,
  t.coin_type      = tx.coin_type
RETURN count(*) AS created`}</pre>
              <p className="text-[10px] text-zinc-600 font-mono mt-2">
                MERGE on txid guarantees idempotency — re-uploading the same CSV creates no duplicate nodes or edges.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════ DETECTION ALGORITHMS ════════════════════ */}
      <section id="detection" className="landing-section landing-section-alt">
        <div className="landing-section-inner">
          <div className="text-center mb-12">
            <span className="landing-section-tag">
              <ShieldAlert size={12} /> DETECTION ENGINE
            </span>
            <h2 className="landing-section-title">Five Fraud Detection Algorithms</h2>
            <p className="landing-section-sub">
              Cypher graph-pattern queries executed against Neo4j that surface laundering, mixing hubs, and relay chains from raw topology.
            </p>
          </div>
          <div className="landing-detect-grid">
            {[
              {
                type: "CIRCULAR", icon: GitBranch, color: "text-red-400", bg: "bg-red-400/10",
                title: "Circular Transfers",
                desc: "Funds cycling back to the origin wallet through 2–6 hop chains. A hallmark of the layering phase — money routed through intermediaries to obscure the trail.",
                query: `MATCH path = (w:Wallet)-[:TRANSFER*2..6]->(w)
WITH w, path, length(path) AS depth
ORDER BY depth ASC
LIMIT $limit
RETURN w.address, depth,
  [n IN nodes(path) | n.address] AS cycle`,
                params: ["depth: 2–6 hops", "ordered: shortest first"],
              },
              {
                type: "FAN-OUT", icon: Network, color: "text-amber-400", bg: "bg-amber-400/10",
                title: "High Fan-Out",
                desc: "Wallets sending to an unusually large number of distinct recipients. Consistent with distribution hubs, peel-chains, tumblers, or automated fund scattering.",
                query: `MATCH (w:Wallet)-[t:TRANSFER]->()
WITH w, count(t) AS outDegree,
     sum(t.amount) AS totalSent
WHERE outDegree >= $threshold
RETURN w.address, outDegree, totalSent
ORDER BY outDegree DESC`,
                params: ["threshold: 5 (default)", "sorted: highest first"],
              },
              {
                type: "FAN-IN", icon: Activity, color: "text-orange-400", bg: "bg-orange-400/10",
                title: "High Fan-In",
                desc: "Wallets receiving from many senders. Identifies collection addresses in phishing campaigns, ransomware sink wallets, or Ponzi scheme deposit targets.",
                query: `MATCH ()-[t:TRANSFER]->(w:Wallet)
WITH w, count(t) AS inDegree,
     sum(t.amount) AS totalReceived
WHERE inDegree >= $threshold
RETURN w.address, inDegree,
       totalReceived
ORDER BY inDegree DESC`,
                params: ["threshold: 5 (default)", "mirror of fan-out"],
              },
              {
                type: "RAPID", icon: Clock, color: "text-cyan-400", bg: "bg-cyan-400/10",
                title: "Rapid Transfers",
                desc: "A→B→C chains where B forwards funds within a short time window. Characteristic of automated laundering pipelines, mule chains, and pass-through wallets.",
                query: `MATCH (a:Wallet)-[t1:TRANSFER]->(b:Wallet)
      -[t2:TRANSFER]->(c:Wallet)
WHERE a <> c
  AND t2.timestamp - t1.timestamp >= 0
  AND t2.timestamp - t1.timestamp
        <= $windowSeconds
RETURN a.address AS from,
       b.address AS via,
       c.address AS to`,
                params: ["window: 60 s (default)", "excludes ping-pong (a ≠ c)"],
              },
              {
                type: "DENSE CLUSTER", icon: Cpu, color: "text-purple-400", bg: "bg-purple-400/10",
                title: "Dense Clusters",
                desc: "Wallets with high in-degree AND high out-degree simultaneously. Central nodes in tight transaction clusters — potential mixers or coordinating accounts.",
                query: `MATCH (w:Wallet)
OPTIONAL MATCH (w)-[out:TRANSFER]->()
WITH w, count(out) AS outDeg
OPTIONAL MATCH ()-[inr:TRANSFER]->(w)
WITH w, outDeg, count(inr) AS inDeg
WHERE outDeg >= $threshold
  AND inDeg  >= $threshold
RETURN w.address, outDeg, inDeg,
       outDeg + inDeg AS totalDeg`,
                params: ["threshold: 3 (both dirs)", "sorted: total degree desc"],
              },
            ].map((algo) => (
              <div key={algo.type} className="landing-detect-card">
                <div className="landing-detect-header">
                  <span className={`landing-detect-badge ${algo.bg} ${algo.color}`}>
                    <algo.icon size={10} /> {algo.type}
                  </span>
                </div>
                <h3 className={`text-sm font-bold mb-1.5 ${algo.color}`}>{algo.title}</h3>
                <p className="text-[11px] text-zinc-500 leading-relaxed mb-3">{algo.desc}</p>
                <pre className="landing-detect-query">{algo.query}</pre>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {algo.params.map((p) => (
                    <span key={p} className="landing-detect-param">{p}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════ RISK SCORE ENGINE ════════════════════ */}
      <section id="risk" className="landing-section">
        <div className="landing-section-inner">
          <div className="text-center mb-12">
            <span className="landing-section-tag">
              <TrendingUp size={12} /> RISK ENGINE
            </span>
            <h2 className="landing-section-title">Composite 0 – 100 Risk Score</h2>
            <p className="landing-section-sub">
              Computed in a single <code className="text-cyan-400 font-mono text-xs">UNWIND</code> Cypher query for all visible wallets simultaneously — no N+1 round-trips to the database.
            </p>
          </div>
          <div className="landing-risk-layout">
            {/* Score formula breakdown */}
            <div className="landing-risk-formula-card">
              <div className="landing-schema-card-header text-red-500 mb-5">
                <BarChart3 size={14} /> SCORING FORMULA — Four Structural Factors
              </div>
              <div className="space-y-4">
                {[
                  { factor: "Fan-Out", formula: "min(25, outDegree × 5)", max: 25, color: "bg-amber-400", pct: "25%", desc: "Outgoing transfer count — distribution hubs score higher" },
                  { factor: "Fan-In", formula: "min(25, inDegree × 5)", max: 25, color: "bg-orange-400", pct: "25%", desc: "Incoming transfer count — aggregation sinks score higher" },
                  { factor: "Cycle Involvement", formula: "min(30, cycles × 15)", max: 30, color: "bg-red-400", pct: "30%", desc: "Circular transfer paths length 2–4 — strongest laundering signal" },
                  { factor: "Total Degree", formula: "min(20, (out+in) × 2)", max: 20, color: "bg-pink-400", pct: "20%", desc: "Overall network centrality — high connectivity is inherently suspicious" },
                ].map((f) => (
                  <div key={f.factor} className="landing-risk-factor">
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div>
                        <span className="text-xs font-bold text-zinc-200">{f.factor}</span>
                        <p className="text-[10px] text-zinc-600 mt-0.5">{f.desc}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-[10px] font-mono text-zinc-500">{f.formula}</span>
                        <div className="text-xs font-bold text-zinc-300 mt-0.5">+{f.max} pts</div>
                      </div>
                    </div>
                    <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div className={`h-full ${f.color} rounded-full`} style={{ width: f.pct }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-5 pt-4 border-t border-zinc-800 flex items-center justify-between">
                <span className="text-xs text-zinc-500 font-mono">TOTAL — capped at 100</span>
                <span className="text-sm font-bold text-white">100 pts max</span>
              </div>
              <p className="text-[10px] text-zinc-600 font-mono mt-3 leading-relaxed">
                Cycle involvement is weighted most heavily (30 pts) — circular transfers are the strongest structural indicator of deliberate fund obfuscation.
              </p>
            </div>

            {/* Risk level map + bulk scoring */}
            <div className="landing-risk-levels-card">
              <div className="landing-schema-card-header text-green-400 mb-4">
                <AlertTriangle size={14} /> RISK LEVEL MAP
              </div>
              <div className="space-y-3 mb-6">
                {[
                  { range: "0 – 20", level: "LOW", color: "text-green-400", bg: "bg-green-400/10", bar: "bg-green-400", pct: "20%" },
                  { range: "21 – 50", level: "MEDIUM", color: "text-yellow-400", bg: "bg-yellow-400/10", bar: "bg-yellow-400", pct: "50%" },
                  { range: "51 – 100", level: "HIGH", color: "text-red-400", bg: "bg-red-400/10", bar: "bg-red-400", pct: "100%" },
                ].map((l) => (
                  <div key={l.level} className={`flex items-center gap-3 p-3 rounded-lg ${l.bg}`}>
                    <div className={`w-3 h-3 rounded-full ${l.bar} shrink-0`} />
                    <div className="flex-1">
                      <div className="flex justify-between items-center">
                        <span className={`text-sm font-bold ${l.color}`}>{l.level}</span>
                        <span className="text-xs text-zinc-500 font-mono">{l.range}</span>
                      </div>
                      <div className="h-1 bg-zinc-800 rounded mt-1.5 overflow-hidden">
                        <div className={`h-full ${l.bar} rounded`} style={{ width: l.pct }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="border-t border-zinc-800 pt-4">
                <div className="landing-schema-card-header text-cyan-400 mb-3">
                  <Globe size={14} /> BULK SCORING QUERY
                </div>
                <pre className="landing-detect-query">{`UNWIND $addresses AS addr
MATCH (w:Wallet {address: addr})
OPTIONAL MATCH (w)-[out:TRANSFER]->()
WITH w, addr, count(out) AS outDeg
OPTIONAL MATCH ()-[inr:TRANSFER]->(w)
WITH w, addr, outDeg,
     count(inr) AS inDeg
OPTIONAL MATCH p =
  (w)-[:TRANSFER*2..4]->(w)
WITH addr, outDeg, inDeg,
     count(p) AS cycles
-- CASE WHEN caps each component
RETURN addr,
  CASE WHEN rawScore < 100
    THEN rawScore ELSE 100
  END AS score`}</pre>
                <p className="text-[10px] text-zinc-600 font-mono mt-2 leading-relaxed">
                  Single round-trip for all wallet scores — efficient even with 200+ nodes in view.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════ GRAPH ALGORITHMS ════════════════════ */}
      <section id="algorithms" className="landing-section landing-section-alt">
        <div className="landing-section-inner">
          <div className="text-center mb-12">
            <span className="landing-section-tag">
              <Cpu size={12} /> GRAPH ALGORITHMS
            </span>
            <h2 className="landing-section-title">Physics, Community &amp; Volume Mapping</h2>
            <p className="landing-section-sub">
              Log-scaled transaction volume drives the Z-axis. Force-directed physics arranges X/Y. Louvain modularity reveals hidden wallet clusters.
            </p>
          </div>
          <div className="landing-algo-grid">
            {/* Louvain */}
            <div className="landing-algo-card">
              <div className="landing-schema-card-header text-pink-400 mb-3">
                <GitBranch size={14} /> LOUVAIN COMMUNITY DETECTION
              </div>
              <p className="text-[11px] text-zinc-500 leading-relaxed mb-4">
                In-memory modularity-maximizing algorithm on the already-fetched subgraph. No Neo4j GDS plugin required — runs in <code className="text-pink-400 font-mono">services/community.js</code>. Up to 20 local-move iterations, O(E × iterations).
              </p>
              <div className="space-y-2">
                {[
                  { step: "1", label: "Build adjacency", detail: "Undirected weighted graph from TRANSFER edges — weight = amount (default 1)" },
                  { step: "2", label: "Initialize communities", detail: "Each node starts in its own community; track per-community total degree" },
                  { step: "3", label: "Local moves (≤20 iters)", detail: "Move each node to the neighbor community with greatest ΔQ modularity gain" },
                  { step: "4", label: "Convergence", detail: "Stop when no node moves or 20 iterations reached; renumber communities from 0" },
                  { step: "5", label: "Golden-angle coloring", detail: "hue = (clusterId × 137.508°) mod 360 — maximizes perceptual separation between IDs" },
                ].map((s) => (
                  <div key={s.step} className="flex gap-3 items-start text-[11px]">
                    <span className="landing-detect-param shrink-0 font-bold">{s.step}</span>
                    <div>
                      <span className="text-zinc-300 font-medium">{s.label} — </span>
                      <span className="text-zinc-600">{s.detail}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 3D Force Layout */}
            <div className="landing-algo-card">
              <div className="landing-schema-card-header text-red-500 mb-3">
                <Cpu size={14} /> 3D FORCE LAYOUT (d3-force-3d / Barnes-Hut)
              </div>
              <p className="text-[11px] text-zinc-500 leading-relaxed mb-4">
                Barnes-Hut many-body simulation with four concurrent forces. 100 warmup ticks before first render eliminates the exploding-graph artifact. αDecay=0.02, friction=0.3.
              </p>
              <div className="landing-axis-table">
                <div className="landing-axis-row landing-schema-header">
                  <span>Force</span><span>Purpose</span><span>Config</span>
                </div>
                {[
                  { force: "charge", purpose: "Many-body repulsion", config: "Default d3 many-body" },
                  { force: "link", purpose: "Spring between edges", config: "Natural spring length" },
                  { force: "center", purpose: "Pull toward origin", config: "Keeps graph centered" },
                  { force: "z (custom)", purpose: "Bias Z by log-volume", config: "strength = α × 0.3" },
                ].map((f) => (
                  <div key={f.force} className="landing-axis-row">
                    <span className="font-mono text-red-500">{f.force}</span>
                    <span className="text-zinc-400">{f.purpose}</span>
                    <span className="text-zinc-600">{f.config}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Z-Axis / Log Volume */}
            <div className="landing-algo-card">
              <div className="landing-schema-card-header text-cyan-400 mb-3">
                <TrendingUp size={14} /> LOG-SCALED Z-AXIS — Volume Mapping
              </div>
              <p className="text-[11px] text-zinc-500 leading-relaxed mb-4">
                Raw blockchain volumes span 10+ orders of magnitude. Log-scaling compresses whale wallets while preserving structure. High-volume nodes rise (Z=+150); low-volume nodes sink (Z=−150).
              </p>
              <div className="landing-axis-table">
                <div className="landing-axis-row landing-schema-header">
                  <span>Step</span><span>Formula</span><span>Output</span>
                </div>
                {[
                  { step: "Aggregate", formula: "Σ value_lossless (adjacent edges)", output: "totalVolume" },
                  { step: "Log-scale", formula: "log₁₀(totalVolume + 1)", output: "logVolume" },
                  { step: "Normalize", formula: "(logVol − min) / range", output: "normalizedVol [0,1]" },
                  { step: "Z position", formula: "normalizedVol × 300 − 150", output: "fz ∈ [−150, +150]" },
                ].map((r) => (
                  <div key={r.step} className="landing-axis-row">
                    <span className="font-mono text-cyan-400">{r.step}</span>
                    <span className="text-zinc-500 text-[10px] font-mono">{r.formula}</span>
                    <span className="text-zinc-400 text-[10px]">{r.output}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Node size + color encoding */}
            <div className="landing-algo-card">
              <div className="landing-schema-card-header text-amber-400 mb-3">
                <Globe size={14} /> NODE SIZE &amp; COLOR ENCODING
              </div>
              <p className="text-[11px] text-zinc-500 leading-relaxed mb-4">
                Visual properties encode data semantics: size = economic importance (√volume), color = risk or community, glow = volume intensity via Three.js AdditiveBlending sprites.
              </p>
              <div className="landing-axis-table">
                <div className="landing-axis-row landing-schema-header">
                  <span>Property</span><span>Encoding</span><span>Range</span>
                </div>
                {[
                  { prop: "Node size", enc: "3 + √volume / scaleFactor", range: "3 → ~16 units" },
                  { prop: "Glow alpha", enc: "0.6 + normalizedVol × 0.4", range: "0.6 → 1.0" },
                  { prop: "Risk color", enc: "hue = 120×(1−score/100)", range: "green → red" },
                  { prop: "Cluster color", enc: "hue = id × 137.5° mod 360", range: "golden angle" },
                  { prop: "Edge width", enc: "log₁₀(amount+1) × scale", range: "0.3 → ~4 units" },
                ].map((r) => (
                  <div key={r.prop} className="landing-axis-row">
                    <span className="font-mono text-amber-400 text-[10px]">{r.prop}</span>
                    <span className="text-zinc-500 text-[10px] font-mono">{r.enc}</span>
                    <span className="text-zinc-400 text-[10px]">{r.range}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════ API REFERENCE ════════════════════ */}
      <section id="api" className="landing-section">
        <div className="landing-section-inner">
          <div className="text-center mb-12">
            <span className="landing-section-tag">
              <Code2 size={12} /> API REFERENCE
            </span>
            <h2 className="landing-section-title">REST Endpoints</h2>
            <p className="landing-section-sub">
              All endpoints require JWT Bearer authentication. Admin-only routes return 403 for regular users.
            </p>
          </div>
          <div className="landing-api-table-wrap">
            <div className="landing-api-row landing-api-header">
              <span>Method</span><span>Path</span><span>Auth</span><span>Description</span>
            </div>
            {[
              { method: "POST", path: "/auth/login", auth: "Public", desc: "Issue JWT token — username + password", mc: "text-green-400", ac: "text-zinc-500" },
              { method: "POST", path: "/auth/register", auth: "Public", desc: "Create a new user account", mc: "text-green-400", ac: "text-zinc-500" },
              { method: "GET", path: "/graph", auth: "User", desc: "Ego-subgraph with bulk risk scores, Louvain clusters, log-volume enrichment", mc: "text-blue-400", ac: "text-cyan-400" },
              { method: "GET", path: "/wallet/:address", auth: "User", desc: "Single wallet detail: risk score, transfer history, coin types", mc: "text-blue-400", ac: "text-cyan-400" },
              { method: "GET", path: "/suspicious", auth: "User", desc: "Run one detector: circular | fanout | fanin | rapid | cluster", mc: "text-blue-400", ac: "text-cyan-400" },
              { method: "GET", path: "/stats", auth: "User", desc: "Aggregate graph statistics: node count, edge count, top wallets", mc: "text-blue-400", ac: "text-cyan-400" },
              { method: "POST", path: "/upload-transactions", auth: "Admin", desc: "Ingest CSV/JSON file — auto-detects BigQuery Ethereum or standard format", mc: "text-green-400", ac: "text-red-400" },
              { method: "GET", path: "/admin/users", auth: "Admin", desc: "List all users with roles, ban status, registration date", mc: "text-blue-400", ac: "text-red-400" },
              { method: "PATCH", path: "/admin/users/:id", auth: "Admin", desc: "Update user role (admin/user), email, or ban status", mc: "text-amber-400", ac: "text-red-400" },
              { method: "DELETE", path: "/admin/clear", auth: "Admin", desc: "Wipe all Wallet and TRANSFER data from the graph database", mc: "text-red-400", ac: "text-red-400" },
            ].map((ep) => (
              <div key={ep.path} className="landing-api-row">
                <span className={`font-mono font-bold text-[11px] ${ep.mc}`}>{ep.method}</span>
                <span className="font-mono text-zinc-300 text-[11px]">{ep.path}</span>
                <span className={`text-[10px] font-bold ${ep.ac}`}>{ep.auth}</span>
                <span className="text-zinc-500 text-[11px]">{ep.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════ CTA ════════════════════ */}
      <section className="landing-cta">
        <div className="landing-cta-inner">
          <div className="landing-cta-glow" />
          <div className="relative z-10 text-center">
            <AlertTriangle size={28} className="text-amber-400 mx-auto mb-4" />
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3 tracking-tight">
              Ready to Expose Hidden Patterns?
            </h2>
            <p className="text-sm text-zinc-400 max-w-lg mx-auto mb-8">
              Upload your transaction data and let the analysis engine reveal
              suspicious flows, community clusters, and high-risk wallets.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <button
                onClick={() => router.push("/login")}
                className="landing-btn-hero"
              >
                <Lock size={16} />
                Access the Console
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════ FOOTER ════════════════════ */}
      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <div className="flex items-center gap-2">
            <ShieldAlert size={14} className="text-red-500" />
            <span className="font-mono text-xs text-zinc-600">
              DBMS v2.0
            </span>
          </div>
          <span className="font-mono text-[10px] text-zinc-700">
            DISTRIBUTED BLOCKCHAIN MONITORING SYSTEM — {new Date().getFullYear()}
          </span>
        </div>
      </footer>
      </>
      </div>)}
    </div>
  );
}
