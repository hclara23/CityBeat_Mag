import { cn } from "../../lib/utils";

interface AdSlotProps {
  type: "banner" | "card" | "sidebar";
  className?: string;
}

export function AdSlot({ type, className }: AdSlotProps) {
  if (type === "banner") {
    return (
      <div className={cn("w-full py-8 flex justify-center", className)}>
        <div className="w-full max-w-[728px] h-[90px] bg-gray-800 flex items-center justify-center border border-white/5 relative overflow-hidden group">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/diagmonds-light.png')] opacity-10"></div>
          <span className="text-xs text-gray-500 font-mono uppercase tracking-widest z-10">Advertisement</span>
          <div className="absolute top-0 right-0 bg-white/10 text-[10px] px-1 text-gray-400">Sponsored</div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("bg-gray-800/50 border border-white/5 p-6 flex flex-col items-center justify-center text-center relative overflow-hidden", className)}>
       <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/diagmonds-light.png')] opacity-5"></div>
      <span className="text-xs text-gray-500 font-mono uppercase tracking-widest mb-2">Advertisement</span>
      <h4 className="text-white font-display font-bold text-xl mb-2">Support Local Journalism</h4>
      <p className="text-gray-400 text-sm mb-4">Become a member today and get exclusive access.</p>
      <button className="text-brand-neon text-xs font-bold uppercase tracking-wider border border-brand-neon px-4 py-2 hover:bg-brand-neon hover:text-black transition-colors">
        Learn More
      </button>
    </div>
  );
}
