"use client";

import { useEffect, useRef } from "react";

export function ShaderAnimation({ redProgress = 0 }) {
  const containerRef = useRef(null);
  const sceneRef = useRef({
    renderer: null,
    uniforms: null,
    animationId: null,
    resizeHandler: null,
  });

  useEffect(() => {
    let destroyed = false;

    const init = () => {
      if (destroyed || !containerRef.current || !window.THREE) return;

      const THREE = window.THREE;
      const container = containerRef.current;
      container.innerHTML = "";

      const camera = new THREE.Camera();
      camera.position.z = 1;

      const scene = new THREE.Scene();
      const geometry = new THREE.PlaneBufferGeometry(2, 2);

      const uniforms = {
        time: { type: "f", value: 1.0 },
        resolution: { type: "v2", value: new THREE.Vector2() },
        redProgress: { type: "f", value: 0.0 },
      };

      const vertexShader = `
        void main() {
          gl_Position = vec4(position, 1.0);
        }
      `;

      const fragmentShader = `
        precision highp float;
        uniform vec2 resolution;
        uniform float time;
        uniform float redProgress;

        float rand(in float x) {
          return fract(sin(x) * 1e4);
        }

        void main(void) {
          vec2 uv = (gl_FragCoord.xy * 2.0 - resolution.xy) / min(resolution.x, resolution.y);

          vec2 mosaic = vec2(4.0, 2.0);
          vec2 screen = vec2(256.0, 256.0);
          uv.x = floor(uv.x * screen.x / mosaic.x) / (screen.x / mosaic.x);
          uv.y = floor(uv.y * screen.y / mosaic.y) / (screen.y / mosaic.y);

          float t = time * 0.06 + rand(uv.x) * 0.4;
          float lw = 0.0008;

          vec3 color = vec3(0.0);
          for (int j = 0; j < 3; j++) {
            for (int i = 0; i < 5; i++) {
              color[j] += lw * float(i * i) /
                abs(fract(t - 0.01 * float(j) + float(i) * 0.01) * 1.0 - length(uv));
            }
          }

          vec3 base = vec3(color[2], color[1], color[0]);

          // Only tint the bright lines red — dark areas stay black
          float brightness = max(base.r, max(base.g, base.b));
          vec3 redLine = vec3(brightness * 1.8, brightness * 0.1, brightness * 0.05);

          // Piece-by-piece: vertical strips turn red at staggered thresholds
          float stripId = floor(uv.x * 16.0);
          float stripRand = rand(stripId * 7.3);
          float sweep = redProgress * 1.6 - 0.3;
          float redMask = smoothstep(0.0, 0.15, sweep - stripRand * 0.5);
          redMask = clamp(redMask, 0.0, 1.0);

          vec3 out_color = mix(base, redLine, redMask);

          gl_FragColor = vec4(out_color, 1.0);
        }
      `;

      const material = new THREE.ShaderMaterial({
        uniforms,
        vertexShader,
        fragmentShader,
      });

      scene.add(new THREE.Mesh(geometry, material));

      const renderer = new THREE.WebGLRenderer({ antialias: false });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.domElement.style.display = "block";
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      container.appendChild(renderer.domElement);

      const resize = () => {
        if (!container) return;
        const w = container.clientWidth;
        const h = container.clientHeight;
        renderer.setSize(w, h);
        uniforms.resolution.value.set(w * renderer.getPixelRatio(), h * renderer.getPixelRatio());
      };
      resize();
      window.addEventListener("resize", resize);

      sceneRef.current = {
        renderer,
        uniforms,
        animationId: null,
        resizeHandler: resize,
      };

      const animate = () => {
        if (destroyed) return;
        sceneRef.current.animationId = requestAnimationFrame(animate);
        uniforms.time.value += 0.05;
        renderer.render(scene, camera);
      };
      animate();
    };

    // Load Three.js if not already loaded
    if (window.THREE) {
      init();
    } else {
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/three.js/89/three.min.js";
      script.onload = init;
      document.head.appendChild(script);
    }

    return () => {
      destroyed = true;
      if (sceneRef.current.animationId) cancelAnimationFrame(sceneRef.current.animationId);
      if (sceneRef.current.resizeHandler) window.removeEventListener("resize", sceneRef.current.resizeHandler);
      if (sceneRef.current.renderer) {
        sceneRef.current.renderer.dispose();
        sceneRef.current.renderer.forceContextLoss();
      }
    };
  }, []);

  // Smoothly animate redProgress uniform toward target
  useEffect(() => {
    if (!sceneRef.current.uniforms) return;
    const target = redProgress;
    const u = sceneRef.current.uniforms;
    let raf;
    const step = () => {
      const cur = u.redProgress.value;
      const next = cur + (target - cur) * 0.06;
      u.redProgress.value = Math.abs(target - next) < 0.005 ? target : next;
      if (u.redProgress.value !== target) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [redProgress]);

  return (
    <div
      ref={containerRef}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
    />
  );
}
