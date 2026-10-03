@echo off
cd /d "C:\Mujoco Projects\vninvest"
start "VNInvest External Docker" powershell.exe -NoExit -ExecutionPolicy Bypass -File "C:\Mujoco Projects\vninvest\docker_external_reset_and_start.ps1"
