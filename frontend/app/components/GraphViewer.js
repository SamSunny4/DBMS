"use client";

import { useEffect, useRef, useCallback } from "react";
import cytoscape from "cytoscape";
import cola from "cytoscape-cola";

// Register the cola layout
if (typeof window !== "undefined") {
  cytoscape.use(cola);
}

const DEFAULT_STYLE = [
  {
    selector: "node[nodeType='Wallet']",
    style: {
      label: "data(label)",
      "text-valign": "bottom",
      "text-halign": "center",
      "font-size": "9px",
      color: "#a1a1aa",
      "text-margin-y": 6,
      "text-max-width": "80px",
      "text-overflow-wrap": "ellipsis",
      "background-color": "#6366f1",
      width: 30,
      height: 30,
      "border-width": 2,
      "border-color": "#4f46e5",
    },
  },
  {
    selector: "node[nodeType='Coin']",
    style: {
      label: "data(label)",
      "text-valign": "bottom",
      "text-halign": "center",
      "font-size": "8px",
      color: "#a1a1aa",
      "text-margin-y": 5,
      "background-color": "#f59e0b",
      shape: "diamond",
      width: 22,
      height: 22,
      "border-width": 1,
      "border-color": "#d97706",
    },
  },
  {
    selector: "node.suspicious",
    style: {
      "background-color": "#ef4444",
      "border-color": "#dc2626",
      "border-width": 3,
    },
  },
  {
    selector: "node.highlighted",
    style: {
      "background-color": "#f59e0b",
      "border-color": "#d97706",
      "border-width": 3,
    },
  },
  {
    selector: "node:selected",
    style: {
      "background-color": "#818cf8",
      "border-color": "#6366f1",
      "border-width": 3,
    },
  },
  {
    selector: "edge",
    style: {
      width: 1.5,
      "line-color": "#374151",
      "target-arrow-color": "#374151",
      "target-arrow-shape": "triangle",
      "curve-style": "bezier",
      "arrow-scale": 0.8,
      label: "data(label)",
      "font-size": "7px",
      color: "#6b7280",
      "text-rotation": "autorotate",
      "text-margin-y": -8,
    },
  },
  {
    selector: "edge.highlighted",
    style: {
      "line-color": "#f59e0b",
      "target-arrow-color": "#f59e0b",
      width: 3,
      "z-index": 10,
    },
  },
  {
    selector: "edge[edgeType='USES']",
    style: {
      "line-style": "dashed",
      "line-color": "#4b5563",
      "target-arrow-shape": "none",
      width: 1,
      label: "",
    },
  },
];

export default function GraphViewer({
  elements,
  onNodeClick,
  highlightedNodes = [],
  highlightPath = [],
  style,
  layout = "cola",
}) {
  const containerRef = useRef(null);
  const cyRef = useRef(null);

  const handleNodeClick = useCallback(
    (e) => {
      const node = e.target;
      if (onNodeClick && node.data("nodeType") === "Wallet") {
        onNodeClick(node.data("label") || node.data("id"));
      }
    },
    [onNodeClick]
  );

  // Initialize Cytoscape
  useEffect(() => {
    if (!containerRef.current) return;

    const cy = cytoscape({
      container: containerRef.current,
      style: DEFAULT_STYLE,
      layout: { name: "grid" },
      minZoom: 0.1,
      maxZoom: 5,
      wheelSensitivity: 0.3,
    });

    cyRef.current = cy;
    cy.on("tap", "node", handleNodeClick);

    return () => {
      cy.destroy();
      cyRef.current = null;
    };
  }, [handleNodeClick]);

  // Update elements
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || !elements) return;

    cy.elements().remove();

    if (elements.nodes?.length > 0 || elements.edges?.length > 0) {
      const allElements = [
        ...(elements.nodes || []),
        ...(elements.edges || []),
      ];
      cy.add(allElements);

      const layoutConfig =
        layout === "cola"
          ? {
              name: "cola",
              animate: true,
              maxSimulationTime: 3000,
              nodeSpacing: 40,
              edgeLength: 120,
              randomize: true,
              avoidOverlap: true,
            }
          : { name: layout, animate: true };

      cy.layout(layoutConfig).run();
    }
  }, [elements, layout]);

  // Update highlights
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;

    cy.elements().removeClass("suspicious highlighted");

    // Mark suspicious nodes
    if (highlightedNodes.length > 0) {
      for (const nodeId of highlightedNodes) {
        const node = cy.getElementById(nodeId);
        if (node.length) node.addClass("suspicious");
        // Also try matching by label
        cy.nodes(`[label = "${nodeId}"]`).addClass("suspicious");
      }
    }

    // Mark path
    if (highlightPath.length > 1) {
      for (const nodeId of highlightPath) {
        const node = cy.getElementById(nodeId);
        if (node.length) node.addClass("highlighted");
        cy.nodes(`[label = "${nodeId}"]`).addClass("highlighted");
      }

      // Highlight edges between consecutive path nodes
      for (let i = 0; i < highlightPath.length - 1; i++) {
        const sourceId = highlightPath[i];
        const targetId = highlightPath[i + 1];
        cy.edges().forEach((edge) => {
          const s = edge.source();
          const t = edge.target();
          if (
            (s.id() === sourceId || s.data("label") === sourceId) &&
            (t.id() === targetId || t.data("label") === targetId)
          ) {
            edge.addClass("highlighted");
          }
        });
      }
    }
  }, [highlightedNodes, highlightPath]);

  return (
    <div
      ref={containerRef}
      className="graph-container"
      style={style}
    />
  );
}
