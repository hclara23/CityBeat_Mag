'use client'

import Link from "next/link";
import { Globe, Mail, MessageSquare, Share2 } from "lucide-react";
import { useParams } from "next/navigation";

export function Footer() {
  const params = useParams();
  const locale = params.locale as string;

  const sections = [
    { name: locale === 'es' ? "Historias" : "Stories", path: `/${locale}/stories` },
    { name: locale === 'es' ? "Eventos" : "Events", path: `/${locale}/events` },
    { name: locale === 'es' ? "Directorio" : "Directory", path: `/${locale}/directory` },
    { name: locale === 'es' ? "Newsletter" : "Newsletter", path: `/${locale}/newsletter` },
  ];

  const company = [
    { name: locale === 'es' ? "Sobre Nosotros" : "About Us", path: `/${locale}/about` },
    { name: locale === 'es' ? "Anunciar" : "Advertise", path: `/${locale}/advertise` },
    { name: locale === 'es' ? "Socios" : "Partners", path: `/${locale}/partners` },
  ];
  return (
    <footer className="bg-brand-charcoal border-t border-white/5 pt-16 pb-8">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
          <div className="col-span-1 md:col-span-1">
            <Link href={`/${locale}`} className="block mb-6">
              <span className="font-display font-bold text-3xl tracking-tighter text-white">
                city<span className="italic text-brand-neon">BEat</span>
              </span>
            </Link>
            <p className="text-gray-400 text-sm leading-relaxed mb-6">
              The definitive guide to modern living in the metro area. Culture, food, nightlife, and the people who make it happen.
            </p>
            <div className="flex gap-4">
              <a href="#" className="text-gray-400 hover:text-white transition-colors"><Globe size={20} /></a>
              <a href="#" className="text-gray-400 hover:text-white transition-colors"><Mail size={20} /></a>
              <a href="#" className="text-gray-400 hover:text-white transition-colors"><MessageSquare size={20} /></a>
              <a href="#" className="text-gray-400 hover:text-white transition-colors"><Share2 size={20} /></a>
            </div>
          </div>

          <div>
            <h4 className="font-display font-bold text-white uppercase tracking-wider mb-6">
              {locale === 'es' ? 'Secciones' : 'Sections'}
            </h4>
            <ul className="space-y-3">
              {sections.map(link => (
                <li key={link.path}>
                  <Link href={link.path} className="text-gray-400 hover:text-brand-neon transition-colors">
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-display font-bold text-white uppercase tracking-wider mb-6">
              {locale === 'es' ? 'Compañía' : 'Company'}
            </h4>
            <ul className="space-y-3">
              {company.map(link => (
                <li key={link.path}>
                  <Link href={link.path} className="text-gray-400 hover:text-brand-neon transition-colors">
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-display font-bold text-white uppercase tracking-wider mb-6">
              {locale === 'es' ? 'Suscribirse' : 'Subscribe'}
            </h4>
            <p className="text-gray-400 text-sm mb-4">
              {locale === 'es' 
                ? 'Recibe lo mejor de la ciudad en tu correo cada viernes.' 
                : 'Get the best of the city delivered to your inbox every Friday.'}
            </p>
            <form className="flex gap-2" onSubmit={(e) => e.preventDefault()}>
              <input 
                type="email" 
                placeholder="Email address" 
                className="bg-black/30 border border-white/10 rounded px-3 py-2 text-sm text-white w-full focus:outline-none focus:border-brand-neon transition-colors"
              />
              <button className="bg-brand-neon text-black font-bold uppercase text-xs px-3 py-2 rounded hover:bg-cyan-400 transition-colors">
                Go
              </button>
            </form>
          </div>
        </div>

        <div className="border-t border-white/5 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-gray-500 text-xs">
            © {new Date().getFullYear()} CityBeat Media Group. All rights reserved.
          </p>
          <div className="flex gap-6">
            <Link href="/privacy" className="text-gray-500 hover:text-white text-xs">Privacy Policy</Link>
            <Link href="/terms" className="text-gray-500 hover:text-white text-xs">Terms of Service</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
