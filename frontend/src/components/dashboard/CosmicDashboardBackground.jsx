import React, { useEffect, useRef, useMemo } from 'react';
import { cn } from '../../lib/utils';
import { resolveCosmicTheme } from '../../lib/dashboardCosmicThemes';

/** Slower rotation / breath = calmer “temple” sky */
const CONSTELLATION_PATTERNS = [
  { phase: 0.2, rot: 0.00012, breathe: 0.0045, anchor: [0.78, 0.11], closed: false, color: [212, 175, 55], rel: [[0, 0], [0.04, -0.02], [0.08, 0.01], [0.12, -0.02], [0.16, 0.03]] },
  { phase: 1.1, rot: -0.0001, breathe: 0.0055, anchor: [0.11, 0.56], closed: true, color: [160, 210, 255], rel: [[0, 0], [0.06, 0.06], [0.02, 0.12], [0, 0]] },
  { phase: 2.4, rot: 0.00014, breathe: 0.004, anchor: [0.5, 0.27], closed: false, color: [255, 210, 190], rel: [[0, 0], [0.08, -0.02], [0.16, 0]] },
  { phase: 0.7, rot: -0.00011, breathe: 0.005, anchor: [0.26, 0.78], closed: false, color: [200, 180, 255], rel: [[0, 0], [0.04, -0.04], [0.08, 0.01], [0.06, 0.06]] },
  { phase: 3.0, rot: 0.00009, breathe: 0.0045, anchor: [0.87, 0.45], closed: true, color: [120, 200, 220], rel: [[0, 0], [0.04, 0.06], [-0.01, 0.1], [-0.04, 0.04], [0, 0]] },
];

function spawnShooting(w, h) {
  const fromTop = Math.random() > 0.5;
  return {
    x: fromTop ? Math.random() * w * 0.85 : -20,
    y: fromTop ? -15 : Math.random() * h * 0.6,
    vx: 8 + Math.random() * 10,
    vy: 3 + Math.random() * 5,
    life: 0,
    maxLife: 42 + Math.floor(Math.random() * 32),
  };
}

/**
 * Living sky: temple-paced drift, optional parallax, respects prefers-reduced-motion.
 */
