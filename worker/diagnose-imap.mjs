// Run inside imap-sync. Never logs credentials, messages or raw provider errors.
import { lookup } from 'node:dns/promises';
import { connect } from 'node:tls';
import { configuredMailTls } from './mail-tls.mjs';
import { safeImapErrorCode } from './imap-diagnostics.mjs';

const host = process.env.IMAP_HOST?.trim();
const servername = process.env.IMAP_TLS_SERVERNAME?.trim();
const port = Number(process.env.IMAP_PORT || 993);
if (!host || !servername || !Number.isInteger(port) || port < 1 || port > 65535) {
  console.log(JSON.stringify({ status: 'invalid_configuration', required: ['IMAP_HOST', 'IMAP_PORT', 'IMAP_TLS_SERVERNAME'] }));
  process.exit(1);
}
if (process.env.IMAP_SECURE === 'false') {
  console.log(JSON.stringify({ status: 'invalid_configuration', required: ['IMAP_SECURE=true'] }));
  process.exit(1);
}
try {
  const addresses = await Promise.race([
    lookup(host, { all: true }),
    new Promise((_, reject) => { const timer = setTimeout(() => reject(Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' })), 10000); timer.unref(); }),
  ]);
  console.log(JSON.stringify({ stage: 'dns', host, addresses }));
  await new Promise((resolve, reject) => {
    let finished = false;
    const socket = connect({ host, port, ...configuredMailTls(host, host, servername, true) });
    const timer = setTimeout(() => finish(Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' })), 10000);
    function finish(error) {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      socket.destroy();
      if (error) reject(error); else resolve();
    }
    socket.once('secureConnect', () => console.log(JSON.stringify({ stage: 'tls', authorized: socket.authorized, servername })));
    let greeting = '';
    socket.on('data', chunk => {
      greeting += chunk.toString('utf8');
      if (greeting.includes('\n')) {
        if (/^\* (?:OK|PREAUTH)\b/i.test(greeting)) finish();
        else finish(Object.assign(new Error('greeting'), { code: 'IMAP_GREETING_INVALID' }));
      } else if (greeting.length > 4096) finish(Object.assign(new Error('greeting'), { code: 'IMAP_GREETING_INVALID' }));
    });
    socket.once('error', finish);
    socket.once('end', () => finish(Object.assign(new Error('closed'), { code: 'ECONNRESET' })));
  });
  console.log(JSON.stringify({ status: 'reachable', checks: ['dns', 'certificate', 'imap_greeting'], authenticationTested: false }));
} catch (error) {
  console.log(JSON.stringify({ status: 'failed', errorCode: safeImapErrorCode(error) }));
  process.exitCode = 1;
}
