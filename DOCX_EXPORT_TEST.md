# DOCX Export Testing Guide

This document provides step-<span style="color: rgb(255, 105, 105);">by-step instruct</span>ions fo<span style="color: rgb(0, 0, 0);">r testing th</span>e enhanced DOCX export features.

## Features to Test weo

1.  **Critical Bug Fix**: Multiple text <mark style="background-color: rgb(173, 216, 230)">runs with different formatting in one paragraph</mark>
    
2.  **Font Family**: <u>Different fonts applied to text</u>
    
3.  **Font Size**: `Various sizes` (10p<span style="color: rgb(39, 64, 140);">x - 32px)</span>
    
4.  **Text Alignment**: Left, c<mark style="background-color: rgb(255, 255, 0)">enter, right</mark>, justify
    
5.  **Headings**: H1, H2, H3 with formatting and alignment
    
6.  **Lists**: Bullet and numbered l`ists with formatting`
    

* * *

## Test Plan

### Test 1: Mixed Formatting in Single Paragraph (Critical Bug Fix)

**What this tests**: The old code only read the first text node, losing content.

**Steps**:

1.  Create a new document in Midlight
    
2.  Type: "This is bold and this is italic and this is strike"
    
3.  Select "bold" and click Bold button (B)
    
4.  Select "italic" and click Italic button (I)
    
5.  Select "strike" and click Strikethrough button (S)
    
6.  Export to DOCX (File → Export to DOCX...)
    
7.  Open in Microsoft Word
    

**Expected Result**: All text appears with correct formatting

-   OLD BUG: Only "This is " would appear
    
-   NEW FIX: Full sentence with bold, italic, and strike formatting
    

**Pass/Fail**: \_\_\_\_\_\_\_\_\_\_\_

* * *

### Test 2: Font Families

**What this tests**: Font family preservation from textStyle mark

**Steps**:

1.  Create three paragraphs
    
2.  Paragraph 1: "Inter Font" - Select font "Inter"
    
3.  Paragraph 2: "Crimson Text Font" - Select font "Crimson Text"
    
4.  Paragraph 3: "JetBrains Mono Font" - Select font "JetBrains Mono"
    
5.  Export to DOCX
    
6.  Open in Word and check fonts
    

**Expected Result**: Each paragraph displays in the specified font

-   Para 1: Inter (sans-serif)
    
-   Para 2: Crimson Text (serif)
    
-   Para 3: JetBrains Mono (monospace)
    

**Pass/Fail**: \_\_\_\_\_\_\_\_\_\_\_

* * *

### Test 3: Font Sizes

**What this tests**: Font size conversion from px to half-points

**Steps**:

1.  Create 5 paragraphs with different sizes:
    
    -   "10px text" - Set to 10px
        
    -   "16px text (default)" - Set to 16px
        
    -   "18px text" - Set to 18px
        
    -   "24px text" - Set to 24px
        
    -   "32px text" - Set to 32px
        
2.  Export to DOCX
    
3.  Open in Word and check sizes (right-click → Font)
    

**Expected Result**:

-   10px → 7.5pt in Word
    
-   16px → 12pt in Word (default)
    
-   18px → 13.5pt in Word
    
-   24px → 18pt in Word
    
-   32px → 24pt in Word
    

**Pass/Fail**: \_\_\_\_\_\_\_\_\_\_\_

* * *

### Test 4: Text Alignment

**What this tests**: Alignment attribute preservation

**Steps**:

1.  Create 4 paragraphs:
    
    -   "Left aligned text" - Set to Left
        
    -   "Center aligned text" - Set to Center
        
    -   "Right aligned text" - Set to Right
        
    -   "Justified text that is long enough to wrap to multiple lines for testing" - Set to Justify
        
2.  Export to DOCX
    
3.  Open in Word
    

**Expected Result**: Visual alignment matches editor

-   Para 1: Left-aligned
    
-   Para 2: Center-aligned
    
-   Para 3: Right-aligned
    
-   Para 4: Justified (text stretches to edges)
    

**Pass/Fail**: \_\_\_\_\_\_\_\_\_\_\_

* * *

### Test 5: Headings with Alignment

**What this tests**: Headings preserve both style AND alignment

**Steps**:

1.  Create 3 headings:
    
    -   "Left Heading" - H1, Left aligned
        
    -   "Center Heading" - H2, Center aligned
        
    -   "Right Heading" - H3, Right aligned
        
2.  Export to DOCX
    
3.  Open in Word
    

**Expected Result**:

-   H1 with left alignment
    
-   H2 (smaller than H1) with center alignment
    
-   H3 (smaller than H2) with right alignment
    

**Pass/Fail**: \_\_\_\_\_\_\_\_\_\_\_

* * *

### Test 6: Font Size + Font Family Combined

**What this tests**: Multiple textStyle attributes work together

