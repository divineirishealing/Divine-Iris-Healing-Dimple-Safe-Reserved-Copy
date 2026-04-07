import React, { useEffect, useRef } from 'react';
import { cn } from '../../lib/utils';

/**
 * Deep-space dashboard backdrop: Milky Way band, nebula washes, soft planets,
 * twinkling stars, and faint constellation lines. Keeps gold (#D4AF37) as accent.
 */
export function CosmicDashboardBackground({ videoActive = false, className }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let stars = [];
    let edges = [];
    let t = 0;
    let logicalW = 0;
    let logicalH = 0;
    const edgeSet = new Set();

    const STAR_COUNT = videoActive ? 85 : 165;
    const dprCap = 2;

    const buildEdges = () => {
      edges = [];
      edgeSet.clear();
      const maxD = 118;
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
        if (roll < 0.55) {
          r = 0.35 + Math.random() * 0.9;
          cr = 240 + Math.random() * 15;
          cg = 245 + Math.random() * 10;
          cb = 255;
        } else if (roll < 0.82) {
          r = 0.5 + Math.random() * 1.1;
          cr = 180 + Math.random() * 40;
          cg = 200 + Math.random() * 35;
          cb = 255;
        } else if (roll < 0.94) {
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

    const draw = () => {
      t += 1;
      const w = logicalW || canvas.clientWidth || 1;
      const h = logicalH || canvas.clientHeight || 1;
      ctx.clearRect(0, 0, w, h);

      // Constellation lines
      edges.forEach(({ a, b, d }) => {
        const sa = stars[a];
        const sb = stars[b];
        if (!sa || !sb) return;
        const fade = 1 - d / 118;
        const pulse = 0.85 + 0.15 * Math.sin(t * 0.012 + a * 0.1);
        const alpha = 0.035 * fade * pulse;
        ctx.beginPath();
        ctx.moveTo(sa.x, sa.y);
        ctx.lineTo(sb.x, sb.y);
        ctx.strokeStyle = `rgba(160,190,255,${alpha})`;
        ctx.lineWidth = 0.55;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(sa.x, sa.y);
        ctx.lineTo(sb.x, sb.y);
        ctx.strokeStyle = `rgba(212,175,55,${alpha * 0.45})`;
        ctx.lineWidth = 0.35;
        ctx.stroke();
      });

      // Stars
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
  }, [videoActive]);

  return (
    <div
      className={cn('fixed inset-0 z-0 pointer-events-none overflow-hidden', className)}
      data-testid="dashboard-cosmic-bg"
      aria-hidden
    >
      {/* Deep space base */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 120% 80% at 50% -10%, rgba(45, 27, 78, 0.55) 0%, transparent 55%),
            radial-gradient(ellipse 90% 60% at 100% 30%, rgba(30, 58, 95, 0.35) 0%, transparent 50%),
            radial-gradient(ellipse 70% 50% at 0% 70%, rgba(60, 30, 90, 0.3) 0%, transparent 45%),
            linear-gradient(165deg, #030510 0%, #0a0a1a 18%, #0f0c28 42%, #080c1c 68%, #030508 100%)
          `,
        }}
      />

      {/* Milky Way band */}
      <div
        className="absolute cosmic-milky-way opacity-[0.42]"
        style={{
          width: '140%',
          height: '55%',
          left: '-20%',
          top: '-5%',
          transform: 'rotate(-18deg)',
          background: `
            linear-gradient(90deg,
              transparent 0%,
              rgba(100, 80, 140, 0.07) 15%,
              rgba(190, 175, 255, 0.14) 38%,
              rgba(255, 245, 230, 0.1) 50%,
              rgba(140, 120, 200, 0.11) 62%,
              rgba(80, 60, 120, 0.06) 82%,
              transparent 100%)
          `,
          filter: 'blur(28px)',
        }}
      />

      {/* Distant galaxy / nebula wash */}
      <div
        className="absolute cosmic-nebula-drift rounded-full opacity-50"
        style={{
          width: 'min(90vw, 720px)',
          height: 'min(55vh, 480px)',
          left: '50%',
          top: '38%',
          transform: 'translate(-50%, -50%)',
          background:
            'radial-gradient(ellipse at 40% 40%, rgba(120, 80, 180, 0.22) 0%, rgba(40, 20, 80, 0.08) 45%, transparent 70%)',
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
          background:
            'radial-gradient(circle at 30% 50%, rgba(212, 175, 55, 0.12) 0%, rgba(93, 63, 211, 0.1) 40%, transparent 68%)',
          filter: 'blur(36px)',
          animationDelay: '-12s',
        }}
      />

      {/* Soft planets (luminous orbs) */}
      <div
        className="absolute cosmic-planet-glow rounded-full"
        style={{
          width: 'min(42vw, 260px)',
          height: 'min(42vw, 260px)',
          right: '4%',
          bottom: '10%',
          background:
            'radial-gradient(circle at 32% 28%, rgba(200, 180, 255, 0.5), rgba(80, 50, 140, 0.2) 38%, rgba(20, 10, 40, 0.05) 62%, transparent 72%)',
          boxShadow: '0 0 100px rgba(100, 70, 180, 0.15), inset -20px -20px 50px rgba(0,0,0,0.25)',
        }}
      />
      <div
        className="absolute cosmic-planet-glow-alt rounded-full opacity-80"
        style={{
          width: 'min(22vw, 140px)',
          height: 'min(22vw, 140px)',
          left: '8%',
          top: '22%',
          background:
            'radial-gradient(circle at 40% 35%, rgba(255, 220, 180, 0.35), rgba(180, 120, 60, 0.12) 50%, transparent 70%)',
          boxShadow: '0 0 60px rgba(212, 175, 55, 0.12)',
          animationDelay: '-8s',
        }}
      />
      <div
        className="absolute cosmic-planet-glow rounded-full opacity-70"
        style={{
          width: 'min(18vw, 110px)',
          height: 'min(18vw, 110px)',
          left: '42%',
          bottom: '6%',
          background:
            'radial-gradient(circle at 50% 40%, rgba(100, 200, 255, 0.25), rgba(30, 60, 120, 0.1) 55%, transparent 72%)',
          boxShadow: '0 0 40px rgba(80, 160, 255, 0.1)',
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

export default CosmicDashboardBackground;
