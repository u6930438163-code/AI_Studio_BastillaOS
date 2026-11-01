import { spawn } from 'node:child_process';
import net from 'node:net';

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function findAvailablePort() {
  const probe = net.createServer();
  await new Promise((resolve, reject) => {
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', resolve);
  });
  const { port } = probe.address();
  await new Promise((resolve, reject) => probe.close((error) => error ? reject(error) : resolve()));
  return port;
}

async function main() {
  const port = await findAvailablePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const server = spawn(process.execPath, ['--import', 'tsx', 'server.ts', '--port', String(port)], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      HOST: '127.0.0.1',
      PORT: String(port),
      LLM_PROVIDERS: 'none',
      CHAT_LOCAL_FALLBACK: 'on',
      DISABLE_HMR: 'true',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let logs = '';
  let spawnError;
  const collect = (chunk) => {
    logs = `${logs}${chunk}`.slice(-12000);
  };
  server.stdout.on('data', collect);
  server.stderr.on('data', collect);
  server.once('error', (error) => { spawnError = error; });

  try {
    let pageResponse;
    const deadline = Date.now() + 45000;
    while (Date.now() < deadline) {
      if (spawnError) throw spawnError;
      if (server.exitCode !== null || server.signalCode !== null) {
        throw new Error(`Server exited before becoming ready (${server.exitCode ?? server.signalCode}).`);
      }
      try {
        pageResponse = await fetch(baseUrl, { signal: AbortSignal.timeout(1500) });
        if (pageResponse.ok) break;
      } catch {
        // The server may still be starting.
      }
      await delay(250);
    }

    if (!pageResponse?.ok) throw new Error('The local web page did not become ready within 45 seconds.');
    const html = await pageResponse.text();
    if (!html.toLowerCase().includes('<html')) throw new Error('The root endpoint did not return an HTML document.');
    console.log('PASS: web UI responds with HTML on loopback.');

    const statusResponse = await fetch(`${baseUrl}/api/without_nlp/status`, {
      signal: AbortSignal.timeout(5000),
    });
    const status = await statusResponse.json();
    if (!statusResponse.ok || status.success !== true || !status.sample_analysis) {
      throw new Error('Deterministic engine status endpoint returned an unexpected response.');
    }
    console.log('PASS: deterministic engine status responds without external model services.');
  } catch (error) {
    if (logs.trim()) console.error(logs.trim());
    throw error;
  } finally {
    if (server.exitCode === null && server.signalCode === null) {
      server.kill('SIGTERM');
      await Promise.race([
        new Promise((resolve) => server.once('exit', resolve)),
        delay(3000),
      ]);
      if (server.exitCode === null && server.signalCode === null) {
        server.kill('SIGKILL');
        await new Promise((resolve) => server.once('exit', resolve));
      }
    }
  }
}

main().catch((error) => {
  console.error(`FAIL: ${error.message}`);
  if (error.stack) console.error(error.stack);
  process.exitCode = 1;
});