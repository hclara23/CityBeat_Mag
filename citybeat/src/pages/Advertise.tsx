import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Check, ArrowRight, BarChart3, Users, MousePointer2 } from "lucide-react";
import { PageTransition } from "../components/layout/PageTransition";
import { Button } from "../components/ui/Button";
import { fetchAPI } from "../lib/api";
import { AdCampaign } from "../lib/types";

export function Advertise() {
  const [step, setStep] = useState(1);
  const [campaigns, setCampaigns] = useState<AdCampaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const data = await fetchAPI<AdCampaign[]>("/campaigns");
        setCampaigns(data);
      } catch (error) {
        console.error("Failed to fetch campaigns", error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) return <div className="min-h-screen bg-brand-dark flex items-center justify-center text-white">Loading...</div>;

  return (
    <PageTransition>
      <div className="pt-32 pb-20 container mx-auto px-4">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h1 className="text-5xl md:text-7xl font-display font-bold text-white mb-6">
            Reach the City's Tastemakers
          </h1>
          <p className="text-xl text-gray-400 leading-relaxed">
            Partner with cityBEat to connect with a highly engaged audience of locals who love food, culture, and events.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20">
          <div className="bg-brand-charcoal p-8 rounded-xl border border-white/5 text-center">
            <Users className="w-8 h-8 text-brand-neon mx-auto mb-4" />
            <h3 className="text-4xl font-bold text-white mb-2">150k+</h3>
            <p className="text-gray-400">Monthly Unique Visitors</p>
          </div>
          <div className="bg-brand-charcoal p-8 rounded-xl border border-white/5 text-center">
            <MousePointer2 className="w-8 h-8 text-brand-magenta mx-auto mb-4" />
            <h3 className="text-4xl font-bold text-white mb-2">3.5%</h3>
            <p className="text-gray-400">Average CTR</p>
          </div>
          <div className="bg-brand-charcoal p-8 rounded-xl border border-white/5 text-center">
            <BarChart3 className="w-8 h-8 text-brand-gold mx-auto mb-4" />
            <h3 className="text-4xl font-bold text-white mb-2">25k+</h3>
            <p className="text-gray-400">Newsletter Subscribers</p>
          </div>
        </div>

        {/* Packages */}
        <h2 className="text-3xl font-display font-bold text-white mb-8 text-center">Advertising Packages</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20">
          {[
            { name: "Sponsored Post", price: "$1,500", features: ["Editorial coverage", "Social promotion", "Newsletter feature"] },
            { name: "Homepage Banner", price: "$2,500", features: ["Top placement", "100k impressions", "High visibility"] },
            { name: "Event Sponsor", price: "$5,000", features: ["Title sponsor", "On-site activation", "Logo placement"] },
          ].map((pkg, i) => (
            <motion.div 
              key={i}
              className="bg-brand-charcoal p-8 rounded-xl border border-white/10 hover:border-brand-neon transition-colors relative overflow-hidden group"
              whileHover={{ y: -5 }}
            >
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <BarChart3 size={64} />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">{pkg.name}</h3>
              <div className="text-3xl font-display font-bold text-brand-neon mb-6">{pkg.price}</div>
              <ul className="space-y-3 mb-8">
                {pkg.features.map((f, j) => (
                  <li key={j} className="flex items-center gap-2 text-gray-300 text-sm">
                    <Check size={16} className="text-brand-neon" /> {f}
                  </li>
                ))}
              </ul>
              <Button variant="outline" className="w-full group-hover:bg-brand-neon group-hover:text-black group-hover:border-transparent transition-all">
                Select Package
              </Button>
            </motion.div>
          ))}
        </div>

        {/* Mock Portal */}
        <div className="bg-gray-900 rounded-2xl border border-white/10 overflow-hidden">
          <div className="bg-black/50 p-4 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <div className="w-3 h-3 rounded-full bg-green-500" />
            </div>
            <span className="text-xs font-mono text-gray-500">Advertiser Portal Preview</span>
          </div>
          
          <div className="p-8">
            <div className="flex gap-8 mb-8 border-b border-white/10 pb-4">
              <button 
                className={`text-sm font-bold uppercase tracking-wider pb-4 -mb-4 border-b-2 transition-colors ${step === 1 ? "text-brand-neon border-brand-neon" : "text-gray-500 border-transparent"}`}
                onClick={() => setStep(1)}
              >
                1. Campaign Setup
              </button>
              <button 
                className={`text-sm font-bold uppercase tracking-wider pb-4 -mb-4 border-b-2 transition-colors ${step === 2 ? "text-brand-neon border-brand-neon" : "text-gray-500 border-transparent"}`}
                onClick={() => setStep(2)}
              >
                2. Dashboard
              </button>
            </div>

            {step === 1 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase text-gray-500 mb-2">Campaign Name</label>
                    <input type="text" className="w-full bg-black border border-white/20 rounded p-3 text-white focus:border-brand-neon outline-none" placeholder="e.g. Summer Launch" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase text-gray-500 mb-2">Placement</label>
                    <select className="w-full bg-black border border-white/20 rounded p-3 text-white focus:border-brand-neon outline-none">
                      <option>Homepage Banner</option>
                      <option>Sponsored Post</option>
                      <option>Newsletter</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase text-gray-500 mb-2">Budget</label>
                    <input type="text" className="w-full bg-black border border-white/20 rounded p-3 text-white focus:border-brand-neon outline-none" placeholder="$2,500" />
                  </div>
                  <Button variant="neon" className="w-full mt-4">Launch Campaign</Button>
                </div>
                <div className="bg-black/30 rounded-xl p-6 border border-white/5 flex items-center justify-center text-gray-500 text-sm">
                  Creative Preview Area
                </div>
              </div>
            ) : (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-bold text-white">Active Campaigns</h3>
                  <Button variant="outline" size="sm">Download Report</Button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="text-gray-500 border-b border-white/10">
                      <tr>
                        <th className="pb-3 font-medium">Client</th>
                        <th className="pb-3 font-medium">Placement</th>
                        <th className="pb-3 font-medium">Status</th>
                        <th className="pb-3 font-medium text-right">Impressions</th>
                        <th className="pb-3 font-medium text-right">Clicks</th>
                        <th className="pb-3 font-medium text-right">Cost</th>
                      </tr>
                    </thead>
                    <tbody className="text-gray-300">
                      {campaigns.map((campaign) => (
                        <tr key={campaign.id} className="border-b border-white/5 last:border-0">
                          <td className="py-4 font-medium text-white">{campaign.clientName}</td>
                          <td className="py-4">{campaign.placement}</td>
                          <td className="py-4"><span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-2"></span>{campaign.status}</td>
                          <td className="py-4 text-right font-mono">{campaign.impressions.toLocaleString()}</td>
                          <td className="py-4 text-right font-mono">{campaign.clicks.toLocaleString()}</td>
                          <td className="py-4 text-right font-mono">${campaign.cost.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
