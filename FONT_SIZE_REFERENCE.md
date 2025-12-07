<!-- @mid:h-oxae25 -->
# Font Size Reference: Editor vs Word

<!-- @mid:p-h2yjip -->
This document explains how font sizes in the editor map to Word export.

<!-- @mid:h-rln61o -->
## Size Conversion Formula

<!-- @mid:p-1s9sab -->
**Editor (px) = Word (pt)**** - NUMBER PARITY! 🎯**

<!-- @mid:p-u8ptfm -->
`What you see ``is what`` you get:`

<!-- @mid:list-9j1nrc -->
1. Editor shows: 16

<!-- @mid:list-ohqkb2 -->
1. Word shows: 16pt

<!-- @mid:list-3n28rn -->
1. Nest 1

<!-- @mid:list-hakcdq -->
1. Nest 2

<!-- @mid:list-mhq8ln -->
1. Wowwww

<!-- @mid:list-tjq2io -->
1. YES!

<!-- @mid:list-uc9uiz -->
1. T`hey match nu`merically AND visually!

<!-- @mid:p-3r1if3 -->
Technical details:

<!-- @mid:list-1n3r5d -->
- Editor pixels → Half\-points: `px × 2`

<!-- @mid:list-0lvddx -->
- Half-points → Points: `halfPoints ÷ 2`

<!-- @mid:list-9ck20k -->
- Combined: `px × 2 ÷ 2 = px` (perfect 1:1 mapping!)

<!-- @mid:p-6fvufp -->
* ** ****

<!-- @mid:h-cg8du5 -->
## Size Mapping Table

<!-- @mid:p-kgw8bi -->
**Editor ShowsEditor UsesWord Exports AsNotes1010px10ptSmall text1212px12ptSmall body text****1414px14ptDefault body text**** ✅1616px16ptMedium body text1818px18ptSlightly larger2020px20ptH3 default ✅2424px24ptH2 default ✅2828px28ptLarge3232px32ptH1 default ✅**

<!-- @mid:p-jb4o52 -->
* ** ****

<!-- @mid:h-uqy1t0 -->
## Default Sizes

<!-- @mid:h-q54p9d -->
### Current Defaults (as of update):

<!-- @mid:p-h03aj6 -->
**Body Text:**

<!-- @mid:list-nhioec -->
- Editor default shown: "14"

<!-- @mid:list-8eps2e -->
- Word export: 14pt

<!-- @mid:list-bd6shc -->
- **Recommended:** Default 14px for standard body text

<!-- @mid:p-gpo03h -->
**Headings:**

<!-- @mid:list-ysvgq3 -->
- H1: 32px → 24pt in Word ✅

<!-- @mid:list-n5xjes -->
- H2: 24px → 18pt in Word ✅

<!-- @mid:list-pxtv6t -->
- H3: 20px → 15pt in Word ✅

<!-- @mid:p-xpaq4v -->
* ** ****

<!-- @mid:h-lgjnn3 -->
## Recommendations

<!-- @mid:h-2xkje5 -->
### For Best Word Compatibility:

<!-- @mid:list-nk6pga -->
1. **Standard body text**: Use **14px** in editor (exports as 14pt) - This is the default

<!-- @mid:list-w0muwh -->
1. **Small footnotes**: Use 10px or 12px

<!-- @mid:list-ld4ber -->
1. **Headings**: Keep defaults (H1=32px, H2=24px, H3=20px)

<!-- @mid:h-p4jmyd -->
### If Text Appears Too Small in Word:

<!-- @mid:p-5wv0yh -->
Increase the px value in the editor:

<!-- @mid:list-jj69nw -->
- 12px → 16px (9pt → 12pt)

<!-- @mid:list-bfld0y -->
- 16px → 20px (12pt → 15pt)

<!-- @mid:h-pj8vrw -->
### If Text Appears Too Large in Word:

<!-- @mid:p-4o7l16 -->
Decrease the px value in the editor:

<!-- @mid:list-vyi30k -->
- 20px → 16px (15pt → 12pt)

<!-- @mid:list-oc90xe -->
- 16px → 14px (12pt → 10.5pt)

<!-- @mid:p-yvr5ba -->
* ** ****

<!-- @mid:h-2kmh1p -->
## Why This Mapping?

<!-- @mid:p-t1bu7q -->
**Short answer:**** Browsers measure in pixels (px), Word measures in points (pt).**

<!-- @mid:p-m5ajvk -->
**Longer explanation:**

<!-- @mid:list-8s76a6 -->
- We use 1:1 mapping: px value = pt value in Word

<!-- @mid:list-cytrkn -->
- **14px** in editor → **14pt** in Word (our default)

<!-- @mid:list-u3qr2u -->
- This provides intuitive number parity between editor and exported documents

<!-- @mid:p-211voo -->
* ** ****

<!-- @mid:h-8jdj2u -->
## Testing Your Documents

<!-- @mid:p-q3bmqs -->
After setting font sizes in the editor:

<!-- @mid:list-bi43ad -->
1. Export to DOCX

<!-- @mid:list-q74o2a -->
1. Open in Word

<!-- @mid:list-dtka0c -->
1. Check font sizes (right-click → Font)

<!-- @mid:list-zvfmr8 -->
1. If sizes are wrong, adjust using the table above

<!-- @mid:list-runr35 -->
- Adult candy

<!-- @mid:img-exluwf -->
![](@img:285d35769ebecab7)