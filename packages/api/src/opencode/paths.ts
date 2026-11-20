import fs from 'node:fs';
import path from 'node:path';
import type { OpenCodeResult } from './errors';
import { err, ok } from './errors';

export interface OpenCodeProjectRecord {
  id?: string;
  _id?: unknown;
  name?: string;
  localPath?: string | null;
}

const WINDOWS_RESERVED_BASENAMES = new Set([
  'con',
  'prn',
  'aux',
  'nul',
  'com1',
  'com2',
  'com3',
  'com4',
  'com5',
  'com6',
  'com7',
  'com8',
  'com9',
  'lpt1',
  'lpt2',
  'lpt3',
  'lpt4',
  'lpt5',
  'lpt6',
  'lpt7',
  'lpt8',
  'lpt9',
]);

const SKIPPED_TREE_DIRS = new Set(['node_modules', 'dist', 'build', '.git', 'coverage']);

export interface ProjectPathInput {
  name?: string | null;
  localPath?: string | null;
}

export interface DirTreeEntry {
  name: string;
  path: string;
  type: 'directory' | 'file';
  size?: number;
  children?: DirTreeEntry[];
}

export interface ResolveInsideRootOptions {
  mustExist?: boolean;
}

function canonicalizePath(targetPath: string): string {
  const realpathFn = fs.realpathSync.native ?? fs.realpathSync;
  return realpathFn(path.resolve(targetPath));
}

function normalizeForComparison(targetPath: string): string {
  const normalized = path.resolve(targetPath);
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
}

export function isPathInsideRoot(canonicalRoot: string, candidatePath: string): boolean {
  const rootCmp = normalizeForComparison(canonicalRoot);
  const candidateCmp = normalizeForComparison(candidatePath);
  const rel = path.relative(rootCmp, candidateCmp);
  if (rel === '') {
    return true;
  }
  if (rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) {
    return false;
  }
  return true;
}

function hasUnsafeRawPrefix(rawPath: string): boolean {
  if (rawPath.includes('\0')) {
    return true;
  }
  if (/^(?:\\\\|\/\/)/.test(rawPath)) {
    return true;
  }
  if (/^[a-zA-Z]:(?![\\/])/.test(rawPath)) {
    return true;
  }
  return false;
}

