import { useEffect, useState, useRef, useCallback } from 'react';
import { EditorContent, Editor } from '@tiptap/react';
import {
  PageBreak,
  PAGE_BREAKS_UPDATED_EVENT,
  PAGE_WIDTH,
  PAGE_HEIGHT,
  PAGE_PADDING,
  CONTENT_HEIGHT,
  PAGE_GAP,
} from './extensions/PageSplitting';
import { usePreferences } from '../store/usePreferences';

interface PaginatedEditorViewProps {
  editor: Editor | null;
}

export function PaginatedEditorView({ editor }: PaginatedEditorViewProps) {
  const [pageBreaks, setPageBreaks] = useState<PageBreak[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const { showPageNumbers } = usePreferences();

  // Listen for page break updates
  useEffect(() => {
    const handlePageBreaksUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<{ pageBreaks: PageBreak[]; totalHeight: number }>;
      setPageBreaks(customEvent.detail.pageBreaks);
    };

    window.addEventListener(PAGE_BREAKS_UPDATED_EVENT, handlePageBreaksUpdate);
    return () => {
      window.removeEventListener(PAGE_BREAKS_UPDATED_EVENT, handlePageBreaksUpdate);
    };
  }, []);

  // If no page breaks calculated yet, show single page
  const pages = pageBreaks.length > 0 ? pageBreaks : [{ pageNumber: 1, startPos: 0, endPos: 0, topOffset: 0, height: CONTENT_HEIGHT }];
  const totalPages = pages.length;

  return (
    <div
      ref={containerRef}
      className="paginated-editor-container"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: `${PAGE_GAP}px`,
        minWidth: 'fit-content',
      }}
    >
      {pages.map((page, index) => (
        <div
          key={page.pageNumber}
          className="page-container"
          style={{
            width: `${PAGE_WIDTH}px`,
            height: `${PAGE_HEIGHT}px`,
            backgroundColor: 'hsl(var(--background))',
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
            borderRadius: '6px',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Page content viewport */}
          <div
            className="page-viewport"
            style={{
              position: 'absolute',
              top: `${PAGE_PADDING}px`,
              left: `${PAGE_PADDING}px`,
              right: `${PAGE_PADDING}px`,
              bottom: `${PAGE_PADDING}px`,
              overflow: 'hidden',
            }}
          >
            {index === 0 ? (
              // First page: render the actual EditorContent
              <div
                className="editor-wrapper"
                style={{
                  width: `${PAGE_WIDTH - PAGE_PADDING * 2}px`,
                }}
              >
                <EditorContent editor={editor} className="paginated-editor-content" />
              </div>
            ) : (
              // Subsequent pages: clone and transform
              <div
                className="editor-clone-wrapper"
                style={{
                  width: `${PAGE_WIDTH - PAGE_PADDING * 2}px`,
                  transform: `translateY(-${page.topOffset}px)`,
                  pointerEvents: 'none', // Prevent interaction on clones for now
                }}
              >
                {/* We'll render a cloned view of the editor content */}
                <ClonedEditorContent editor={editor} pageIndex={index} />
              </div>
            )}
          </div>

          {/* Page number */}
          {showPageNumbers && (
            <div
              className="page-number"
              style={{
                position: 'absolute',
                bottom: '16px',
                left: '50%',
                transform: 'translateX(-50%)',
                fontSize: '12px',
                color: 'hsl(var(--muted-foreground))',
              }}
            >
              {page.pageNumber} of {totalPages}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// Component to render a cloned view of the editor for pages 2+
// Uses a debounced approach to avoid expensive DOM cloning during typing
function ClonedEditorContent({ editor, pageIndex }: { editor: Editor | null; pageIndex: number }) {
  const cloneRef = useRef<HTMLDivElement>(null);
  const updateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastClonedVersion = useRef<number>(0);

  const doClone = useCallback(() => {
    if (!editor || !cloneRef.current) return;

    const editorDom = editor.view.dom;
    if (editorDom) {
      // Clear previous clone
      cloneRef.current.innerHTML = '';

      // Clone the editor content
      const clone = editorDom.cloneNode(true) as HTMLElement;
      clone.setAttribute('contenteditable', 'false');
      clone.style.pointerEvents = 'none';
      clone.classList.add('editor-clone');

      cloneRef.current.appendChild(clone);
      lastClonedVersion.current = Date.now();
    }
  }, [editor]);

  // Initial clone
  useEffect(() => {
    doClone();
  }, [doClone, pageIndex]);

  // Debounced re-clone when page breaks update
  useEffect(() => {
    const handleUpdate = () => {
      // Debounce clone updates - wait 200ms after last update
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
      updateTimeoutRef.current = setTimeout(() => {
        doClone();
        updateTimeoutRef.current = null;
      }, 200);
    };

    window.addEventListener(PAGE_BREAKS_UPDATED_EVENT, handleUpdate);
    return () => {
      window.removeEventListener(PAGE_BREAKS_UPDATED_EVENT, handleUpdate);
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, [doClone]);

  return <div ref={cloneRef} className="cloned-content" />;
}

export default PaginatedEditorView;
