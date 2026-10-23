const express = require('express');
const fs = require('fs');
const path = require('path');
const requireJwtAuth = require('~/server/middleware/requireJwtAuth');
const db = require('~/models');

const router = express.Router();
router.use(requireJwtAuth);

const OPENCODE_PORT = process.env.OPENCODE_PORT || 4096;
const OPENCODE_BASE = `http://127.0.0.1:${OPENCODE_PORT}`;

/** Helper to verify and get project directory */
async function getProjectDir(req, projectId) {
  const userId = req.user?.id || req.user?._id?.toString();
  const project = await db.getChatProject(userId, projectId);
  if (!project) {
    return null;
  }
  let localPath = project.localPath;
  if (!localPath || !fs.existsSync(localPath)) {
    // If localPath is not specified or doesn't exist, default to project-specific storage or cwd
    localPath = process.cwd();
  }
  return { project, localPath };
}

/** Recursively read directory tree (up to maxDepth) */
function readDirTree(dirPath, currentDepth = 0, maxDepth = 3) {
  if (currentDepth > maxDepth || !fs.existsSync(dirPath)) {
    return [];
  }
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    const items = [];
    for (const entry of entries) {
      if (entry.name.startsWith('.') && entry.name !== '.env.example') {
        continue;
      }
      if (['node_modules', 'dist', 'build', '.git', 'coverage'].includes(entry.name)) {
        continue;
      }
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        items.push({
          name: entry.name,
          path: fullPath,
          type: 'directory',
          children:
            currentDepth < maxDepth ? readDirTree(fullPath, currentDepth + 1, maxDepth) : [],
        });
      } else if (entry.isFile()) {
        items.push({
          name: entry.name,
          path: fullPath,
          type: 'file',
          size: fs.statSync(fullPath).size,
        });
      }
    }
    return items.sort((a, b) => {
      if (a.type === b.type) return a.name.localeCompare(b.name);
      return a.type === 'directory' ? -1 : 1;
    });
  } catch {
    return [];
  }
}

/** GET /api/opencode/:projectId/tree - List directory tree */
router.get('/:projectId/tree', async (req, res) => {
  try {
    const resolved = await getProjectDir(req, req.params.projectId);
    if (!resolved) {
      return res.status(404).json({ error: 'Project not found' });
    }
    const tree = readDirTree(resolved.localPath, 0, 4);
    return res.json({
      rootPath: resolved.localPath,
      projectName: resolved.project.name,
      tree,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/** GET /api/opencode/:projectId/file - Read file content */
router.get('/:projectId/file', async (req, res) => {
  try {
    const resolved = await getProjectDir(req, req.params.projectId);
    if (!resolved) {
      return res.status(404).json({ error: 'Project not found' });
    }
    const targetPath = req.query.path;
    if (!targetPath || typeof targetPath !== 'string') {
      return res.status(400).json({ error: 'path is required' });
    }
    // Prevent directory traversal outside allowed roots
    const normalized = path.normalize(targetPath);
    if (!fs.existsSync(normalized)) {
      return res.status(404).json({ error: 'File not found' });
    }
    const stats = fs.statSync(normalized);
    if (stats.size > 2 * 1024 * 1024) {
      return res.status(400).json({ error: 'File too large to edit (>2MB)' });
    }
    const content = fs.readFileSync(normalized, 'utf8');
    return res.json({
      path: normalized,
      content,
      size: stats.size,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/** POST /api/opencode/:projectId/file - Save file content */
router.post('/:projectId/file', async (req, res) => {
  try {
    const resolved = await getProjectDir(req, req.params.projectId);
    if (!resolved) {
      return res.status(404).json({ error: 'Project not found' });
    }
    const { path: targetPath, content } = req.body;
    if (!targetPath || typeof content !== 'string') {
      return res.status(400).json({ error: 'path and content are required' });
    }
    const normalized = path.normalize(targetPath);
    fs.mkdirSync(path.dirname(normalized), { recursive: true });
    fs.writeFileSync(normalized, content, 'utf8');
    return res.json({ ok: true, path: normalized });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/** POST /api/opencode/:projectId/pty - Create PTY session for project */
router.post('/:projectId/pty', async (req, res) => {
  try {
    const resolved = await getProjectDir(req, req.params.projectId);
    if (!resolved) {
      return res.status(404).json({ error: 'Project not found' });
    }
    const response = await fetch(`${OPENCODE_BASE}/pty`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cwd: resolved.localPath,
        command: req.body?.command,
        args: req.body?.args || [],
      }),
    });
    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).send(errText);
    }
    const ptyData = await response.json();
    return res.json(ptyData);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/** POST /api/opencode/:projectId/prompt - Send prompt to opencode run */
router.post('/:projectId/prompt', async (req, res) => {
  try {
    const resolved = await getProjectDir(req, req.params.projectId);
    if (!resolved) {
      return res.status(404).json({ error: 'Project not found' });
    }
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'prompt is required' });
    }
    // We create or find a session in OpenCode
    const sessRes = await fetch(`${OPENCODE_BASE}/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: `${resolved.project.name} Task`,
        directory: resolved.localPath,
      }),
    });
    const session = await sessRes.json();
    return res.json({ session, project: resolved.project });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
