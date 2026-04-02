import React, { useEffect, useState } from "react";
import { ChevronUp } from "lucide-react";

export default function ScrollToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setVisible(window.scrollY > 420);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleClick = () => {
    window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="Scroll to top"
      className={`fixed z-40 right-5 sm:right-6 bottom-24 sm:bottom-28 w-11 h-11 rounded-full border border-white/15 bg-charcoal/85 text-white/75 hover:text-white hover:border-white/30 hover:bg-charcoal-light transition-all duration-200 shadow-lg ${
        visible ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 translate-y-2 pointer-events-none"
      }`}
    >
      <ChevronUp className="w-5 h-5 mx-auto" />
    </button>
  );
}
