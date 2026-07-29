import type { ReactNode } from 'react';

interface SidebarSectionProps {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

// <details>/<summary> nativo: collassabile senza stato JS extra, accessibile di default.
// Sostituisce l'elenco verticale continuo della sidebar originale (prompt-refactoring.md,
// "Direzione grafica").
export function SidebarSection({ title, defaultOpen = false, children }: SidebarSectionProps) {
  return (
    <details className="sidebar-section" open={defaultOpen}>
      <summary className="sidebar-section__title">{title}</summary>
      <div className="sidebar-section__body">{children}</div>
    </details>
  );
}
