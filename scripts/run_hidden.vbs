' Launches a PowerShell script completely hidden (window style 0, zero console flash)
If WScript.Arguments.Count >= 1 Then
    Dim scriptPath, cmd, shell
    scriptPath = WScript.Arguments(0)
    cmd = "powershell.exe -NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File """ & scriptPath & """"
    Set shell = CreateObject("WScript.Shell")
    shell.Run cmd, 0, False
End If
