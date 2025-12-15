; Midlight Custom Installer Script
; =================================
; Customizes NSIS installer behavior:
; - Fresh installs: Show wizard
; - Updates: Run silently without UI

!include "LogicLib.nsh"

; Variable to track if this is an update
Var IsUpdate

!macro preInit
  ; Detect if this is an update by checking for existing installation in registry
  ; Check both HKCU and HKLM for the uninstall key
  ReadRegStr $0 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${UNINSTALL_APP_KEY}" "UninstallString"
  ${If} $0 != ""
    StrCpy $IsUpdate "1"
    SetSilent silent
  ${Else}
    ReadRegStr $0 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${UNINSTALL_APP_KEY}" "UninstallString"
    ${If} $0 != ""
      StrCpy $IsUpdate "1"
      SetSilent silent
    ${Else}
      StrCpy $IsUpdate "0"
    ${EndIf}
  ${EndIf}
!macroend

!macro customInit
  ; No custom initialization needed
!macroend

; Customize welcome page text
!macro customWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "Welcome to Midlight"
  !define MUI_WELCOMEPAGE_TEXT "Midlight is a local-first, AI-native document editor.$\r$\n$\r$\nThis wizard will guide you through the installation.$\r$\n$\r$\nClick Next to continue."
!macroend

!macro customInstall
  ; Custom actions after files are installed

  ; Add enhanced registry information for Add/Remove Programs
  WriteRegStr SHCTX "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}" \
    "Publisher" "Midlight"
  WriteRegStr SHCTX "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}" \
    "URLInfoAbout" "https://midlight.ai"
  WriteRegStr SHCTX "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}" \
    "HelpLink" "https://midlight.ai/support"

  ; Mark as fresh install so app can show login prompt on first launch
  ${If} $IsUpdate != "1"
    WriteRegStr SHCTX "Software\Midlight" "FirstRun" "1"
  ${EndIf}
!macroend

!macro customInstallMode
  ; Set installation mode - use per-user installation by default
  StrCpy $isForceCurrentInstall "1"
!macroend

!macro customUnInstall
  ; Custom uninstall actions - clean up registry entries
  DeleteRegKey SHCTX "Software\Midlight"
!macroend
