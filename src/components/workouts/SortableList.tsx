import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { GripVertical } from "lucide-react";
import { moveTo } from "@/lib/workout-sharing";

// Pointer events funcionam no touch e mouse. Só o puxador bloqueia o gesto de rolagem.
export function SortableList<T extends { id: string }>({
  items,
  onReorder,
  label,
  disabled = false,
  children,
}: {
  items: T[];
  onReorder: (items: T[]) => void;
  label: (item: T) => string;
  disabled?: boolean;
  children: (item: T, index: number, handle: ReactNode) => ReactNode;
}) {
  const list = useRef<HTMLOListElement>(null);
  const current = useRef(items);
  const change = useRef(onReorder);
  const [dragging, setDragging] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const helpId = useId();
  const gesture = useRef<{
    id: string;
    startY: number;
    y: number;
    moved: boolean;
    original: T[];
    pointer: number;
    scroll: HTMLElement | null;
    frame: number;
  } | null>(null);
  useEffect(() => {
    current.current = items;
    change.current = onReorder;
  }, [items, onReorder]);
  useEffect(
    () => () => {
      if (gesture.current) cancelAnimationFrame(gesture.current.frame);
    },
    [],
  );

  function commit(next: T[]) {
    current.current = next;
    change.current(next);
  }
  function update() {
    const g = gesture.current;
    if (!g?.moved || !list.current) return;
    const from = current.current.findIndex((item) => item.id === g.id);
    const rows = [...list.current.children] as HTMLElement[];
    const to = rows.findIndex((row, i) => {
      if (i === from) return false;
      const rect = row.getBoundingClientRect();
      return (
        g.y >= rect.top &&
        g.y <= rect.bottom &&
        (i > from ? g.y > (rect.top + rect.bottom) / 2 : g.y < (rect.top + rect.bottom) / 2)
      );
    });
    if (to !== -1) commit(moveTo(current.current, from, to));
  }
  function scrollFrame() {
    const g = gesture.current;
    if (!g) return;
    if (g.moved) {
      const bounds = g.scroll?.getBoundingClientRect();
      const top = bounds?.top ?? 0,
        bottom = bounds?.bottom ?? window.innerHeight - 88;
      const distance = g.y < top + 64 ? -12 : g.y > bottom - 64 ? 12 : 0;
      if (distance) {
        if (g.scroll) g.scroll.scrollTop += distance;
        else window.scrollBy(0, distance);
        update();
      }
    }
    g.frame = requestAnimationFrame(scrollFrame);
  }
  function finish(cancel: boolean) {
    const g = gesture.current;
    if (!g) return;
    cancelAnimationFrame(g.frame);
    if (cancel && g.moved) commit(g.original);
    const index = current.current.findIndex((item) => item.id === g.id);
    if (g.moved)
      setAnnouncement(
        cancel
          ? "Movimento cancelado."
          : `${label(current.current[index])}, posição ${index + 1} de ${items.length}.`,
      );
    gesture.current = null;
    setDragging(null);
  }

  return (
    <>
      <p id={helpId} className="sort-help">
        Arraste pelo puxador ou use as setas para mudar a ordem.
      </p>
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>
      <ol
        ref={list}
        className="sort-list"
        onPointerMove={(e) => {
          const g = gesture.current;
          if (!g || g.pointer !== e.pointerId) return;
          g.y = e.clientY;
          if (!g.moved && Math.abs(g.y - g.startY) > 6) {
            g.moved = true;
            setDragging(g.id);
          }
          update();
        }}
        onPointerUp={() => finish(false)}
        onPointerCancel={() => finish(true)}
        onLostPointerCapture={(e) => {
          if (e.target === e.currentTarget) finish(true);
        }}
      >
        {items.map((item, index) => (
          <li
            key={item.id}
            data-sort-id={item.id}
            className={dragging === item.id ? "sort-row is-dragging" : "sort-row"}
          >
            {children(
              item,
              index,
              <button
                type="button"
                className="sort-handle"
                aria-label={`Arrastar ${label(item)}`}
                aria-describedby={helpId}
                disabled={disabled || items.length < 2}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    finish(true);
                    return;
                  }
                  const to =
                    e.key === "ArrowUp"
                      ? index - 1
                      : e.key === "ArrowDown"
                        ? index + 1
                        : e.key === "Home"
                          ? 0
                          : e.key === "End"
                            ? items.length - 1
                            : null;
                  if (to === null) return;
                  e.preventDefault();
                  if (to < 0 || to >= items.length) return;
                  commit(moveTo(current.current, index, to));
                  requestAnimationFrame(() =>
                    list.current
                      ?.querySelector<HTMLButtonElement>(
                        `[data-sort-id="${CSS.escape(item.id)}"] .sort-handle`,
                      )
                      ?.focus(),
                  );
                  setAnnouncement(`${label(item)}, posição ${to + 1} de ${items.length}.`);
                }}
                onPointerDown={(e) => {
                  if (e.button !== 0 || disabled || gesture.current) return;
                  list.current?.setPointerCapture(e.pointerId);
                  let parent = list.current?.parentElement ?? null;
                  while (
                    parent &&
                    parent !== document.body &&
                    parent !== document.documentElement &&
                    !(
                      parent.scrollHeight > parent.clientHeight &&
                      /auto|scroll/.test(getComputedStyle(parent).overflowY)
                    )
                  )
                    parent = parent.parentElement;
                  if (parent === document.body || parent === document.documentElement)
                    parent = null;
                  gesture.current = {
                    id: item.id,
                    startY: e.clientY,
                    y: e.clientY,
                    moved: false,
                    original: [...current.current],
                    pointer: e.pointerId,
                    scroll: parent,
                    frame: 0,
                  };
                  scrollFrame();
                }}
              >
                <GripVertical size={22} aria-hidden="true" />
              </button>,
            )}
          </li>
        ))}
      </ol>
    </>
  );
}
