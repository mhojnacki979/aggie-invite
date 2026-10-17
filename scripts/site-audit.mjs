/**
 * Non-invasive exposure audit for a web host.
 *
 *   node scripts/site-audit.mjs https://example.com [...more hosts]
 *
 * Read-only. It issues ordinary GET requests for paths that should never be
 * public, and inspects response headers. It does NOT attempt authentication
 * bypass, injection, brute force, or anything that writes. Run it against
 * hosts you own.
 *
 * Written 2026-10-17 after api.eyesonscore.com was found serving its Laravel
 * log (4.1 GB, 17,372 email addresses, 207 MB downloaded by 12 IPs). The point
 * is to make that class of mistake a 30-second check instead of a discovery.
 */

const SENSITIVE = [
  // secrets and config
  '.env', '.env.local', '.env.backup', '.env.save', '.env.example',
  'config/database.php', 'appsettings.json', 'wp-config.php',
  // dependency manifests (version fingerprinting)
  'composer.json', 'composer.lock', 'package.json', 'package-lock.json', 'yarn.lock',
  // framework internals
  'artisan', 'storage/logs/laravel.log', 'app/Http/Kernel.php', 'routes/api.php',
  'vendor/autoload.php', 'bootstrap/cache/config.php',
  // vcs and editor leftovers
  '.git/config', '.git/HEAD', '.svn/entries', '.DS_Store', '.htaccess',
  // dumps and backups
  'backup.sql', 'dump.sql', 'database.sql', 'backup.zip', 'db.sqlite',
  // build artefacts that can leak source
  '.next/BUILD_ID', 'server.js.map', 'static/js/main.js.map',
  // common admin or debug surfaces
  'phpinfo.php', 'info.php', 'telescope', 'horizon', '_debugbar/open',
]

const SECURITY_HEADERS = [
  'strict-transport-security',
  'x-content-type-options',
  'x-frame-options',
  'content-security-policy',
  'referrer-policy',
]

async function probe(base, path) {
  const url = `${base.replace(/\/$/, '')}/${path}`
  try {
    const res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(15000) })
    let bytes = 0
    if (res.status === 200 && res.body) {
      // Read at most a little, and never print it.
      const reader = res.body.getReader()
      const { value } = await reader.read()
      bytes = value ? value.length : 0
      await reader.cancel()
    }
    return { status: res.status, bytes, type: res.headers.get('content-type') ?? '' }
  } catch {
    return { status: 'ERR', bytes: 0, type: '' }
  }
}

async function auditHost(base) {
  console.log(`\n${'='.repeat(64)}\n${base}\n${'='.repeat(64)}`)

  let root
  try {
    root = await fetch(base, { signal: AbortSignal.timeout(15000) })
  } catch (err) {
    console.log(`  unreachable: ${err.message}`)
    return
  }
  console.log(`root: HTTP ${root.status}  server=${root.headers.get('server') ?? 'n/a'}`)

  console.log('\nsecurity headers')
  for (const h of SECURITY_HEADERS) {
    const v = root.headers.get(h)
    console.log(`  ${v ? 'ok  ' : 'MISS'} ${h}${v ? `: ${v.slice(0, 58)}` : ''}`)
  }
  const powered = root.headers.get('x-powered-by')
  if (powered) console.log(`  INFO x-powered-by leaks the stack: ${powered}`)

  console.log('\nsensitive paths (200 with a body = exposed)')
  const exposed = []
  for (const p of SENSITIVE) {
    const r = await probe(base, p)
    if (r.status === 200 && r.bytes > 0) {
      exposed.push({ p, ...r })
      console.log(`  EXPOSED  ${p}  (${r.bytes}+ bytes, ${r.type.split(';')[0]})`)
    }
  }
  if (exposed.length === 0) console.log('  none of the checked paths are exposed')

  console.log('\nhttp -> https')
  try {
    const plain = await fetch(base.replace(/^https:/, 'http:'), {
      redirect: 'manual', signal: AbortSignal.timeout(15000),
    })
    const loc = plain.headers.get('location') ?? ''
    const ok = plain.status >= 300 && plain.status < 400 && loc.startsWith('https:')
    console.log(`  ${ok ? 'ok  ' : 'CHECK'} ${plain.status}${loc ? ` -> ${loc}` : ''}`)
  } catch {
    console.log('  (no plain-http listener, which is fine)')
  }

  console.log(`\nverdict: ${exposed.length === 0 ? 'no exposed paths found' : `${exposed.length} EXPOSED PATH(S)`}`)
}

const hosts = process.argv.slice(2)
if (hosts.length === 0) {
  console.error('usage: node scripts/site-audit.mjs https://host [...more]')
  process.exit(2)
}
for (const h of hosts) await auditHost(h)
