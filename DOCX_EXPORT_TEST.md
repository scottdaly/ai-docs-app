# <span style="font-family: Inter, sans-serif;">DOCX Export Testing Guide</span>

<span style="font-family: Inter, sans-serif;">This document provides step-</span><span style="font-family: Inter, sans-serif; color: rgb(255, 105, 105);">by-step instruct</span><span style="font-family: Inter, sans-serif;">ions fo</span><span style="font-family: Inter, sans-serif; color: rgb(0, 0, 0);">r testing th</span><span style="font-family: Inter, sans-serif;">e enhanced DOCX export features.</span>

## <span style="font-family: Inter, sans-serif;">Features to Test</span>

1. <span style="font-family: Inter, sans-serif;">**Critical Bug Fix**: Multiple text <mark data-color="#ADD8E6" style="background-color: rgb(173, 216, 230); color: inherit;">runs with different formatting in one paragraph</mark></span>
2. <span style="font-family: Inter, sans-serif;">**Font Family**: <u>Different fonts applied to text</u></span>
3. <span style="font-family: Inter, sans-serif;">**Font Size**:</span>` Various sizes`<span style="font-family: Inter, sans-serif;"> (10p</span><span style="font-family: Inter, sans-serif; color: rgb(39, 64, 140);">x - 32px)</span>
4. <span style="font-family: Inter, sans-serif;">**Text Alignment**: Left, c<mark data-color="#FFFF00" style="background-color: rgb(255, 255, 0); color: inherit;">enter, right</mark>, justify</span>
5. <span style="font-family: Inter, sans-serif;">**Headings**: H1, H2, H3 with formatting and alignment</span>
6. <span style="font-family: Inter, sans-serif;">**Lists**: Bullet and numbered lists with formatting</span>

---

## <span style="font-family: Inter, sans-serif;">Test Plan</span>

### <span style="font-family: Inter, sans-serif;">Test 1: Mixed Formatting in Single Paragraph (Critical Bug Fix)</span>

<span style="font-family: Inter, sans-serif;">**What this tests**: The old code only read the first text node, losing content.</span>

<span style="font-family: Inter, sans-serif;">**Steps**:</span>

1. <span style="font-family: Inter, sans-serif;">Create a new document in Project Muse</span>
2. <span style="font-family: Inter, sans-serif;">Type: "This is bold and this is italic and this is strike"</span>
3. <span style="font-family: Inter, sans-serif;">Select "bold" and click Bold button (B)</span>
4. <span style="font-family: Inter, sans-serif;">Select "italic" and click Italic button (I)</span>
5. <span style="font-family: Inter, sans-serif;">Select "strike" and click Strikethrough button (S)</span>
6. <span style="font-family: Inter, sans-serif;">Export to DOCX (File → Export to DOCX...)</span>
7. <span style="font-family: Inter, sans-serif;">Open in Microsoft Word</span>

<span style="font-family: Inter, sans-serif;">**Expected Result**: All text appears with correct formatting</span>

- <span style="font-family: Inter, sans-serif;">OLD BUG: Only "This is " would appear</span>
- <span style="font-family: Inter, sans-serif;">NEW FIX: Full sentence with bold, italic, and strike formatting</span>

<span style="font-family: Inter, sans-serif;">**Pass/Fail**: \__________\_</span>

---

### <span style="font-family: Inter, sans-serif;">Test 2: Font Families</span>

<span style="font-family: Inter, sans-serif;">**What this tests**: Font family preservation from textStyle mark</span>

<span style="font-family: Inter, sans-serif;">**Steps**:</span>

1. <span style="font-family: Inter, sans-serif;">Create three paragraphs</span>
2. <span style="font-family: Inter, sans-serif;">Paragraph 1: "Inter Font" - Select font "Inter"</span>
3. <span style="font-family: Inter, sans-serif;">Paragraph 2: "Crimson Text Font" - Select font "Crimson Text"</span>
4. <span style="font-family: Inter, sans-serif;">Paragraph 3: "JetBrains Mono Font" - Select font "JetBrains Mono"</span>
5. <span style="font-family: Inter, sans-serif;">Export to DOCX</span>
6. <span style="font-family: Inter, sans-serif;">Open in Word and check fonts</span>

<span style="font-family: Inter, sans-serif;">**Expected Result**: Each paragraph displays in the specified font</span>

- <span style="font-family: Inter, sans-serif;">Para 1: Inter (sans-serif)</span>
- <span style="font-family: Inter, sans-serif;">Para 2: Crimson Text (serif)</span>
- <span style="font-family: Inter, sans-serif;">Para 3: JetBrains Mono (monospace)</span>

