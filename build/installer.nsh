; Midlight Custom Installer Script
; =================================
; Customizes NSIS installer behavior:
; - Fresh installs: Show full branded wizard with login option
; - Updates: Run silently without UI

!include "nsDialogs.nsh"
!include "LogicLib.nsh"

; Variables for custom page
Var Dialog
Var LoginRadio
Var SkipRadio
Var ShouldLogin
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
  ; Initialize login preference (default to skip)
  StrCpy $ShouldLogin "0"
!macroend

; Custom page function - Create the login choice page
Function LoginPageCreate
  ; Skip this page for updates
  ${If} $IsUpdate == "1"
    Abort
  ${EndIf}

  !insertmacro MUI_HEADER_TEXT "Account Setup" "Would you like to sign in to your Midlight account?"

  nsDialogs::Create 1018
  Pop $Dialog
  ${If} $Dialog == error
    Abort
  ${EndIf}

  ; Description text
  ${NSD_CreateLabel} 0 0 100% 40u "Signing in enables cloud sync, AI features, and more.$\r$\n$\r$\nYou can always sign in later from the app settings."
  Pop $0

  ; Radio buttons
  ${NSD_CreateRadioButton} 0 50u 100% 12u "Sign in after installation"
  Pop $LoginRadio

  ${NSD_CreateRadioButton} 0 65u 100% 12u "Skip for now"
  Pop $SkipRadio

  ; Default to "Skip for now"
  ${NSD_Check} $SkipRadio

  nsDialogs::Show
FunctionEnd

; Custom page function - Save the login choice
Function LoginPageLeave
  ${NSD_GetState} $LoginRadio $ShouldLogin
FunctionEnd

; Register the custom page
!macro customWelcomePage
  ; Welcome page text customization
  !define MUI_WELCOMEPAGE_TITLE "Welcome to Midlight"
  !define MUI_WELCOMEPAGE_TEXT "Midlight is a local-first, AI-native document editor.$\r$\n$\r$\nThis wizard will guide you through the installation.$\r$\n$\r$\nClick Next to continue."
!macroend

; Insert custom page after welcome, before install
!macro customPageAfterWelcome
  Page custom LoginPageCreate LoginPageLeave
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

  ; Store login preference for the app to read on first launch (only for fresh installs)
  ${If} $IsUpdate != "1"
    ${If} $ShouldLogin == "1"
      WriteRegStr SHCTX "Software\Midlight" "ShowLoginOnStart" "1"
    ${Else}
      WriteRegStr SHCTX "Software\Midlight" "ShowLoginOnStart" "0"
    ${EndIf}
  ${EndIf}
!macroend

!macro customInstallMode
  ; Set installation mode - use per-user installation by default
  StrCpy $isForceCurrentInstall "1"
!macroend

!macro customUnInit
  ; Custom uninstaller initialization
  ; Check if being run during update (silent uninstall)
  ${If} ${Silent}
    ; Already silent, likely an update
  ${EndIf}
!macroend

!macro customUnInstall
  ; Custom uninstall actions
  ; Clean up registry entries (this runs for manual uninstalls)
  ; During updates, the old version is uninstalled silently first
  DeleteRegKey SHCTX "Software\Midlight"
!macroend
