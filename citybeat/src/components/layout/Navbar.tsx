import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { Menu, X, Search, User } from "lucide-react";
import { Button } from "../ui/Button";
import { cn } from "../../lib/utils";

export function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location]);

  const navLinks = [
    { name: "Stories", path: "/stories" },
    { name: "Events", path: "/events" },
    { name: "Directory", path: "/directory" },
    { name: "Newsletter", path: "/newsletter" },
    { name: "Partners", path: "/partners" },
  ];

  return (
    <>
      <motion.nav
        className={cn(
          "fixed top-0 left-0 right-0 z-50 transition-all duration-300 border-b border-transparent",
          isScrolled
            ? "bg-brand-dark/80 backdrop-blur-lg py-3 border-white/10 shadow-lg"
            : "bg-transparent py-6"
        )}
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="container mx-auto px-4 flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group">
            <div className="relative overflow-hidden">
              <span className="font-display font-bold text-2xl tracking-tighter text-white group-hover:text-brand-neon transition-colors">
                city<span className="italic text-brand-neon">BEat</span>
              </span>
            </div>
          </Link>

          {/* Desktop Nav */}
          <div 
            className={cn(
              "hidden md:flex items-center gap-8 transition-all duration-500 ease-out",
              isScrolled ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2 pointer-events-none"
            )}
          >
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={cn(
                  "text-sm font-medium uppercase tracking-wider hover:text-brand-neon transition-colors relative group",
                  location.pathname === link.path ? "text-brand-neon" : "text-gray-300"
                )}
              >
                {link.name}
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-brand-neon transition-all group-hover:w-full" />
              </Link>
            ))}
          </div>

          {/* Actions */}
          <div className="hidden md:flex items-center gap-4">
            <Button variant="ghost" size="icon" aria-label="Search">
              <Search className="w-5 h-5" />
            </Button>
            <Link to="/advertise">
              <Button variant="outline" size="sm" className="hidden lg:flex">
                Advertise
              </Button>
            </Link>
            <Button variant="neon" size="sm">
              Subscribe
            </Button>
          </div>

          {/* Mobile Toggle */}
          <button
            className="md:hidden text-white"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X /> : <Menu />}
          </button>
        </div>
      </motion.nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, x: "100%" }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed inset-0 z-40 bg-brand-dark flex flex-col pt-24 px-6 md:hidden"
          >
            <div className="flex flex-col gap-6">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className="text-3xl font-display font-bold text-white hover:text-brand-neon"
                >
                  {link.name}
                </Link>
              ))}
              <Link
                to="/advertise"
                className="text-3xl font-display font-bold text-white hover:text-brand-neon"
              >
                Advertise
              </Link>
              <div className="h-px bg-white/10 my-4" />
              <div className="flex flex-col gap-4">
                <Button variant="neon" size="lg" className="w-full">
                  Subscribe
                </Button>
                <Button variant="outline" size="lg" className="w-full">
                  <Search className="mr-2 w-4 h-4" /> Search
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
