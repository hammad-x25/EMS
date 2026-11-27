"use client";

import { PointerEvent, useEffect, useRef, useState } from "react";
import { Eraser, PenLine, RotateCcw, Trash2, X } from "lucide-react";
import { loadScratchpad, saveScratchpad } from "@/lib/offline-queue";

type Tool = "pen" | "eraser";

export function ScratchpadDrawer({ attemptId, open, onClose }: { attemptId: string; open: boolean; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const undoStackRef = useRef<string[]>([]);
  const notesRef = useRef("");
  const drawingDataRef = useRef<string | null>(null);
  const [tab, setTab] = useState<"drawing" | "notes">("drawing");
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
    return () => { active = false; };
  }, [attemptId]);

  useEffect(() => {
    if (open && tab === "drawing" && loaded) paintDataUrl(drawingDataRef.current);
  }, [loaded, open, tab]);

  async function persist(drawingDataUrl = drawingDataRef.current, noteText = notesRef.current) {
    drawingDataRef.current = drawingDataUrl;
    notesRef.current = noteText;
    await saveScratchpad(attemptId, { notes: noteText, drawingDataUrl });
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

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/50" role="dialog" aria-modal="true" aria-labelledby="scratchpad-title">
      <section className="flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 p-5">
          <div><p className="eyebrow">Persists on this device</p><h2 className="mt-1 text-xl font-black" id="scratchpad-title">Digital scratchpad</h2></div>
          <button aria-label="Close scratchpad" className="rounded-lg p-2 hover:bg-slate-100" onClick={onClose} type="button"><X size={20} /></button>
        </div>
        <div className="flex gap-2 border-b border-slate-200 px-5 py-3">
          <button className={tab === "drawing" ? "btn-primary" : "btn-secondary"} onClick={() => setTab("drawing")} type="button">Freehand canvas</button>
          <button className={tab === "notes" ? "btn-primary" : "btn-secondary"} onClick={() => setTab("notes")} type="button">Quick notes</button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {tab === "drawing" ? (
            <div>
              <div className="mb-3 flex flex-wrap gap-2">
                <button className={tool === "pen" ? "btn-primary" : "btn-secondary"} onClick={() => setTool("pen")} type="button"><PenLine size={15} /> Pen</button>
                <button className={tool === "eraser" ? "btn-primary" : "btn-secondary"} onClick={() => setTool("eraser")} type="button"><Eraser size={15} /> Eraser</button>
                <button className="btn-secondary" onClick={undo} type="button"><RotateCcw size={15} /> Undo</button>
                <button className="btn-danger" onClick={clearDrawing} type="button"><Trash2 size={15} /> Clear</button>
              </div>
              <canvas
                aria-label="Freehand scratchpad canvas"
                className="w-full touch-none rounded-xl border-2 border-slate-300 bg-white"
                height={420}
                onPointerDown={beginStroke}
                onPointerMove={continueStroke}
                onPointerUp={endStroke}
                onPointerCancel={endStroke}
                ref={canvasRef}
                width={720}
              />
            </div>
          ) : (
            <label className="block text-sm font-black">Notes and rough calculations
              <textarea
                className="field mt-2 min-h-[420px] resize-y font-mono leading-7"
                onChange={(event) => {
                  const value = event.target.value;
                  notesRef.current = value;
                  setNotes(value);
                  void persist(drawingDataRef.current, value);
                }}
                placeholder="Type notes, formulae, or intermediate calculations here…"
                value={notes}
              />
            </label>
          )}
        </div>
      </section>
    </div>
  );
}
