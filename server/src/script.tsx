import React, { useRef, useState, useEffect } from "react";

export const HeroSection: React.FC = () => {
  const [message, setMessage] = useState("");
  const [showMessage, setShowMessage] = useState(false);
  const [buttonText, setButtonText] = useState("Get Started");
  const featureCardsRef = useRef<Array<HTMLDivElement | null>>([]);
  const headerRef = useRef<HTMLDivElement | null>(null);

  // Parallax effect for header
  useEffect(() => {
    const handleScroll = () => {
      if (headerRef.current) {
        const scrolled = window.scrollY;
        const maxTranslate = 100;
        const translateY = Math.min(scrolled * 0.5, maxTranslate);
        headerRef.current.style.transform = `translateY(${translateY}px)`;
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Animation keyframes (inject once)
  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `
      @keyframes pulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.05); }
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  const handleGetStarted = () => {
    setMessage("Welcome aboard! Your journey begins now. 🚀");
    setShowMessage(true);
    setButtonText("Let's Go! ✨");

    // Animate feature cards
    featureCardsRef.current.forEach((card) => {
      if (card) {
        card.style.animation = "pulse 0.5s ease";
        setTimeout(() => {
          card.style.animation = "";
        }, 500);
      }
    });

    setTimeout(() => {
      setButtonText("Get Started");
    }, 3000);
  };

  return (
    <div>
      <div className="header" ref={headerRef}>
        <h1>AI Search Visibility Engine</h1>
      </div>
      <button
        id="getStartedBtn"
        className="cta-button"
        onClick={handleGetStarted}
      >
        {buttonText}
      </button>
      <div
        id="message"
        className={`message ${showMessage ? "success" : "hidden"}`}
      >
        {message}
      </div>
      <div className="features-grid">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="feature-card"
            ref={(el) => { featureCardsRef.current[i] = el; }}
          >
            Feature {i + 1}
          </div>
        ))}
      </div>
    </div>
  );
};