/**
 * Satchida RAG service — entry point.
 *
 * The service implementation lives in ./routes.mjs. This file exists so the
 * historical entry path (`node src/index.mjs`) keeps working and so tests can
 * import the modules directly without binding a port.
 */
import './routes.mjs';