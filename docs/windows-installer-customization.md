# Windows Installer Customization Plan

## Overview

This document outlines the plan to customize the Windows NSIS installer for Midlight, providing a branded wizard experience for fresh installs while keeping updates fast and silent.

## Goals

1. **Fresh Install**: Full branded wizard with welcome page, Midlight branding, and clear installation flow
2. **Updates**: Silent/quick installation with no UI interruption
3. **Uninstall**: Clean uninstallation with proper cleanup
4. **Branding**: Professional appearance consistent with Midlight's design language

## Current State

```json
"nsis": {
  "oneClick": true,
  "perMachine": false,
  "allowElevation": true,
  "createDesktopShortcut": true,
  "createStartMenuShortcut": true
}
```

Currently using a generic one-click installer with no custom branding.

## Target State

### Behavior Matrix

| Scenario | UI Experience | Details |
|----------|---------------|---------|
| Fresh Install | Full wizard | Welcome page, sidebar branding, progress bar, finish page |
| Auto-Update | Silent | No UI, installs in background, app restarts |
| Manual Update | Silent | Same as auto-update |
| Manual Uninstall | Confirmation | Shows uninstall confirmation dialog |
| Uninstall (during update) | Silent | No UI, handled automatically |

## Implementation

### Step 1: Create Branded Assets

#### Sidebar Image (`build/installerSidebar.bmp`)

