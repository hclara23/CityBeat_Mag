/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Navbar } from "./components/layout/Navbar";
import { Footer } from "./components/layout/Footer";
import { Home } from "./pages/Home";
import { StoryIndex } from "./pages/StoryIndex";
import { StoryDetail } from "./pages/StoryDetail";
import { Events } from "./pages/Events";
import { Newsletter } from "./pages/Newsletter";
import { Advertise } from "./pages/Advertise";
import { Search } from "./pages/Search";
import { Partners } from "./pages/Partners";
import { Directory } from "./pages/Directory";
import { About } from "./pages/About";

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}

export default function App() {
  return (
    <Router>
      <ScrollToTop />
      <div className="min-h-screen bg-brand-dark text-white font-sans selection:bg-brand-neon selection:text-black flex flex-col">
        <Navbar />
        <main className="flex-grow">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/stories" element={<StoryIndex />} />
            <Route path="/stories/:slug" element={<StoryDetail />} />
            <Route path="/events" element={<Events />} />
            <Route path="/newsletter" element={<Newsletter />} />
            <Route path="/advertise" element={<Advertise />} />
            <Route path="/search" element={<Search />} />
            <Route path="/partners" element={<Partners />} />
            <Route path="/directory" element={<Directory />} />
            <Route path="/about" element={<About />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </Router>
  );
}
