import React, { useEffect, useRef, useMemo } from 'react';
import { cn } from '../../lib/utils';
import { resolveCosmicTheme } from '../../lib/dashboardCosmicThemes';
import { SanctuaryCozyOverviewBackground } from './SanctuaryCozyOverviewBackground';

/** Electric violet constellations — bolder than default, aligned with Transformations hero energy */
const CONSTELLATION_PATTERNS = [
  { phase: 0.2, rot: 0.00012, breathe: 0.0045, anchor: [0.78, 0.11], closed: false, color: [192, 132, 252], rel: [[0, 0], [0.04, -0.02], [0.08, 0.01], [0.12, -0.02], [0.16, 0.03]] },
  { phase: 1.1, rot: -0.0001, breathe: 0.0055, anchor: [0.11, 0.56], closed: true, color: [167, 112, 255], rel: [[0, 0], [0.06, 0.06], [0.02, 0.12], [0, 0]] },
  { phase: 2.4, rot: 0.00014, breathe: 0.004, anchor: [0.5, 0.27], closed: false, color: [233, 213, 255], rel: [[0, 0], [0.08, -0.02], [0.16, 0]] },
  { phase: 0.7, rot: -0.00011, breathe: 0.005, anchor: [0.26, 0.78], closed: false, color: [147, 51, 234], rel: [[0, 0], [0.04, -0.04], [0.08, 0.01], [0.06, 0.06]] },
  { phase: 3.0, rot: 0.00009, breathe: 0.0045, anchor: [0.87, 0.45], closed: true, color: [216, 180, 254], rel: [[0, 0], [0.04, 0.06], [-0.01, 0.1], [-0.04, 0.04], [0, 0]] },
  { phase: 1.8, rot: 0.00011, breathe: 0.004, anchor: [0.38, 0.62], closed: false, color: [236, 72, 153], rel: [[0, 0], [0.03, 0.05], [0.07, 0.02], [0.1, 0.06]] },
  { phase: 2.1, rot: -0.00013, breathe: 0.0048, anchor: [0.62, 0.88], closed: true, color: [168, 85, 247], rel: [[0, 0], [0.05, -0.03], [0.02, -0.07], [0, 0]] },
];

const MESH_PURPLE_A = [168, 85, 247];
const MESH_PURPLE_B = [233, 213, 255];

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

/** Larger “hero-style” stars (Transformations ConstellationCanvas uses ~0.8–3px cores + glow) */
function randomPurpleStar(warmBoost) {
  const roll = Math.random();
  let r;
  let cr;
  let cg;
  let cb;
  const wb = warmBoost;
  const big = 1.75;
  if (roll < 0.38 - wb * 0.1) {
    r = (0.75 + Math.random() * 1.35) * big;
    cr = 200 + Math.random() * 55;
    cg = 160 + Math.random() * 70;
    cb = 255;
  } else if (roll < 0.72 - wb * 0.08) {
    r = (0.85 + Math.random() * 1.55) * big;
    cr = 140 + Math.random() * 80;
    cg = 70 + Math.random() * 100;
    cb = 255;
  } else if (roll < 0.88 + wb * 0.04) {
    r = (0.7 + Math.random() * 1.2) * big;
    cr = 244 + Math.random() * 11;
    cg = 200 + Math.random() * 45;
    cb = 255;
  } else {
    r = (0.65 + Math.random() * 1.0) * big;
    cr = 230 + Math.random() * 25;
    cg = 190 + Math.random() * 50;
    cb = 255;
  }
  return { r, cr, cg, cb };
}

/**
 * Purplish sanctuary sky: drifting stars, named constellations + proximity mesh, violet aurora.
 */
