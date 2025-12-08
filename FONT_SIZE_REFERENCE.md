<!-- @mid:h-j3o3ei -->
# Font Size Reference: Editor vs Word

<!-- @mid:p-9l7ps5 -->
This document explains how font sizes in the editor map to Word export.

<!-- @mid:h-jr9wcp -->
## Size Conversion Formula

<!-- @mid:p-f51ffe -->
***Editor (px) = Word (pt)******\******\****** - NUMBER PARITY! 🎯\******\***

<!-- @mid:p-ndic3y -->
`What you see ``is what`` you get:`

<!-- @mid:list-a8drku -->
1. Editor shows: 16

<!-- @mid:list-bf7a7r -->
1. Word shows: 16pt

<!-- @mid:list-aazrr6 -->
1. Nest 1

<!-- @mid:list-boa4lg -->
1. Nest 2

<!-- @mid:list-h2d9x1 -->
1. Wowwww

<!-- @mid:list-jo9q0w -->
1. YES!

<!-- @mid:list-yspcpu -->
1. T`hey match nu`merically AND visually!

<!-- @mid:p-hxt6sv -->
Technical details:

<!-- @mid:list-wn9yes -->
- Editor pixels → Half-points: `px × 2`

<!-- @mid:list-b9c18t -->
- Half-points → Points: `halfPoints ÷ 2`

<!-- @mid:list-9bw0z3 -->
- Combined: `px × 2 ÷ 2 = px` (perfect 1:1 mapping!)

<!-- @mid:p-z2v0jl -->
* ** ****

<!-- @mid:h-7wzao0 -->
## Size Mapping Table

<!-- @mid:p-00xj41 -->
***Editor ShowsEditor UsesWord Exports AsNotes1010px10ptSmall text1212px12ptSmall body text\*\*1414px14ptDefault body text****** ✅1616px16ptMedium body text1818px18ptSlightly larger2020px20ptH3 default ✅2424px24ptH2 default ✅2828px28ptLarge3232px32ptH1 default ✅\******\***

<!-- @mid:p-m5tnxj -->
* ** ****

<!-- @mid:h-nzzh5l -->
## Default Sizes

<!-- @mid:h-qvsdjs -->
### Current Defaults (as of update):

<!-- @mid:p-gfbyfy -->
**Body Text:**

<!-- @mid:list-tceflb -->
- Editor default shown: "14"

<!-- @mid:list-8ol3xk -->
- Word export: 14pt

<!-- @mid:list-q2r9sb -->
- **Recommended:** Default 14px for standard body text

<!-- @mid:p-dbfc5t -->
**Headings:**

<!-- @mid:list-lv461o -->
- H1: 32px → 24pt in Word ✅

<!-- @mid:list-w0z7kj -->
- H2: 24px → 18pt in Word ✅

<!-- @mid:list-a69f7o -->
- H3: 20px → 15pt in Word ✅

<!-- @mid:p-3xhhr2 -->
* ** ****

<!-- @mid:h-83rxdo -->
## Recommendations

<!-- @mid:h-pjq3b1 -->
### For Best Word Compatibility:

<!-- @mid:list-bbxbnc -->
1. **Standard body text**: Use **14px** in editor (exports as 14pt) - This is the default

<!-- @mid:list-poz1bp -->
1. **Small footnotes**: Use 10px or 12px

<!-- @mid:list-rc3i40 -->
1. **Headings**: Keep defaults (H1=32px, H2=24px, H3=20px)

<!-- @mid:h-0n9tb0 -->
### If Text Appears Too Small in Word:

<!-- @mid:p-5z66pg -->
Increase the px value in the editor:

<!-- @mid:list-cma8j7 -->
- 12px → 16px (9pt → 12pt)

<!-- @mid:list-z8x9bv -->
- 16px → 20px (12pt → 15pt)

<!-- @mid:h-uqld17 -->
### If Text Appears Too Large in Word:

<!-- @mid:p-8k1j3h -->
Decrease the px value in the editor:

<!-- @mid:list-z1gnqn -->
- 20px → 16px (15pt → 12pt)

<!-- @mid:list-pp5u0x -->
- 16px → 14px (12pt → 10.5pt)

<!-- @mid:p-qsxdg6 -->
* ** ****

<!-- @mid:h-k0aa60 -->
## Why This Mapping?

<!-- @mid:p-8ku2ue -->
***Short answer:******\******\****** Browsers measure in pixels (px), Word measures in points (pt).\******\***

<!-- @mid:p-f7ah5y -->
**Longer explanation:**

<!-- @mid:list-s7b1tm -->
- We use 1:1 mapping: px value = pt value in Word

<!-- @mid:list-u580l9 -->
- **14px** in editor → **14pt** in Word (our default)

<!-- @mid:list-tghwpz -->
- This provides intuitive number parity between editor and exported documents

<!-- @mid:p-9skim2 -->
* ** ****

<!-- @mid:h-knlzrf -->
## Testing Your Documents

<!-- @mid:p-kcjwul -->
After setting font sizes in the editor:

<!-- @mid:list-lilps4 -->
1. Export to DOCX

<!-- @mid:list-8t46zb -->
1. Open in Word

<!-- @mid:list-genj51 -->
1. Check font sizes (right-click → Font)

<!-- @mid:list-mvjbd9 -->
1. If sizes are wrong, adjust using the table above

<!-- @mid:list-n4kbh0 -->
- Adult candy

<!-- @mid:img-vtj48f -->
![](@img:285d35769ebecab7)