<span style="font-family: Inter, sans-serif;">**Pass/Fail**: \__________\_</span>

---

### <span style="font-family: Inter, sans-serif;">Test 3: Font Sizes</span>

<span style="font-family: Inter, sans-serif;">**What this tests**: Font size conversion from px to half-points</span>

<span style="font-family: Inter, sans-serif;">**Steps**:</span>

1. <span style="font-family: Inter, sans-serif;">Create 5 paragraphs with different sizes:</span>
   - <span style="font-family: Inter, sans-serif;">"10px text" - Set to 10px</span>
   - <span style="font-family: Inter, sans-serif;">"16px text (default)" - Set to 16px</span>
   - <span style="font-family: Inter, sans-serif;">"18px text" - Set to 18px</span>
   - <span style="font-family: Inter, sans-serif;">"24px text" - Set to 24px</span>
   - <span style="font-family: Inter, sans-serif;">"32px text" - Set to 32px</span>
2. <span style="font-family: Inter, sans-serif;">Export to DOCX</span>
3. <span style="font-family: Inter, sans-serif;">Open in Word and check sizes (right-click → Font)</span>

<span style="font-family: Inter, sans-serif;">**Expected Result**:</span>

- <span style="font-family: Inter, sans-serif;">10px → 7.5pt in Word</span>
- <span style="font-family: Inter, sans-serif;">16px → 12pt in Word (default)</span>
- <span style="font-family: Inter, sans-serif;">18px → 13.5pt in Word</span>
- <span style="font-family: Inter, sans-serif;">24px → 18pt in Word</span>
- <span style="font-family: Inter, sans-serif;">32px → 24pt in Word</span>

<span style="font-family: Inter, sans-serif;">**Pass/Fail**: \__________\_</span>

---

### <span style="font-family: Inter, sans-serif;">Test 4: Text Alignment</span>

<span style="font-family: Inter, sans-serif;">**What this tests**: Alignment attribute preservation</span>

<span style="font-family: Inter, sans-serif;">**Steps**:</span>

1. <span style="font-family: Inter, sans-serif;">Create 4 paragraphs:</span>
   - <span style="font-family: Inter, sans-serif;">"Left aligned text" - Set to Left</span>
   - <span style="font-family: Inter, sans-serif;">"Center aligned text" - Set to Center</span>
   - <span style="font-family: Inter, sans-serif;">"Right aligned text" - Set to Right</span>
   - <span style="font-family: Inter, sans-serif;">"Justified text that is long enough to wrap to multiple lines for testing" - Set to Justify</span>
2. <span style="font-family: Inter, sans-serif;">Export to DOCX</span>
3. <span style="font-family: Inter, sans-serif;">Open in Word</span>

<span style="font-family: Inter, sans-serif;">**Expected Result**: Visual alignment matches editor</span>

- <span style="font-family: Inter, sans-serif;">Para 1: Left-aligned</span>
- <span style="font-family: Inter, sans-serif;">Para 2: Center-aligned</span>
- <span style="font-family: Inter, sans-serif;">Para 3: Right-aligned</span>
- <span style="font-family: Inter, sans-serif;">Para 4: Justified (text stretches to edges)</span>

<span style="font-family: Inter, sans-serif;">**Pass/Fail**: \__________\_</span>

---

### <span style="font-family: Inter, sans-serif;">Test 5: Headings with Alignment</span>

<span style="font-family: Inter, sans-serif;">**What this tests**: Headings preserve both style AND alignment</span>

<span style="font-family: Inter, sans-serif;">**Steps**:</span>

1. <span style="font-family: Inter, sans-serif;">Create 3 headings:</span>
   - <span style="font-family: Inter, sans-serif;">"Left Heading" - H1, Left aligned</span>
   - <span style="font-family: Inter, sans-serif;">"Center Heading" - H2, Center aligned</span>
   - <span style="font-family: Inter, sans-serif;">"Right Heading" - H3, Right aligned</span>
2. <span style="font-family: Inter, sans-serif;">Export to DOCX</span>
3. <span style="font-family: Inter, sans-serif;">Open in Word</span>

<span style="font-family: Inter, sans-serif;">**Expected Result**:</span>

- <span style="font-family: Inter, sans-serif;">H1 with left alignment</span>
- <span style="font-family: Inter, sans-serif;">H2 (smaller than H1) with center alignment</span>
- <span style="font-family: Inter, sans-serif;">H3 (smaller than H2) with right alignment</span>

