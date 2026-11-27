"use client";

import { PointerEvent, useEffect, useRef, useState } from "react";
import { Eraser, PenLine, RotateCcw, Trash2 } from "lucide-react";
import { Drawer } from "@/components/ui/Drawer";
import { Tabs } from "@/components/ui/Tabs";
import { loadScratchpad, saveScratchpad } from "@/lib/offline-queue";

type Tool = "pen" | "eraser";
type ScratchpadTab = "drawing" | "notes";

export function ScratchpadDrawer({
  attemptId,
  open,
  onClose,
}: {
  attemptId: string;
  open: boolean;
  onClose: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const undoStackRef = useRef<string[]>([]);
  const notesRef = useRef("");
  const notesSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const drawingDataRef = useRef<string | null>(null);
  const [tab, setTab] = useState<ScratchpadTab>("drawing");
  const [tool, setTool] = useState<Tool>("pen");
  const [notes, setNotes] = useState("");
  const [loaded, setLoaded] = useState(false);

  function paintDataUrl(dataUrl: string | null) {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    if (!dataUrl) return;
    const image = new Image();
    image.onload = () => context.drawImage(image, 0, 0, canvas.width, canvas.height);
    image.src = dataUrl;
  }

  useEffect(() => {
    let active = true;
    void loadScratchpad(attemptId).then((saved) => {
      if (!active) return;
      const savedNotes = saved?.notes ?? "";
      notesRef.current = savedNotes;
      drawingDataRef.current = saved?.drawingDataUrl ?? null;
      setNotes(savedNotes);
      setLoaded(true);
    });
    return () => {
      active = false;
    };
  }, [attemptId]);

  useEffect(() => {
    if (open && tab === "drawing" && loaded) paintDataUrl(drawingDataRef.current);
  }, [loaded, open, tab]);

  useEffect(() => {
    return () => {
      if (notesSaveTimerRef.current) {
        clearTimeout(notesSaveTimerRef.current);
        notesSaveTimerRef.current = null;
        void saveScratchpad(attemptId, {
          notes: notesRef.current,
          drawingDataUrl: drawingDataRef.current,
        });
      }
    };
  }, [attemptId]);

  async function persist(drawingDataUrl = drawingDataRef.current, noteText = notesRef.current) {
    drawingDataRef.current = drawingDataUrl;
    notesRef.current = noteText;
    await saveScratchpad(attemptId, { notes: noteText, drawingDataUrl });
  }

  function scheduleNotesPersist(noteText: string) {
    notesRef.current = noteText;
    if (notesSaveTimerRef.current) clearTimeout(notesSaveTimerRef.current);
    notesSaveTimerRef.current = setTimeout(() => {
      notesSaveTimerRef.current = null;
      void persist(drawingDataRef.current, notesRef.current);
    }, 200);
  }

  function point(event: PointerEvent<HTMLCanvasElement>) {
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  function beginStroke(event: PointerEvent<HTMLCanvasElement>) {
    const canvas = event.currentTarget;
    const context = canvas.getContext("2d");
    if (!context) return;
    undoStackRef.current.push(canvas.toDataURL("image/png"));
    if (undoStackRef.current.length > 20) undoStackRef.current.shift();
    drawingRef.current = true;
    canvas.setPointerCapture(event.pointerId);
    const start = point(event);
    context.beginPath();
    context.moveTo(start.x, start.y);
  }

  function continueStroke(event: PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const context = event.currentTarget.getContext("2d");
    if (!context) return;
    const next = point(event);
    context.lineCap = "round";
    context.lineJoin = "round";
    context.lineWidth = tool === "eraser" ? 20 : 3;
    context.strokeStyle = "#172554";
    context.globalCompositeOperation = tool === "eraser" ? "destination-out" : "source-over";
    context.lineTo(next.x, next.y);
    context.stroke();
  }

  function endStroke(event: PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    event.currentTarget.releasePointerCapture(event.pointerId);
    const dataUrl = event.currentTarget.toDataURL("image/png");
    void persist(dataUrl);
  }

  function undo() {
    const previous = undoStackRef.current.pop() ?? null;
    paintDataUrl(previous);
    void persist(previous);
  }

  function clearDrawing() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    undoStackRef.current.push(canvas.toDataURL("image/png"));
    paintDataUrl(null);
    void persist(null);
  }

  function handleClose() {
    if (notesSaveTimerRef.current) {
      clearTimeout(notesSaveTimerRef.current);
      notesSaveTimerRef.current = null;
      void persist(drawingDataRef.current, notesRef.current);
    }
    onClose();
  }

  return (
    <Drawer
      closeLabel="Close scratchpad"
      eyebrow="Persists on this device"
      maxWidthClass="max-w-2xl"
      onClose={handleClose}
      open={open}
      title="Digital scratchpad"
    >
      <div className="space-y-4">
        <Tabs
          activeId={tab}
          ariaLabel="Scratchpad mode"
          idPrefix="scratchpad"
          items={[
            { id: "drawing", label: "Freehand canvas" },
            { id: "notes", label: "Quick notes" },
          ]}
          onSelect={setTab}
        />

        {tab === "drawing" ? (
          <div id="scratchpad-panel-drawing" role="tabpanel">
            <div className="mb-3 flex flex-wrap gap-2">
              <button
                className={tool === "pen" ? "btn-primary h-9 px-3 text-xs" : "btn-secondary h-9 px-3 text-xs"}
                onClick={() => setTool("pen")}
                type="button"
              >
                <PenLine size={14} /> Pen
              </button>
              <button
                className={tool === "eraser" ? "btn-primary h-9 px-3 text-xs" : "btn-secondary h-9 px-3 text-xs"}
                onClick={() => setTool("eraser")}
                type="button"
              >
                <Eraser size={14} /> Eraser
              </button>
              <button className="btn-secondary h-9 px-3 text-xs" onClick={undo} type="button">
                <RotateCcw size={14} /> Undo
              </button>
              <button className="btn-danger h-9 px-3 text-xs" onClick={clearDrawing} type="button">
                <Trash2 size={14} /> Clear
              </button>
            </div>
            <canvas
              aria-label="Freehand scratchpad canvas"
              className="w-full touch-none rounded-lg border-2 border-[var(--border-strong)] bg-white"
              height={420}
              onPointerCancel={endStroke}
              onPointerDown={beginStroke}
              onPointerMove={continueStroke}
              onPointerUp={endStroke}
              ref={canvasRef}
              width={720}
            />
          </div>
        ) : (
          <div id="scratchpad-panel-notes" role="tabpanel">
            <label className="block text-sm font-bold text-[var(--text-primary)]">
              Notes and rough calculations
              <textarea
                className="field font-mono-tabular mt-2 min-h-[420px] resize-y leading-7"
                onBlur={() => void persist(drawingDataRef.current, notesRef.current)}
                onChange={(event) => {
                  const value = event.target.value;
                  setNotes(value);
                  scheduleNotesPersist(value);
                }}
                placeholder="Type notes, formulae, or intermediate calculations here…"
                value={notes}
              />
            </label>
          </div>
        )}
      </div>
    </Drawer>
  );
}
