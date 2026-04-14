import { motion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";
import { Button } from "../ui/Button";

interface HeroFeatureProps {
  title: string;
  subtitle: string;
  image: string;
  ctaText?: string;
  ctaLink?: string;
}

export function HeroFeature({ title, subtitle, image, ctaText = "Read Story", ctaLink = "#" }: HeroFeatureProps) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  const y = useTransform(scrollYProgress, [0, 1], ["0%", "50%"]);
  const opacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  return (
    <div ref={ref} className="relative h-[90vh] w-full overflow-hidden flex items-center justify-center">
      <motion.div 
        style={{ y, opacity }} 
        className="absolute inset-0 z-0"
      >
        <div className="absolute inset-0 bg-black/40 z-10" />
        <div className="absolute inset-0 bg-gradient-to-t from-brand-dark via-transparent to-transparent z-10" />
        <img src={image} alt={title} className="w-full h-full object-cover" />
      </motion.div>

      <div className="container mx-auto px-4 relative z-20 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-display font-bold text-white mb-6 leading-[0.9] tracking-tight text-balance">
            {title}
          </h1>
          <p className="text-lg md:text-xl text-gray-300 max-w-2xl mx-auto mb-8 font-light leading-relaxed text-balance">
            {subtitle}
          </p>
          <Button variant="neon" size="lg" className="text-base px-8">
            {ctaText}
          </Button>
        </motion.div>
      </div>
    </div>
  );
}