<span style="font-family: Inter, sans-serif;">**Pass/Fail**: \__________\_</span>

---

### <span style="font-family: Inter, sans-serif;">Test 6: Font Size + Font Family Combined</span>

<span style="font-family: Inter, sans-serif;">**What this tests**: Multiple textStyle attributes work together</span>

<span style="font-family: Inter, sans-serif;">**Steps**:</span>

1. <span style="font-family: Inter, sans-serif;">Create a paragraph: "Large Crimson Text"</span>
2. <span style="font-family: Inter, sans-serif;">Select all text</span>
3. <span style="font-family: Inter, sans-serif;">Set font to "Crimson Text"</span>
4. <span style="font-family: Inter, sans-serif;">Set size to 24px</span>
5. <span style="font-family: Inter, sans-serif;">Make it Bold</span>
6. <span style="font-family: Inter, sans-serif;">Export to DOCX</span>
7. <span style="font-family: Inter, sans-serif;">Open in Word</span>

<span style="font-family: Inter, sans-serif;">**Expected Result**:</span>

- <span style="font-family: Inter, sans-serif;">Font: Crimson Text</span>
- <span style="font-family: Inter, sans-serif;">Size: 18pt (24px)</span>
- <span style="font-family: Inter, sans-serif;">Style: Bold</span>

<span style="font-family: Inter, sans-serif;">**Pass/Fail**: \__________\_</span>

---

### <span style="font-family: Inter, sans-serif;">Test 7: Lists with Formatting</span>

<span style="font-family: Inter, sans-serif;">**What this tests**: List items preserve formatting</span>

<span style="font-family: Inter, sans-serif;">**Steps**:</span>

1. <span style="font-family: Inter, sans-serif;">Create a bullet list:</span>
   - <span style="font-family: Inter, sans-serif;">Item 1: "Regular text" (16px, Inter)</span>
   - <span style="font-family: Inter, sans-serif;">Item 2: "Large text" (24px, Crimson Text)</span>
   - <span style="font-family: Inter, sans-serif;">Item 3: "Small bold text" (12px, Inter, Bold)</span>
2. 

## <span style="font-family: Inter, sans-serif;">Create a numbered list:</span>

1. <span style="font-family: Inter, sans-serif;">"First item" (16px)</span>

- 

2. <span style="font-family: Inter, sans-serif;">"Second item in Lora" (18px, Lora)</span>

- <span style="font-family: Inter, sans-serif;">Export to DOCX</span>
- <span style="font-family: Inter, sans-serif;">Open in Word</span>

<span style="font-family: Inter, sans-serif;">**Expected Result**:</span>

- <span style="font-family: Inter, sans-serif;">Bullet list with different fonts/sizes per item</span>
- <span style="font-family: Inter, sans-serif;">Numbered list with formatting preserved</span>
- <span style="font-family: Inter, sans-serif;">All text appears (not just first run)</span>

<span style="font-family: Inter, sans-serif;">**Pass/Fail**: \__________\_</span>

---

### <span style="font-family: Inter, sans-serif;">Test 8: Edge Cases</span>

<span style="font-family: Inter, sans-serif;">**What this tests**: Error handling and graceful fallbacks</span>

<span style="font-family: Inter, sans-serif;">**Steps**:</span>

1. <span style="font-family: Inter, sans-serif;">Create a paragraph with no formatting (plain text)</span>
2. <span style="font-family: Inter, sans-serif;">Create an empty paragraph (just hit Enter)</span>
3. <span style="font-family: Inter, sans-serif;">Create a paragraph with only spaces</span>
4. <span style="font-family: Inter, sans-serif;">Create a heading with custom font size (20px)</span>
5. <span style="font-family: Inter, sans-serif;">Export to DOCX</span>
6. <span style="font-family: Inter, sans-serif;">Open in Word</span>

<span style="font-family: Inter, sans-serif;">**Expected Result**:</span>

- <span style="font-family: Inter, sans-serif;">Plain text uses Word defaults</span>
- <span style="font-family: Inter, sans-serif;">Empty paragraph creates blank line</span>
- <span style="font-family: Inter, sans-serif;">Spaces-only paragraph creates blank line</span>
- <span style="font-family: Inter, sans-serif;">Heading with custom size works</span>

<span style="font-family: Inter, sans-serif;">**Pass/Fail**: \__________\_</span>

---

### <span style="font-family: Inter, sans-serif;">Test 9: Complex Document</span>

<span style="font-family: Inter, sans-serif;">**What this tests**: Everything together in a realistic document</span>

