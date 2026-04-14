import { motion } from "motion/react";
import { PageTransition } from "../components/layout/PageTransition";
import { ExternalLink } from "lucide-react";

const PARTNERS = [
  {
    id: "1",
    name: "Metro Arts Council",
    description: "Supporting local artists and cultural initiatives across the city.",
    url: "#",
    logo: "https://picsum.photos/seed/arts/200/100",
  },
  {
    id: "2",
    name: "Downtown Business Alliance",
    description: "Promoting economic growth and community development in the downtown area.",
    url: "#",
    logo: "https://picsum.photos/seed/business/200/100",
  },
  {
    id: "3",
    name: "City Parks Foundation",
    description: "Preserving and enhancing our city's green spaces for everyone to enjoy.",
    url: "#",
    logo: "https://picsum.photos/seed/parks/200/100",
  },
  {
    id: "4",
    name: "Local Eats Collective",
    description: "A coalition of independent restaurants and food vendors.",
    url: "#",
    logo: "https://picsum.photos/seed/food/200/100",
  },
  {
    id: "5",
    name: "Tech Hub Metro",
    description: "Fostering innovation and supporting the local technology ecosystem.",
    url: "#",
    logo: "https://picsum.photos/seed/tech/200/100",
  },
  {
    id: "6",
    name: "Urban Mobility Initiative",
    description: "Advocating for sustainable and accessible transportation options.",
    url: "#",
    logo: "https://picsum.photos/seed/mobility/200/100",
  }
];

export function Partners() {
  return (
    <PageTransition>
      <div className="container mx-auto px-4 py-32">
        <div className="max-w-4xl mx-auto text-center mb-16">
          <motion.h1 
            className="text-5xl md:text-7xl font-display font-bold text-white mb-6 tracking-tight"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            Our Partners
          </motion.h1>
          <motion.p 
            className="text-xl text-gray-400 font-light"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            We collaborate with organizations that share our vision for a vibrant, connected, and thriving city.
          </motion.p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {PARTNERS.map((partner, index) => (
            <motion.a
              key={partner.id}
              href={partner.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group bg-brand-charcoal border border-white/5 rounded-xl p-8 hover:border-brand-neon/50 transition-all duration-300 flex flex-col items-center text-center"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 * (index + 2) }}
            >
              <div className="h-24 mb-6 flex items-center justify-center opacity-70 group-hover:opacity-100 transition-opacity">
                <img 
                  src={partner.logo} 
                  alt={partner.name} 
                  className="max-h-full max-w-full object-contain grayscale group-hover:grayscale-0 transition-all duration-300"
                  referrerPolicy="no-referrer"
                />
              </div>
              <h3 className="text-xl font-display font-bold text-white mb-3 group-hover:text-brand-neon transition-colors flex items-center gap-2">
                {partner.name}
                <ExternalLink size={16} className="opacity-0 group-hover:opacity-100 transition-opacity" />
              </h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                {partner.description}
              </p>
            </motion.a>
          ))}
        </div>
      </div>
    </PageTransition>
  );
}
