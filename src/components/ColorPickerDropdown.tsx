import { Editor } from '@tiptap/react';
import { useState, useRef, useEffect } from 'react';
import { HexColorPicker } from 'react-colorful';

interface ColorPickerDropdownProps {
  editor: Editor;
}

const PRESET_COLORS = [
  '#000000', // Black
  '#374151', // Gray 700
  '#6B7280', // Gray 500
  '#9CA3AF', // Gray 400
  '#DC2626', // Red 600
  '#EA580C', // Orange 600
  '#CA8A04', // Yellow 600
  '#16A34A', // Green 600
  '#0891B2', // Cyan 600
  '#2563EB', // Blue 600
  '#7C3AED', // Violet 600
  '#C026D3', // Fuchsia 600
  '#BE185D', // Pink 700
  '#92400E', // Amber 800 (Brown)
  '#1E40AF', // Blue 800 (Dark Blue)
  '#7F1D1D', // Red 900 (Dark Red)
];

export function ColorPickerDropdown({ editor }: ColorPickerDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [color, setColor] = useState('#000000');
  const [recentColors, setRecentColors] = useState<string[]>(() => {
    const saved = localStorage.getItem('recentTextColors');
    return saved ? JSON.parse(saved) : [];
  });
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        // Add current color to recent before closing
        if (color && color.length === 7 && /^#[0-9A-Fa-f]{6}$/.test(color)) {
          addToRecent(color);
        }
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [color]);

  const getCurrentColor = () => {
    const attrs = editor.getAttributes('textStyle');
    return attrs.color || null;
  };

  const addToRecent = (color: string) => {
    const normalized = color.toUpperCase();
    // Don't add if it's already in the preset colors
    if (PRESET_COLORS.map(c => c.toUpperCase()).includes(normalized)) {
      return;
    }
    const updated = [normalized, ...recentColors.filter(c => c !== normalized)].slice(0, 8);
    setRecentColors(updated);
    localStorage.setItem('recentTextColors', JSON.stringify(updated));
  };

  const handleColorChange = (newColor: string) => {
    setColor(newColor);
    editor.chain().focus().setTextColor(newColor).run();
  };

  const handlePresetClick = (presetColor: string) => {
    setColor(presetColor);
    editor.chain().focus().setTextColor(presetColor).run();
    addToRecent(presetColor);
  };

  const handleClear = () => {
    editor.chain().focus().unsetTextColor().run();
    setIsOpen(false);
  };

  const currentColor = getCurrentColor();

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-1.5 rounded hover:bg-accent hover:text-accent-foreground transition-colors relative flex items-center justify-center text-muted-foreground"
        title="Text Color"
      >
        <span className="text-sm font-light leading-none">A</span>
        <div
          className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-4 h-1 rounded-full"
          style={{ backgroundColor: currentColor || '#000000' }}
        />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 bg-popover border rounded shadow-md p-3 z-50 w-56 animate-in fade-in zoom-in-95 duration-100">
          <HexColorPicker color={color} onChange={handleColorChange} />

          <input
            type="text"
            value={color}
            onChange={(e) => {
              const val = e.target.value;
              if (/^#[0-9A-Fa-f]{0,6}$/.test(val)) {
                setColor(val);
                if (val.length === 7) {
                  handleColorChange(val);
                  addToRecent(val);
                }
              }
            }}
            onBlur={() => {
              if (color.length === 7 && /^#[0-9A-Fa-f]{6}$/.test(color)) {
                addToRecent(color);
              }
            }}
            className="w-full mt-2 px-2 py-1 text-sm border rounded bg-background"
            placeholder="#000000"
          />

          <div className="grid grid-cols-8 gap-1 mt-2">
            {PRESET_COLORS.map(preset => (
              <button
                key={preset}
                onClick={() => handlePresetClick(preset)}
                className="w-6 h-6 rounded border border-border hover:scale-110 transition-transform"
                style={{ backgroundColor: preset }}
              />
            ))}
          </div>

          {recentColors.filter(c => !PRESET_COLORS.map(p => p.toUpperCase()).includes(c.toUpperCase())).length > 0 && (
            <>
              <div className="text-xs font-medium mt-3 mb-1 text-muted-foreground">Recent</div>
              <div className="grid grid-cols-8 gap-1">
                {recentColors
                  .filter(c => !PRESET_COLORS.map(p => p.toUpperCase()).includes(c.toUpperCase()))
                  .map(recent => (
                    <button
                      key={recent}
                      onClick={() => handlePresetClick(recent)}
                      className="w-6 h-6 rounded border border-border hover:scale-110 transition-transform"
                      style={{ backgroundColor: recent }}
                      title={recent}
                    />
                  ))}
              </div>
            </>
          )}

          <button
            onClick={handleClear}
            className="w-full mt-2 px-2 py-1 text-sm text-muted-foreground hover:bg-accent rounded"
          >
            Clear Color
          </button>
        </div>
      )}
    </div>
  );
}
