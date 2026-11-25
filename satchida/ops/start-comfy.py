import subprocess, time, os, sys

py = r'C:\Users\WinDiesel\Documents\ComfyUI\.venv\Scripts\python.exe'
main = r'C:\Users\WinDiesel\AppData\Local\Programs\ComfyUI\resources\ComfyUI\main.py'
cfg = r'C:\Users\WinDiesel\AppData\Roaming\ComfyUI\extra_models_config.yaml'
out_dir = r'C:\Users\WinDiesel\Documents\ComfyUI\output'
log_path = r'D:\LAN-AI-Infra\Satchida-Studio\logs\comfy_run.log'

with open(log_path, 'a', encoding='utf-8') as log:
    log.write(f'=== Starting ComfyUI at {time.ctime()} ===\n')
    log.flush()
    proc = subprocess.Popen([
        py, main,
        '--port', '8188',
        '--listen', '127.0.0.1',
        '--extra-model-paths-config', cfg,
        '--output-directory', out_dir
    ], stdout=log, stderr=subprocess.STDOUT)
    proc.wait()
