import { Link } from "react-router-dom";
import { Facebook, Twitter, Instagram, Youtube } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-brand-charcoal border-t border-white/5 pt-16 pb-8">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
          <div className="col-span-1 md:col-span-1">
            <Link to="/" className="block mb-6">
              <span className="font-display font-bold text-3xl tracking-tighter text-white">
                city<span className="italic text-brand-neon">BEat</span>
              </span>
            </Link>
            <p className="text-gray-400 text-sm leading-relaxed mb-6">
              The definitive guide to modern living in the metro area. Culture, food, nightlife, and the people who make it happen.
            </p>
            <div className="flex gap-4">
              <a href="#" className="text-gray-400 hover:text-white transition-colors"><Twitter size={20} /></a>
              <a href="#" className="text-gray-400 hover:text-white transition-colors"><Instagram size={20} /></a>
              <a href="#" className="text-gray-400 hover:text-white transition-colors"><Facebook size={20} /></a>
              <a href="#" className="text-gray-400 hover:text-white transition-colors"><Youtube size={20} /></a>
            </div>
          </div>

          <div>
            <h4 className="font-display font-bold text-white uppercase tracking-wider mb-6">Sections</h4>
            <ul className="space-y-3">
              <li><Link to="/stories" className="text-gray-400 hover:text-brand-neon transition-colors">Stories</Link></li>
              <li><Link to="/events" className="text-gray-400 hover:text-brand-neon transition-colors">Events</Link></li>
              <li><Link to="/directory" className="text-gray-400 hover:text-brand-neon transition-colors">Directory</Link></li>
              <li><Link to="/newsletter" className="text-gray-400 hover:text-brand-neon transition-colors">Newsletter</Link></li>
              <li><Link to="/search" className="text-gray-400 hover:text-brand-neon transition-colors">Search</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-display font-bold text-white uppercase tracking-wider mb-6">Company</h4>
            <ul className="space-y-3">
              <li><Link to="/about" className="text-gray-400 hover:text-brand-neon transition-colors">About Us</Link></li>
              <li><Link to="/advertise" className="text-gray-400 hover:text-brand-neon transition-colors">Advertise</Link></li>
              <li><Link to="/partners" className="text-gray-400 hover:text-brand-neon transition-colors">Partners</Link></li>
              <li><Link to="/careers" className="text-gray-400 hover:text-brand-neon transition-colors">Careers</Link></li>
              <li><Link to="/contact" className="text-gray-400 hover:text-brand-neon transition-colors">Contact</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-display font-bold text-white uppercase tracking-wider mb-6">Subscribe</h4>
            <p className="text-gray-400 text-sm mb-4">Get the best of the city delivered to your inbox every Friday.</p>
            <form className="flex gap-2">
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
            <Link to="/privacy" className="text-gray-500 hover:text-white text-xs">Privacy Policy</Link>
            <Link to="/terms" className="text-gray-500 hover:text-white text-xs">Terms of Service</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
