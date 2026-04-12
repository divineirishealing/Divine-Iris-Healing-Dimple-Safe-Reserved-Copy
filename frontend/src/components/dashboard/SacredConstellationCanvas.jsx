import React, { useEffect, useRef } from 'react';

/**
 * Port of divine_iris_constellation.html — deep violet radial base, nebula blobs,
 * drifting twinkling stars, proximity constellation lines, occasional shooting star.
 */
const STAR_COUNT = 150;
const MAX_DIST = 140;
const NEBULAS = [
  { x: 0.12, y: 0.18, r: 0.38, c: 'rgba(100,30,200,0.22)' },
  { x: 0.88, y: 0.12, r: 0.32, c: 'rgba(180,40,255,0.16)' },
  { x: 0.55, y: 0.88, r: 0.42, c: 'rgba(80,10,180,0.2)' },
  { x: 0.18, y: 0.75, r: 0.28, c: 'rgba(160,40,240,0.15)' },
  { x: 0.82, y: 0.7, r: 0.3, c: 'rgba(60,0,160,0.18)' },
];

export function SacredConstellationCanvas({ className = '', style = {} }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cx = canvas.getContext('2d');
    if (!cx) return;

    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    let reduceMotion = mq.matches;

    let W = 0;
    let H = 0;
    const stars = [];

    const resize = () => {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
      stars.length = 0;
      for (let i = 0; i < STAR_COUNT; i++) {
        stars.push({
          x: Math.random() * W,
          y: Math.random() * H,
          r: Math.random() * 1.8 + 0.3,
          vx: reduceMotion ? 0 : (Math.random() - 0.5) * 0.18,
          vy: reduceMotion ? 0 : (Math.random() - 0.5) * 0.12,
          phase: Math.random() * Math.PI * 2,
          speed: 0.015 + Math.random() * 0.025,
          hue: Math.random() < 0.3 ? (Math.random() < 0.5 ? 'purple' : 'gold') : 'white',
          brightness: 0.4 + Math.random() * 0.5,
        });
      }
    };

    window.addEventListener('resize', resize);
    resize();

    let tick = 0;
    let shooter = null;

    const onMotion = () => {
      reduceMotion = mq.matches;
      resize();
      if (reduceMotion) shooter = null;
    };
    mq.addEventListener('change', onMotion);

    const drawNebulas = () => {
      NEBULAS.forEach((n) => {
        const x = n.x * W;
        const y = n.y * H;
        const r = n.r * Math.min(W, H);
        const pulse = reduceMotion ? 1 : 1 + 0.04 * Math.sin(tick * 0.008 + n.x * 10);
        const g = cx.createRadialGradient(x, y, 0, x, y, r * pulse);
        g.addColorStop(0, n.c);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        cx.beginPath();
        cx.arc(x, y, r * pulse, 0, Math.PI * 2);
        cx.fillStyle = g;
        cx.fill();
      });
    };

    const drawConstellations = () => {
      for (let i = 0; i < stars.length; i++) {
        for (let j = i + 1; j < stars.length; j++) {
          const dx = stars[i].x - stars[j].x;
          const dy = stars[i].y - stars[j].y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < MAX_DIST) {
            const alpha = (1 - d / MAX_DIST) * 0.18;
            cx.beginPath();
            cx.moveTo(stars[i].x, stars[i].y);
            cx.lineTo(stars[j].x, stars[j].y);
            cx.strokeStyle = `rgba(180,140,255,${alpha})`;
            cx.lineWidth = 0.5;
            cx.stroke();
          }
        }
      }
    };

    const drawStars = () => {
      stars.forEach((s) => {
        if (!reduceMotion) {
          s.x += s.vx;
          s.y += s.vy;
          if (s.x < -20) s.x = W + 20;
          if (s.x > W + 20) s.x = -20;
          if (s.y < -20) s.y = H + 20;
          if (s.y > H + 20) s.y = -20;
          s.phase += s.speed;
        }
        const twinkle = 0.5 + 0.5 * Math.sin(s.phase);
        const op = s.brightness * (0.4 + 0.6 * twinkle);
        let col;
        if (s.hue === 'purple') col = `rgba(200,150,255,${op})`;
        else if (s.hue === 'gold') col = `rgba(245,210,100,${op})`;
        else col = `rgba(255,255,255,${op})`;

        cx.beginPath();
        cx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        cx.fillStyle = col;
        cx.fill();

        if (s.r > 1.2) {
          cx.beginPath();
          cx.arc(s.x, s.y, s.r * 2.5, 0, Math.PI * 2);
          const glow = cx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * 2.5);
          glow.addColorStop(0, col);
          glow.addColorStop(1, 'rgba(0,0,0,0)');
          cx.fillStyle = glow;
          cx.fill();
        }
      });
    };

    const maybeShoot = () => {
      if (reduceMotion) return;
      if (!shooter && Math.random() < 0.004) {
        const edge = Math.random();
        shooter = {
          x: edge < 0.5 ? Math.random() * W : 0,
          y: edge < 0.5 ? 0 : Math.random() * H,
          vx: 3 + Math.random() * 4,
          vy: 2 + Math.random() * 3,
          len: 60 + Math.random() * 80,
          life: 1,
        };
      }
      if (shooter) {
        shooter.x += shooter.vx;
        shooter.y += shooter.vy;
        shooter.life -= 0.03;
        if (shooter.life <= 0 || shooter.x > W + 100 || shooter.y > H + 100) {
          shooter = null;
        } else {
          const speed = Math.hypot(shooter.vx, shooter.vy) || 1;
          const tailX = shooter.x - (shooter.vx / speed) * shooter.len;
          const tailY = shooter.y - (shooter.vy / speed) * shooter.len;
          const g = cx.createLinearGradient(tailX, tailY, shooter.x, shooter.y);
          g.addColorStop(0, 'rgba(255,255,255,0)');
          g.addColorStop(1, `rgba(255,240,200,${shooter.life * 0.9})`);
          cx.beginPath();
          cx.moveTo(tailX, tailY);
          cx.lineTo(shooter.x, shooter.y);
          cx.strokeStyle = g;
          cx.lineWidth = 1.5;
          cx.stroke();
        }
      }
    };

    let raf = 0;
    const loop = () => {
      const bg = cx.createRadialGradient(W * 0.4, H * 0.3, 0, W * 0.5, H * 0.5, Math.max(W, H) * 0.9);
      bg.addColorStop(0, 'rgba(28,8,70,1)');
      bg.addColorStop(0.3, 'rgba(18,4,52,1)');
      bg.addColorStop(0.6, 'rgba(10,1,36,1)');
      bg.addColorStop(1, 'rgba(4,0,16,1)');
      cx.fillStyle = bg;
      cx.fillRect(0, 0, W, H);

      drawNebulas();
      drawConstellations();
      drawStars();
      maybeShoot();

      tick++;
      raf = requestAnimationFrame(loop);
    };

    loop();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      mq.removeEventListener('change', onMotion);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ display: 'block', width: '100%', height: '100%', ...style }}
      aria-hidden
    />
  );
}

export default SacredConstellationCanvas;
