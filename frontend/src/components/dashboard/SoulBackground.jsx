import React, { useEffect, useRef } from 'react';

/* ═══ Animated Purple-Gold Glitter Background + Butterflies ═══ 
   Shared across ALL dashboard pages. Renders a canvas with:
   - Floating golden/purple glitter particles
   - Gentle purple-gold butterflies
   - Soft ambient glow
*/

const COLORS = {
  gold: ['#D4AF37', '#FFD700', '#F5C518', '#E8B923'],
  purple: ['#7C3AED', '#8B5CF6', '#A78BFA', '#6D28D9'],
};

export const SoulBackground = ({ intensity = 'normal' }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId;
    let particles = [];
    let butterflies = [];

    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight; };
    resize();
    window.addEventListener('resize', resize);

    const count = intensity === 'subtle' ? 30 : intensity === 'rich' ? 80 : 50;

    // Init particles
    for (let i = 0; i < count; i++) {
      const isGold = Math.random() > 0.4;
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: 1 + Math.random() * 2.5,
        speedX: (Math.random() - 0.5) * 0.3,
        speedY: -0.2 - Math.random() * 0.4,
        opacity: 0.2 + Math.random() * 0.5,
        color: isGold ? COLORS.gold[Math.floor(Math.random() * 4)] : COLORS.purple[Math.floor(Math.random() * 4)],
        twinkleSpeed: 0.005 + Math.random() * 0.015,
        twinklePhase: Math.random() * Math.PI * 2,
      });
    }

    // Init butterflies (3-5)
    const bCount = intensity === 'subtle' ? 2 : intensity === 'rich' ? 5 : 3;
    for (let i = 0; i < bCount; i++) {
      butterflies.push({
        x: Math.random() * canvas.width,
        y: 100 + Math.random() * (canvas.height - 200),
        size: 6 + Math.random() * 4,
        speedX: 0.3 + Math.random() * 0.4,
        wingPhase: Math.random() * Math.PI * 2,
        wingSpeed: 0.08 + Math.random() * 0.04,
        isGold: Math.random() > 0.5,
        yOffset: 0,
        ySpeed: 0.02 + Math.random() * 0.02,
        yPhase: Math.random() * Math.PI * 2,
      });
    }

    const drawButterfly = (b, time) => {
      const wingAngle = Math.sin(b.wingPhase + time * b.wingSpeed) * 0.6;
      const color1 = b.isGold ? '#D4AF37' : '#8B5CF6';
      const color2 = b.isGold ? '#F5C518' : '#A78BFA';
      const s = b.size;

      ctx.save();
      ctx.translate(b.x, b.y + b.yOffset);
      ctx.globalAlpha = 0.6;

      // Left wing
      ctx.save();
      ctx.scale(Math.cos(wingAngle), 1);
      ctx.beginPath();
      ctx.ellipse(-s * 0.6, 0, s, s * 0.6, -0.3, 0, Math.PI * 2);
      ctx.fillStyle = color1;
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(-s * 0.4, s * 0.3, s * 0.5, s * 0.35, -0.2, 0, Math.PI * 2);
      ctx.fillStyle = color2;
      ctx.fill();
      ctx.restore();

      // Right wing
      ctx.save();
      ctx.scale(Math.cos(wingAngle), 1);
      ctx.beginPath();
      ctx.ellipse(s * 0.6, 0, s, s * 0.6, 0.3, 0, Math.PI * 2);
      ctx.fillStyle = color1;
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(s * 0.4, s * 0.3, s * 0.5, s * 0.35, 0.2, 0, Math.PI * 2);
      ctx.fillStyle = color2;
      ctx.fill();
      ctx.restore();

      // Body
      ctx.beginPath();
      ctx.ellipse(0, 0, 1.5, s * 0.4, 0, 0, Math.PI * 2);
      ctx.fillStyle = b.isGold ? '#8B6914' : '#4C1D95';
      ctx.fill();

      // Glow
      ctx.beginPath();
      ctx.arc(0, 0, s * 1.5, 0, Math.PI * 2);
      const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 1.5);
      glow.addColorStop(0, b.isGold ? 'rgba(212,175,55,0.15)' : 'rgba(139,92,246,0.15)');
      glow.addColorStop(1, 'transparent');
      ctx.fillStyle = glow;
      ctx.fill();

      ctx.restore();
    };

    let time = 0;
    const animate = () => {
      time++;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw particles
      particles.forEach(p => {
        p.x += p.speedX;
        p.y += p.speedY;
        p.twinklePhase += p.twinkleSpeed;
        const alpha = p.opacity * (0.5 + 0.5 * Math.sin(p.twinklePhase));

        if (p.y < -10) { p.y = canvas.height + 10; p.x = Math.random() * canvas.width; }
        if (p.x < -10) p.x = canvas.width + 10;
        if (p.x > canvas.width + 10) p.x = -10;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = alpha;
        ctx.fill();

        // Glow
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2);
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 3);
        g.addColorStop(0, p.color + '30');
        g.addColorStop(1, 'transparent');
        ctx.fillStyle = g;
        ctx.globalAlpha = alpha * 0.5;
        ctx.fill();
      });

      ctx.globalAlpha = 1;

      // Draw butterflies
      butterflies.forEach(b => {
        b.x += b.speedX;
        b.yPhase += b.ySpeed;
        b.yOffset = Math.sin(b.yPhase) * 20;
        if (b.x > canvas.width + 20) { b.x = -20; b.y = 100 + Math.random() * (canvas.height - 200); }
        drawButterfly(b, time);
      });

      animId = requestAnimationFrame(animate);
    };

    animate();
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize); };
  }, [intensity]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{ width: '100%', height: '100%', opacity: 0.7 }}
      data-testid="soul-background"
    />
  );
};

export default SoulBackground;
