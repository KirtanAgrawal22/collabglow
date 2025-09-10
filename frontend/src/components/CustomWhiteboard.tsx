"use client";

import { useRef, useEffect, useState, useCallback } from 'react';
import { ShareButton } from './ShareButton';

interface Point {
  x: number;
  y: number;
}

interface DrawingHistory {
  dataURL: string;
  timestamp: number;
}

export const CustomWhiteboard = () => {
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
  const [shareUrl, setShareUrl] = useState('');

  const ctx = useRef<CanvasRenderingContext2D | null>(null);

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      const container = canvas.parentElement;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      
      // Redraw current state after resize
      if (historyStep >= 0 && history[historyStep]) {
        const img = new Image();
        img.onload = () => {
          ctx.current?.clearRect(0, 0, canvas.width, canvas.height);
          ctx.current?.drawImage(img, 0, 0);
        };
        img.src = history[historyStep].dataURL;
      }
    };

    ctx.current = canvas.getContext('2d');
    if (ctx.current) {
      ctx.current.lineCap = 'round';
      ctx.current.lineJoin = 'round';
      ctx.current.imageSmoothingEnabled = true;
    }

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Save initial state
    saveState();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
    };
  }, []);

  const saveState = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const newHistory = history.slice(0, historyStep + 1);
    newHistory.push({
      dataURL: canvas.toDataURL(),
      timestamp: Date.now()
    });

    // Limit history to prevent memory issues
    if (newHistory.length > 50) {
      newHistory.shift();
    }

    setHistory(newHistory);
    setHistoryStep(newHistory.length - 1);
  }, [history, historyStep]);

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
    }
  }, [historyStep, restoreState]);

  const redo = useCallback(() => {
    if (historyStep < history.length - 1) {
      restoreState(historyStep + 1);
    }
  }, [historyStep, history.length, restoreState]);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !ctx.current) return;

    ctx.current.clearRect(0, 0, canvas.width, canvas.height);
    saveState();
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

  const startDrawing = useCallback((e: React.MouseEvent) => {
    setIsDrawing(true);
    const pos = getMousePos(e);
    setStartPos(pos);

    // Save current canvas state for shape preview
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

  useEffect(() => {
    updateCursor();
  }, [currentTool, updateCursor]);

  return (
    <div className="h-full flex flex-col bg-white border border-gray-300 rounded-lg">
      {/* Header */}
      <div className="p-3 bg-gray-100 border-b border-gray-300 flex items-center justify-between flex-wrap gap-2">
        <div className="text-sm font-medium text-gray-700">🎨 Custom Whiteboard</div>
        
        <div className="flex items-center gap-2 flex-wrap">
          {/* Tools */}
          <div className="flex gap-1 bg-white p-1 rounded">
            {['pen', 'eraser', 'rectangle', 'circle', 'line'].map((tool) => (
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
              </button>
            ))}
          </div>

          {/* Color Picker */}
          <input
            type="color"
            value={currentColor}
            onChange={(e) => setCurrentColor(e.target.value)}
            className="w-8 h-8 cursor-pointer"
          />

          {/* Size Slider */}
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

          {/* Share Button */}
          <ShareButton 
            drawingData={getCanvasData()}
            onShare={(url) => 
              console.log('Share URL:', url)}
          />

          {/* Actions */}
          <div className="flex gap-1">
            <button
              onClick={undo}
              disabled={historyStep <= 0}
              className="p-2 bg-gray-500 text-white rounded text-sm disabled:opacity-50"
              title="Undo"
            >
              ↶
            </button>
            <button
              onClick={redo}
              disabled={historyStep >= history.length - 1}
              className="p-2 bg-gray-500 text-white rounded text-sm disabled:opacity-50"
              title="Redo"
            >
              ↷
            </button>
            <button
              onClick={clearCanvas}
              className="p-2 bg-red-500 text-white rounded text-sm"
              title="Clear Canvas"
            >
              🗑️
            </button>
          </div>
        </div>
      </div>

      {/* Canvas Container */}
      <div className="flex-1 relative">
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseOut={stopDrawing}
          onMouseEnter={updateCoordinates}
          className="absolute inset-0 w-full h-full"
          style={{ cursor: currentTool === 'pen' ? 'crosshair' : 'default' }}
        />
      </div>

      {/* Status Bar */}
      <div className="p-2 bg-gray-100 border-t border-gray-300 text-sm text-gray-600 flex justify-between">
        <div>{coordinates}</div>
        <div className="flex gap-4">
          <span>Ready to draw • Press and drag to start</span>
          {shareUrl && (
            <span className="text-blue-600">
              Shared: <a href={shareUrl} className="underline" target="_blank" rel="noopener noreferrer">View</a>
            </span>
          )}
        </div>
      </div>
    </div>
  );
};