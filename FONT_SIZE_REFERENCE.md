<!-- @mid:h-y4nmo7 -->
# Font Size Reference: Editor vs Word

<!-- @mid:p-3ksucp -->
This document explains how font sizes in the editor map to Word export.

<!-- @mid:h-774fqj -->
## Size Conversion Formula

<!-- @mid:p-piqlvd -->
***Editor (px) = Word (pt)******\******\****** - NUMBER PARITY! 🎯\******\***

<!-- @mid:p-e25i1c -->
`What you see ``is what`` you get:`

<!-- @mid:list-ff5j8a -->
1. Editor shows: 16

<!-- @mid:list-4ixp7d -->
1. Word shows: 16pt

<!-- @mid:list-fub4vv -->
1. Nest 1

<!-- @mid:list-3y0ffx -->
1. Nest 2

<!-- @mid:list-b7zljs -->
1. Wowwww

<!-- @mid:list-pa3r3l -->
1. YES!

<!-- @mid:list-7oezsy -->
1. T`hey match nu`merically AND visually!

<!-- @mid:p-n7kezw -->
Technical details:

<!-- @mid:list-0lyqfb -->
- Editor pixels → Half-points: `px × 2`

<!-- @mid:list-ijd0j0 -->
- Half-points → Points: `halfPoints ÷ 2`

<!-- @mid:list-q6ooec -->
- Combined: `px × 2 ÷ 2 = px` (perfect 1:1 mapping!)

<!-- @mid:p-i2e3n2 -->
* ** ****

<!-- @mid:h-a0og42 -->
## Size Mapping Table

<!-- @mid:p-i0jzv8 -->
***Editor ShowsEditor UsesWord Exports AsNotes1010px10ptSmall text1212px12ptSmall body text\*\*1414px14ptDefault body text****** ✅1616px16ptMedium body text1818px18ptSlightly larger2020px20ptH3 default ✅2424px24ptH2 default ✅2828px28ptLarge3232px32ptH1 default ✅\******\***

<!-- @mid:p-ssnfwt -->
* ** ****

<!-- @mid:h-4ytjvh -->
## Default Sizes

<!-- @mid:h-h132a4 -->
### Current Defaults (as of update):

<!-- @mid:p-yui9hf -->
**Body Text:**

<!-- @mid:list-2ro8tg -->
- Editor default shown: "14"

<!-- @mid:list-0mb3dt -->
- Word export: 14pt

<!-- @mid:list-lq6e1h -->
- **Recommended:** Default 14px for standard body text

<!-- @mid:p-p98oar -->
**Headings:**

<!-- @mid:list-kogocj -->
- H1: 32px → 24pt in Word ✅

<!-- @mid:list-1u3u2c -->
- H2: 24px → 18pt in Word ✅

<!-- @mid:list-39ap5w -->
- H3: 20px → 15pt in Word ✅

<!-- @mid:p-h1ka51 -->
* ** ****

<!-- @mid:h-scg9yd -->
## Recommendations

<!-- @mid:h-dde0nb -->
### For Best Word Compatibility:

<!-- @mid:list-j6dqrw -->
1. **Standard body text**: Use **14px** in editor (exports as 14pt) - This is the default

<!-- @mid:list-03fcdk -->
1. **Small footnotes**: Use 10px or 12px

<!-- @mid:list-33j0qx -->
1. **Headings**: Keep defaults (H1=32px, H2=24px, H3=20px)

<!-- @mid:h-7nrfij -->
### If Text Appears Too Small in Word:

<!-- @mid:p-nb73s6 -->
Increase the px value in the editor:

<!-- @mid:list-mtpncx -->
- 12px → 16px (9pt → 12pt)

<!-- @mid:list-6crs8h -->
- 16px → 20px (12pt → 15pt)

<!-- @mid:h-vhqyhu -->
### If Text Appears Too Large in Word:

<!-- @mid:p-cj8hpv -->
Decrease the px value in the editor:

<!-- @mid:list-zsiydb -->
- 20px → 16px (15pt → 12pt)

<!-- @mid:list-u5b2ba -->
- 16px → 14px (12pt → 10.5pt)

<!-- @mid:p-no226d -->
* ** ****

<!-- @mid:h-ygvmxp -->
## Why This Mapping?

<!-- @mid:p-20ze59 -->
***Short answer:******\******\****** Browsers measure in pixels (px), Word measures in points (pt).\******\***

<!-- @mid:p-po4khe -->
**Longer explanation:**

<!-- @mid:list-99c38o -->
- We use 1:1 mapping: px value = pt value in Word

<!-- @mid:list-f1zcyb -->
- **14px** in editor → **14pt** in Word (our default)

<!-- @mid:list-u8ejjq -->
- This provides intuitive number parity between editor and exported documents

<!-- @mid:p-2y3kf4 -->
* ** ****

<!-- @mid:h-kf1avz -->
## Testing Your Documents

<!-- @mid:p-qof0b9 -->
After setting font sizes in the editor:

<!-- @mid:list-chhq4k -->
1. Export to DOCX

<!-- @mid:list-fmfatj -->
1. Open in Word

<!-- @mid:list-vxk03p -->
1. Check font sizes (right-click → Font)

<!-- @mid:list-ul3cnc -->
1. If sizes are wrong, adjust using the table above

<!-- @mid:list-zam21h -->
- Adult candy

<!-- @mid:img-0jcc3k -->
![](@img:285d35769ebecab7)