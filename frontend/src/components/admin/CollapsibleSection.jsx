import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

const CollapsibleSection = ({ title, subtitle, defaultOpen = false, badge, children }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mb-4">
      <button type="button" onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-2 py-2 group cursor-pointer" data-testid={`collapse-${title?.replace(/\s/g,'-').toLowerCase()}`}>
        {open ? <ChevronDown size={13} className="text-gray-400 flex-shrink-0" /> : <ChevronRight size={13} className="text-gray-400 flex-shrink-0" />}
        <span className="text-xs font-semibold text-gray-700 group-hover:text-gray-900 transition-colors">{title}</span>
        {badge && <span className="text-[8px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">{badge}</span>}
        {subtitle && !open && <span className="text-[9px] text-gray-400 ml-auto truncate max-w-[200px]">{subtitle}</span>}
      </button>
      {open && <div className="pl-5">{children}</div>}
    </div>
  );
};

export default CollapsibleSection;
