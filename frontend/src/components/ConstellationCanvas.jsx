import React, { useEffect, useRef } from 'react';

/*
  ConstellationCanvas
  ──────────────────
  Renders an animated star-constellation effect on a full-bleed canvas.
  Stars drift slowly, twinkle, and connect with fading lines when close.
  Colour palette: deep violet + gold to match the Divine Iris brand.
*/

const STAR_COUNT   = 80;
const MAX_DIST     = 130;   // px — max distance for a connecting line
const SPEED        = 0.28;  // base drift speed (px/frame)
const TWINKLE_SPD  = 0.018; // opacity oscillation speed

// Two accent colours + white for variety
const STAR_COLORS = [
  { r: 212, g: 175, b: 55  },   // gold
  { r: 196, g: 181, b: 253 },   // lavender
  { r: 255, g: 255, b: 255 },   // white
  { r: 167, g: 139, b: 250 },   // violet
];

function initStars(w, h) {
  return Array.from({ length: STAR_COUNT }, (_, i) => {
    const col = STAR_COLORS[i % STAR_COLORS.length];
    return {
      x:   Math.random() * w,
      y:   Math.random() * h,
      vx:  (Math.random() - 0.5) * SPEED * 2,
      vy:  (Math.random() - 0.5) * SPEED * 2,
      r:   0.8 + Math.random() * 2.2,
      op:  0.3 + Math.random() * 0.7,
      dop: (Math.random() > 0.5 ? 1 : -1) * TWINKLE_SPD * (0.5 + Math.random()),
      col,
    };
  });
}

const ConstellationCanvas = ({ style = {} }) => {
  const canvasRef = useRef(null);
  const starsRef  = useRef([]);
  const rafRef    = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const resize = () => {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      starsRef.current = initStars(canvas.width, canvas.height);
    };

    resize();
    window.addEventListener('resize', resize);

    const draw = () => {
      const { width: W, height: H } = canvas;
      ctx.clearRect(0, 0, W, H);

      const stars = starsRef.current;

      // Update positions + twinkle
      for (const s of stars) {
        s.x  += s.vx;
        s.y  += s.vy;
        s.op += s.dop;

        // Bounce off edges
        if (s.x < 0 || s.x > W) { s.vx *= -1; s.x = Math.max(0, Math.min(W, s.x)); }
        if (s.y < 0 || s.y > H) { s.vy *= -1; s.y = Math.max(0, Math.min(H, s.y)); }

        // Clamp + reverse twinkle
        if (s.op > 1)   { s.op = 1;   s.dop *= -1; }
        if (s.op < 0.1) { s.op = 0.1; s.dop *= -1; }
      }

      // Draw connecting lines between nearby stars
      for (let i = 0; i < stars.length; i++) {
        for (let j = i + 1; j < stars.length; j++) {
          const a  = stars[i];
          const b  = stars[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d  = Math.sqrt(dx * dx + dy * dy);
          if (d > MAX_DIST) continue;

          const alpha = (1 - d / MAX_DIST) * 0.22 * Math.min(a.op, b.op);
          // Blend the two star colours for the line
          const r = Math.round((a.col.r + b.col.r) / 2);
          const g = Math.round((a.col.g + b.col.g) / 2);
          const bv = Math.round((a.col.b + b.col.b) / 2);

          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = `rgba(${r},${g},${bv},${alpha.toFixed(3)})`;
          ctx.lineWidth = 0.7;
          ctx.stroke();
        }
      }

      // Draw stars
      for (const s of stars) {
        // Soft glow
        const grd = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * 3.5);
        grd.addColorStop(0,   `rgba(${s.col.r},${s.col.g},${s.col.b},${(s.op * 0.55).toFixed(3)})`);
        grd.addColorStop(1,   `rgba(${s.col.r},${s.col.g},${s.col.b},0)`);
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r * 3.5, 0, Math.PI * 2);
        ctx.fillStyle = grd;
        ctx.fill();

        // Crisp centre dot
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${s.col.r},${s.col.g},${s.col.b},${s.op.toFixed(3)})`;
        ctx.fill();
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ ...style }}
    />
  );
};

export default ConstellationCanvas;
