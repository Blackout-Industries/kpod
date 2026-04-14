import { useEffect, useRef, useState, useCallback } from 'react';
import { usePolicyContext } from '@/state/context';

interface ArrowPath {
  id: string;
  d: string;
  direction: 'ingress' | 'egress';
}

export function ArrowLayer() {
  const { state } = usePolicyContext();
  const containerRef = useRef<HTMLDivElement>(null);
  const [paths, setPaths] = useState<ArrowPath[]>([]);

  const recalculate = useCallback(() => {
    const overlay = containerRef.current;
    if (!overlay) return;

    // Search the parent (VisualCanvas) since rule elements are siblings, not children
    const canvas = overlay.parentElement;
    if (!canvas) return;

    const canvasRect = canvas.getBoundingClientRect();
    const targetEl = canvas.querySelector('[data-target-pod]');
    if (!targetEl) return;

    const targetRect = targetEl.getBoundingClientRect();
    const targetLeft = targetRect.left - canvasRect.left;
    const targetRight = targetRect.right - canvasRect.left;
    const targetCenterY = targetRect.top - canvasRect.top + targetRect.height / 2;

    const newPaths: ArrowPath[] = [];

    // Smooth horizontal bezier — control points at the horizontal midpoint
    // so the curve gently bows left/right without vertical swooping
    const bezier = (sx: number, sy: number, ex: number, ey: number) => {
      const midX = (sx + ex) / 2;
      return `M ${sx} ${sy} C ${midX} ${sy}, ${midX} ${ey}, ${ex} ${ey}`;
    };

    // Ingress arrows: sub-rule row right edge -> target left edge
    const ingressEls = canvas.querySelectorAll('[data-direction="ingress"]');
    ingressEls.forEach(el => {
      const elRect = el.getBoundingClientRect();
      const startX = elRect.right - canvasRect.left;
      const startY = elRect.top - canvasRect.top + elRect.height / 2;
      const endX = targetLeft;
      const endY = targetCenterY;

      const d = bezier(startX, startY, endX, endY);
      const ruleId = el.getAttribute('data-rule-id') ?? '';
      newPaths.push({ id: `ingress-${ruleId}`, d, direction: 'ingress' });
    });

    // Egress arrows: target right edge -> sub-rule row left edge
    const egressEls = canvas.querySelectorAll('[data-direction="egress"]');
    egressEls.forEach(el => {
      const elRect = el.getBoundingClientRect();
      const startX = targetRight;
      const startY = targetCenterY;
      const endX = elRect.left - canvasRect.left;
      const endY = elRect.top - canvasRect.top + elRect.height / 2;

      const d = bezier(startX, startY, endX, endY);
      const ruleId = el.getAttribute('data-rule-id') ?? '';
      newPaths.push({ id: `egress-${ruleId}`, d, direction: 'egress' });
    });

    setPaths(newPaths);
  }, []);

  // Recalculate on state changes
  useEffect(() => {
    const timer = setTimeout(recalculate, 50);
    return () => clearTimeout(timer);
  }, [state.ingressRules, state.egressRules, recalculate]);

  // Recalculate on resize via ResizeObserver
  useEffect(() => {
    const overlay = containerRef.current;
    const canvas = overlay?.parentElement;
    if (!canvas) return;
    const observer = new ResizeObserver(() => recalculate());
    observer.observe(canvas);
    window.addEventListener('resize', recalculate);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', recalculate);
    };
  }, [recalculate]);

  return (
    <div ref={containerRef} className="absolute inset-0 pointer-events-none">
      <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
        {paths.map(p => {
          const color = p.direction === 'ingress'
            ? 'var(--color-arrow-deny)'
            : 'var(--color-arrow-allow)';

          return (
            <path
              key={p.id}
              d={p.d}
              fill="none"
              stroke={color}
              strokeWidth={2.5}
              opacity={0.75}
              strokeLinecap="round"
            />
          );
        })}
      </svg>
    </div>
  );
}
