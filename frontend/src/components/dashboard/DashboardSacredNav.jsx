import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../lib/utils';
import { SANCTUARY_REFERENCE } from '../../lib/dashboardSanctuaryCopy';

const LINKS = [
  { to: '/dashboard', label: 'Home', end: true },
  { to: '/dashboard/progress', label: 'My Journey' },
  { to: '/dashboard/bhaad', label: 'Bhaad' },
  { to: '/dashboard/tribe', label: 'Soul Tribe' },
  { to: '/dashboard/financials', label: 'Exchange' },
];

const tierLabel = (tier) =>
  ({ 1: 'Seeker', 2: 'Initiate', 3: 'Explorer', 4: 'Iris Zenith' }[tier] || 'Seeker');

/**
 * Fixed top bar matching divine_iris_constellation.html (glass + gold/violet accents).
 */
export function DashboardSacredNav() {
  const { user } = useAuth();
  const initial = (user?.name || user?.email || 'S').trim().charAt(0).toUpperCase() || '✦';

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-[60] flex items-center justify-between h-[58px] px-4 sm:px-8 pointer-events-auto"
      style={{
        background: 'rgba(8,0,24,0.65)',
        backdropFilter: 'blur(28px)',
        WebkitBackdropFilter: 'blur(28px)',
        borderBottom: '1px solid rgba(180,100,255,0.14)',
      }}
      data-testid="dashboard-sacred-nav"
    >
      <div
        className="font-semibold text-sm tracking-[0.12em] shrink-0"
        style={{
          fontFamily: "'Lato', sans-serif",
          background: 'linear-gradient(90deg, #d4aaff, #fff 50%, #f5c840)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}
      >
        ✦ Divine Iris Healing
      </div>

      <div className="hidden md:flex items-center gap-0.5 flex-1 justify-center max-w-xl mx-2">
        {LINKS.map(({ to, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'text-xs px-3.5 py-1.5 rounded-full transition-all no-underline',
                isActive
                  ? 'text-white bg-[rgba(160,80,255,0.22)] border border-[rgba(180,100,255,0.28)]'
                  : 'text-[rgba(200,160,255,0.5)] border border-transparent hover:text-[rgba(220,190,255,0.85)] hover:bg-[rgba(160,80,255,0.08)]'
              )
            }
            style={{ fontFamily: "'Lato', sans-serif" }}
          >
            {label}
          </NavLink>
        ))}
      </div>

      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <div
          className="hidden sm:block text-[9px] tracking-[0.16em] px-3 py-1 rounded-full max-w-[min(280px,42vw)] truncate"
          style={{
            fontFamily: "'Lato', sans-serif",
            background: 'rgba(200,150,20,0.14)',
            border: '1px solid rgba(220,170,40,0.32)',
            color: '#f5c840',
          }}
          title={user?.tier === 4 ? SANCTUARY_REFERENCE.navTierZenith : undefined}
        >
          {user?.tier === 4 ? SANCTUARY_REFERENCE.navTierZenith : `✦ ${tierLabel(user?.tier)} · Tier ${user?.tier ?? '—'}`}
        </div>
        <div
          className="w-[33px] h-[33px] rounded-full flex items-center justify-center text-sm font-bold text-white"
          style={{
            background: 'linear-gradient(135deg, #22c55e, #16a34a)',
            boxShadow: '0 0 14px rgba(34,197,94,0.35)',
          }}
          aria-hidden
        >
          {user?.picture ? (
            <img src={user.picture} alt="" className="w-full h-full rounded-full object-cover" />
          ) : (
            initial
          )}
        </div>
      </div>
    </nav>
  );
}

export default DashboardSacredNav;
