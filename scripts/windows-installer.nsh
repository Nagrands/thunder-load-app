!macro customInstall
  ; Remove the legacy per-user shortcut left by older installers. Having two
  ; shortcuts with the same AUMID lets Explorer reuse the stale Electron icon.
  SetShellVarContext current
  Delete "$SMPROGRAMS\${SHORTCUT_NAME}.lnk"
  SetShellVarContext all

  ; Use a standalone ICO path so Explorer does not reuse the cached icon from
  ; the executable resource after an in-place upgrade.
  Delete "$newStartMenuLink"
  CreateShortCut "$newStartMenuLink" "$appExe" "" "$INSTDIR\resources\app-icon.ico" 0 "" "" "${APP_DESCRIPTION}"
  WinShell::SetLnkAUMI "$newStartMenuLink" "${APP_ID}"

  ${if} ${FileExists} "$newDesktopLink"
    Delete "$newDesktopLink"
    CreateShortCut "$newDesktopLink" "$appExe" "" "$INSTDIR\resources\app-icon.ico" 0 "" "" "${APP_DESCRIPTION}"
    WinShell::SetLnkAUMI "$newDesktopLink" "${APP_ID}"
  ${endIf}

  ; Invalidate Explorer's association/icon cache after recreating the links.
  System::Call 'Shell32::SHChangeNotify(i 0x8000000, i 0, i 0, i 0)'
!macroend
