import { Editor } from '@tiptap/react';
import { Highlighter, ChevronDown, ChevronLeft } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { HexColorPicker } from 'react-colorful';

interface HighlightPickerDropdownProps {
  editor: Editor;
}

const PRESET_COLORS = [
  '#FFFF00', // Yellow
  '#FFD700', // Gold
  '#FFA500', // Orange
  '#FF6347', // Tomato/Coral
  '#FF69B4', // Hot Pink
  '#FFB6C1', // Light Pink
  '#DDA0DD', // Plum
  '#EE82EE', // Violet
  '#00FF00', // Lime Green
  '#90EE90', // Light Green
  '#7FFFD4', // Aquamarine
  '#00FFFF', // Cyan
  '#87CEEB', // Sky Blue
  '#ADD8E6', // Light Blue
  '#E6E6FA', // Lavender
  '#F0E68C', // Khaki
];

const DEFAULT_HIGHLIGHT_COLOR = '#FFFF00'; // Yellow

export function HighlightPickerDropdown({ editor }: HighlightPickerDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedColor, setSelectedColor] = useState(DEFAULT_HIGHLIGHT_COLOR);
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [recentColors, setRecentColors] = useState<string[]>(() => {
    const saved = localStorage.getItem('recentHighlightColors');
    return saved ? JSON.parse(saved) : [];
  });
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        // Add current color to recent before closing if using custom picker
        if (showCustomPicker && selectedColor && selectedColor.length === 7 && /^#[0-9A-Fa-f]{6}$/.test(selectedColor)) {
          addToRecent(selectedColor);
        }
        setIsOpen(false);
        setShowCustomPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [selectedColor, showCustomPicker]);

  // Update selectedColor when editor highlight changes
  useEffect(() => {
    const currentHighlight = editor.getAttributes('highlight').color;
    if (currentHighlight) {
      setSelectedColor(currentHighlight);
    }
  }, [editor.state]);

  const isHighlightActive = editor.isActive('highlight');

  const addToRecent = (color: string) => {
    const normalized = color.toUpperCase();
    // Don't add if it's already in the preset colors
    if (PRESET_COLORS.map(c => c.toUpperCase()).includes(normalized)) {
      return;
    }
    const updated = [normalized, ...recentColors.filter(c => c !== normalized)].slice(0, 8);
    setRecentColors(updated);
    localStorage.setItem('recentHighlightColors', JSON.stringify(updated));
  };

  const toggleHighlight = () => {
    if (isHighlightActive) {
      // Remove highlight
      editor.chain().focus().unsetHighlight().run();
    } else {
      // Apply highlight with selected color
      editor.chain().focus().setHighlight({ color: selectedColor }).run();
      addToRecent(selectedColor);
    }
  };

  const handleColorChange = (newColor: string) => {
    setSelectedColor(newColor);
    // If highlight is already active, update it
    if (isHighlightActive) {
      editor.chain().focus().setHighlight({ color: newColor }).run();
    }
  };

  const handlePresetClick = (presetColor: string) => {
    setSelectedColor(presetColor);
    editor.chain().focus().setHighlight({ color: presetColor }).run();
    addToRecent(presetColor);
    setIsOpen(false);
  };

  const handleRemoveHighlight = () => {
    editor.chain().focus().unsetHighlight().run();
    setIsOpen(false);
  };

  return (
    <div className="relative inline-flex" ref={dropdownRef}>
      {/* Main toggle button */}
      <button
        onClick={toggleHighlight}
        className={`p-1.5 rounded-l hover:bg-accent hover:text-accent-foreground transition-colors relative ${
          isHighlightActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'
        }`}
        title="Toggle Highlight"
      >
        <Highlighter size={14} />
        <div
          className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-4 h-1 rounded-full"
          style={{ backgroundColor: selectedColor }}
        />
      </button>

      {/* Dropdown button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`p-1.5 rounded-r border-l hover:bg-accent hover:text-accent-foreground transition-colors ${
          isHighlightActive ? 'bg-accent text-accent-foreground border-accent-foreground/20' : 'text-muted-foreground border-border'
        }`}
        title="Change Highlight Color"
      >
        <ChevronDown size={12} />
      </button>

      {isOpen && (
        <div className={`absolute top-full left-0 mt-1 bg-popover border rounded shadow-md p-2 z-50 animate-in fade-in zoom-in-95 duration-100 ${
          showCustomPicker ? 'w-56' : 'w-48'
        }`}>
          {!showCustomPicker ? (
            <>
              {/* Color Palette View */}
              <div className="text-xs font-medium mb-2 px-1">Highlight Color</div>

              <div className="grid grid-cols-4 gap-2 mb-2">
                {PRESET_COLORS.map(preset => (
                  <button
                    key={preset}
                    onClick={() => handlePresetClick(preset)}
                    className={`w-10 h-10 rounded border-2 hover:scale-105 transition-transform ${
                      selectedColor.toLowerCase() === preset.toLowerCase()
                        ? 'border-primary ring-2 ring-primary/20'
                        : 'border-border'
                    }`}
                    style={{ backgroundColor: preset }}
                    title={preset}
                  />
                ))}
              </div>

              {recentColors.filter(c => !PRESET_COLORS.map(p => p.toUpperCase()).includes(c.toUpperCase())).length > 0 && (
                <>
                  <div className="w-full h-px bg-border my-2" />
                  <div className="text-xs font-medium mb-2 px-1 text-muted-foreground">Recent</div>
                  <div className="grid grid-cols-4 gap-2 mb-2">
                    {recentColors
                      .filter(c => !PRESET_COLORS.map(p => p.toUpperCase()).includes(c.toUpperCase()))
                      .map(recent => (
                        <button
                          key={recent}
                          onClick={() => handlePresetClick(recent)}
                          className={`w-10 h-10 rounded border-2 hover:scale-105 transition-transform ${
                            selectedColor.toLowerCase() === recent.toLowerCase()
                              ? 'border-primary ring-2 ring-primary/20'
                              : 'border-border'
                          }`}
                          style={{ backgroundColor: recent }}
                          title={recent}
                        />
                      ))}
                  </div>
                </>
              )}

              <div className="w-full h-px bg-border my-2" />

              <button
                onClick={() => setShowCustomPicker(true)}
                className="w-full px-2 py-1.5 text-sm hover:bg-accent rounded text-left"
              >
                Custom...
              </button>

              {isHighlightActive && (
                <button
                  onClick={handleRemoveHighlight}
                  className="w-full px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent rounded text-left"
                >
                  Remove Highlight
                </button>
              )}
            </>
          ) : (
            <>
              {/* Custom Color Picker View */}
              <div className="flex items-center justify-between mb-2 px-1">
                <button
                  onClick={() => setShowCustomPicker(false)}
                  className="text-muted-foreground hover:text-foreground p-1"
                  title="Back"
                >
                  <ChevronLeft size={16} />
                </button>
                <div className="text-xs font-medium flex-1 text-center">Highlight Color</div>
                <div className="w-6"></div>
              </div>

              <HexColorPicker color={selectedColor} onChange={handleColorChange} />

              <input
                type="text"
                value={selectedColor}
                onChange={(e) => {
                  const val = e.target.value;
                  if (/^#[0-9A-Fa-f]{0,6}$/.test(val)) {
                    setSelectedColor(val);
                    if (val.length === 7) {
                      handleColorChange(val);
                      addToRecent(val);
                    }
                  }
                }}
                onBlur={() => {
                  if (selectedColor.length === 7 && /^#[0-9A-Fa-f]{6}$/.test(selectedColor)) {
                    addToRecent(selectedColor);
                  }
                }}
                className="w-full mt-2 px-2 py-1 text-sm border rounded bg-background"
                placeholder="#FFFF00"
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}