<span style="font-family: Inter, sans-serif;">**Steps**:</span>

1. <span style="font-family: Inter, sans-serif;">Create a document with:</span>

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

2. <span style="font-family: Inter, sans-serif;">Export to DOCX</span>

3. <span style="font-family: Inter, sans-serif;">Open in Word</span>

4. <span style="font-family: Inter, sans-serif;">Verify all formatting is preserved</span>

<span style="font-family: Inter, sans-serif;">**Expected Result**: Complete document with all formatting intact</span>

<span style="font-family: Inter, sans-serif;">**Pass/Fail**: \__________\_</span>

---

## <span style="font-family: Inter, sans-serif;">Quick Visual Check</span>

<span style="font-family: Inter, sans-serif;">Export the test document and open it in Word. At a glance, you should see:</span>

- <span style="font-family: Inter, sans-serif;">✅ Different font families (serif vs sans-serif visually distinct)</span>
- <span style="font-family: Inter, sans-serif;">✅ Different font sizes (noticeably larger/smaller text)</span>
- <span style="font-family: Inter, sans-serif;">✅ Different alignments (center/right are obvious)</span>
- <span style="font-family: Inter, sans-serif;">✅ All text content present (no missing words)</span>
- <span style="font-family: Inter, sans-serif;">✅ Headings are bold and larger (Word's heading styles)</span>
- <span style="font-family: Inter, sans-serif;">✅ Lists are properly indented with bullets/numbers</span>

---

## <span style="font-family: Inter, sans-serif;">Known Limitations (Deferred Features)</span>

<span style="font-family: Inter, sans-serif;">These are intentionally NOT implemented yet:</span>

- <span style="font-family: Inter, sans-serif;">❌ Nested lists (only flat lists supported)</span>
- <span style="font-family: Inter, sans-serif;">❌ Images (not exported to DOCX)</span>
- <span style="font-family: Inter, sans-serif;">❌ Underline formatting</span>
- <span style="font-family: Inter, sans-serif;">❌ Text color</span>
- <span style="font-family: Inter, sans-serif;">❌ Text highlighting</span>

<span style="font-family: Inter, sans-serif;">If you encounter these, they are expected gaps for future phases.</span>

---

## <span style="font-family: Inter, sans-serif;">Troubleshooting</span>

### <span style="font-family: Inter, sans-serif;">If fonts don't appear:</span>

- <span style="font-family: Inter, sans-serif;">Check that the font name is clean (no quotes, no commas)</span>
- <span style="font-family: Inter, sans-serif;">Verify Word has the font installed</span>
- <span style="font-family: Inter, sans-serif;">Generic families like "sans-serif" will use Word's default</span>

### <span style="font-family: Inter, sans-serif;">If sizes are wrong:</span>

- <span style="font-family: Inter, sans-serif;">Check the conversion: 16px should be 12pt</span>
- <span style="font-family: Inter, sans-serif;">Formula: px \* 1.5 = half-points, half-points / 2 = points</span>
- <span style="font-family: Inter, sans-serif;">Example: 24px \* 1.5 = 36 half-points = 18pt</span>

### <span style="font-family: Inter, sans-serif;">If alignment doesn't work:</span>

- Ensure the pa<mark data-color="#00FFFF" style="background-color: rgb(0, 255, 255); color: inherit;">r</mark><span style="color: rgb(162, 251, 253);"><mark data-color="#00FFFF" style="background-color: rgb(0, 255, 255); color: inherit;">agraph itself</mark></span> has alignment (not just selected text)
- Check in Word's paragraph settings (not just visually)

### <span style="font-family: Inter, sans-serif;">If text is missing:</span>

- <span style="font-family: Inter, sans-serif;">This was the critical bug! Should be fixed now.</span>
- <span style="font-family: Inter, sans-serif;">Verify </span>`processTextNodes()`<span style="font-family: Inter, sans-serif;"> is being called in paragraph-processors.ts</span>
- <span style="font-family: Inter, sans-serif;">Check console for errors</span>

---

## <span style="font-family: Inter, sans-serif;">Reporting Issues</span>

<span style="font-family: Inter, sans-serif;">If any test fails, please note:</span>

1. <span style="font-family: Inter, sans-serif;">Which test failed</span>
2. <span style="font-family: Inter, sans-serif;">What you expected</span>
3. <span style="font-family: Inter, sans-serif;">What actually happened</span>
4. <span style="font-family: Inter, sans-serif;">Console errors (if any)</span>
5. <span style="font-family: Inter, sans-serif;">Screenshot of the exported DOCX in WordÍ</span>