export function CosmicDashboardBackground({
  videoActive = false,
  variant = 'milky_way',
  className,
  /** When set (e.g. user id/email), overview cozy scene remounts so the mug quote re-runs for a new login. */
  sacredHomeRemountKey,
}) {
  const canvasRef = useRef(null);
  const canvasParallaxRef = useRef(null);
  const theme = useMemo(() => resolveCosmicTheme(variant), [variant]);

  useEffect(() => {
    if (variant === 'immersive_purple' || variant === 'sacred_home_light') return;
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
        if (was && logicalW > 0 && logicalH > 0) {
          initStars(logicalW, logicalH);
          initFallDots(logicalW, logicalH);
        }
      }
    };
    mq.addEventListener('change', onMotionPref);

    const c = resolveCosmicTheme(variant).canvas;

    let raf = 0;
    let stars = [];
    let fallDots = [];
    let edges = [];
    let t = 0;
    let frame = 0;
    let logicalW = 0;
    let logicalH = 0;
    const edgeSet = new Set();
    const maxD = Math.min(c.maxD * 1.22, 152);
    const warmBoost = c.warmStarBoost;

    const STAR_COUNT = (videoActive ? 120 : 240) + Math.floor((c.starDelta || 0) * 1.2);
    const FALL_DOT_COUNT = videoActive ? 110 : 200;
    const dprCap = 2;
    const MESH_REBUILD = 48;

    let meteors = [];
    let nextMeteor = reduceMotion ? 99999 : 220 + Math.random() * 360;

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
        const take = Math.min(5, near.length);
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

    const initFallDots = (w, h) => {
      fallDots = [];
      for (let i = 0; i < FALL_DOT_COUNT; i++) {
        const depth = 0.25 + Math.random() * 0.75;
        fallDots.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.45 * depth,
          vy: (0.35 + Math.random() * 1.85) * (0.5 + depth * 0.5),
          r: 0.65 + Math.random() * 2.1,
          ph: Math.random() * Math.PI * 2,
          tw: 0.025 + Math.random() * 0.055,
          cr: 180 + Math.floor(Math.random() * 75),
          cg: 100 + Math.floor(Math.random() * 95),
          cb: 255,
          base: 0.28 + Math.random() * 0.42,
        });
      }
    };

    const initStars = (w, h) => {
      stars = [];
      for (let i = 0; i < STAR_COUNT; i++) {
        const { r, cr, cg, cb } = randomPurpleStar(warmBoost);
        const depth = 0.35 + Math.random() * 0.65;
        const sp = reduceMotion ? 0 : (0.012 + Math.random() * 0.046) * depth;
        const ang = Math.random() * Math.PI * 2;
        const fallBias = 0.0062 * depth;
        stars.push({
          x: Math.random() * w,
          y: Math.random() * h,
          r,
          cr,
          cg,
          cb,
          tw: reduceMotion ? 0.002 : 0.0035 + Math.random() * 0.012,
          ph: Math.random() * Math.PI * 2,
          base: 0.32 + Math.random() * 0.52,
          vx: Math.cos(ang) * sp,
          vy: Math.sin(ang) * sp + fallBias,
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
      initFallDots(w, h);
      meteors = [];
    };

    resize();
    window.addEventListener('resize', resize);

    const lineMult = (c.lineAlphaMult || 1) * 1.45;

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
        fallDots.forEach((d) => {
          d.y += d.vy;
          d.x += d.vx;
          d.ph += d.tw;
          if (d.y > h + 12) {
            d.y = -6 - Math.random() * 40;
            d.x = Math.random() * w;
          }
          if (d.x < -8) d.x = w + 8;
          if (d.x > w + 8) d.x = -8;
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
        ctx.strokeStyle = `rgba(${r},${g},${b},${0.42 * soulPulse * (videoActive ? 0.55 : 1)})`;
        ctx.lineWidth = 2.1;
        ctx.setLineDash([8, 12]);
        ctx.lineDashOffset = reduceMotion ? 0 : -t * dashSpeed;
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.strokeStyle = `rgba(250, 245, 255,${0.16 * soulPulse})`;
        ctx.lineWidth = 0.85;
        ctx.stroke();

        pts.forEach((p, i) => {
          const glint = reduceMotion
            ? 0.65
            : 0.4 + 0.45 * Math.sin(t * 0.016 + p.x * 0.008 + i);
          const nodeR = reduceMotion ? 2.4 : 2.2 + 0.65 * Math.sin(t * 0.022 + i);
          ctx.beginPath();
          ctx.arc(p.x, p.y, nodeR * 3.2, 0, Math.PI * 2);
          const hg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, nodeR * 3.2);
          hg.addColorStop(0, `rgba(${r},${g},${b},${glint * 0.22 * (videoActive ? 0.65 : 1)})`);
          hg.addColorStop(1, 'transparent');
          ctx.fillStyle = hg;
          ctx.fill();
          ctx.beginPath();
          ctx.arc(p.x, p.y, nodeR, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 252, 255,${glint * 0.88 * (videoActive ? 0.65 : 1)})`;
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
        let alpha = 0.1 * fade * pulse * lineMult * (videoActive ? 0.65 : 1);
        const [ar, ag, ab] = MESH_PURPLE_A;
        const [br, bg, bb] = MESH_PURPLE_B;
        ctx.beginPath();
        ctx.moveTo(sa.x, sa.y);
        ctx.lineTo(sb.x, sb.y);
        ctx.setLineDash([4, 8]);
        ctx.lineDashOffset = -dashOff;
        ctx.strokeStyle = `rgba(${ar},${ag},${ab},${alpha})`;
        ctx.lineWidth = 1.15;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(sa.x, sa.y);
        ctx.lineTo(sb.x, sb.y);
        ctx.lineDashOffset = -dashOff * 0.7;
        ctx.strokeStyle = `rgba(${br},${bg},${bb},${alpha * 0.82})`;
        ctx.lineWidth = 0.62;
        ctx.stroke();
        ctx.setLineDash([]);
      });

      /* Falling / drifting violet dust */
      fallDots.forEach((d) => {
        const tw = reduceMotion ? 0.65 : 0.35 + 0.65 * Math.sin(d.ph);
        const a = d.base * tw * (videoActive ? 0.75 : 1);
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${d.cr},${d.cg},${d.cb},${a})`;
        ctx.fill();
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
        g.addColorStop(0, `rgba(240,230,255,${headA})`);
        g.addColorStop(0.4, `rgba(180,150,255,${headA * 0.45})`);
        g.addColorStop(1, 'transparent');
        ctx.strokeStyle = g;
        ctx.lineWidth = 1.45;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(m.x, m.y, 1.35, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(230, 220, 255,${headA * 0.85})`;
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
        const glowR = s.r * 3.5;
        ctx.beginPath();
        ctx.arc(s.x, s.y, glowR, 0, Math.PI * 2);
        const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, glowR);
        g.addColorStop(0, `rgba(${s.cr},${s.cg},${s.cb},${alpha * 0.52})`);
        g.addColorStop(0.45, `rgba(${s.cr},${s.cg},${s.cb},${alpha * 0.12})`);
        g.addColorStop(1, 'transparent');
        ctx.fillStyle = g;
        ctx.fill();
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

  const isImmersivePurple = variant === 'immersive_purple';
  const isSacredHomeLight = variant === 'sacred_home_light';

  return (
    <div
      className={cn('fixed inset-0 z-0 pointer-events-none overflow-hidden', className)}
      data-testid="dashboard-cosmic-bg"
      data-cosmic-variant={variant}
      aria-hidden
    >
      {isSacredHomeLight ? (
        <SanctuaryCozyOverviewBackground
          key={sacredHomeRemountKey || 'sanctuary-cozy'}
          storageScope={sacredHomeRemountKey || 'student'}
        />
      ) : isImmersivePurple ? (
        <>
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(165deg, #1a0a3e 0%, #2d1b69 22%, #4c1d95 48%, #5b21b6 72%, #312e81 100%)',
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              opacity: 0.95,
              background: `
                radial-gradient(ellipse 110% 85% at 50% -15%, rgba(196, 181, 253, 0.55) 0%, transparent 52%),
                radial-gradient(ellipse 90% 70% at 100% 45%, rgba(167, 139, 250, 0.35) 0%, transparent 48%),
                radial-gradient(ellipse 80% 60% at 0% 85%, rgba(139, 92, 246, 0.28) 0%, transparent 45%)
              `,
            }}
          />
          <div
            className="absolute inset-0 opacity-[0.12]"
            style={{
              background: 'radial-gradient(ellipse 70% 50% at 50% 100%, rgba(212, 175, 55, 0.35) 0%, transparent 55%)',
            }}
          />
        </>
      ) : (
        <>
          <div
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(180deg, #0d0618 0%, #1a0a3e 55%, #0f0a1e 100%)',
            }}
          />
          <div
            className="absolute inset-0 opacity-[0.5]"
            style={{
              background:
                'radial-gradient(ellipse 100% 68% at 50% 8%, rgba(196, 181, 253, 0.38) 0%, rgba(167, 139, 250, 0.1) 42%, transparent 55%), radial-gradient(ellipse 88% 56% at 90% 52%, rgba(139, 92, 246, 0.2) 0%, transparent 48%), radial-gradient(ellipse 65% 48% at 8% 78%, rgba(233, 213, 255, 0.12) 0%, transparent 50%)',
            }}
          />
          <div className="absolute inset-0 opacity-[0.2]" style={{ background: theme.baseBg }} />

          <div
            className="absolute cosmic-aurora-slow rounded-[100%] opacity-[0.48]"
            style={{
              width: 'min(125vw, 960px)',
              height: 'min(92vh, 720px)',
              left: '50%',
              top: '40%',
              background: `radial-gradient(ellipse at 42% 38%, rgba(233, 213, 255, 0.5) 0%, rgba(167, 139, 250, 0.28) 40%, transparent 72%), ${theme.nebula1}`,
              filter: 'blur(52px)',
            }}
          />
          <div
            className="absolute cosmic-aurora-slow-alt rounded-[100%] opacity-[0.42]"
            style={{
              width: 'min(105vw, 680px)',
              height: 'min(72vh, 540px)',
              right: '-14%',
              bottom: '4%',
              background: `radial-gradient(ellipse at 30% 48%, rgba(192, 132, 252, 0.32) 0%, rgba(124, 58, 237, 0.15) 45%, transparent 58%), ${theme.nebula2}`,
              filter: 'blur(44px)',
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
        </>
      )}
    </div>
  );
}

export default CosmicDashboardBackground;
