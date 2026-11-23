const fs = require('fs');
const filePath = 'api/server/index.js';
let str = fs.readFileSync(filePath, 'utf8');

// Target block in api/server/index.js
const target = `  // Studio artifact home — stable directory OUTSIDE client/dist so client
  // rebuilds can never 404 a delivered creation. The montage server publishes
  // here and the Studio Library manifest lives alongside the artifacts.
  const studioGeneratedDir = path.resolve('D:\\\\LAN-AI-Infra\\\\Satchida-Studio\\\\exports\\\\generated');
  if (!fs.existsSync(studioGeneratedDir)) {
    fs.mkdirSync(studioGeneratedDir, { recursive: true });
  }
  app.use(
    '/generated',
    express.static(studioGeneratedDir, {
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.mp4')) {
          res.setHeader('Content-Type', 'video/mp4');
        } else if (filePath.endsWith('.webm')) {
          res.setHeader('Content-Type', 'video/webm');
        } else if (filePath.endsWith('.png')) {
          res.setHeader('Content-Type', 'image/png');
        } else if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) {
          res.setHeader('Content-Type', 'image/jpeg');
        } else if (filePath.endsWith('.json')) {
          res.setHeader('Content-Type', 'application/json');
        }
        res.setHeader('Access-Control-Allow-Origin', '*');
      },
    }),
  );`;

const replacement = `  // Studio artifact home — prefers in-repo storage/exports/generated with fallback
  const inRepoGeneratedDir = path.resolve('storage', 'exports', 'generated');
  const externalGeneratedDir = path.resolve('D:\\\\LAN-AI-Infra\\\\Satchida-Studio\\\\exports\\\\generated');
  const studioGeneratedDir = fs.existsSync(inRepoGeneratedDir) ? inRepoGeneratedDir : externalGeneratedDir;
  if (!fs.existsSync(studioGeneratedDir)) {
    fs.mkdirSync(studioGeneratedDir, { recursive: true });
  }
  app.use(
    '/generated',
    express.static(studioGeneratedDir, {
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.mp4')) {
          res.setHeader('Content-Type', 'video/mp4');
        } else if (filePath.endsWith('.webm')) {
          res.setHeader('Content-Type', 'video/webm');
        } else if (filePath.endsWith('.png')) {
          res.setHeader('Content-Type', 'image/png');
        } else if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) {
          res.setHeader('Content-Type', 'image/jpeg');
        } else if (filePath.endsWith('.json')) {
          res.setHeader('Content-Type', 'application/json');
        }
        res.setHeader('Access-Control-Allow-Origin', '*');
      },
    }),
  );

  // Authenticated and Privacy-Isolated /storage Static Route (tenant & user isolation)
  const storageRootDir = path.resolve('storage');
  if (!fs.existsSync(storageRootDir)) {
    fs.mkdirSync(storageRootDir, { recursive: true });
  }
  app.use('/storage', optionalJwtAuth, (req, res, next) => {
    // 1. Guard user privacy for /storage/users/:username/...
    const userMatch = req.path.match(/^\\/users\\/([^\\/]+)/);
    if (userMatch) {
      const targetUser = decodeURIComponent(userMatch[1]);
      const isAuth = req.user && (req.user.name || req.user.username);
      const isOwner = isAuth && (req.user.name === targetUser || req.user.username === targetUser);
      const isAdmin = req.user && (req.user.role === 'ADMIN' || req.user.role === 'admin');

      if (!isOwner && !isAdmin) {
        return res.status(403).json({ error: 'Access denied to private user storage' });
      }
    }

    // 2. Serve static file with full byte-range streaming & proper MIME headers
    express.static(storageRootDir, {
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.mp4')) {
          res.setHeader('Content-Type', 'video/mp4');
        } else if (filePath.endsWith('.webm')) {
          res.setHeader('Content-Type', 'video/webm');
        } else if (filePath.endsWith('.mp3')) {
          res.setHeader('Content-Type', 'audio/mpeg');
        } else if (filePath.endsWith('.png')) {
          res.setHeader('Content-Type', 'image/png');
        } else if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) {
          res.setHeader('Content-Type', 'image/jpeg');
        } else if (filePath.endsWith('.pdf')) {
          res.setHeader('Content-Type', 'application/pdf');
        } else if (filePath.endsWith('.json')) {
          res.setHeader('Content-Type', 'application/json');
        }
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Access-Control-Allow-Origin', '*');
      },
    })(req, res, next);
  });`;

