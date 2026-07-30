import type { ComponentType, ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';

interface SidebarSectionProps {
  title: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  defaultOpen?: boolean;
  children: ReactNode;
}

// <details>/<summary> nativo: collassabile senza stato JS extra, accessibile di default.
// Icona + chevron che ruota per rendere la voce riconoscibile come menu cliccabile
// (prompt-refactoring.md, "Direzione grafica").
export function SidebarSection({ title, icon: Icon, defaultOpen = false, children }: SidebarSectionProps) {
  return (
    <details className="sidebar-section" open={defaultOpen}>
      <summary className="sidebar-section__title">
        <Icon size={16} className="sidebar-section__icon" />
        <span className="sidebar-section__label">{title}</span>
        <ChevronRight size={16} className="sidebar-section__chevron" />
      </summary>
      <div className="sidebar-section__body">{children}</div>
    </details>
  );
}
