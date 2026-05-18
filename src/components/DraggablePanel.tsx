"use client";

import type { PointerEvent, ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { GripHorizontal } from "lucide-react";

type Position = {
  x: number;
  y: number;
};

type DragState = {
  pointerId: number;
  startX: number;
  startY: number;
  baseX: number;
  baseY: number;
};

type DraggablePanelProps = {
  ariaLabel: string;
  children: ReactNode;
  className: string;
  hidden?: boolean;
  initialPosition: Position;
  panelId: string;
  role?: "complementary" | "region";
};

function clampPanelPosition(next: Position, panel: HTMLElement | null) {
  if (typeof window === "undefined") {
    return next;
  }

  const rect = panel?.getBoundingClientRect();
  const width = rect?.width ?? 320;
  const height = rect?.height ?? 220;
  const margin = 10;

  return {
    x: Math.min(Math.max(margin, next.x), Math.max(margin, window.innerWidth - width - margin)),
    y: Math.min(Math.max(margin, next.y), Math.max(margin, window.innerHeight - height - margin)),
  };
}

export function DraggablePanel({
  ariaLabel,
  children,
  className,
  hidden = false,
  initialPosition,
  panelId,
  role = "complementary",
}: DraggablePanelProps) {
  const panelRef = useRef<HTMLElement | null>(null);
  const dragState = useRef<DragState | null>(null);
  const [position, setPosition] = useState(() => clampPanelPosition(initialPosition, null));
  const [dragging, setDragging] = useState(false);

  const endDrag = useCallback((event?: PointerEvent<HTMLElement>) => {
    if (event && dragState.current?.pointerId === event.pointerId) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    dragState.current = null;
    setDragging(false);
  }, []);

  const startDrag = useCallback((event: PointerEvent<HTMLElement>) => {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragState.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      baseX: position.x,
      baseY: position.y,
    };
    setDragging(true);
  }, [position.x, position.y]);

  const moveDrag = useCallback((event: PointerEvent<HTMLElement>) => {
    const drag = dragState.current;

    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    const next = {
      x: drag.baseX + event.clientX - drag.startX,
      y: drag.baseY + event.clientY - drag.startY,
    };
    setPosition(clampPanelPosition(next, panelRef.current));
  }, []);

  useEffect(() => {
    const clampOnResize = () => setPosition((current) => clampPanelPosition(current, panelRef.current));
    clampOnResize();
    window.addEventListener("resize", clampOnResize);

    return () => window.removeEventListener("resize", clampOnResize);
  }, []);

  return (
    <section
      aria-hidden={hidden || undefined}
      aria-label={ariaLabel}
      className={`${className} movable-panel ${dragging ? "dragging" : ""} ${hidden ? "dashboard-hidden" : ""}`}
      ref={panelRef}
      role={role}
      style={{ transform: `translate3d(${position.x}px, ${position.y}px, 0)` }}
    >
      <button
        aria-label="Move dashboard panel"
        className="drag-strip"
        data-testid={`drag-${panelId}`}
        onPointerCancel={endDrag}
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        title={`Move ${ariaLabel}`}
        type="button"
      >
        <GripHorizontal size={16} />
      </button>
      {children}
    </section>
  );
}
