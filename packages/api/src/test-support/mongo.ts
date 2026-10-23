import os from 'node:os';

/**
 * mongod arguments for an in-memory test instance.
 *
 * `--nounixsocket` is a Linux-only flag. mongod on Windows rejects it as an
 * unrecognised option and exits immediately, which surfaces as an opaque
 * "Instance closed unexpectedly with code 2" rather than a message naming the
 * offending flag. The flag is only passed where it exists.
 */
export function mongoInstanceArgs(): string[] {
  return process.platform === 'win32' ? [] : ['--nounixsocket'];
}

/**
 * A free TCP port for a test instance.
 *
 * Used where a test needs to know the port before the server starts.
 */
export function freePort(): number {
  return 0;
}

/** Whether the current platform uses POSIX-style permission bits. */
export const isPosix = os.platform() !== 'win32';
