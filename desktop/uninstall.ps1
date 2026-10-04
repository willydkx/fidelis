# Removes the Fidelis desktop app for the current user. Your data stays in
# %LOCALAPPDATA%\Fidelis (delete that folder too if you want to erase it).
$target = Join-Path $env:LOCALAPPDATA 'Programs\Fidelis'
Get-Process Fidelis -ErrorAction SilentlyContinue | Where-Object { $_.Path -like "$target\*" } | Stop-Process -Force
Remove-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run' -Name 'Fidelis' -ErrorAction SilentlyContinue
Remove-Item (Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Fidelis.lnk') -ErrorAction SilentlyContinue
Remove-Item $target -Recurse -Force -ErrorAction SilentlyContinue
Write-Output 'Fidelis desinstalada. Tus datos siguen en %LOCALAPPDATA%\Fidelis.'
