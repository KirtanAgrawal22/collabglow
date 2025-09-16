"use client";

import { useRef, useEffect, useState, useCallback, MutableRefObject } from 'react';
import type { Socket } from 'socket.io-client';
// Share removed from whiteboard

interface Point {
  x: number;
  y: number;
}

interface DrawingHistory {
  dataURL: string;
  timestamp: number;
}

interface CustomWhiteboardProps {
  roomId?: string;
  socket?: MutableRefObject<Socket | null>;
  initialImage?: string;
}

const LARGE_CANVAS_SIZE = 3000; // simulate infinite via large canvas

export const CustomWhiteboard = ({ roomId, socket, initialImage }: CustomWhiteboardProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentTool, setCurrentTool] = useState('pen');
  const [currentColor, setCurrentColor] = useState('#000000');
  const [currentSize, setCurrentSize] = useState(5);
  const [startPos, setStartPos] = useState<Point>({ x: 0, y: 0 });
  const [history, setHistory] = useState<DrawingHistory[]>([]);
  const [historyStep, setHistoryStep] = useState(-1);
  const [savedImageData, setSavedImageData] = useState<ImageData | null>(null);
  const [coordinates, setCoordinates] = useState('Position: (0, 0)');
  // removed share state
  const [textBox, setTextBox] = useState<{ x: number; y: number; value: string; visible: boolean }>({ x: 0, y: 0, value: '', visible: false });
  const textInputRef = useRef<HTMLInputElement>(null);

  const ctx = useRef<CanvasRenderingContext2D | null>(null);
  const isRemoteUpdate = useRef(false);
  const lastEmitTimeRef = useRef(0);

  // Keyboard shortcuts: Ctrl+Z / Ctrl+Y
  // (moved below after function declarations to avoid TDZ issues)

  // Text tool: draw text on click
  // moved below after saveState initialization to avoid TDZ issues

  // Initialize canvas (fixed large size, scrollable container)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    ctx.current = canvas.getContext('2d');
    if (ctx.current) {
      ctx.current.lineCap = 'round';
      ctx.current.lineJoin = 'round';
      ctx.current.imageSmoothingEnabled = true;
    }

    canvas.width = LARGE_CANVAS_SIZE;
    canvas.height = LARGE_CANVAS_SIZE;

    // Load initial image from server if provided, else from localStorage
    try {
      if (initialImage) {
        const img = new Image();
        img.onload = () => {
          ctx.current?.clearRect(0, 0, canvas.width, canvas.height);
          ctx.current?.drawImage(img, 0, 0);
          saveState();
        };
        img.src = initialImage;
      } else if (roomId) {
        const saved = localStorage.getItem(`whiteboard:${roomId}`);
        if (saved) {
          const img = new Image();
          img.onload = () => {
            ctx.current?.clearRect(0, 0, canvas.width, canvas.height);
            ctx.current?.drawImage(img, 0, 0);
            saveState();
          };
          img.src = saved;
        } else {
          saveState();
        }
      } else {
        saveState();
      }
    } catch {
      saveState();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, initialImage]);

  const saveState = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const newHistory = history.slice(0, historyStep + 1);
    newHistory.push({ dataURL: canvas.toDataURL(), timestamp: Date.now() });
    if (newHistory.length > 50) newHistory.shift();
    setHistory(newHistory);
    setHistoryStep(newHistory.length - 1);

    // Persist in localStorage
    if (roomId) {
      try { localStorage.setItem(`whiteboard:${roomId}`, canvas.toDataURL()); } catch {}
    }
  }, [history, historyStep, roomId]);

  const restoreState = useCallback((step: number) => {
    const canvas = canvasRef.current;
    if (!canvas || !ctx.current || step < 0 || step >= history.length) return;

    const img = new Image();
    img.onload = () => {
      ctx.current?.clearRect(0, 0, canvas.width, canvas.height);
      ctx.current?.drawImage(img, 0, 0);
    };
    img.src = history[step].dataURL;
    setHistoryStep(step);
  }, [history]);

  const undo = useCallback(() => {
    if (historyStep > 0) {
      restoreState(historyStep - 1);
      emitCanvasStateThrottled();
    }
  }, [historyStep, restoreState]);

  const redo = useCallback(() => {
    if (historyStep < history.length - 1) {
      restoreState(historyStep + 1);
      emitCanvasStateThrottled();
    }
  }, [historyStep, history.length, restoreState]);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !ctx.current) return;

    ctx.current.clearRect(0, 0, canvas.width, canvas.height);
    saveState();
    emitCanvasStateThrottled();
  }, [saveState]);

  const getMousePos = useCallback((e: React.MouseEvent | MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  }, []);

  const updateCoordinates = useCallback((e: React.MouseEvent) => {
    const pos = getMousePos(e);
    setCoordinates(`Position: (${Math.round(pos.x)}, ${Math.round(pos.y)})`);
  }, [getMousePos]);

  const drawTextAtRef = useRef<(x: number, y: number) => void>(() => {});

  // drawTextAt is defined after emitCanvasStateThrottled to avoid TDZ

  const startDrawing = useCallback((e: React.MouseEvent) => {
    if (currentTool === 'text') {
      const pos = getMousePos(e);
      drawTextAtRef.current(pos.x, pos.y);
      return;
    }
    setIsDrawing(true);
    const pos = getMousePos(e);
    setStartPos(pos);

    const canvas = canvasRef.current;
    if (canvas && ctx.current && currentTool !== 'pen' && currentTool !== 'eraser') {
      setSavedImageData(ctx.current.getImageData(0, 0, canvas.width, canvas.height));
    }

    if (ctx.current && (currentTool === 'pen' || currentTool === 'eraser')) {
      ctx.current.beginPath();
      ctx.current.moveTo(pos.x, pos.y);
    }
  }, [currentTool, getMousePos]);

  const draw = useCallback((e: React.MouseEvent) => {
    if (!isDrawing || !ctx.current) return;

    const pos = getMousePos(e);
    updateCoordinates(e);
    
    ctx.current.lineWidth = currentSize;
    ctx.current.strokeStyle = currentTool === 'eraser' ? '#FFFFFF' : currentColor;
    ctx.current.globalCompositeOperation = currentTool === 'eraser' ? 'destination-out' : 'source-over';

    switch (currentTool) {
      case 'pen':
      case 'eraser':
        ctx.current.lineTo(pos.x, pos.y);
        ctx.current.stroke();
        break;
        
      case 'rectangle':
        if (savedImageData) {
          ctx.current.putImageData(savedImageData, 0, 0);
          drawRectangle(startPos.x, startPos.y, pos.x - startPos.x, pos.y - startPos.y);
        }
        break;
        
      case 'circle':
        if (savedImageData) {
          ctx.current.putImageData(savedImageData, 0, 0);
          drawCircle(startPos.x, startPos.y, pos.x, pos.y);
        }
        break;
        
      case 'line':
        if (savedImageData) {
          ctx.current.putImageData(savedImageData, 0, 0);
          drawLine(startPos.x, startPos.y, pos.x, pos.y);
        }
        break;
    }

    emitCanvasStateThrottled();
  }, [isDrawing, currentTool, currentSize, currentColor, savedImageData, startPos, getMousePos, updateCoordinates]);

  const drawRectangle = useCallback((x: number, y: number, width: number, height: number) => {
    if (!ctx.current) return;
    ctx.current.strokeStyle = currentColor;
    ctx.current.lineWidth = currentSize;
    ctx.current.strokeRect(x, y, width, height);
  }, [currentColor, currentSize]);

  const drawCircle = useCallback((x1: number, y1: number, x2: number, y2: number) => {
    if (!ctx.current) return;
    const radius = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
    ctx.current.strokeStyle = currentColor;
    ctx.current.lineWidth = currentSize;
    ctx.current.beginPath();
    ctx.current.arc(x1, y1, radius, 0, 2 * Math.PI);
    ctx.current.stroke();
  }, [currentColor, currentSize]);

  const drawLine = useCallback((x1: number, y1: number, x2: number, y2: number) => {
    if (!ctx.current) return;
    ctx.current.strokeStyle = currentColor;
    ctx.current.lineWidth = currentSize;
    ctx.current.beginPath();
    ctx.current.moveTo(x1, y1);
    ctx.current.lineTo(x2, y2);
    ctx.current.stroke();
  }, [currentColor, currentSize]);

  const stopDrawing = useCallback(() => {
    if (isDrawing) {
      setIsDrawing(false);
      if (ctx.current) {
        ctx.current.globalCompositeOperation = 'source-over';
      }
      setSavedImageData(null);
      saveState();
      emitCanvasStateThrottled();
    }
  }, [isDrawing, saveState]);

  const updateCursor = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const cursors = {
      pen: 'crosshair',
      eraser: 'grab',
      rectangle: 'crosshair',
      circle: 'crosshair',
      line: 'crosshair'
    };
    canvas.style.cursor = cursors[currentTool as keyof typeof cursors] || 'crosshair';
  }, [currentTool]);

  const getCanvasData = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    
    return {
      dataURL: canvas.toDataURL(),
      width: canvas.width,
      height: canvas.height,
      timestamp: Date.now()
    };
  }, []);

  // Emit canvas updates (throttled)
  const emitCanvasStateThrottled = useCallback(() => {
    if (!roomId || !socket?.current) return;
    const now = Date.now();
    if (now - lastEmitTimeRef.current < 100) return;
    lastEmitTimeRef.current = now;
    const payload = getCanvasData();
    if (!payload) return;
    if (!isRemoteUpdate.current) {
      socket.current.emit('whiteboard_change', { roomId, drawing: payload });
    } else {
      isRemoteUpdate.current = false;
    }
    try { localStorage.setItem(`whiteboard:${roomId}`, payload.dataURL); } catch {}
  }, [roomId, socket, getCanvasData]);

  // Text tool: draw text on click (after emitCanvasStateThrottled is defined)
  const drawTextAt = useCallback((x: number, y: number) => {
    // Show input box at clicked position and focus
    setTextBox({ x, y, value: '', visible: true });
    // focus next tick
    setTimeout(() => { textInputRef.current?.focus(); }, 0);
  }, []);

  useEffect(() => {
    drawTextAtRef.current = drawTextAt;
  }, [drawTextAt]);

  // When receiving remote update, also persist
  useEffect(() => {
    if (!socket?.current) return;
    const s = socket.current;
    const handler = ({ drawing }: { drawing: { dataURL: string } }) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const img = new Image();
      img.onload = () => {
        const ctx2d = canvas.getContext('2d');
        if (!ctx2d) return;
        ctx2d.clearRect(0, 0, canvas.width, canvas.height);
        ctx2d.drawImage(img, 0, 0, canvas.width, canvas.height);
        try { if (roomId) localStorage.setItem(`whiteboard:${roomId}`, canvas.toDataURL()); } catch {}
      };
      isRemoteUpdate.current = true;
      img.src = drawing.dataURL;
    };
    s.on('whiteboard_update', handler);
    return () => { s.off('whiteboard_update', handler); };
  }, [socket, roomId]);

  useEffect(() => {
    updateCursor();
  }, [currentTool, updateCursor]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isCtrl = e.ctrlKey || e.metaKey;
      if (isCtrl && !e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        if (historyStep > 0) {
          restoreState(historyStep - 1);
          emitCanvasStateThrottled();
        }
      } else if ((isCtrl && e.key.toLowerCase() === 'y') || (isCtrl && e.shiftKey && e.key.toLowerCase() === 'z')) {
        e.preventDefault();
        if (historyStep < history.length - 1) {
          restoreState(historyStep + 1);
          emitCanvasStateThrottled();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [historyStep, history.length, restoreState, emitCanvasStateThrottled]);

  const handleDownloadImage = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dataURL = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = dataURL;
    link.download = `whiteboard_${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  // Scrollable container: update JSX
  return (
    <div className="h-full flex flex-col bg-white border border-gray-300 rounded-lg">
      <div className="p-3 bg-gray-100 border-b border-gray-300 flex items-center justify-between flex-wrap gap-2">
        <div className="text-sm font-medium text-gray-700">🎨 Custom Whiteboard</div>
        
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-1 bg-white p-1 rounded">
            {['pen', 'eraser', 'rectangle', 'circle', 'line', 'text'].map((tool) => (
              <button
                key={tool}
                onClick={() => setCurrentTool(tool)}
                className={`p-2 rounded text-sm ${
                  currentTool === tool 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-white text-gray-700 hover:bg-gray-100'
                }`}
                title={tool.charAt(0).toUpperCase() + tool.slice(1)}
              >
                {tool === 'pen' && '✏️'}
                {tool === 'eraser' && '🧽'}
                {tool === 'rectangle' && '⬜'}
                {tool === 'circle' && '⭕'}
                {tool === 'line' && '📏'}
                {tool === 'text' && '🔤'}
              </button>
            ))}
          </div>

          <input
            type="color"
            value={currentColor}
            onChange={(e) => setCurrentColor(e.target.value)}
            className="w-8 h-8 cursor-pointer"
          />

          <div className="flex items-center gap-2">
            <input
              type="range"
              min="1"
              max="20"
              value={currentSize}
              onChange={(e) => setCurrentSize(Number(e.target.value))}
              className="w-20"
            />
            <span className="text-sm text-gray-600 w-6">{currentSize}px</span>
          </div>

          <button
            onClick={handleDownloadImage}
            className="p-2 bg-gray-600 text-white rounded text-sm"
            title="Download Image"
          >
            ⬇️ Download Image
          </button>
        </div>
      </div>

      <div className="flex-1 relative overflow-auto">
        <div className="absolute" style={{ width: LARGE_CANVAS_SIZE, height: LARGE_CANVAS_SIZE }}>
          <canvas
            ref={canvasRef}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseOut={stopDrawing}
            onMouseEnter={updateCoordinates}
            className="w-full h-full"
            style={{ cursor: currentTool === 'pen' ? 'crosshair' : 'default' }}
          />
          {textBox.visible && (
            <input
              ref={textInputRef}
              value={textBox.value}
              onChange={(e) => setTextBox((t) => ({ ...t, value: e.target.value }))}
              onBlur={() => {
                if (!ctx.current) { setTextBox((t) => ({ ...t, visible: false })); return; }
                const val = textBox.value.trim();
                if (val) {
                  ctx.current.fillStyle = currentColor;
                  ctx.current.font = `${Math.max(10, currentSize * 4)}px sans-serif`;
                  ctx.current.fillText(val, textBox.x, textBox.y);
                  saveState();
                  emitCanvasStateThrottled();
                }
                setTextBox((t) => ({ ...t, visible: false, value: '' }));
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  (e.currentTarget as HTMLInputElement).blur();
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  setTextBox((t) => ({ ...t, visible: false, value: '' }));
                }
              }}
              className="absolute bg-transparent border border-gray-400 text-black outline-none"
              style={{ left: textBox.x, top: textBox.y, color: currentColor, fontSize: Math.max(10, currentSize * 4) }}
              placeholder="Type..."
            />
          )}
        </div>
      </div>

      <div className="p-2 bg-gray-100 border-t border-gray-300 text-sm text-gray-600 flex justify-between">
        <div>{coordinates}</div>
        <div className="flex gap-4">
          <span>Ready to draw • Press and drag to start</span>
          {/* Share status removed */}
        </div>
      </div>
    </div>
  );
};