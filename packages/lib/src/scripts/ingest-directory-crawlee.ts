import dotenv from 'dotenv'
import path from 'path'
import { runDirectoryIngest } from '../directory/crawlee-ingest'

interface CliOptions {
  write: boolean
  limit: number
  categories: string[]
  overpassUrl: string | undefined
}

dotenv.config({ path: path.resolve(process.cwd(), '.env') })
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })
dotenv.config({ path: path.resolve(process.cwd(), '.env.vercel.production.local') })
dotenv.config({ path: path.resolve(process.cwd(), 'apps/web/.env.local') })

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    write: false,
    limit: 100,
    categories: [],
    overpassUrl: process.env.OVERPASS_URL,
  }

  for (const arg of argv) {
    if (arg === '--write') options.write = true
    if (arg.startsWith('--limit=')) options.limit = Math.max(1, Number(arg.split('=')[1]) || options.limit)
    if (arg.startsWith('--category=')) options.categories = [arg.split('=')[1]?.trim()].filter(Boolean) as string[]
    if (arg.startsWith('--categories=')) {
      options.categories = (arg.split('=')[1] || '')
        .split(',')
        .map((category) => category.trim())
        .filter(Boolean)
    }
    if (arg.startsWith('--overpass-url=')) options.overpassUrl = arg.split('=')[1]?.trim() || options.overpassUrl
  }

  return options
}

async function run() {
  const options = parseArgs(process.argv.slice(2))
  const { candidates, inserted } = await runDirectoryIngest(options)

  console.log(`Prepared ${candidates.length} deduped directory candidate(s).`)

  if (!options.write) {
    console.log('Dry run only. Re-run with --write to insert unpublished listings for admin review.')
    console.table(candidates.slice(0, 10).map(({ name, category, address, website }) => ({ name, category, address, website })))
    return
  }

  console.log(`Inserted or updated ${inserted} unpublished listing(s) for admin review.`)
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
