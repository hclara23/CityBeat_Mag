import Link from 'next/link'
import { SiteHeader } from '@/components/citybeat/SiteHeader'
import { adminDb } from '@citybeat/lib/firebase/admin'

export const dynamic = 'force-dynamic'

interface Job {
  id: string
  title: string
  company_name: string
  location: string
  description: string
  apply_url: string
  created_at: string
}

export default async function JobsPage({ params }: { params: { locale: string } }) {
  const locale = params?.locale || 'en'
  // Fetch active paid jobs
  let jobs: Job[] = []
  let error: any = null
  
  try {
    const jobsSnapshot = await adminDb.collection('jobs')
      .where('is_paid', '==', true)
      .where('expires_at', '>', new Date().toISOString())
      .orderBy('expires_at', 'desc')
      .orderBy('created_at', 'desc')
      .get()
      
    jobs = jobsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Job))
  } catch (err: any) {
    console.error('Firestore jobs error:', err)
    error = err
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader />
      <main className="container-wide py-12">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-4">
          <div>
            <h1 className="text-4xl font-display font-black uppercase tracking-widest mb-2">
              Job Board
            </h1>
            <p className="text-white/60 text-lg">
              Find your next role in the city.
            </p>
          </div>
          <Link
            href={`/${locale}/jobs/post`}
            className="bg-brand-neon text-black font-black uppercase tracking-wider text-sm px-6 py-3 rounded hover:bg-white transition"
          >
            Post a Job ($50)
          </Link>
        </div>

        {error && (
          <div className="text-red-500 mb-8 p-4 border border-red-500/20 rounded bg-red-500/10">
            Error loading jobs: {error.message}
          </div>
        )}

        {!jobs || jobs.length === 0 ? (
          <div className="text-white/50 border border-white/10 rounded-xl p-12 text-center bg-white/5">
            <p className="text-xl font-bold mb-2">No active jobs right now.</p>
            <p>Check back later or post a job to reach our community.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {jobs.map((job) => (
              <div key={job.id} className="citybeat-panel p-6 flex flex-col md:flex-row justify-between gap-6 border border-white/10 hover:border-brand-neon/50 transition rounded-xl">
                <div>
                  <h3 className="text-2xl font-bold mb-1 text-brand-neon">{job.title}</h3>
                  <div className="flex gap-4 text-sm text-white/60 mb-4 font-bold uppercase tracking-wider">
                    <span>{job.company_name}</span>
                    <span>•</span>
                    <span>{job.location}</span>
                  </div>
                  <p className="text-white/80 line-clamp-2">{job.description}</p>
                </div>
                <div className="flex-shrink-0 flex items-center">
                  <a
                    href={job.apply_url || '#'}
                    target="_blank"
                    rel="noreferrer"
                    className="bg-brand-gold text-black px-8 py-3 rounded font-black uppercase tracking-widest hover:bg-yellow-400 transition inline-block text-center whitespace-nowrap"
                  >
                    Apply Now
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
