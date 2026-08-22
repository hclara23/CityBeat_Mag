// ScrapeFlow — a port of the open-source "ScrapeFlow" visual web-scraping
// workflow engine (github.com/*/scrapeflow: Next.js + Puppeteer + cheerio) into
// CityBeat. The original is a standalone SaaS (Clerk, Prisma/Postgres, Stripe,
// React-Flow canvas); we keep its core model — a workflow is an ordered list of
// task NODES, each with typed INPUTS/OUTPUTS, executed phase-by-phase with
// per-phase logs — and swap the storage for Firestore, the canvas for a JSON
// editor, and add CityBeat-specific sinks (deliver listings straight into the
// business directory, insert-only).
//
// Browser backends: plain fetch (default — the Cloud Run web image has no
// Chromium), the Crawl4AI microservice (`CRAWLER_URL`, services/crawler) for
// JS-rendered / bot-walled pages, or Puppeteer when running locally with
// `SCRAPEFLOW_BROWSER=puppeteer`.

export enum TaskType {
  LAUNCH_BROWSER = 'LAUNCH_BROWSER',
  NAVIGATE_URL = 'NAVIGATE_URL',
  PAGE_TO_HTML = 'PAGE_TO_HTML',
  PAGE_TO_TEXT = 'PAGE_TO_TEXT',
  EXTRACT_TEXT_FROM_ELEMENT = 'EXTRACT_TEXT_FROM_ELEMENT',
  EXTRACT_LINKS = 'EXTRACT_LINKS',
  CRAWL_PAGES = 'CRAWL_PAGES',
  EXTRACT_DATA_WITH_AI = 'EXTRACT_DATA_WITH_AI',
  EXTRACT_LISTINGS_WITH_AI = 'EXTRACT_LISTINGS_WITH_AI',
  DELIVER_TO_DIRECTORY = 'DELIVER_TO_DIRECTORY',
  DELIVER_VIA_WEBHOOK = 'DELIVER_VIA_WEBHOOK',
  WAIT = 'WAIT',
  FETCH_JSON = 'FETCH_JSON',
  MAP_JSON_TO_LISTINGS = 'MAP_JSON_TO_LISTINGS',
  SEARCH_GOOGLE_PLACES = 'SEARCH_GOOGLE_PLACES',
}

export type TaskParamType = 'STRING' | 'NUMBER' | 'BOOLEAN' | 'SELECT' | 'BROWSER_INSTANCE' | 'JSON' | 'LONG_TEXT'

export interface TaskParam {
  name: string
  type: TaskParamType
  helperText?: string
  required?: boolean
  hideHandle?: boolean
  options?: string[]
  defaultValue?: string
}

export interface WorkflowTask {
  type: TaskType
  label: string
  description: string
  isEntryPoint?: boolean
  credits: number
  inputs: readonly TaskParam[]
  outputs: readonly TaskParam[]
}

/** One node (= one execution phase) in a workflow definition. */
export interface WorkflowNode {
  id: string
  type: TaskType
  /**
   * Literal values, or references to earlier outputs as `{{nodeId.Output Name}}`.
   * Inputs that are omitted are auto-wired from the most recent earlier node
   * that produced an output with the SAME name (ScrapeFlow's implicit edge).
   */
  inputs: Record<string, string>
}

export interface WorkflowDefinition {
  nodes: WorkflowNode[]
}

export type WorkflowRunStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED'
export type PhaseStatus = 'CREATED' | 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED'
export type LogLevel = 'info' | 'warn' | 'error'

export interface LogEntry {
  level: LogLevel
  message: string
  ts: string
}

export interface PhaseResult {
  node_id: string
  type: TaskType
  label: string
  number: number
  status: PhaseStatus
  started_at: string | null
  completed_at: string | null
  credits: number
  inputs: Record<string, string>
  outputs: Record<string, string>
  logs: LogEntry[]
}

export interface RunSummary {
  candidates: number
  inserted: number
  skipped_existing: number
  skipped_invalid: number
  pages_crawled: number
  consolidated_groups?: number
}

export interface WorkflowRunResult {
  status: WorkflowRunStatus
  started_at: string
  completed_at: string
  credits_consumed: number
  phases: PhaseResult[]
  summary: RunSummary
  error: string | null
}

export interface WorkflowDoc {
  id: string
  name: string
  description: string | null
  definition: WorkflowDefinition
  enabled: boolean
  /** Minimum hours between cron-triggered runs. */
  interval_hours: number
  run_count: number
  last_run_at: string | null
  last_run_status: WorkflowRunStatus | null
  last_run_id: string | null
  total_inserted: number
  created_at: string
  updated_at: string
}

export interface WorkflowRunDoc extends WorkflowRunResult {
  id: string
  workflow_id: string
  workflow_name: string
  trigger: 'manual' | 'cron'
  dry_run: boolean
  definition: WorkflowDefinition
}

/** A business record as extracted from a page, before normalization. */
export interface ExtractedListing {
  name: string
  category?: string | null
  address?: string | null
  city?: string | null
  state?: string | null
  zip?: string | null
  phone?: string | null
  website?: string | null
  email?: string | null
  description?: string | null
  source_url?: string | null
  /** Real Google place id (from SEARCH_GOOGLE_PLACES) — used as the doc id so enrichment/dedupe line up. */
  google_place_id?: string | null
  latitude?: number | null
  longitude?: number | null
}
