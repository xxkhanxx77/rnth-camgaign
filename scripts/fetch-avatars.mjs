import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const csvPath = new URL('../public/renaiss_mar_may_2026_combined.csv', import.meta.url)
const outputPath = new URL('../src/data/avatars.json', import.meta.url)
const execFileAsync = promisify(execFile)

function parseCsv(text) {
  const rows = []
  let row = []
  let current = ''
  let inQuotes = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    const next = text[index + 1]

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"'
        index += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (char === ',' && !inQuotes) {
      row.push(current)
      current = ''
      continue
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') {
        index += 1
      }
      row.push(current)
      rows.push(row)
      row = []
      current = ''
      continue
    }

    current += char
  }

  if (current.length > 0 || row.length > 0) {
    row.push(current)
    rows.push(row)
  }

  const headers = rows.shift()?.map((header) => header.replace(/^\uFEFF/, '')) ?? []
  return rows
    .filter((cells) => cells.some((cell) => cell.trim() !== ''))
    .map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ''])))
}

function decodeNitterImageUrl(url) {
  const match = url.match(/\/pic\/(.+)$/)
  const decoded = decodeURIComponent(match ? match[1] : url)

  if (decoded.startsWith('pbs.twimg.com/')) {
    return `https://${decoded}`
  }

  if (decoded.startsWith('https://pbs.twimg.com/')) {
    return decoded
  }

  return url
}

async function fetchAvatar(username) {
  const { stdout: rss } = await execFileAsync('curl', [
    '-L',
    '-s',
    '--max-time',
    '12',
    '-A',
    'Mozilla/5.0',
    `https://nitter.net/${encodeURIComponent(username)}/rss`,
  ])
  const imageUrl = rss.match(/<image>[\s\S]*?<url>(.*?)<\/url>[\s\S]*?<\/image>/)?.[1]

  if (!imageUrl) {
    throw new Error('missing channel image')
  }

  return decodeNitterImageUrl(imageUrl)
}

const rows = parseCsv(await readFile(csvPath, 'utf8'))
const usernames = [...new Set(rows.map((row) => row.author_username?.trim()).filter(Boolean))].sort((a, b) =>
  a.localeCompare(b),
)

const avatars = {}
const failures = []

for (const username of usernames) {
  try {
    avatars[username] = await fetchAvatar(username)
    process.stdout.write(`ok ${username}\n`)
  } catch (error) {
    failures.push({ username, error: error instanceof Error ? error.message : String(error) })
    process.stdout.write(`miss ${username}\n`)
  }
}

await mkdir(new URL('../src/data/', import.meta.url), { recursive: true })
await writeFile(outputPath, `${JSON.stringify(avatars, null, 2)}\n`)

process.stdout.write(`\nSaved ${Object.keys(avatars).length}/${usernames.length} avatars to src/data/avatars.json\n`)
if (failures.length > 0) {
  process.stdout.write(`${JSON.stringify({ failures }, null, 2)}\n`)
}
