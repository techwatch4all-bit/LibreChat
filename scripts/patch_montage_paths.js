const fs = require('fs');
const filePath = 'skill/satchida-montage-server.py';
let str = fs.readFileSync(filePath, 'utf8');

const t1 = '_STUDIO_ROOT = Path(r"D:\\LAN-AI-Infra\\Satchida-Studio")';
const r1 = '_LIBRECHAT_ROOT = Path(__file__).resolve().parent.parent\r\n_STUDIO_ROOT = (_LIBRECHAT_ROOT / "repos" / "Satchida-Studio") if (_LIBRECHAT_ROOT / "repos" / "Satchida-Studio").exists() else Path(r"D:\\LAN-AI-Infra\\Satchida-Studio")';

const t2 = '_STABLE_GENERATED_DIR = Path(r"D:\\LAN-AI-Infra\\Satchida-Studio\\exports\\generated")';
const r2 = '_STABLE_GENERATED_DIR = (_LIBRECHAT_ROOT / "storage" / "exports" / "generated") if (_LIBRECHAT_ROOT / "storage" / "exports" / "generated").exists() else Path(r"D:\\LAN-AI-Infra\\Satchida-Studio\\exports\\generated")';

const t3 = 'stable_dir = Path(r"D:\\LAN-AI-Infra\\Satchida-Studio\\exports\\generated")';
const r3 = 'stable_dir = _STABLE_GENERATED_DIR';

if (str.includes(t1) && str.includes(t2) && str.includes(t3)) {
  str = str.replace(t1, r1).replace(t2, r2).replace(t3, r3);
  fs.writeFileSync(filePath, str, 'utf8');
  console.log('Successfully patched skill/satchida-montage-server.py');
} else {
  console.log('Could not find all targets in montage server');
}