if (str.includes("const studioGeneratedDir = path.resolve('D:\\\\LAN-AI-Infra\\\\Satchida-Studio\\\\exports\\\\generated');")) {
  str = str.replace(
    "const studioGeneratedDir = path.resolve('D:\\\\LAN-AI-Infra\\\\Satchida-Studio\\\\exports\\\\generated');",
    `const inRepoGeneratedDir = path.resolve('storage', 'exports', 'generated');
  const externalGeneratedDir = path.resolve('D:\\\\LAN-AI-Infra\\\\Satchida-Studio\\\\exports\\\\generated');
  const studioGeneratedDir = fs.existsSync(inRepoGeneratedDir) ? inRepoGeneratedDir : externalGeneratedDir;`
  );

  // Update /api/studio/library manifestPath as well
  str = str.replace(
    "const manifestPath = path.resolve(\r\n        'D:\\\\LAN-AI-Infra\\\\Satchida-Studio\\\\exports\\\\generated\\\\manifest.json',\r\n      );",
    `const manifestPath = fs.existsSync(path.resolve('storage', 'exports', 'generated', 'manifest.json'))
        ? path.resolve('storage', 'exports', 'generated', 'manifest.json')
        : path.resolve('D:\\\\LAN-AI-Infra\\\\Satchida-Studio\\\\exports\\\\generated\\\\manifest.json');`
  );

  // Append /storage route right after /generated
  const afterGenerated = "res.setHeader('Access-Control-Allow-Origin', '*');\r\n      },\r\n    }),\r\n  );";
  const storageMount = `res.setHeader('Access-Control-Allow-Origin', '*');\r\n      },\r\n    }),\r\n  );\r\n\r\n  // Authenticated and Privacy-Isolated /storage Static Route (tenant & user isolation)
  const storageRootDir = path.resolve('storage');
  if (!fs.existsSync(storageRootDir)) {
    fs.mkdirSync(storageRootDir, { recursive: true });
  }
  app.use('/storage', optionalJwtAuth, (req, res, next) => {
    // 1. Guard user privacy for /storage/users/:username/...
    const userMatch = req.path.match(/^\\/users\\/([^\\/]+)/);
    if (userMatch) {
      const targetUser = decodeURIComponent(userMatch[1]);
      const currentUserName = (req.user && (req.user.name || req.user.username)) || '';
      const isOwner = currentUserName && (currentUserName === targetUser);
      const isAdmin = req.user && (req.user.role === 'ADMIN' || req.user.role === 'admin');

      if (!isOwner && !isAdmin) {
        return res.status(403).json({ error: 'Access denied to private user storage' });
      }
    }

    // 2. Serve static file with full byte-range streaming & proper MIME headers
    express.static(storageRootDir, {
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.mp4')) {
          res.setHeader('Content-Type', 'video/mp4');
        } else if (filePath.endsWith('.webm')) {
          res.setHeader('Content-Type', 'video/webm');
        } else if (filePath.endsWith('.mp3')) {
          res.setHeader('Content-Type', 'audio/mpeg');
        } else if (filePath.endsWith('.png')) {
          res.setHeader('Content-Type', 'image/png');
        } else if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) {
          res.setHeader('Content-Type', 'image/jpeg');
        } else if (filePath.endsWith('.pdf')) {
          res.setHeader('Content-Type', 'application/pdf');
        } else if (filePath.endsWith('.json')) {
          res.setHeader('Content-Type', 'application/json');
        }
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Access-Control-Allow-Origin', '*');
      },
    })(req, res, next);
  });`;

  str = str.replace(afterGenerated, storageMount);
  fs.writeFileSync(filePath, str, 'utf8');
  console.log('Successfully patched api/server/index.js with /storage route and in-repo generated dir');
} else {
  console.log('Target string in api/server/index.js not found');
}
