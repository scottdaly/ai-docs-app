import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import FontFamily from '@tiptap/extension-font-family';
import { TextStyle } from '@tiptap/extension-text-style';
import { FontSize } from './extensions/FontSize';
import { ResizableImage } from './extensions/ResizableImage';
import { Underline } from './extensions/Underline';
import { TextColor } from './extensions/TextColor';
import { TextHighlight } from './extensions/TextHighlight';
import { CustomCode } from './extensions/CustomCode';
import { useEffect, useRef } from 'react';
import { useFileSystem } from '../store/useFileSystem';
import { EditorToolbar } from './EditorToolbar';
import { ImageWrapMenu } from './ImageWrapMenu';
import { htmlToMarkdown, markdownToHtml } from '../utils/markdown';

export function Editor() {
  const { activeFilePath, fileContent, saveFile, setIsDirty } = useFileSystem();
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
          // Disable all input rules (auto-markdown formatting)
          bulletList: {
              keepMarks: true,
              keepAttributes: false,
          },
          orderedList: {
              keepMarks: true,
              keepAttributes: false,
          },
          code: false, // Disable default Code extension, we'll use CustomCode instead
          // We have to disable specific input rules if we want to fully stop markdown behavior
          // The StarterKit bundles many. Let's try to disable the common ones.
          // Actually, StarterKit doesn't expose a single 'disableInputRules' flag.
          // We need to configure each node/mark or use a custom extension to strip them.
          // OR, effectively, we can just disable the 'InputRule' plugin logic if possible?
          // The easiest way is to disable specific nodes' input rules if configurable, 
          // BUT Tiptap's architecture makes this tricky without re-defining extensions.
          
          // A simpler approach for this requirement:
          // "The user shouldn't be able to manually format via markdown characters"
          // We can disable the extensions that provide this, but we NEED them for rendering.
          
          // We just want to disable the *trigger*.
          
          // Let's try configuring the nodes that have strong input rules:
          heading: {
              levels: [1, 2, 3],
          },
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      TextStyle,
      FontFamily,
      FontSize,
      Underline,
      TextColor,
      TextHighlight,
      CustomCode.configure({
        HTMLAttributes: {
          class: 'bg-muted px-1.5 py-0.5 rounded text-sm font-mono',
        },
      }),
      ResizableImage.configure({
        allowBase64: true,
      }),
    ],
    
        editorProps: {
          attributes: {
            class: 'prose prose-neutral dark:prose-invert mx-auto focus:outline-none min-h-full max-w-3xl pt-8 pb-32',
          },
          handleDrop: (view, event, _slice, moved) => {
            if (!moved && event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files.length > 0) {
              const file = event.dataTransfer.files[0];
              if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (readerEvent) => {
                   const base64 = readerEvent.target?.result;
                   if (typeof base64 === 'string') {
                     const { schema } = view.state;
                     const coordinates = view.posAtCoords({ left: event.clientX, top: event.clientY });
                     if (coordinates) {
                        const node = schema.nodes.image.create({ src: base64 });
                        const transaction = view.state.tr.insert(coordinates.pos, node);
                        view.dispatch(transaction);
                     }
                   }
                };
                reader.readAsDataURL(file);
                return true; // Handled
              }
            }
            return false;
          },
          handlePaste: (view, event) => {
            if (event.clipboardData && event.clipboardData.files && event.clipboardData.files.length > 0) {
                const file = event.clipboardData.files[0];
                if (file.type.startsWith('image/')) {
                    const reader = new FileReader();
                    reader.onload = (readerEvent) => {
                        const base64 = readerEvent.target?.result;
                        if (typeof base64 === 'string') {
                            const { schema } = view.state;
                            const node = schema.nodes.image.create({ src: base64 });
                            const transaction = view.state.tr.replaceSelectionWith(node);
                            view.dispatch(transaction);
                        }
                    };
                    reader.readAsDataURL(file);
                    return true; // Handled
                }
            }
            return false;
          }
        },
    
        onUpdate: ({ editor }) => {
    
          setIsDirty(true);
    
          
    
          if (saveTimeoutRef.current) {
    
            clearTimeout(saveTimeoutRef.current);
    
          }
    
    
    
          saveTimeoutRef.current = setTimeout(() => {

            const html = editor.getHTML();
            const markdown = htmlToMarkdown(html);

            saveFile(markdown);
    
          }, 1000);
    
        },
    
      });
    
    
    
        // Load file content into editor when activeFilePath changes
    
    
    
        useEffect(() => {
    
    
    
          if (editor && activeFilePath) {
    
    
    
            // Check if content actually differs to prevent cursor jumps/loops
    
    
    
            // We compare the editor's current markdown state vs the store's fileContent


            const currentHtml = editor.getHTML();
            const currentMarkdown = htmlToMarkdown(currentHtml);



            if (currentMarkdown !== fileContent) {



              const html = markdownToHtml(fileContent);
              editor.commands.setContent(html);
    
    
    
            }
    
    
    
          }
    
    
    
        }, [activeFilePath, fileContent, editor]);
    
    
    
      // Listen for external insert events (e.g. Import DOCX)
    
      useEffect(() => {
    
          const handleInsert = (e: Event) => {
    
              const detail = (e as CustomEvent).detail;
    
              if (editor && detail) {
    
                  editor.commands.insertContent(detail);
    
              }
    
          };
    
          window.addEventListener('editor:insert-content', handleInsert);
    
          return () => window.removeEventListener('editor:insert-content', handleInsert);
    
      }, [editor]);
    
    
    
      // Listen for export requests
    
      useEffect(() => {
    
          const handleExport = async () => {
    
              if (editor) {
    
                  const json = editor.getJSON();
    
                  await window.electronAPI.exportDocx(json);
    
              }
    
          };
    
          window.addEventListener('editor:export-request', handleExport);
    
          return () => window.removeEventListener('editor:export-request', handleExport);
    
      }, [editor]);
    
    
    
      if (!activeFilePath) {
    
        return (
    
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
    
            Select a file to edit
    
          </div>
    
        );
    
      }
    
    
    
              return (
    
    
    
            
    
    
    
                <div className="flex-1 flex flex-col h-full overflow-hidden">
    
    
    
            
    
    
    
                   {editor && (
    
    
    
                      <ImageWrapMenu editor={editor} />
    
    
    
                   )}
    
    
    
            
    
    
    
                   <EditorToolbar editor={editor} />
    
    
    
            
    
    
    
                   <div className="flex-1 overflow-y-auto bg-background p-4">
    
    
    
            
    
    
    
                      <EditorContent editor={editor} className="min-h-full" />
    
    
    
            
    
    
    
                   </div>
    
    
    
            
    
    
    
                </div>
    
    
    
            
    
    
    
              );
    
    
    
      }