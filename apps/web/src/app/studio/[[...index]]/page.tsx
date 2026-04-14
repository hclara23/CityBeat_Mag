'use client'

import { NextStudio } from 'next-sanity/studio'
import config from '../../../../../../sanity/sanity.config'

type StudioConfigWithProject = {
  projectId?: unknown
}

const projectConfig = (Array.isArray(config) ? config[0] : config) as StudioConfigWithProject
const projectId = projectConfig?.projectId
const isConfiguredProject =
  typeof projectId === 'string' &&
  /^[a-z0-9-]+$/.test(projectId) &&
  projectId !== 'your_sanity_project_id' &&
  projectId !== 'dev_project'

export default function StudioPage() {
  if (!isConfiguredProject) {
    return (
      <main className="min-h-screen bg-[#080a09] px-6 py-8 text-white">
        <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-5xl flex-col">
          <header className="flex items-center justify-between border-b border-white/10 pb-5">
            <a href="/en" className="text-sm font-black uppercase tracking-[0.22em] text-[#c7ff41]">
              CityBeat
            </a>
            <a
              href="/en/ads"
              className="rounded-md border border-white/15 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-white hover:border-[#c7ff41] hover:text-[#c7ff41]"
            >
              Ads
            </a>
          </header>

          <section className="grid flex-1 items-center gap-8 py-16 md:grid-cols-[1.15fr_0.85fr]">
            <div>
              <p className="mb-5 text-xs font-black uppercase tracking-[0.3em] text-[#ff3f8e]">
                Studio
              </p>
              <h1 className="max-w-3xl text-5xl font-black uppercase leading-[0.92] tracking-tight md:text-7xl">
                Connect Sanity to publish.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-white/72">
                The Studio now lives at citybeatmag.co/studio. Add a real Sanity project ID and
                dataset to the web app environment to open the editor.
              </p>
            </div>

            <div className="border border-white/12 bg-white/[0.04] p-6">
              <p className="text-sm font-black uppercase tracking-[0.2em] text-[#c7ff41]">
                Required env
              </p>
              <div className="mt-6 space-y-3 font-mono text-sm text-white/78">
                <p>NEXT_PUBLIC_SANITY_PROJECT_ID</p>
                <p>NEXT_PUBLIC_SANITY_DATASET</p>
                <p>SANITY_API_TOKEN</p>
              </div>
            </div>
          </section>
        </div>
      </main>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <NextStudio config={config} />
    </div>
  )
}
