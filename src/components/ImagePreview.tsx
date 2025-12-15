import { useState, useEffect, useRef } from 'react';
import { RiZoomInLine, RiZoomOutLine, RiRefreshLine } from '@remixicon/react';

interface ImagePreviewProps {
  filePath: string;
  fileName: string;
}

export function ImagePreview({ filePath, fileName }: ImagePreviewProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [zoomInput, setZoomInput] = useState('100');
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const zoomInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function loadImage() {
      setLoading(true);
      setError(null);
      try {
        const dataUrl = await window.electronAPI.readImageAsDataUrl(filePath);
        setImageUrl(dataUrl);
      } catch (err) {
        setError('Failed to load image');
        console.error('Failed to load image:', err);
      } finally {
        setLoading(false);
      }
    }

    loadImage();
  }, [filePath]);

  // Reset zoom and position when file changes
  useEffect(() => {
    setZoom(1);
    setZoomInput('100');
    setPosition({ x: 0, y: 0 });
  }, [filePath]);

  // Sync input with zoom value (when zoom changes from buttons/wheel)
  useEffect(() => {
    setZoomInput(Math.round(zoom * 100).toString());
  }, [zoom]);

  const handleZoomIn = () => setZoom(prev => Math.min(prev * 1.25, 5));
  const handleZoomOut = () => setZoom(prev => Math.max(prev / 1.25, 0.1));
  const handleReset = () => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleZoomInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setZoomInput(e.target.value);
  };

  const handleZoomInputSubmit = () => {
    const value = parseInt(zoomInput);
    if (!isNaN(value) && value >= 10 && value <= 500) {
      setZoom(value / 100);
    } else {
      // Reset to current zoom if invalid
      setZoomInput(Math.round(zoom * 100).toString());
    }
  };

  const handleZoomInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleZoomInputSubmit();
      zoomInputRef.current?.blur();
    } else if (e.key === 'Escape') {
      setZoomInput(Math.round(zoom * 100).toString());
      zoomInputRef.current?.blur();
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setZoom(prev => Math.min(Math.max(prev * delta, 0.1), 5));
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => setIsDragging(false);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <div className="animate-pulse">Loading image...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center text-destructive">
        {error}
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-4 py-2 border-b bg-background">
        <span className="text-sm text-muted-foreground mr-auto truncate">
          {fileName}
        </span>
        <button
          onClick={handleZoomOut}
          className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
          title="Zoom Out"
        >
          <RiZoomOutLine size={16} />
        </button>
        <div className="flex items-center">
          <input
            ref={zoomInputRef}
            type="text"
            value={zoomInput}
            onChange={handleZoomInputChange}
            onBlur={handleZoomInputSubmit}
            onKeyDown={handleZoomInputKeyDown}
            onFocus={(e) => e.target.select()}
            className="w-10 text-xs text-center bg-transparent border border-transparent hover:border-muted-foreground/30 focus:border-primary focus:outline-none rounded px-1 py-0.5 text-muted-foreground"
            title="Zoom percentage (10-500)"
          />
          <span className="text-xs text-muted-foreground">%</span>
        </div>
        <button
          onClick={handleZoomIn}
          className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
          title="Zoom In"
        >
          <RiZoomInLine size={16} />
        </button>
        <button
          onClick={handleReset}
          className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
          title="Reset Zoom"
        >
          <RiRefreshLine size={16} />
        </button>
      </div>

      {/* Image container */}
      <div
        ref={containerRef}
        className="flex-1 overflow-hidden bg-muted/50 dark:bg-muted/30 flex items-center justify-center"
        style={{ cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {imageUrl && (
          <img
            src={imageUrl}
            alt={fileName}
            draggable={false}
            className="max-w-full max-h-full object-contain select-none"
            style={{
              transform: `scale(${zoom}) translate(${position.x / zoom}px, ${position.y / zoom}px)`,
              transition: isDragging ? 'none' : 'transform 0.1s ease-out',
            }}
          />
        )}
      </div>
    </div>
  );
}
