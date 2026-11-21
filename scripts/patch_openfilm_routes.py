with open('api/server/routes/openfilm.js', 'r', encoding='utf-8') as f:
    text = f.read()

target = """    if (!matched) {
      // Create new project
      const createRes = await fetch(`${targetOrigin}/api/projects`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-studio-key': studioKey,
        },
        body: JSON.stringify({ name: projectName }),
      });
      const createdData = await createRes.json();
      matched = createdData.project;

      try {
        const projectDir = matched.path;
        const assetsDir = path.join(projectDir, 'assets');
        if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });

        const mediaSource = req.query.media;
        if (mediaSource) {
          const publicGenerated = path.join(process.cwd(), 'client', 'public', 'generated');
          const studioGenerated = path.resolve('D:\\\\LAN-AI-Infra\\\\Satchida-Studio\\\\exports\\\\generated');
          let srcPath = path.join(publicGenerated, path.basename(mediaSource));
          if (!fs.existsSync(srcPath)) {
            srcPath = path.join(studioGenerated, path.basename(mediaSource));
          }
          const destPath = path.join(assetsDir, path.basename(mediaSource));
          if (fs.existsSync(srcPath) && !fs.existsSync(destPath)) {
            fs.copyFileSync(srcPath, destPath);
          }
          const filmHtmlPath = path.join(projectDir, 'film.html');
          const relAsset = `assets/${path.basename(mediaSource)}`;
          const filmHtml = `<!doctype html>\\n<html>\\n<head>\\n<meta charset="utf-8">\\n<meta name="viewport" content="width=1920, height=1080">\\n</head>\\n<body>\\n<section>\\n  <video id="clip-1" src="${relAsset}" at="0" style="left: 0px; top: 0px; width: 1920px; height: 1080px"></video>\\n</section>\\n</body>\\n</html>\\n`;
          fs.writeFileSync(filmHtmlPath, filmHtml, 'utf8');
        }
      } catch (seedErr) {
        logger.warn('[OpenFilm seed project error]', seedErr);
      }
    }"""

replacement = """    if (!matched) {
      // Create new project
      const createRes = await fetch(`${targetOrigin}/api/projects`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-studio-key': studioKey,
        },
        body: JSON.stringify({ name: projectName }),
      });
      const createdData = await createRes.json();
      matched = createdData.project;
    }

    // Always seed or update the project's media if mediaSource is provided
    try {
      if (matched && matched.path) {
        const projectDir = matched.path;
        const assetsDir = path.join(projectDir, 'assets');
        if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });

        const mediaSource = req.query.media;
        if (mediaSource) {
          const publicGenerated = path.join(process.cwd(), 'client', 'public', 'generated');
          const studioGenerated = path.resolve('D:\\\\LAN-AI-Infra\\\\Satchida-Studio\\\\exports\\\\generated');
          let srcPath = path.join(publicGenerated, path.basename(mediaSource));
          if (!fs.existsSync(srcPath)) {
            srcPath = path.join(studioGenerated, path.basename(mediaSource));
          }
          const destPath = path.join(assetsDir, path.basename(mediaSource));
          if (fs.existsSync(srcPath) && (!fs.existsSync(destPath) || fs.statSync(srcPath).mtimeMs > fs.statSync(destPath).mtimeMs)) {
            fs.copyFileSync(srcPath, destPath);
          }
          const filmHtmlPath = path.join(projectDir, 'film.html');
          const relAsset = `assets/${path.basename(mediaSource)}`;
          const filmHtml = `<!doctype html>\\n<html>\\n<head>\\n<meta charset="utf-8">\\n<meta name="viewport" content="width=1920, height=1080">\\n</head>\\n<body>\\n<section>\\n  <video id="clip-1" src="${relAsset}" at="0" style="left: 0px; top: 0px; width: 1920px; height: 1080px"></video>\\n</section>\\n</body>\\n</html>\\n`;
          fs.writeFileSync(filmHtmlPath, filmHtml, 'utf8');
        }
      }
    } catch (seedErr) {
      logger.warn('[OpenFilm seed project error]', seedErr);
    }"""

if target in text:
    new_text = text.replace(target, replacement)
    with open('api/server/routes/openfilm.js', 'w', encoding='utf-8') as f:
        f.write(new_text)
    print("Updated openfilm.js successfully!")
else:
    print("Target block not found in openfilm.js")