function hasUnsafeSegment(rawPath: string): boolean {
  const strippedDrive = rawPath.replace(/^[a-zA-Z]:/, '');
  const segments = strippedDrive.split(/[\\/]+/).filter((segment) => segment.length > 0);
  for (const segment of segments) {
    if (segment === '.' || segment === '..') {
      continue;
    }
    if (/[. ]$/.test(segment)) {
      return true;
    }
    if (segment.includes(':')) {
      return true;
    }
    if (process.platform === 'win32') {
      const stem = segment.split('.')[0]?.toLowerCase() ?? '';
      if (WINDOWS_RESERVED_BASENAMES.has(stem)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Searches `allowedRoots` for an existing directory matching a bare folder name
 * or relative path (for example, when the browser's `showDirectoryPicker()` returns
 * only `handle.name` such as `"OpenHands"` instead of the full disk path).
 * If `<allowedRoot>/<name>/<name>` is a nested repository root (containing `.git`,
 * `package.json`, or `pyproject.toml`), prefers the inner repository root.
 */
export function findExistingDirectoryInAllowedRoots(
  rawNameOrRelPath: string | null | undefined,
  allowedRoots: readonly string[],
): string | null {
  const trimmed = (rawNameOrRelPath ?? '').trim();
  if (!trimmed || path.isAbsolute(trimmed)) {
    return null;
  }
  if (hasUnsafeRawPrefix(trimmed) || hasUnsafeSegment(trimmed) || trimmed.includes('..')) {
    return null;
  }

  for (const allowedRoot of allowedRoots) {
    if (typeof allowedRoot !== 'string' || allowedRoot.trim().length === 0) {
      continue;
    }
    try {
      const resolvedAllowed = path.resolve(allowedRoot);
      if (!fs.statSync(resolvedAllowed).isDirectory()) {
        continue;
      }
      const canonicalAllowed = canonicalizePath(resolvedAllowed);
      const candidate = path.resolve(canonicalAllowed, trimmed);
      if (!fs.existsSync(candidate) || !fs.statSync(candidate).isDirectory()) {
        continue;
      }
      const canonicalCandidate = canonicalizePath(candidate);
      if (!isPathInsideRoot(canonicalAllowed, canonicalCandidate)) {
        continue;
      }

      // Check if this is an outer wrapper folder around a nested repo of the same name (e.g. D:\LAN-AI-Infra\OpenHands\OpenHands)
      const baseName = path.basename(canonicalCandidate);
      const nestedCandidate = path.join(canonicalCandidate, baseName);
      try {
        if (fs.existsSync(nestedCandidate) && fs.statSync(nestedCandidate).isDirectory()) {
          const outerHasMarker =
            fs.existsSync(path.join(canonicalCandidate, 'package.json')) ||
            fs.existsSync(path.join(canonicalCandidate, '.git')) ||
            fs.existsSync(path.join(canonicalCandidate, 'pyproject.toml'));
          const innerHasMarker =
            fs.existsSync(path.join(nestedCandidate, 'package.json')) ||
            fs.existsSync(path.join(nestedCandidate, '.git')) ||
            fs.existsSync(path.join(nestedCandidate, 'pyproject.toml'));
          if (innerHasMarker && !outerHasMarker) {
            const canonicalNested = canonicalizePath(nestedCandidate);
            if (isPathInsideRoot(canonicalAllowed, canonicalNested)) {
              return canonicalNested;
            }
          }
        }
      } catch {
        /* ignore nested check error */
      }

      return canonicalCandidate;
    } catch {
      continue;
    }
  }
  return null;
}

function isEmptyAutoProvisionedFolder(dirPath: string): boolean {
  try {
    const entries = fs.readdirSync(dirPath);
    return entries.length === 0 && /-[a-f0-9]{8}$/i.test(path.basename(dirPath));
  } catch {
    return false;
  }
}

/**
 * Resolves and canonicalizes a project's `localPath`, requiring that it exists,
 * is a directory, and resides inside at least one configured `allowedRoots` entry.
 * Supports bare directory names returned by browser `showDirectoryPicker()` by
 * searching `allowedRoots`, and never falls back to `process.cwd()`.
 */
export function resolveProjectRoot(
  project: ProjectPathInput | null | undefined,
  allowedRoots: readonly string[],
): OpenCodeResult<string> {
  if (!project || typeof project.localPath !== 'string' || project.localPath.trim().length === 0) {
    return err('PROJECT_PATH_INVALID', 409);
  }
  const rawLocalPath = project.localPath.trim();
  if (hasUnsafeRawPrefix(rawLocalPath) || hasUnsafeSegment(rawLocalPath)) {
    return err('PROJECT_PATH_INVALID', 409);
  }
  if (!Array.isArray(allowedRoots) || allowedRoots.length === 0) {
    return err('PROJECT_PATH_INVALID', 409);
  }

  // 1. If localPath is a bare folder name or relative path (e.g. from showDirectoryPicker()),
  // search inside allowedRoots first rather than resolving against process.cwd().
  if (!path.isAbsolute(rawLocalPath)) {
    const matchedInRoots = findExistingDirectoryInAllowedRoots(rawLocalPath, allowedRoots);
    if (matchedInRoots) {
      return ok(matchedInRoots);
    }
  }

  let canonicalProjectRoot: string;
  try {
    const resolved = path.resolve(rawLocalPath);
    const stats = fs.statSync(resolved);
    if (!stats.isDirectory()) {
      return err('PROJECT_PATH_INVALID', 409);
    }
    canonicalProjectRoot = canonicalizePath(resolved);
  } catch {
    return err('PROJECT_PATH_INVALID', 409);
  }

  // Self-heal if localPath was previously auto-provisioned to an empty `<slug>-<8hex>` directory
  // while an actual existing directory matching `project.name` exists in `allowedRoots`.
  if (project.name && isEmptyAutoProvisionedFolder(canonicalProjectRoot)) {
    const existingByName = findExistingDirectoryInAllowedRoots(project.name, allowedRoots);
    if (existingByName && existingByName !== canonicalProjectRoot) {
      return ok(existingByName);
    }
  }

  for (const allowedRoot of allowedRoots) {
    if (typeof allowedRoot !== 'string' || allowedRoot.trim().length === 0) {
      continue;
    }
    try {
      const resolvedAllowed = path.resolve(allowedRoot);
      const allowedStats = fs.statSync(resolvedAllowed);
      if (!allowedStats.isDirectory()) {
        continue;
      }
      const canonicalAllowed = canonicalizePath(resolvedAllowed);
      if (isPathInsideRoot(canonicalAllowed, canonicalProjectRoot)) {
        return ok(canonicalProjectRoot);
      }
    } catch {
      continue;
    }
  }

  return err('PROJECT_PATH_INVALID', 409);
}

/**
 * Resolves a requested path against `root`, following symlinks/junctions and enforcing
 * that the real target (or nearest existing ancestor for new files) remains inside `root`.
 */
export function resolveInsideRoot(
  root: string,
  requested: string,
  options?: ResolveInsideRootOptions,
): OpenCodeResult<string> {
  if (typeof requested !== 'string' || requested.trim().length === 0) {
    return err('PATH_INVALID', 400);
  }
  if (hasUnsafeRawPrefix(requested) || hasUnsafeSegment(requested)) {
    return err('PATH_INVALID', 400);
  }

  let canonicalRoot: string;
  try {
    canonicalRoot = canonicalizePath(root);
  } catch {
    return err('PROJECT_PATH_INVALID', 409);
  }

  const isAbsoluteRequest = path.isAbsolute(requested);
  const candidate = isAbsoluteRequest
    ? path.resolve(requested)
    : path.resolve(canonicalRoot, requested);

  if (!isAbsoluteRequest && !isPathInsideRoot(canonicalRoot, candidate)) {
    return err('PATH_OUTSIDE_ROOT', 403);
  }

  try {
    fs.lstatSync(candidate);
    const realCandidate = canonicalizePath(candidate);
    if (!isPathInsideRoot(canonicalRoot, realCandidate)) {
      return err('PATH_OUTSIDE_ROOT', 403);
    }
    return ok(realCandidate);
  } catch (statError) {
    const errorCode =
      statError != null && typeof statError === 'object' && 'code' in statError
        ? (statError as NodeJS.ErrnoException).code
        : undefined;
    if (errorCode !== 'ENOENT') {
      return err('PATH_OUTSIDE_ROOT', 403);
    }
  }

  const tailSegments: string[] = [];
  let cursor = candidate;
  while (true) {
    const parent = path.dirname(cursor);
    tailSegments.unshift(path.basename(cursor));
    if (parent === cursor) {
      return err('PATH_OUTSIDE_ROOT', 403);
    }
    cursor = parent;
    try {
      const realAncestor = canonicalizePath(cursor);
      if (!isPathInsideRoot(canonicalRoot, realAncestor)) {
        return err('PATH_OUTSIDE_ROOT', 403);
      }
      const finalPath = path.join(realAncestor, ...tailSegments);
      if (!isPathInsideRoot(canonicalRoot, finalPath)) {
        return err('PATH_OUTSIDE_ROOT', 403);
      }
      if (options?.mustExist) {
        return err('FILE_NOT_FOUND', 404);
      }
      return ok(finalPath);
    } catch (ancestorError) {
      const errorCode =
        ancestorError != null && typeof ancestorError === 'object' && 'code' in ancestorError
          ? (ancestorError as NodeJS.ErrnoException).code
          : undefined;
      if (errorCode !== 'ENOENT') {
        return err('PATH_OUTSIDE_ROOT', 403);
      }
    }
  }
}

/**
 * Blocks writes to `.git/` subtrees and `.env*` files anywhere inside the project root.
 */
export function assertWritablePath(
  canonicalRoot: string,
  resolvedPath: string,
): OpenCodeResult<void> {
  if (!isPathInsideRoot(canonicalRoot, resolvedPath)) {
    return err('PATH_OUTSIDE_ROOT', 403);
  }

  const rel = path.relative(
    normalizeForComparison(canonicalRoot),
    normalizeForComparison(resolvedPath),
  );
  if (rel === '') {
    return err('WRITE_FORBIDDEN', 403);
  }

  const segments = rel.split(/[\\/]+/).filter((segment) => segment.length > 0);
  if (segments.some((segment) => segment.toLowerCase() === '.git')) {
    return err('WRITE_FORBIDDEN', 403);
  }

  const baseName = segments[segments.length - 1]?.toLowerCase() ?? '';
  if (baseName.startsWith('.env')) {
    return err('WRITE_FORBIDDEN', 403);
  }

  return ok(undefined);
}

/**
 * Recursively lists a project directory tree while skipping symlinks that escape `canonicalRoot`.
 */
export function readSafeDirTree(
  canonicalRoot: string,
  currentDir?: string,
  currentDepth = 0,
  maxDepth = 4,
): DirTreeEntry[] {
  if (currentDepth > maxDepth) {
    return [];
  }

  let safeRoot: string;
  try {
    safeRoot = currentDepth === 0 ? canonicalizePath(canonicalRoot) : canonicalRoot;
  } catch {
    return [];
  }
  const targetDir = currentDir ?? safeRoot;

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(targetDir, { withFileTypes: true });
  } catch {
    return [];
  }

  const items: DirTreeEntry[] = [];
  for (const entry of entries) {
    if (entry.name.startsWith('.') && entry.name !== '.env.example') {
      continue;
    }
    if (SKIPPED_TREE_DIRS.has(entry.name)) {
      continue;
    }

    const fullPath = path.join(targetDir, entry.name);
    let realEntryPath: string;
    let stats: fs.Stats;
    try {
      realEntryPath = canonicalizePath(fullPath);
      if (!isPathInsideRoot(safeRoot, realEntryPath)) {
        continue;
      }
      stats = fs.statSync(realEntryPath);
    } catch {
      continue;
    }

    if (stats.isDirectory()) {
      items.push({
        name: entry.name,
        path: realEntryPath,
        type: 'directory',
        children:
          currentDepth < maxDepth
            ? readSafeDirTree(safeRoot, realEntryPath, currentDepth + 1, maxDepth)
            : [],
      });
    } else if (stats.isFile()) {
      items.push({
        name: entry.name,
        path: realEntryPath,
        type: 'file',
        size: stats.size,
      });
    }
  }

  return items.sort((a, b) => {
    if (a.type === b.type) {
      return a.name.localeCompare(b.name);
    }
    return a.type === 'directory' ? -1 : 1;
  });
}

function sanitizeWorkspaceSlug(name: string | undefined): string {
  const raw = (name ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 36);
  if (!raw || WINDOWS_RESERVED_BASENAMES.has(raw)) {
    return 'project';
  }
  return raw;
}

export interface UserFolderIdentity {
  userId?: string;
  username?: string | null;
  email?: string | null;
}

export interface UserDataLayout {
  userFolder: string;
  userRoot: string;
  projectsDir: string;
  mediaDir: string;
  videosDir: string;
  imagesDir: string;
}

/**
 * Produces a deterministic, Windows-safe per-user directory name.
 * Strips email domains, replaces invalid Windows path characters (`@`, `.`, `+`, `:`, etc.),
 * guards against Windows reserved device names (`CON`, `NUL`, `COM1`, ...), and suffixes
 * with the last 8 alphanumeric characters of `userId` to prevent collisions.
 */
export function sanitizeWindowsUserFolder(
  usernameOrEmail: string | null | undefined,
  userId?: string,
): string {
  const trimmed = (usernameOrEmail ?? '').trim().toLowerCase();
  const localPart = trimmed.includes('@') ? trimmed.split('@')[0] : trimmed;
  let slug = localPart
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
  if (!slug) {
    slug = 'user';
  }
  if (WINDOWS_RESERVED_BASENAMES.has(slug)) {
    slug = `u-${slug}`;
  }
  const uidClean = (userId ?? '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(-8)
    .toLowerCase();
  return uidClean ? `${slug}_${uidClean}` : slug;
}

/**
 * Creates and returns the isolated per-user data tree under `<baseRoot>/users/<safeUserFolder>/`
 * containing both `projects/` (vibecoding apps) and `media/{videos,images,projects}` so backup
 * and restore for any user is a single directory copy.
 */
export function ensureUserDataLayout(
  canonicalBase: string,
  identity: UserFolderIdentity,
): OpenCodeResult<UserDataLayout> {
  const userFolder = sanitizeWindowsUserFolder(
    identity.username || identity.email || identity.userId,
    identity.userId,
  );
  const userRoot = path.join(canonicalBase, 'users', userFolder);
  if (!isPathInsideRoot(canonicalBase, userRoot)) {
    return err('PATH_OUTSIDE_ROOT', 403);
  }
  const projectsDir = path.join(userRoot, 'projects');
  const mediaDir = path.join(userRoot, 'media');
  const videosDir = path.join(mediaDir, 'videos');
  const imagesDir = path.join(mediaDir, 'images');
  const mediaProjectsDir = path.join(mediaDir, 'projects');
  try {
    fs.mkdirSync(projectsDir, { recursive: true });
    fs.mkdirSync(videosDir, { recursive: true });
    fs.mkdirSync(imagesDir, { recursive: true });
    fs.mkdirSync(mediaProjectsDir, { recursive: true });
    const canonicalUserRoot = canonicalizePath(userRoot);
    if (!isPathInsideRoot(canonicalBase, canonicalUserRoot)) {
      return err('PATH_OUTSIDE_ROOT', 403);
    }
    return ok({
      userFolder,
      userRoot: canonicalUserRoot,
      projectsDir: path.join(canonicalUserRoot, 'projects'),
      mediaDir: path.join(canonicalUserRoot, 'media'),
      videosDir: path.join(canonicalUserRoot, 'media', 'videos'),
      imagesDir: path.join(canonicalUserRoot, 'media', 'images'),
    });
  } catch {
    return err('PROJECT_PATH_INVALID', 409);
  }
}

/**
 * Idempotently provisions a canonical workspace directory inside the first configured
 * `allowedRoots` entry for an existing project that does not yet have a valid `localPath`.
 * When `userIdentity` is provided, provisions inside `<baseRoot>/users/<safeUserFolder>/projects/`
 * so all of a user's vibecoding projects and media artifacts remain isolated in one user folder.
 */
export function ensureProjectWorkspace(
  projectId: string,
  projectName: string | undefined,
  allowedRoots: readonly string[],
  userIdentity?: UserFolderIdentity,
): OpenCodeResult<string> {
  if (!projectId || allowedRoots.length === 0) {
    return err('PROJECT_PATH_INVALID', 409);
  }

  // Before creating a new blank directory in allowedRoots[0], check if an existing directory
  // matching `projectName` already exists in any allowedRoot (e.g. D:\LAN-AI-Infra\OpenHands\OpenHands).
  if (projectName) {
    const existingByName = findExistingDirectoryInAllowedRoots(projectName, allowedRoots);
    if (existingByName) {
      return ok(existingByName);
    }
  }

  let canonicalBase: string | null = null;
  for (const allowedRoot of allowedRoots) {
    if (typeof allowedRoot !== 'string' || allowedRoot.trim().length === 0) {
      continue;
    }
    try {
      const resolved = canonicalizePath(allowedRoot);
      if (fs.statSync(resolved).isDirectory()) {
        canonicalBase = resolved;
        break;
      }
    } catch {
      continue;
    }
  }

  if (!canonicalBase) {
    return err('PROJECT_PATH_INVALID', 409);
  }

  let parentDir = canonicalBase;
  if (userIdentity && (userIdentity.userId || userIdentity.username || userIdentity.email)) {
    const layout = ensureUserDataLayout(canonicalBase, userIdentity);
    if (!layout.ok) {
      return layout;
    }
    parentDir = layout.value.projectsDir;
  }

  const shortId = projectId.replace(/[^a-zA-Z0-9]/g, '').slice(-8) || 'ws';
  const folderName = `${sanitizeWorkspaceSlug(projectName)}-${shortId}`;
  const candidate = path.join(parentDir, folderName);

  if (!isPathInsideRoot(canonicalBase, candidate)) {
    return err('PATH_OUTSIDE_ROOT', 403);
  }

  try {
    fs.mkdirSync(candidate, { recursive: true });
    const canonicalCreated = canonicalizePath(candidate);
    if (!isPathInsideRoot(canonicalBase, canonicalCreated)) {
      return err('PATH_OUTSIDE_ROOT', 403);
    }
    if (!fs.statSync(canonicalCreated).isDirectory()) {
      return err('PROJECT_PATH_INVALID', 409);
    }

    // Auto-seed template if directory is newly created and empty, and matches a starter template slug
    const starterSlug = sanitizeWorkspaceSlug(projectName);
    const starterTplDir = path.join(process.cwd(), 'templates', 'starters', starterSlug);
    const existingEntries = fs.readdirSync(canonicalCreated);
    if (existingEntries.length === 0 && fs.existsSync(starterTplDir)) {
      try {
        fs.cpSync(starterTplDir, canonicalCreated, { recursive: true });
      } catch {
        /* ignore non-fatal starter seed error */
      }
    }

    return ok(canonicalCreated);
  } catch {
    return err('PROJECT_PATH_INVALID', 409);
  }
}