- **Dimensions**: 164 × 314 pixels
- **Format**: 24-bit BMP (no alpha channel)
- **Content Suggestions**:
  - Midlight logo (top portion)
  - Gradient background matching app theme (#1a1a2e to #16213e or similar)
  - App name "Midlight"
  - Optional tagline: "Local-first, AI-native editor"
  - Subtle decorative elements

**Design Mockup**:
```
┌──────────────────┐
│                  │
│    [Midlight     │
│      Logo]       │
│                  │
│                  │
│    Midlight      │
│                  │
│   Local-first,   │
│   AI-native      │
│   editor         │
│                  │
│                  │
│                  │
│                  │
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓  │
│  gradient/design │
│                  │
└──────────────────┘
     164 × 314
```

#### Uninstaller Sidebar (`build/uninstallerSidebar.bmp`)

- Same dimensions and format as installer sidebar
- Can be identical or slightly different (e.g., different color tone)

### Step 2: Update package.json

```json
"nsis": {
  "oneClick": false,
  "allowToChangeInstallationDirectory": false,
  "perMachine": false,
  "allowElevation": true,
  "createDesktopShortcut": true,
  "createStartMenuShortcut": true,
  "include": "build/installer.nsh",
  "installerIcon": "build/icon.ico",
  "uninstallerIcon": "build/icon.ico",
  "installerSidebar": "build/installerSidebar.bmp",
  "uninstallerSidebar": "build/uninstallerSidebar.bmp",
  "shortcutName": "Midlight",
  "uninstallDisplayName": "Midlight"
}
```

**Key Changes**:
- `oneClick: false` - Enables wizard mode (we'll make updates silent via script)
- `allowToChangeInstallationDirectory: false` - Keeps install simple
- `include` - Points to our custom NSIS script
- `installerSidebar` / `uninstallerSidebar` - Branded images

### Step 3: Create NSIS Script (`build/installer.nsh`)

```nsis
; Midlight Custom Installer Script
; ================================
; This script customizes the NSIS installer behavior:
; - Fresh installs: Show full branded wizard
; - Updates: Run silently without UI

!macro preInit
  ; Detect if this is an update and run silently
  ${if} ${isUpdated}
    SetSilent silent
  ${endIf}
!macroend

!macro customHeader
  ; Custom header modifications (if needed)
!macroend

!macro customInit
  ; Custom initialization logic
  ; Runs after preInit, before UI is shown
!macroend

!macro customWelcomePage
  ; Customize the welcome page text
  ; Note: Only shown for fresh installs (updates are silent)
  !define MUI_WELCOMEPAGE_TITLE "Welcome to Midlight"
  !define MUI_WELCOMEPAGE_TEXT "Midlight is a local-first, AI-native document editor.$\r$\n$\r$\nThis wizard will guide you through the installation.$\r$\n$\r$\nClick Next to continue."
!macroend

!macro customInstall
  ; Custom actions after files are installed
  ; Runs for BOTH fresh installs and updates

  ; Add enhanced registry information for Add/Remove Programs
  WriteRegStr SHCTX "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}" \
    "Publisher" "Midlight"
  WriteRegStr SHCTX "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}" \
    "URLInfoAbout" "https://midlight.ai"
  WriteRegStr SHCTX "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}" \
    "HelpLink" "https://midlight.ai/support"

  ; Fresh install specific actions
  ${ifNot} ${isUpdated}
    ; Could add first-run markers, etc.
  ${endIf}
!macroend

!macro customInstallMode
  ; Set installation mode
  ; We use per-user installation by default
  StrCpy $isForceCurrentInstall "1"
!macroend

!macro customUnInit
  ; Custom uninstaller initialization
  ; Skip confirmation dialogs during updates
  ${if} ${isUpdated}
    SetSilent silent
  ${endIf}
!macroend

!macro customUnInstall
  ; Custom uninstall actions
  ; Only run for manual uninstalls, not during updates
  ${ifNot} ${isUpdated}
    ; Clean up any additional files/registry entries
    ; Note: Core cleanup is handled by electron-builder
  ${endIf}
!macroend

!macro customRemoveFiles
  ; Custom file removal logic (if needed)
  ; Default behavior is usually sufficient
!macroend
```

### Step 4: File Structure

After implementation, the `build/` directory should contain:

```
build/
├── entitlements.mac.plist    # Existing - macOS entitlements
├── icon.icns                 # Existing - macOS icon
├── icon.ico                  # Existing - Windows icon
├── icon.png                  # Existing - Linux icon
├── installer.nsh             # NEW - Custom NSIS script
├── installerSidebar.bmp      # NEW - Installer branding (164×314)
└── uninstallerSidebar.bmp    # NEW - Uninstaller branding (164×314)
```

## Creating the BMP Files

### Option A: Export from Design Tool

1. Create design in Figma/Photoshop/etc. at 164×314 pixels
2. Export as PNG
3. Convert to 24-bit BMP:
   - **ImageMagick**: `magick input.png -type TrueColor BMP3:output.bmp`
   - **ffmpeg**: `ffmpeg -i input.png -pix_fmt bgr24 output.bmp`
   - **GIMP**: Export as BMP, select "24 bits" (R8 G8 B8)

### Option B: Use Online Converter

1. Create/export as PNG at 164×314 pixels
2. Use online converter (e.g., convertio.co) to convert to BMP
3. Ensure 24-bit color depth

### Important Notes

- **No transparency**: BMP doesn't support alpha; use solid background
- **Exact dimensions**: Must be exactly 164×314 pixels
- **Color depth**: Must be 24-bit (not 32-bit, not 8-bit)
- **Test on Windows**: Preview may look different on macOS

## Testing

### Test Fresh Install

1. Build the installer: `npm run build`
2. Uninstall any existing Midlight installation
3. Run the new installer
4. **Expected**: Full wizard with sidebar branding, welcome text

### Test Update

1. Install an older version first
2. Run the new installer over it
3. **Expected**: Silent installation, no wizard UI

### Test via Auto-Updater

1. Install current version
2. Publish new version to update server
3. Let auto-updater download and install
4. **Expected**: Silent update, app restarts automatically

### Test Uninstall

1. Go to Windows Settings > Apps > Midlight > Uninstall
2. **Expected**: Uninstaller with sidebar branding, confirmation

## Rollback Plan

If issues arise, revert to one-click installer:

```json
"nsis": {
  "oneClick": true,
  "perMachine": false,
  "allowElevation": true,
  "createDesktopShortcut": true,
  "createStartMenuShortcut": true
}
```

And remove/rename `build/installer.nsh`.

## Future Enhancements

### Potential Additions

1. **License Agreement Page**: Add EULA if needed
   ```nsis
   !macro customLicense
     !insertmacro MUI_PAGE_LICENSE "license.txt"
   !macroend
   ```

2. **Custom Finish Page**: Add "Launch Midlight" checkbox, links
   ```nsis
   !macro customFinishPage
     !define MUI_FINISHPAGE_RUN "$INSTDIR\Midlight.exe"
     !define MUI_FINISHPAGE_RUN_TEXT "Launch Midlight"
   !macroend
   ```

3. **File Associations**: Register .md files to open with Midlight

4. **Custom Install Location**: Allow users to choose (set `allowToChangeInstallationDirectory: true`)

## References

- [electron-builder NSIS Documentation](https://www.electron.build/nsis.html)
- [NSIS Modern UI 2 Documentation](https://nsis.sourceforge.io/Docs/Modern%20UI/Readme.html)
- [NSIS Scripting Reference](https://nsis.sourceforge.io/Docs/Chapter4.html)
- [electron-builder NSIS Template](https://github.com/electron-userland/electron-builder/blob/master/packages/app-builder-lib/templates/nsis/installer.nsi)

## Checklist

- [ ] Create `installerSidebar.bmp` (164×314, 24-bit BMP)
- [ ] Create `uninstallerSidebar.bmp` (164×314, 24-bit BMP)
- [ ] Create `build/installer.nsh` script
- [ ] Update `package.json` with new NSIS config
- [ ] Test fresh install on Windows
- [ ] Test update on Windows
- [ ] Test auto-updater flow
- [ ] Test manual uninstall
- [ ] Verify branding appears correctly in all scenarios
