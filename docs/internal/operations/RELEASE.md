# Dual-Track Development & Production Release Workflow

This document details the release management architecture for LibreChat in this environment.

---

## 1. Architectural Model: Dual-Track Isolation

To ensure stability in production without hindering ongoing feature development, we maintain two isolated layers:

```
D:\LAN-AI-Infra\LibreChat\
├── [Development Workspace]             <- Full workspace with compilers & dev tools
│   ├── client/src/ & client/dist/      (vite, tailwindcss, react devtools)
│   ├── packages/*/src/ & dist/         (tsdown, tsc, types)
│   ├── api/server/                     (Express backend & custom routes)
│   └── node_modules/                   (~1.5 GB: complete devDependencies & toolchain)
│
└── release/                            <- Ignored by git (.gitignore)
    ├── v0.8.8-prod/                    <- Specific immutable release artifact
    │   ├── client/dist/                (compiled static UI bundle only)
    │   ├── packages/*/dist/            (compiled JS artifacts only)
    │   ├── api/                        (runtime backend server)
    │   └── node_modules/               (~1.0 GB: npm ci --omit=dev, pruned footprint)
    ├── v0.8.9-prod/                    <- Future release artifact
    └── latest                          <- Directory junction pointing to the active release
```

---

## 2. Why This Approach?

1. **Unbroken Development Workflow**:
   - Compiling TypeScript packages (`packages/data-provider`, `packages/data-schemas`, `packages/api`) requires `tsdown` and `typescript`.
   - Building the React client requires `vite`, `@vitejs/plugin-react`, and `tailwindcss`.
   - Running `npm prune --production` inside the main workspace deletes these compilers, breaking subsequent builds until an `npm install` is re-run.
   - Creating versioned releases inside `release/<version>` keeps the development workspace fully functional at all times.

2. **Hardened Production Artifacts**:
   - Dev-only dependencies, test suites (`jest`, `playwright`), and compiler harnesses are excluded from the release bundles.
   - The production dependency footprint is reduced by over **32%** (~497 MB saved).
   - Each release artifact is standalone, self-contained, and can be archived or deployed independently.

3. **Rollback & Version Control**:
   - Having versioned folders (`release/v0.8.8-prod`, `release/v0.8.9-prod`) allows rolling back instantly by updating the `release/latest` directory junction or PM2 start directory.

---

## 3. Creating a New Production Release

Whenever a milestone or feature is completed in the development workspace, package a new version with the automated release script:

```powershell
# From D:\LAN-AI-Infra\LibreChat
.\scripts\create-release.ps1 -Version "v0.8.9-prod"
```

### What the script performs automatically:
1. Compiles all packages and the client bundle (`npm run frontend`).
2. Scaffolds `release/<version>` with runtime code, configurations (`.env`, `librechat.yaml`), and built bundles.
3. Installs pruned production dependencies (`npm ci --omit=dev --ignore-scripts`).
4. Verifies module resolution for all internal workspace packages (`@librechat/api`, `librechat-data-provider`, etc.).
5. Updates the `release/latest` directory junction to point to the new version.

---

## 4. Server Execution & PM2 Operations

### Development Workspace (Active Dev Server):
```powershell
pm2 start api/server/index.js --name librechat
# Or restart:
pm2 restart librechat
```

### Production Release Server:
```powershell
pm2 start D:\LAN-AI-Infra\LibreChat\release\latest\api\server\index.js --name librechat-prod --cwd D:\LAN-AI-Infra\LibreChat\release\latest
```
