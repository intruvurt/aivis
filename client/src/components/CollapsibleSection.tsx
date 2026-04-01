import React, { useState } from "react";
import { ChevronDown } from "lucide-react";

interface CollapsibleSectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  icon?: React.ElementType;
  accent?: string;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  description,
  children,
  defaultOpen = false,
  icon: Icon,
  accent = "rgba(249, 115, 22, 0.22)",
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="rounded-2xl transition-all border" style={{ 
      background: 'rgba(10,14,28,0.75)',
      borderColor: isOpen ? 'rgba(249, 115, 22, 0.25)' : 'rgba(255, 255, 255, 0.08)',
    }}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-5 flex items-center justify-between gap-3 hover:bg-white/5 transition-colors rounded-t-2xl"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-3 min-w-0 text-left flex-1">
          {Icon && <Icon className="w-5 h-5 text-white/70 flex-shrink-0" />}
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-white truncate">{title}</h3>
            {description && (
              <p className="text-xs text-white/50 mt-0.5 line-clamp-1">{description}</p>
            )}
          </div>
        </div>
        <ChevronDown
          className="w-5 h-5 text-white/50 flex-shrink-0 transition-transform"
          style={{
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
            transitionDuration: "200ms",
          }}
        />
      </button>

      {isOpen && (
        <div
          className="px-6 py-5 border-t transition-all"
          style={{ borderColor: 'rgba(255, 255, 255, 0.08)' }}
        >
          {children}
        </div>
      )}
    </div>
  );
};

export default CollapsibleSection;
