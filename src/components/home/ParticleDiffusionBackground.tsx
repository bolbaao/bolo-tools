"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  baseX: number;
  baseY: number;
};

type Mouse = { x: number; y: number; active: boolean };

const LINE_COLOR = "125, 211, 252";
const DOT_COLOR = "186, 230, 253";
const LINK_DIST = 118;
const MOUSE_DIST = 160;
const MOUSE_FORCE = 0.018;

function easeOutCubic(t: number) {
  return 1 - (1 - t) ** 3;
}

function particleCount(span: number) {
  return Math.min(110, Math.max(52, Math.floor((span * span) / 12000)));
}

function buildParticles(width: number, height: number, count: number): Particle[] {
  const particles: Particle[] = [];
  for (let i = 0; i < count; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    particles.push({
      x,
      y,
      baseX: x,
      baseY: y,
      vx: (Math.random() - 0.5) * 0.35,
      vy: (Math.random() - 0.5) * 0.35,
    });
  }
  return particles;
}

function drawParticleNetwork(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  particles: Particle[],
  mouse: Mouse,
  intro: number,
  animate: boolean,
) {
  ctx.globalAlpha = intro;
  ctx.fillStyle = "#020408";
  ctx.fillRect(0, 0, width, height);

  const ambient = ctx.createRadialGradient(
    width * 0.5,
    height * 0.5,
    0,
    width * 0.5,
    height * 0.5,
    Math.max(width, height) * 0.55,
  );
  ambient.addColorStop(0, "rgba(14, 165, 233, 0.06)");
  ambient.addColorStop(0.45, "rgba(56, 189, 248, 0.02)");
  ambient.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = ambient;
  ctx.fillRect(0, 0, width, height);

  if (animate) {
    for (const p of particles) {
      if (mouse.active) {
        const dx = mouse.x - p.x;
        const dy = mouse.y - p.y;
        const dist = Math.hypot(dx, dy);
        if (dist < MOUSE_DIST && dist > 0.001) {
          const force = (MOUSE_DIST - dist) / MOUSE_DIST;
          p.vx -= (dx / dist) * force * MOUSE_FORCE;
          p.vy -= (dy / dist) * force * MOUSE_FORCE;
        }
      }

      p.x += p.vx;
      p.y += p.vy;
      p.vx += (p.baseX - p.x) * 0.0008;
      p.vy += (p.baseY - p.y) * 0.0008;
      p.vx *= 0.992;
      p.vy *= 0.992;

      if (p.x < 0 || p.x > width) {
        p.vx *= -1;
        p.x = Math.max(0, Math.min(width, p.x));
      }
      if (p.y < 0 || p.y > height) {
        p.vy *= -1;
        p.y = Math.max(0, Math.min(height, p.y));
      }
    }
  }

  for (let i = 0; i < particles.length; i++) {
    const a = particles[i];
    let mouseBoost = 0;

    if (mouse.active) {
      const md = Math.hypot(mouse.x - a.x, mouse.y - a.y);
      if (md < MOUSE_DIST) mouseBoost = (1 - md / MOUSE_DIST) * 0.85;
    }

    for (let j = i + 1; j < particles.length; j++) {
      const b = particles[j];
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const dist = Math.hypot(dx, dy);
      if (dist > LINK_DIST) continue;

      let lineAlpha = (1 - dist / LINK_DIST) * 0.22;
      if (mouse.active) {
        const midX = (a.x + b.x) * 0.5;
        const midY = (a.y + b.y) * 0.5;
        const md = Math.hypot(mouse.x - midX, mouse.y - midY);
        if (md < MOUSE_DIST) lineAlpha += (1 - md / MOUSE_DIST) * 0.45;
      }
      lineAlpha = Math.min(0.72, lineAlpha + mouseBoost * 0.15);
      if (lineAlpha < 0.03) continue;

      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = `rgba(${LINE_COLOR}, ${lineAlpha})`;
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
  }

  for (const p of particles) {
    let alpha = 0.35;
    let radius = 1.1;
    if (mouse.active) {
      const md = Math.hypot(mouse.x - p.x, mouse.y - p.y);
      if (md < MOUSE_DIST) {
        const t = 1 - md / MOUSE_DIST;
        alpha = 0.35 + t * 0.55;
        radius = 1.1 + t * 1.4;
      }
    }

    const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius * 3);
    glow.addColorStop(0, `rgba(${DOT_COLOR}, ${alpha * 0.5})`);
    glow.addColorStop(1, `rgba(${DOT_COLOR}, 0)`);
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius * 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(p.x, p.y, radius * 0.55, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${DOT_COLOR}, ${alpha})`;
    ctx.fill();
  }

  const vignette = ctx.createRadialGradient(
    width * 0.5,
    height * 0.5,
    Math.min(width, height) * 0.12,
    width * 0.5,
    height * 0.5,
    Math.max(width, height) * 0.78,
  );
  vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
  vignette.addColorStop(0.72, "rgba(0, 0, 0, 0.1)");
  vignette.addColorStop(1, "rgba(0, 0, 0, 0.58)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);

  ctx.globalAlpha = 1;
}

export default function ParticleDiffusionBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef<Mouse>({ x: 0, y: 0, active: false });
  const pathname = usePathname();
  const isHome = pathname === "/";

  useEffect(() => {
    if (!isHome) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let raf = 0;
    let span = 0;
    let particles: Particle[] = [];
    const mountTime = performance.now();

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const rebuild = () => {
      span = Math.min(window.innerWidth, window.innerHeight);
      particles = buildParticles(width, height, particleCount(span));
    };

    const resizeCanvas = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = parent.clientWidth;
      height = parent.clientHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      rebuild();
    };

    const setMouseFromEvent = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = {
        x: clientX - rect.left,
        y: clientY - rect.top,
        active: true,
      };
    };

    const onPointerMove = (e: PointerEvent) => {
      setMouseFromEvent(e.clientX, e.clientY);
    };

    const onPointerLeave = () => {
      mouseRef.current.active = false;
    };

    const tick = (time: number) => {
      const intro = easeOutCubic(Math.min(1, (time - mountTime) / 1600));
      drawParticleNetwork(ctx, width, height, particles, mouseRef.current, intro, true);
      raf = requestAnimationFrame(tick);
    };

    resizeCanvas();
    const parent = canvas.parentElement;
    if (!parent) return;

    const ro = new ResizeObserver(resizeCanvas);
    ro.observe(parent);
    parent.addEventListener("pointermove", onPointerMove);
    parent.addEventListener("pointerleave", onPointerLeave);

    if (reducedMotion) {
      drawParticleNetwork(ctx, width, height, particles, { x: 0, y: 0, active: false }, 1, false);
      return () => {
        ro.disconnect();
        parent.removeEventListener("pointermove", onPointerMove);
        parent.removeEventListener("pointerleave", onPointerLeave);
      };
    }

    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      parent.removeEventListener("pointermove", onPointerMove);
      parent.removeEventListener("pointerleave", onPointerLeave);
    };
  }, [isHome]);

  if (!isHome) return null;

  return (
    <canvas
      ref={canvasRef}
      className="particle-diffusion-canvas pointer-events-none absolute inset-0 z-0"
      aria-hidden
    />
  );
}
