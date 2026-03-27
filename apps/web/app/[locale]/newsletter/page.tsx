import { Metadata } from 'next'
import { NewsletterSignup } from '@/src/components/features/NewsletterSignup'

export const metadata: Metadata = {
  title: 'Newsletter | CityBeat',
  description: 'Subscribe to our weekly curated news.',
}

export default async function NewsletterPage() {
  return (
    <main className="min-h-screen bg-brand-dark flex items-center justify-center pt-20">
      <div className="w-full">
        <NewsletterSignup />
        <div className="container mx-auto px-4 py-20 max-w-4xl">
           <div className="bg-brand-charcoal rounded-3xl p-12 border border-white/5">
             <h2 className="text-3xl font-display font-bold text-white mb-6">Archive</h2>
             <p className="text-gray-400 mb-8 italic text-lg leading-relaxed">
               &ldquo;The heartbeat of our city delivered directly to your inbox every Friday morning.&rdquo;
             </p>
             <div className="space-y-6">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex items-center justify-between p-6 rounded-2xl bg-brand-dark/50 border border-white/5 hover:border-brand-neon transition-colors cursor-pointer">
                    <span className="text-gray-400 font-mono text-sm">Edition #0{i}</span>
                    <span className="text-white font-bold">The City at Night</span>
                    <span className="text-brand-neon text-xs font-bold uppercase tracking-widest">Read</span>
                  </div>
                ))}
             </div>
           </div>
        </div>
      </div>
    </main>
  )
}