export function CosmicDashboardBackground({ videoActive = false, variant = 'milky_way', className }) {
  const canvasRef = useRef(null);
  const canvasParallaxRef = useRef(null);
  const theme = useMemo(() => resolveCosmicTheme(variant), [variant]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    let reduceMotion = mq.matches;
    const onMotionPref = () => {
      const was = reduceMotion;
      reduceMotion = mq.matches;
      if (reduceMotion) {
        meteors = [];
        nextMeteor = 99999;
        parallaxX = 0;
        parallaxY = 0;
        targetParallaxX = 0;
        targetParallaxY = 0;
        if (canvasParallaxRef.current) canvasParallaxRef.current.style.transform = 'translate3d(0,0,0)';
      } else {
        nextMeteor = 200 + Math.random() * 280;
        if (was && logicalW > 0 && logicalH > 0) initStars(logicalW, logicalH);
      }
    };
    mq.addEventListener('change', onMotionPref);

    const c = resolveCosmicTheme(variant).canvas;

    let raf = 0;
    let stars = [];
    let edges = [];
    let t = 0;
    let frame = 0;
    let logicalW = 0;
    let logicalH = 0;
    const edgeSet = new Set();
    const maxD = c.maxD;
    const warmBoost = c.warmStarBoost;

    const STAR_COUNT = (videoActive ? 95 : 200) + (c.starDelta || 0);
    const dprCap = 2;
    const MESH_REBUILD = 52;

    let meteors = [];
    let nextMeteor = reduceMotion ? 99999 : 220 + Math.random() * 360;

    /** Subtle depth parallax (px) */
    let parallaxX = 0;
    let parallaxY = 0;
    let targetParallaxX = 0;
    let targetParallaxY = 0;
    const onMove = (e) => {
      if (reduceMotion) return;
      targetParallaxX = (e.clientX / window.innerWidth - 0.5) * 16;
      targetParallaxY = (e.clientY / window.innerHeight - 0.5) * 12;
    };
    window.addEventListener('mousemove', onMove, { passive: true });

    const buildEdges = () => {
      edges = [];
      edgeSet.clear();
      for (let i = 0; i < stars.length; i++) {
        const near = [];
        for (let j = 0; j < stars.length; j++) {
          if (i === j) continue;
          const dx = stars[i].x - stars[j].x;
          const dy = stars[i].y - stars[j].y;
          const d = Math.hypot(dx, dy);
          if (d < maxD) near.push({ j, d });
        }
        near.sort((a, b) => a.d - b.d);
        const take = Math.min(3, near.length);
        for (let k = 0; k < take; k++) {
          const j = near[k].j;
          const a = Math.min(i, j);
          const b = Math.max(i, j);
          const key = `${a},${b}`;
          if (!edgeSet.has(key)) {
            edgeSet.add(key);
            edges.push({ a, b, d: near[k].d });
          }
        }
      }
    };

    const initStars = (w, h) => {
      stars = [];
      for (let i = 0; i < STAR_COUNT; i++) {
        const roll = Math.random();
        let r;
        let cr;
        let cg;
        let cb;
        const wb = warmBoost;
        if (roll < 0.55 - wb * 0.25) {
          r = 0.35 + Math.random() * 0.85;
          cr = 240 + Math.random() * 15;
          cg = 245 + Math.random() * 10;
          cb = 255;
        } else if (roll < 0.82 - wb * 0.15) {
          r = 0.45 + Math.random() * 1.05;
          cr = 180 + Math.random() * 40;
          cg = 200 + Math.random() * 35;
          cb = 255;
        } else if (roll < 0.94 + wb * 0.04) {
          r = 0.38 + Math.random() * 0.75;
          cr = 255;
          cg = 230 + Math.random() * 25;
          cb = 200 + Math.random() * 40;
        } else {
          r = 0.42 + Math.random() * 0.65;
          cr = 230;
          cg = 200;
          cb = 120 + Math.random() * 40;
        }
        const depth = 0.35 + Math.random() * 0.65;
        const sp = reduceMotion ? 0 : (0.006 + Math.random() * 0.028) * depth;
        const ang = Math.random() * Math.PI * 2;
        stars.push({
          x: Math.random() * w,
          y: Math.random() * h,
          r,
          cr,
          cg,
          cb,
          tw: reduceMotion ? 0.002 : 0.0035 + Math.random() * 0.012,
          ph: Math.random() * Math.PI * 2,
          base: 0.26 + Math.random() * 0.62,
          vx: Math.cos(ang) * sp,
          vy: Math.sin(ang) * sp,
          depth,
        });
      }
      buildEdges();
    };

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const w = parent.clientWidth || window.innerWidth;
      const h = parent.clientHeight || window.innerHeight;
      logicalW = w;
      logicalH = h;
      const dpr = Math.min(window.devicePixelRatio || 1, dprCap);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      initStars(w, h);
      meteors = [];
    };

    resize();
    window.addEventListener('resize', resize);

    const [lbR, lbG, lbB] = c.lineBlue;
    const lineMult = (c.lineAlphaMult || 1) * 1.12;

    const patternPoints = (pat, w, h) => {
      if (reduceMotion) {
        const ax = pat.anchor[0] * w;
        const ay = pat.anchor[1] * h;
        return pat.rel.map(([rdx, rdy]) => ({ x: ax + rdx * w, y: ay + rdy * h }));
      }
      const wanderAx = pat.anchor[0] + 0.025 * Math.sin(t * 0.0002 + pat.phase);
      const wanderAy = pat.anchor[1] + 0.02 * Math.cos(t * 0.00016 + pat.phase * 1.3);
      const ax = wanderAx * w;
      const ay = wanderAy * h;
      const ang = t * pat.rot + pat.phase;
      const cos = Math.cos(ang);
      const sin = Math.sin(ang);
      const br = 1 + pat.breathe * Math.sin(t * 0.0065 + pat.phase);
      return pat.rel.map(([rdx, rdy]) => {
        const rx = rdx * w * br;
        const ry = rdy * h * br;
        return { x: ax + rx * cos - ry * sin, y: ay + rx * sin + ry * cos };
      });
    };

    const draw = () => {
      t += 1;
      frame += 1;
      const w = logicalW || canvas.clientWidth || 1;
      const h = logicalH || canvas.clientHeight || 1;

      if (!reduceMotion) {
        parallaxX += (targetParallaxX - parallaxX) * 0.026;
        parallaxY += (targetParallaxY - parallaxY) * 0.026;
        if (canvasParallaxRef.current) {
          canvasParallaxRef.current.style.transform = `translate3d(${parallaxX.toFixed(2)}px,${parallaxY.toFixed(2)}px,0)`;
        }
      }

      if (!reduceMotion) {
        stars.forEach((s) => {
          s.x += s.vx;
          s.y += s.vy;
          if (s.x < -8) s.x = w + 8;
          if (s.x > w + 8) s.x = -8;
          if (s.y < -8) s.y = h + 8;
          if (s.y > h + 8) s.y = -8;
        });
        if (frame % MESH_REBUILD === 0) buildEdges();
      }

      ctx.clearRect(0, 0, w, h);

      const dashSpeed = reduceMotion ? 0 : 0.11;
      const soulPulse = 0.82 + 0.18 * Math.sin(t * (reduceMotion ? 0.003 : 0.006));

      CONSTELLATION_PATTERNS.forEach((pat) => {
        const pts = patternPoints(pat, w, h);
        if (pts.length < 2) return;
        const [r, g, b] = pat.color;
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        if (pat.closed) ctx.closePath();
        ctx.strokeStyle = `rgba(${r},${g},${b},${0.14 * soulPulse * (videoActive ? 0.55 : 1)})`;
        ctx.lineWidth = 1.15;
        ctx.setLineDash([6, 10]);
        ctx.lineDashOffset = reduceMotion ? 0 : -t * dashSpeed;
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.strokeStyle = `rgba(255,255,255,${0.055 * soulPulse})`;
        ctx.lineWidth = 0.5;
        ctx.stroke();

        pts.forEach((p, i) => {
          const glint = reduceMotion
            ? 0.55
            : 0.35 + 0.4 * Math.sin(t * 0.016 + p.x * 0.008 + i);
          ctx.beginPath();
          ctx.arc(p.x, p.y, reduceMotion ? 1.15 : 1.2 + 0.3 * Math.sin(t * 0.022 + i), 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255,248,230,${glint * 0.62 * (videoActive ? 0.65 : 1)})`;
          ctx.fill();
        });
      });

      const dashOff = reduceMotion ? 0 : t * 0.09;
      edges.forEach(({ a, b, d }) => {
        const sa = stars[a];
        const sb = stars[b];
        if (!sa || !sb) return;
        const fade = 1 - d / maxD;
        const pulse = reduceMotion ? 1 : 0.82 + 0.18 * Math.sin(t * 0.009 + a * 0.07);
        let alpha = 0.038 * fade * pulse * lineMult * (videoActive ? 0.65 : 1);
        ctx.beginPath();
        ctx.moveTo(sa.x, sa.y);
        ctx.lineTo(sb.x, sb.y);
        ctx.setLineDash([3, 7]);
        ctx.lineDashOffset = -dashOff;
        ctx.strokeStyle = `rgba(${lbR},${lbG},${lbB},${alpha})`;
        ctx.lineWidth = 0.6;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(sa.x, sa.y);
        ctx.lineTo(sb.x, sb.y);
        ctx.lineDashOffset = -dashOff * 0.7;
        ctx.strokeStyle = `rgba(212,175,55,${alpha * (c.lineGoldMult ?? 0.5)})`;
        ctx.lineWidth = 0.38;
        ctx.stroke();
        ctx.setLineDash([]);
      });

      if (!reduceMotion) {
        nextMeteor -= 1;
        if (nextMeteor <= 0 && meteors.length < 1) {
          meteors.push(spawnShooting(w, h));
          nextMeteor = 280 + Math.random() * 520;
        }
      }
      meteors = meteors.filter((m) => {
        m.life += 1;
        m.x += m.vx;
        m.y += m.vy;
        const prog = m.life / m.maxLife;
        if (prog >= 1) return false;
        const headA = (1 - prog) * 0.78;
        ctx.beginPath();
        ctx.moveTo(m.x, m.y);
        ctx.lineTo(m.x - m.vx * 3.2, m.y - m.vy * 3.2);
        const g = ctx.createLinearGradient(m.x, m.y, m.x - m.vx * 4, m.y - m.vy * 4);
        g.addColorStop(0, `rgba(255,255,255,${headA})`);
        g.addColorStop(0.35, `rgba(200,220,255,${headA * 0.42})`);
        g.addColorStop(1, 'transparent');
        ctx.strokeStyle = g;
        ctx.lineWidth = 1.05;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(m.x, m.y, 1.05, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,245,${headA * 0.85})`;
        ctx.fill();
        return m.x < w + 100 && m.y < h + 100;
      });

      stars.forEach((s) => {
        if (!reduceMotion) s.ph += s.tw;
        const tw = reduceMotion ? 1 : 0.5 + 0.5 * Math.sin(s.ph);
        const alpha = s.base * tw * (0.75 + 0.25 * s.depth) * (videoActive ? 0.85 : 1);
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${s.cr},${s.cg},${s.cb},${alpha})`;
        ctx.fill();
        if (s.r > 0.82) {
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.r * 2.4, 0, Math.PI * 2);
          const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * 2.4);
          g.addColorStop(0, `rgba(${s.cr},${s.cg},${s.cb},${alpha * 0.32})`);
          g.addColorStop(1, 'transparent');
          ctx.fillStyle = g;
          ctx.fill();
        }
      });

      raf = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMove);
      mq.removeEventListener('change', onMotionPref);
    };
  }, [videoActive, variant]);

  return (
    <div
      className={cn('fixed inset-0 z-0 pointer-events-none overflow-hidden', className)}
      data-testid="dashboard-cosmic-bg"
      data-cosmic-variant={variant}
      aria-hidden
    >
      <div className="absolute inset-0 bg-[#000008]" />
      <div className="absolute inset-0 opacity-[0.22]" style={{ background: theme.baseBg }} />

      <div
        className="absolute cosmic-aurora-slow rounded-[100%] opacity-[0.28]"
        style={{
          width: 'min(120vw, 900px)',
          height: 'min(90vh, 700px)',
          left: '50%',
          top: '42%',
          background: theme.nebula1,
          filter: 'blur(56px)',
        }}
      />
      <div
        className="absolute cosmic-aurora-slow-alt rounded-[100%] opacity-[0.22]"
        style={{
          width: 'min(100vw, 640px)',
          height: 'min(70vh, 520px)',
          right: '-12%',
          bottom: '5%',
          background: theme.nebula2,
          filter: 'blur(48px)',
          animationDelay: '-20s',
        }}
      />

      <div
        className="absolute inset-0 opacity-[0.022] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />

      <div ref={canvasParallaxRef} className="absolute inset-0 will-change-transform">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
          style={{ opacity: videoActive ? 0.52 : 1 }}
          data-testid="dashboard-cosmic-canvas"
        />
      </div>
    </div>
  );
}

export default CosmicDashboardBackground;
