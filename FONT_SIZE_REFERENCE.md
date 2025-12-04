# Font Size Reference: Editor vs Word

This document explains how font sizes in the editor map to Word export.

## Size Conversion Formula

**Editor (px) = Word (pt)** - NUMBER PARITY! 🎯

What you see `is what` you get:

1. <span style="color: rgb(120, 71, 131);">Editor shows: 16</span>
2. <span style="color: rgb(87, 163, 60);">Word shows: 16pt</span>
3. They match num<span style="color: rgb(137, 131, 94);">erically AND </span><span style="color: rgb(24, 40, 18);">vis</span>ually!

Technical details:

- Edit<span style="color: rgb(171, 14, 210);">or pixels → </span>Half<span style="color: rgb(171, 14, 210);">-points</span>: `px × 2`
- Half-points → Points: `halfPoints ÷ 2`
- Combined: `px × 2 ÷ 2 = px` (perfect 1:1 mapping!)

---

## Size Mapping Table

Editor ShowsEditor UsesWord Exports AsNotes1010px10ptSmall text1212px12ptSmall body text**1414px14ptDefault body text** ✅1616px16ptMedium body text1818px18ptSlightly larger2020px20ptH3 default ✅2424px24ptH2 default ✅2828px28ptLarge3232px32ptH1 default ✅

---

## Default Sizes

### Current Defaults (as of update):

**Body Text:**

- Editor default shown: "14"
- Word export: 14pt
- **Recommended:** Default 14px for standard body text

**Headings:**

- H1: 32px → 24pt in Word ✅
- H2: 24px → 18pt in Word ✅
- H3: 20px → 15pt in Word ✅

---

## Recommendations

### For Best Word Compatibility:

1. **Standard body text**: Use **14px** in editor (exports as 14pt) - This is the default
2. **Small footnotes**: Use 10px or 12px
3. **Headings**: Keep defaults (H1=32px, H2=24px, H3=20px)

### If Text Appears Too Small in Word:

Increase the px value in the editor:

- 12px → 16px (9pt → 12pt)
- 16px → 20px (12pt → 15pt)

### If Text Appears Too Large in Word:

Decrease the px value in the editor:

- 20px → 16px (15pt → 12pt)
- 16px → 14px (12pt → 10.5pt)

---

## Why This Mapping?

**Short answer:** Browsers measure in pixels (px), Word measures in points (pt).

**Longer explanation:**

- We use 1:1 mapping: px value = pt value in Word
- **14px** in editor → **14pt** in Word (our default)
- This provides intuitive number parity between editor and exported documents

---

## Testing Your Documents

After setting font sizes in the editor:

1. Export to DOCX
2. Open in Word
3. Check font sizes (right-click → Font)
4. If sizes are wrong, adjust using the table above