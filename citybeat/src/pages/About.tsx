import { motion } from "motion/react";
import { PageTransition } from "../components/layout/PageTransition";
import { Users, Target, Heart, Zap } from "lucide-react";

export function About() {
  return (
    <PageTransition>
      <div className="container mx-auto px-4 py-32">
        {/* Hero Section */}
        <div className="max-w-4xl mx-auto text-center mb-24">
          <motion.h1 
            className="text-5xl md:text-7xl font-display font-bold text-white mb-6 tracking-tight"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            About <span className="italic text-brand-neon">CityBeat</span>
          </motion.h1>
          <motion.p 
            className="text-xl text-gray-400 font-light leading-relaxed"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            We are the definitive guide to modern living in the metro area. Our mission is to uncover the stories, culture, food, and people that make our city pulse with life.
          </motion.p>
        </div>

        {/* Mission & Vision */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-24 max-w-5xl mx-auto">
          <motion.div 
            className="bg-brand-charcoal border border-white/5 p-8 rounded-2xl"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <div className="w-12 h-12 bg-brand-neon/10 rounded-full flex items-center justify-center mb-6">
              <Target className="text-brand-neon w-6 h-6" />
            </div>
            <h2 className="text-2xl font-display font-bold text-white mb-4">Our Mission</h2>
            <p className="text-gray-400 leading-relaxed">
              To connect urbanites with the heartbeat of their city. We strive to highlight the hidden gems, amplify diverse voices, and provide a curated lens through which to experience urban life.
            </p>
          </motion.div>

          <motion.div 
            className="bg-brand-charcoal border border-white/5 p-8 rounded-2xl"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <div className="w-12 h-12 bg-brand-neon/10 rounded-full flex items-center justify-center mb-6">
              <Zap className="text-brand-neon w-6 h-6" />
            </div>
            <h2 className="text-2xl font-display font-bold text-white mb-4">Our Vision</h2>
            <p className="text-gray-400 leading-relaxed">
              To be the most trusted, vibrant, and essential platform for city dwellers seeking authentic experiences, meaningful connections, and the latest cultural movements.
            </p>
          </motion.div>
        </div>

        {/* Core Values */}
        <div className="mb-24">
          <h2 className="text-3xl md:text-4xl font-display font-bold text-center text-white mb-12">Our Core Values</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {[
              {
                icon: <Heart className="w-6 h-6" />,
                title: "Authenticity",
                description: "We tell real stories about real people. No fluff, just the raw, beautiful truth of city life."
              },
              {
                icon: <Users className="w-6 h-6" />,
                title: "Community",
                description: "We believe in the power of bringing people together and supporting local creators and businesses."
              },
              {
                icon: <Zap className="w-6 h-6" />,
                title: "Innovation",
                description: "We are always looking for new ways to experience, document, and share the urban landscape."
              }
            ].map((value, index) => (
              <motion.div 
                key={value.title}
                className="text-center"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.4 + (index * 0.1) }}
              >
                <div className="w-16 h-16 mx-auto bg-white/5 border border-white/10 rounded-full flex items-center justify-center text-brand-neon mb-6">
                  {value.icon}
                </div>
                <h3 className="text-xl font-bold text-white mb-3">{value.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{value.description}</p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Team Section */}
        <div>
          <h2 className="text-3xl md:text-4xl font-display font-bold text-center text-white mb-12">Meet the Team</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
            {[
              { name: "Sarah Jenkins", role: "Editor in Chief", image: "https://picsum.photos/seed/sarah/300/400" },
              { name: "Marcus Chen", role: "Culture Director", image: "https://picsum.photos/seed/marcus/300/400" },
              { name: "Elena Rodriguez", role: "Food & Drink Editor", image: "https://picsum.photos/seed/elena/300/400" },
              { name: "David Kim", role: "Lead Photographer", image: "https://picsum.photos/seed/david/300/400" }
            ].map((member, index) => (
              <motion.div 
                key={member.name}
                className="group"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: 0.5 + (index * 0.1) }}
              >
                <div className="relative overflow-hidden rounded-xl aspect-[3/4] mb-4">
                  <img 
                    src={member.image} 
                    alt={member.name} 
                    className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </div>
                <h3 className="text-lg font-bold text-white">{member.name}</h3>
                <p className="text-brand-neon text-sm">{member.role}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
