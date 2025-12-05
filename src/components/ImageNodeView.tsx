import { NodeViewWrapper, NodeViewProps } from '@tiptap/react';
import { useEffect, useRef, useState, useCallback } from 'react';
import ReactCrop, { type Crop, type PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { getCroppedImg } from '../lib/canvasUtils';

export function ImageNodeView(props: NodeViewProps) {
  const { node, updateAttributes, selected, editor, getPos } = props;
  const [isResizing, setIsResizing] = useState(false);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const imageRef = useRef<HTMLImageElement>(null);
  const cropperRef = useRef<HTMLImageElement>(null);

  // Initial width from attributes or default
  const [width, setWidth] = useState(node.attrs.width);
  
  // Alignment styles wrapper
  const alignmentStyles: Record<string, string> = {
    // New explicit modes
    'left-wrap': 'float-left mr-4 mb-4',
    'left-break': 'flex justify-start w-full',
    'center-break': 'flex justify-center w-full',
    'right-break': 'flex justify-end w-full',
    'right-wrap': 'float-right ml-4 mb-4',
    
    // Legacy / Default mappings
    'left': 'float-left mr-4 mb-4',
    'center': 'flex justify-center w-full',
    'right': 'float-right ml-4 mb-4',
  };

  const handleMouseDown = (e: React.MouseEvent, direction: 'left' | 'right') => {
      e.preventDefault();
      e.stopPropagation(); // Stop event from bubbling to editor
      setIsResizing(true);
      
      const startX = e.clientX;
      const startWidth = imageRef.current ? imageRef.current.offsetWidth : 0;

      const onMouseMove = (moveEvent: MouseEvent) => {
          moveEvent.preventDefault(); // Prevent text selection during drag
          
          const currentX = moveEvent.clientX;
          const diffX = currentX - startX;

          let newWidth;
          if (direction === 'left') {
             // Dragging left increases width
             newWidth = Math.max(50, startWidth - diffX);
          } else {
             // Dragging right increases width
             newWidth = Math.max(50, startWidth + diffX);
          }
          
          setWidth(`${newWidth}px`);
      };

      const onMouseUp = () => {
          setIsResizing(false);
          document.removeEventListener('mousemove', onMouseMove);
          document.removeEventListener('mouseup', onMouseUp);
          // Persist final width to node attributes
          if (imageRef.current) {
            updateAttributes({ width: `${imageRef.current.offsetWidth}px` });
          }
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
  };

  useEffect(() => {
      setWidth(node.attrs.width);
  }, [node.attrs.width]);

  useEffect(() => {
      if (node.attrs.isCropping) {
          setCompletedCrop(undefined);
          setCrop({
              unit: '%',
              x: 0,
              y: 0,
              width: 100,
              height: 100
          });
      }
  }, [node.attrs.isCropping]);

  const onCropComplete = useCallback(() => {
    if (completedCrop && cropperRef.current) {
        const croppedImageBase64 = getCroppedImg(
            cropperRef.current,
            completedCrop
        );
        // 1. Update source (History step)
        updateAttributes({ src: croppedImageBase64 });
        
        // 2. Exit crop mode (No history step)
        if (typeof getPos === 'function') {
            const pos = getPos();
            // @ts-ignore
            editor.view.dispatch(editor.state.tr.setNodeAttribute(pos, 'isCropping', false).setMeta('addToHistory', false));
        }
    } else {
        // If no crop, just exit mode (No history step)
        if (typeof getPos === 'function') {
            const pos = getPos();
            // @ts-ignore
            editor.view.dispatch(editor.state.tr.setNodeAttribute(pos, 'isCropping', false).setMeta('addToHistory', false));
        }
    }
  }, [completedCrop, cropperRef, updateAttributes, editor, getPos]);

  useEffect(() => {
    // If we were in cropping mode and the image node loses selection
    if (node.attrs.isCropping && !selected) {
        onCropComplete(); 
    }
  }, [node.attrs.isCropping, selected, onCropComplete]);

  const handleCropChange = (_c: Crop, percentCrop: Crop) => {
      const threshold = 2; // 2% snap threshold
      const snap = { ...percentCrop };

      if (snap.x < threshold) snap.x = 0;
      if (snap.y < threshold) snap.y = 0;
      if (100 - (snap.x + snap.width) < threshold) snap.width = 100 - snap.x;
      if (100 - (snap.y + snap.height) < threshold) snap.height = 100 - snap.y;

      setCrop(snap);
  };

  return (
    <NodeViewWrapper className={`relative block ${alignmentStyles[node.attrs.align] || ''}`}>
      <div className={`relative group ${width === '100%' ? 'w-full block' : 'inline-flex'} ${selected ? 'ring-1 ring-[hsl(var(--image-border))] rounded-sm' : ''}`}>
          
          {node.attrs.isCropping ? (
             <ReactCrop
                crop={crop}
                onChange={handleCropChange}
                onComplete={(c) => setCompletedCrop(c)}
             >
                <img 
                    ref={cropperRef}
                    src={node.attrs.src} 
                    style={{ width: width, height: 'auto', maxWidth: '100%' }} 
                />
             </ReactCrop>
          ) : (
              <img
                ref={imageRef}
                src={node.attrs.src}
                alt={node.attrs.alt}
                style={{ width: width, height: 'auto', maxWidth: '100%' }}
                className="rounded-sm"
              />
          )}
          
          {/* Resize Handles - Visible on Selection AND NOT Cropping */}
          {(selected && !node.attrs.isCropping || isResizing) && (
            <>
              {/* Top Left */}
              <div
                  className="absolute -top-1.5 -left-1.5 w-3 h-3 cursor-nwse-resize bg-[hsl(var(--image-border))] rounded-full shadow-sm z-50 hover:scale-125 transition-transform"
                  onMouseDown={(e) => handleMouseDown(e, 'left')}
              />
              
              {/* Top Right */}
              <div
                  className="absolute -top-1.5 -right-1.5 w-3 h-3 cursor-nesw-resize bg-[hsl(var(--image-border))] rounded-full shadow-sm z-50 hover:scale-125 transition-transform"
                  onMouseDown={(e) => handleMouseDown(e, 'right')}
              />

              {/* Bottom Left */}
              <div
                  className="absolute -bottom-1.5 -left-1.5 w-3 h-3 cursor-nesw-resize bg-[hsl(var(--image-border))] rounded-full shadow-sm z-50 hover:scale-125 transition-transform"
                  onMouseDown={(e) => handleMouseDown(e, 'left')}
              />

              {/* Bottom Right */}
              <div
                  className="absolute -bottom-1.5 -right-1.5 w-3 h-3 cursor-nwse-resize bg-[hsl(var(--image-border))] rounded-full shadow-sm z-50 hover:scale-125 transition-transform"
                  onMouseDown={(e) => handleMouseDown(e, 'right')}
              />

              {/* Middle Left */}
              <div
                  className="absolute top-1/2 -translate-y-1/2 -left-1.5 w-3 h-3 cursor-ew-resize bg-[hsl(var(--image-border))] rounded-full shadow-sm z-50 hover:scale-125 transition-transform"
                  onMouseDown={(e) => handleMouseDown(e, 'left')}
              />

              {/* Middle Right */}
              <div
                  className="absolute top-1/2 -translate-y-1/2 -right-1.5 w-3 h-3 cursor-ew-resize bg-[hsl(var(--image-border))] rounded-full shadow-sm z-50 hover:scale-125 transition-transform"
                  onMouseDown={(e) => handleMouseDown(e, 'right')}
              />
            </>
          )}
      </div>
    </NodeViewWrapper>
  );
}