**Steps**:

1.  Create a paragraph: "Large Crimson Text"
    
2.  Select all text
    
3.  Set font to "Crimson Text"
    
4.  Set size to 24px
    
5.  Make it Bold
    
6.  Export to DOCX
    
7.  Open in Word
    

**Expected Result**:

-   Font: Crimson Text
    
-   Size: 18pt (24px)
    
-   Style: Bold
    

**Pass/Fail**: \_\_\_\_\_\_\_\_\_\_\_

* * *

### Test 7: Lists with Formatting

**What this tests**: List items preserve formatting

**Steps**:

1.  Create a bullet list:
    
    -   Item 1: "Regular text" (16px, Inter)
        
    -   Item 2: "Large text" (24px, Crimson Text)
        
    -   Item 3: "Small bold text" (12px, Inter, Bold)
        

## Create a numbered list:

1.  "First item" (16px)
    

\-

2.  "Second item in Lora" (18px, Lora)
    

-   Export to DOCX
    
-   Open in Word
    

**Expected Result**:

-   Bullet list with different fonts/sizes per item
    
-   Numbered list with formatting preserved
    
-   All text appears (not just first run)
    

**Pass/Fail**: \_\_\_\_\_\_\_\_\_\_\_

* * *

### Test 8: Edge Cases

**What this tests**: Error handling and graceful fallbacks

**Steps**:

1.  Create a paragraph with no formatting (plain text)
    
2.  Create an empty paragraph (just hit Enter)
    
3.  Create a paragraph with only spaces
    
4.  Create a heading with custom font size (20px)
    
5.  Export to DOCX
    
6.  Open in Word
    

**Expected Result**:

-   Plain text uses Word defaults
    
-   Empty paragraph creates blank line
    
-   Spaces-only paragraph creates blank line
    
-   Heading with custom size works
    

**Pass/Fail**: \_\_\_\_\_\_\_\_\_\_\_

* * *

### Test 9: Complex Document

**What this tests**: Everything together in a realistic document

**Steps**:

1.  Create a document with:
    
    ```
    [H1, Center, 32px] Document Title
    
    [Paragraph, Left, 16px] This is an introduction paragraph with bold and italic words mixed together.
    
    [H2, Left, 24px] Section 1
    [Paragraph, Justify, 14px] This is body text that is justified and uses a smaller font size.
    
    [Bullet List]
    • Point one with Inter font
    • Point two with Crimson Text
    
    [H2, Right, 20px] Conclusion
    [Paragraph, Center, 18px] Final thoughts in a larger, centered paragraph.
    ```
    
2.  Export to DOCX
    
3.  Open in Word
    
4.  Verify all formatting is preserved
    

**Expected Result**: Complete document with all formatting intact

**Pass/Fail**: \_\_\_\_\_\_\_\_\_\_\_

* * *

## Quick Visual Check

Export the test document and open it in Word. At a glance, you should see:

-   ✅ Different font families (serif vs sans-serif visually distinct)
    
-   ✅ Different font sizes (noticeably larger/smaller text)
    
-   ✅ Different alignments (center/right are obvious)
    
-   ✅ All text content present (no missing words)
    
-   ✅ Headings are bold and larger (Word's heading styles)
    
-   ✅ Lists are properly indented with bullets/numbers
    

* * *

## Known Limitations (Deferred Features)

These are intentionally NOT implemented yet:

-   ❌ Nested lists (only flat lists supported)
    
-   ❌ Images (not exported to DOCX)
    
-   ❌ Underline formatting
    
-   ❌ Text color
    
-   ❌ Text highlighting
    

If you encounter these, they are expected gaps for future phases.

* * *

## Troubleshooting

### If fonts don't appear:

-   Check that the font name is clean (no quotes, no commas)
    
-   Verify Word has the font installed
    
-   Generic families like "sans-serif" will use Word's default
    

### If sizes are wrong:

-   Check the conversion: 16px should be 12pt
    
-   Formula: px \* 1.5 = half-points, half-points / 2 = points
    
-   Example: 24px \* 1.5 = 36 half-points = 18pt
    

### If alignment doesn't work:

-   Ensure the pa<mark style="background-color: rgb(0, 255, 255)">r</mark><span style="color: rgb(162, 251, 253);"><mark style="background-color: rgb(0, 255, 255)">agraph itself</mark></span> has alignment (not just selected text)
    
-   Check in Word's paragraph settings (not just visually)
    

### If text is missing:

-   This was the critical bug! Should be fixed now.
    
-   Verify `processTextNodes()` is being called in paragraph-processors.ts
    
-   Check console for errors
    

* * *

## Reporting Issues

If any test fails, please note:

1.  Which test failed
    
2.  What you expected
    
3.  What actually happened
    
4.  Console errors (if any)
    
5.  Screenshot of the exported DOCX in WordÍ