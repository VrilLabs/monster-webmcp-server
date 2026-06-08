'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface DocSectionProps {
  title: string;
  icon?: React.ReactNode;
  accent?: 'violet' | 'pink';
  children: React.ReactNode;
  defaultOpen?: boolean;
}

export function DocSection({ title, icon, accent = 'violet', children, defaultOpen = false }: DocSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const accentColor = accent === 'violet' ? '#8b5cf6' : '#ec4899';

  return (
    <div className="border border-border-custom rounded-xl overflow-hidden bg-surface/30">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full p-4 text-left hover:bg-surface-hover/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          {icon && <span style={{ color: accentColor }}>{icon}</span>}
          <span className="font-semibold text-text">{title}</span>
        </div>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="h-4 w-4 text-text-dim" />
        </motion.div>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
          >
            <div className="px-4 pb-4 pt-0 border-t border-border-custom/50">
              <div className="pt-4 space-y-4">{children}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
