import type { Request, Response, NextFunction } from 'express';

function isLoopbackAddress(addr: string | undefined): boolean {
  if (!addr) return false;
  if (addr === '127.0.0.1' || addr === '::1') return true;
  if (addr === '::ffff:127.0.0.1') return true;
  return false;
}

/** Allow only direct TCP connections from loopback (Mac Studio local browser / curl). */
export function localhostOnly(req: Request, res: Response, next: NextFunction): void {
  const addr = req.socket.remoteAddress;
  if (!isLoopbackAddress(addr)) {
    res.status(403).send('Forbidden');
    return;
  }
  next();
}
