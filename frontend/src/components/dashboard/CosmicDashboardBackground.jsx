import React, { useEffect, useRef, useMemo } from 'react';
import { cn } from '../../lib/utils';
import { resolveCosmicTheme } from '../../lib/dashboardCosmicThemes';

/**
 * Route-aware deep space: Milky Way, nebulae, planets, constellations.
 * Variants from `getDashboardCosmicVariant(pathname)` — no butterflies.
 */
export function CosmicDashboardBackground({ videoActive = false, variant = 'milky_way', className }) {
  const canvasRef = useRef(null);
  const theme = useMemo(() => resolveCosmicTheme(variant), [variant]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const c = resolveCosmicTheme(variant).canvas;

    let raf = 0;
    let stars = [];
    let edges = [];
    let t = 0;
    let logicalW = 0;
    let logicalH = 0;
    const edgeSet = new Set();
    const maxD = c.maxD;
    const warmBoost = c.warmStarBoost;

    const STAR_COUNT = (videoActive ? 85 : 165) + (c.starDelta || 0);
    const dprCap = 2;

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
          r = 0.35 + Math.random() * 0.9;
          cr = 240 + Math.random() * 15;
          cg = 245 + Math.random() * 10;
          cb = 255;
        } else if (roll < 0.82 - wb * 0.15) {
          r = 0.5 + Math.random() * 1.1;
          cr = 180 + Math.random() * 40;
          cg = 200 + Math.random() * 35;
          cb = 255;
        } else if (roll < 0.94 + wb * 0.04) {
          r = 0.4 + Math.random() * 0.8;
          cr = 255;
          cg = 230 + Math.random() * 25;
          cb = 200 + Math.random() * 40;
        } else {
          r = 0.45 + Math.random() * 0.7;
          cr = 230;
          cg = 200;
          cb = 120 + Math.random() * 40;
        }
        stars.push({
          x: Math.random() * w,
          y: Math.random() * h,
          r,
          cr,
          cg,
          cb,
          tw: 0.004 + Math.random() * 0.014,
          ph: Math.random() * Math.PI * 2,
          base: 0.25 + Math.random() * 0.55,
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
    };

    resize();
    window.addEventListener('resize', resize);

    const [lbR, lbG, lbB] = c.lineBlue;

    const draw = () => {
      t += 1;
      const w = logicalW || canvas.clientWidth || 1;
      const h = logicalH || canvas.clientHeight || 1;
      ctx.clearRect(0, 0, w, h);

      edges.forEach(({ a, b, d }) => {
        const sa = stars[a];
        const sb = stars[b];
        if (!sa || !sb) return;
        const fade = 1 - d / maxD;
        const pulse = 0.85 + 0.15 * Math.sin(t * 0.012 + a * 0.1);
        let alpha = 0.035 * fade * pulse * (c.lineAlphaMult || 1);
        ctx.beginPath();
        ctx.moveTo(sa.x, sa.y);
        ctx.lineTo(sb.x, sb.y);
        ctx.strokeStyle = `rgba(${lbR},${lbG},${lbB},${alpha})`;
        ctx.lineWidth = 0.55;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(sa.x, sa.y);
        ctx.lineTo(sb.x, sb.y);
        ctx.strokeStyle = `rgba(212,175,55,${alpha * (c.lineGoldMult ?? 0.45)})`;
        ctx.lineWidth = 0.35;
        ctx.stroke();
      });

      stars.forEach((s) => {
        s.ph += s.tw;
        const tw = 0.5 + 0.5 * Math.sin(s.ph);
        const alpha = s.base * tw * (videoActive ? 0.85 : 1);
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${s.cr},${s.cg},${s.cb},${alpha})`;
        ctx.fill();
        if (s.r > 0.85) {
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.r * 2.2, 0, Math.PI * 2);
          const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * 2.2);
          g.addColorStop(0, `rgba(${s.cr},${s.cg},${s.cb},${alpha * 0.35})`);
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
    };
  }, [videoActive, variant]);

  const planetBaseStyle = { position: 'absolute', borderRadius: '9999px' };

  return (
    <div
      className={cn('fixed inset-0 z-0 pointer-events-none overflow-hidden', className)}
      data-testid="dashboard-cosmic-bg"
      data-cosmic-variant={variant}
      aria-hidden
    >
      <div className="absolute inset-0" style={{ background: theme.baseBg }} />

      <div
        className="absolute cosmic-milky-way"
        style={{
          opacity: theme.milkyOpacity,
          width: '140%',
          height: '55%',
          left: '-20%',
          top: '-5%',
          transform: 'rotate(-18deg)',
          background: theme.milkyGradient,
          filter: 'blur(28px)',
        }}
      />

      <div
        className="absolute cosmic-nebula-drift rounded-full opacity-50"
        style={{
          width: 'min(90vw, 720px)',
          height: 'min(55vh, 480px)',
          left: '50%',
          top: '38%',
          transform: 'translate(-50%, -50%)',
          background: theme.nebula1,
          filter: 'blur(40px)',
        }}
      />
      <div
        className="absolute cosmic-nebula-drift rounded-full opacity-35"
        style={{
          width: 'min(70vw, 520px)',
          height: 'min(40vh, 360px)',
          right: '-8%',
          bottom: '18%',
          background: theme.nebula2,
          filter: 'blur(36px)',
          animationDelay: '-12s',
        }}
      />

      <div
        className="absolute cosmic-planet-glow rounded-full"
        style={{
          ...planetBaseStyle,
          width: 'min(42vw, 260px)',
          height: 'min(42vw, 260px)',
          right: '4%',
          bottom: '10%',
          ...theme.planetA,
        }}
      />
      <div
        className="absolute cosmic-planet-glow-alt rounded-full opacity-80"
        style={{
          ...planetBaseStyle,
          width: 'min(22vw, 140px)',
          height: 'min(22vw, 140px)',
          left: '8%',
          top: '22%',
          ...theme.planetB,
          animationDelay: '-8s',
        }}
      />
      <div
        className="absolute cosmic-planet-glow rounded-full opacity-70"
        style={{
          ...planetBaseStyle,
          width: 'min(18vw, 110px)',
          height: 'min(18vw, 110px)',
          left: '42%',
          bottom: '6%',
          ...theme.planetC,
          animationDelay: '-16s',
        }}
      />

      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ opacity: videoActive ? 0.42 : 0.92 }}
        data-testid="dashboard-cosmic-canvas"
      />
    </div>
  );
}

/** Small route mood line above page content */
export function CosmicPageMood({ variant }) {
  const theme = useMemo(() => resolveCosmicTheme(variant), [variant]);
  return (
    <div
      className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] uppercase tracking-[0.2em] text-cyan-200/50 px-0.5"
      data-testid="dashboard-cosmic-mood"
    >
      <span className="flex h-1.5 w-1.5 shrink-0 rounded-full bg-gradient-to-br from-cyan-200 to-violet-400 shadow-[0_0_10px_rgba(165,243,252,0.6)]" />
      <span className="font-semibold text-cyan-100/80">{theme.label}</span>
      {theme.sub && (
        <span className="font-normal normal-case tracking-normal text-white/35">· {theme.sub}</span>
      )}
    </div>
  );
}

export default CosmicDashboardBackground;
