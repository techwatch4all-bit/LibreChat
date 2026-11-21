import crypto from 'node:crypto';

export interface OpenCodePtyOwnership {
  readonly ptyId: string;
  readonly userId: string;
  readonly tenantId?: string;
  readonly projectId: string;
  readonly projectRoot: string;
  readonly createdAt: number;
}

export interface IssuedConnectTicket {
  readonly connectTicket: string;
  readonly expiresIn: number;
}

interface StoredTicket {
  readonly ptyId: string;
  readonly digest: Buffer;
  readonly expiresAt: number;
}

export interface OpenCodePtyRegistryOptions {
  ticketTtlMs?: number;
  entryTtlMs?: number;
  maxEntries?: number;
}

export interface OpenCodePtyRegistry {
  registerPty: (entry: Omit<OpenCodePtyOwnership, 'createdAt'>) => IssuedConnectTicket;
  issueConnectTicket: (
    ptyId: string,
    userId: string,
    projectId?: string,
  ) => IssuedConnectTicket | null;
  getPtyOwner: (ptyId: string) => OpenCodePtyOwnership | null;
  consumeConnectTicket: (ptyId: string, ticket: string) => OpenCodePtyOwnership | null;
}

const DEFAULT_TICKET_TTL_MS = 60_000;
const DEFAULT_ENTRY_TTL_MS = 12 * 60 * 60_000;
const DEFAULT_MAX_ENTRIES = 1_000;

function sha256(value: string): Buffer {
  return crypto.createHash('sha256').update(value, 'utf8').digest();
}

export function createOpenCodePtyRegistry(
  options?: OpenCodePtyRegistryOptions,
): OpenCodePtyRegistry {
  const ticketTtlMs = options?.ticketTtlMs ?? DEFAULT_TICKET_TTL_MS;
  const entryTtlMs = options?.entryTtlMs ?? DEFAULT_ENTRY_TTL_MS;
  const maxEntries = options?.maxEntries ?? DEFAULT_MAX_ENTRIES;

  const owners = new Map<string, OpenCodePtyOwnership>();
  const tickets = new Map<string, StoredTicket>();

  function prune(now: number): void {
    for (const [id, entry] of owners.entries()) {
      if (now - entry.createdAt > entryTtlMs) {
        owners.delete(id);
      }
    }
    for (const [key, stored] of tickets.entries()) {
      if (now >= stored.expiresAt || !owners.has(stored.ptyId)) {
        tickets.delete(key);
      }
    }
    while (owners.size > maxEntries) {
      const oldestKey = owners.keys().next().value;
      if (oldestKey === undefined) {
        break;
      }
      owners.delete(oldestKey);
    }
  }

  function mintTicket(ptyId: string, now: number): IssuedConnectTicket {
    const connectTicket = crypto.randomBytes(32).toString('base64url');
    const digest = sha256(connectTicket);
    const key = digest.toString('hex');
    tickets.set(key, {
      ptyId,
      digest,
      expiresAt: now + ticketTtlMs,
    });
    return {
      connectTicket,
      expiresIn: Math.ceil(ticketTtlMs / 1000),
    };
  }

  return {
    registerPty(entry) {
      const now = Date.now();
      prune(now);
      owners.set(entry.ptyId, {
        ...entry,
        createdAt: now,
      });
      return mintTicket(entry.ptyId, now);
    },

    issueConnectTicket(ptyId, userId, projectId) {
      const now = Date.now();
      prune(now);
      const entry = owners.get(ptyId);
      if (!entry || entry.userId !== userId) {
        return null;
      }
      if (projectId !== undefined && entry.projectId !== projectId) {
        return null;
      }
      return mintTicket(ptyId, now);
    },

    getPtyOwner(ptyId) {
      const now = Date.now();
      prune(now);
      return owners.get(ptyId) ?? null;
    },

    consumeConnectTicket(ptyId, ticket) {
      if (typeof ticket !== 'string' || ticket.length === 0) {
        return null;
      }
      const now = Date.now();
      prune(now);
      const digest = sha256(ticket);
      const key = digest.toString('hex');
      const stored = tickets.get(key);
      if (!stored) {
        return null;
      }
      tickets.delete(key);
      if (stored.ptyId !== ptyId || now >= stored.expiresAt) {
        return null;
      }
      if (!crypto.timingSafeEqual(stored.digest, digest)) {
        return null;
      }
      return owners.get(ptyId) ?? null;
    },
  };
}
