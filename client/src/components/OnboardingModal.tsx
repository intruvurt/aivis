import React, { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  ArrowRight,
  ArrowLeft,
  Globe,
  Brain,
  Target,
  Users,
  MessageSquare,
  FileText,
  CheckCircle2,
  Loader2,
  BarChart3,
  Search,
  Compass,
  Cpu,
  Plug,
  Terminal,
  Eye,
  Megaphone,
  Sparkles,
  Rocket,
  ChevronRight,
  Bot,
} from "lucide-react";
import { PLATFORM_NARRATIVE } from "../constants/platformNarrative";

const ONBOARDING_KEY = "aivis_onboarding_v2";

export function markOnboardingComplete() {
  localStorage.setItem(ONBOARDING_KEY, "done");
  // Also mark v1 so old check never re-triggers
  localStorage.setItem("aivis_onboarding_v1", "done");
}

export function isOnboardingComplete() {
  return localStorage.getItem(ONBOARDING_KEY) === "done";
}

export function resetOnboarding() {
  localStorage.removeItem(ONBOARDING_KEY);
}

interface OnboardingModalProps {
  onClose: () => void;
  onAnalyze: (url: string) => void;
}

// ─── Animation variants ──────────────────────────────────────────────────────

const pageVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 80 : -80,
    opacity: 0,
    scale: 0.96,
  }),
  center: {
    x: 0,
    opacity: 1,
    scale: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -80 : 80,
    opacity: 0,
    scale: 0.96,
  }),
};

const pageTransition = {
  type: "spring" as const,
  stiffness: 300,
  damping: 30,
};

const stagger = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.15 },
  },
};

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.8 },
  show: { opacity: 1, scale: 1, transition: { duration: 0.4, ease: "easeOut" } },
};

// ─── Shared sub-components ───────────────────────────────────────────────────

function SceneIcon({ icon: Icon, gradient }: { icon: React.ComponentType<{ className?: string }>; gradient: string }) {
  return (
    <motion.div
      variants={scaleIn}
      className="relative mx-auto mb-5"
    >
      <div className={`absolute -inset-4 rounded-full ${gradient} blur-2xl opacity-40 pointer-events-none`} />
      <div className={`relative w-16 h-16 rounded-2xl ${gradient} flex items-center justify-center shadow-lg`}>
        <Icon className="w-8 h-8 text-white" />
      </div>
    </motion.div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  desc,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
  accent: string;
}) {
  return (
    <motion.div
      variants={fadeUp}
      className="flex items-start gap-3 px-4 py-3 rounded-xl bg-charcoal/60 border border-white/8 hover:border-white/15 transition-colors"
    >
      <div className={`flex-shrink-0 w-9 h-9 rounded-lg ${accent} flex items-center justify-center mt-0.5`}>
        <Icon className="w-4.5 h-4.5 text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-white">{title}</p>
        <p className="text-xs text-white/50 mt-0.5 leading-relaxed">{desc}</p>
      </div>
    </motion.div>
  );
}

function NavButton({
  children,
  onClick,
  variant = "secondary",
  disabled = false,
  className = "",
}: {
  children: React.ReactNode;
  onClick: () => void;
  variant?: "primary" | "secondary" | "icon";
  disabled?: boolean;
  className?: string;
}) {
  const base = "rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed";
  const styles = {
    primary: "py-2.5 px-5 bg-gradient-to-r from-violet-600 to-cyan-500 hover:from-violet-500 hover:to-cyan-400 text-white font-semibold shadow-lg shadow-violet-500/20",
    secondary: "py-2.5 px-4 text-white/55 hover:text-white border border-white/10 hover:border-white/20",
    icon: "p-2.5 text-white/55 hover:text-white border border-white/10 hover:border-white/20",
  };
  return (
    <button onClick={onClick} disabled={disabled} className={`${base} ${styles[variant]} ${className}`}>
      {children}
    </button>
  );
}

// ─── Total steps ─────────────────────────────────────────────────────────────

const TOTAL_STEPS = 7;

// ─── Scene 0: Cinematic Welcome ──────────────────────────────────────────────

function SceneWelcome() {
  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="flex flex-col items-center text-center">
      {/* Orbital glow */}
      <motion.div variants={scaleIn} className="relative mb-6">
        <div className="absolute -inset-10 pointer-events-none">
          <div className="absolute -top-4 -left-6 w-28 h-28 rounded-full bg-violet-500/20 blur-3xl animate-pulse" style={{ animationDuration: "4s" }} />
          <div className="absolute -bottom-4 -right-6 w-28 h-28 rounded-full bg-cyan-500/20 blur-3xl animate-pulse" style={{ animationDuration: "5s", animationDelay: "1s" }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full bg-amber-500/10 blur-2xl animate-pulse" style={{ animationDuration: "3.5s", animationDelay: "0.5s" }} />
        </div>
        <div className="relative logo-pill p-3 brand-glow-violet">
          <img
            src="/text-logo.png"
            alt="AiVIS"
            className="w-56 h-16 object-contain drop-shadow-[0_0_40px_rgba(139,92,246,0.4)]"
          />
        </div>
      </motion.div>

      <motion.h2 variants={fadeUp} className="text-2xl font-bold text-white mb-2">
        Welcome to AiVIS
      </motion.h2>
      <motion.p variants={fadeUp} className="text-white/50 text-sm mb-7 max-w-sm leading-relaxed">
        {PLATFORM_NARRATIVE.oneLiner}
      </motion.p>

      <motion.div variants={stagger} className="w-full space-y-2.5 text-left">
        <FeatureCard
          icon={Brain}
          title="AI Visibility Score"
          desc="See whether answer engines can read, trust, and cite your content."
          accent="bg-violet-500/20"
        />
        <FeatureCard
          icon={Target}
          title="Actionable Recommendations"
          desc="8-12 prioritized fixes with measurable before-vs-after impact."
          accent="bg-cyan-500/20"
        />
        <FeatureCard
          icon={Globe}
          title="Full Platform Suite"
          desc="Competitor tracking, citation testing, MCP integrations, and more."
          accent="bg-amber-500/20"
        />
      </motion.div>
    </motion.div>
  );
}

// ─── Scene 1: Command Center ─────────────────────────────────────────────────

function SceneCommandCenter() {
  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="flex flex-col items-center text-center">
      <SceneIcon icon={BarChart3} gradient="bg-gradient-to-br from-violet-600 to-violet-400" />

      <motion.h2 variants={fadeUp} className="text-2xl font-bold text-white mb-2">
        Your Command Center
      </motion.h2>
      <motion.p variants={fadeUp} className="text-white/50 text-sm mb-6 max-w-sm leading-relaxed">
        The Dashboard is your mission control — a real-time view of how AI systems see your content.
      </motion.p>

      <motion.div variants={stagger} className="w-full space-y-2.5 text-left">
        <FeatureCard
          icon={Eye}
          title="0-100 Visibility Score"
          desc="Composite score across 6 categories: content depth, headings, schema, meta, technical SEO, and AI readability."
          accent="bg-violet-500/20"
        />
        <FeatureCard
          icon={Sparkles}
          title="Executive Summary"
          desc="AI-generated overview of exactly what's working, what's broken, and where to focus."
          accent="bg-cyan-500/20"
        />
        <FeatureCard
          icon={BarChart3}
          title="Analytics & Trends"
          desc="Track score changes over time on the Analytics page with interactive charts."
          accent="bg-emerald-500/20"
        />
      </motion.div>
    </motion.div>
  );
}

// ─── Scene 2: First Audit ────────────────────────────────────────────────────

function SceneFirstAudit({ onAnalyze, onNext }: { onAnalyze: (url: string) => void; onNext: () => void }) {
  const [url, setUrl] = useState("");
  const [starting, setStarting] = useState(false);

  const handleAnalyze = useCallback(() => {
    const trimmed = url.trim();
    if (!trimmed) return;
    const normalized = trimmed.match(/^https?:\/\//i) ? trimmed : `https://${trimmed}`;
    setStarting(true);
    setTimeout(() => {
      onAnalyze(normalized);
      onNext();
    }, 300);
  }, [url, onAnalyze, onNext]);

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="flex flex-col items-center text-center">
      <SceneIcon icon={Search} gradient="bg-gradient-to-br from-cyan-600 to-cyan-400" />

      <motion.h2 variants={fadeUp} className="text-2xl font-bold text-white mb-2">
        Run Your First Audit
      </motion.h2>
      <motion.p variants={fadeUp} className="text-white/50 text-sm mb-6 max-w-sm leading-relaxed">
        Enter any public URL and get a full AI visibility report in ~30 seconds.
      </motion.p>

      <motion.div variants={fadeUp} className="w-full">
        <div className="relative mb-3">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
            <Globe className="w-4 h-4 text-white/50" />
          </div>
          <input
            type="url"
            placeholder="https://yourwebsite.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
            className="w-full bg-charcoal/80 border border-white/10 focus:border-violet-500/50 rounded-xl pl-10 pr-4 py-3.5 text-white placeholder-white/35 text-sm outline-none transition-all focus:ring-2 focus:ring-violet-500/20"
            disabled={starting}
            autoFocus
          />
        </div>
        <p className="text-xs text-white/40 mb-5 px-1">
          Works on any public URL: homepage, blog post, or landing page.
        </p>
      </motion.div>

      <motion.div variants={fadeUp} className="w-full">
        <button
          onClick={handleAnalyze}
          disabled={!url.trim() || starting}
          className="w-full py-3 px-5 rounded-xl bg-gradient-to-r from-cyan-600 to-violet-500 hover:from-cyan-500 hover:to-violet-400 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all shadow-lg shadow-cyan-500/20"
        >
          {starting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Starting audit...
            </>
          ) : (
            <>
              <Search className="w-4 h-4" />
              Analyze Now
            </>
          )}
        </button>
        <p className="text-xs text-white/30 mt-3">Or skip this step and run an audit from the Dashboard anytime.</p>
      </motion.div>
    </motion.div>
  );
}

// ─── Scene 3: Research & Intelligence ────────────────────────────────────────

function SceneResearch() {
  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="flex flex-col items-center text-center">
      <SceneIcon icon={Compass} gradient="bg-gradient-to-br from-emerald-600 to-emerald-400" />

      <motion.h2 variants={fadeUp} className="text-2xl font-bold text-white mb-2">
        Research & Intelligence
      </motion.h2>
      <motion.p variants={fadeUp} className="text-white/50 text-sm mb-6 max-w-sm leading-relaxed">
        Discover what AI models find in your market — keywords they associate with topics, niches they surface, and how the competitive landscape looks from an AI lens.
      </motion.p>

      <motion.div variants={stagger} className="w-full space-y-2.5 text-left">
        <FeatureCard
          icon={Search}
          title="Keyword Intelligence"
          desc="See the exact keywords AI systems associate with your content and your competitors'."
          accent="bg-emerald-500/20"
        />
        <FeatureCard
          icon={Compass}
          title="Niche Discovery"
          desc="Find underserved niches where AI answers are thin — your opportunity to own the space."
          accent="bg-teal-500/20"
        />
        <FeatureCard
          icon={Globe}
          title="Competitive Landscape"
          desc="Bird's-eye view of how all players in your market rank in AI visibility."
          accent="bg-lime-500/20"
        />
      </motion.div>
    </motion.div>
  );
}

// ─── Scene 4: AI Power Tools ─────────────────────────────────────────────────

function ScenePowerTools() {
  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="flex flex-col items-center text-center">
      <SceneIcon icon={Cpu} gradient="bg-gradient-to-br from-rose-600 to-orange-400" />

      <motion.h2 variants={fadeUp} className="text-2xl font-bold text-white mb-2">
        AI Power Tools
      </motion.h2>
      <motion.p variants={fadeUp} className="text-white/50 text-sm mb-6 max-w-sm leading-relaxed">
        Reverse-engineer how AI models build answers, connect via MCP protocol, and integrate with your existing stack.
      </motion.p>

      <motion.div variants={stagger} className="w-full space-y-2.5 text-left">
        <FeatureCard
          icon={Cpu}
          title="Reverse Engineer Suite"
          desc="Decompile AI answers, ghost-write competing drafts, diff structures, and simulate answer changes."
          accent="bg-rose-500/20"
        />
        <FeatureCard
          icon={Terminal}
          title="MCP Console"
          desc="Connect AiVIS to AI assistants via Model Context Protocol for real-time audit data."
          accent="bg-orange-500/20"
        />
        <FeatureCard
          icon={Plug}
          title="Integrations Hub"
          desc="WebMCP endpoints and third-party connections to embed visibility data in your workflows."
          accent="bg-amber-500/20"
        />
      </motion.div>
    </motion.div>
  );
}

// ─── Scene 5: Track & Monitor ────────────────────────────────────────────────

function SceneTrackMonitor() {
  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="flex flex-col items-center text-center">
      <SceneIcon icon={Eye} gradient="bg-gradient-to-br from-blue-600 to-indigo-400" />

      <motion.h2 variants={fadeUp} className="text-2xl font-bold text-white mb-2">
        Track & Monitor
      </motion.h2>
      <motion.p variants={fadeUp} className="text-white/50 text-sm mb-6 max-w-sm leading-relaxed">
        Keep tabs on competitors, verify AI citations in real time, and scan for brand mentions across the web.
      </motion.p>

      <motion.div variants={stagger} className="w-full space-y-2.5 text-left">
        <FeatureCard
          icon={Users}
          title="Competitor Tracking"
          desc="Add competitors and compare AI visibility scores, structure quality, and citation presence."
          accent="bg-blue-500/20"
        />
        <FeatureCard
          icon={MessageSquare}
          title="Citation Testing"
          desc="Query DuckDuckGo, Bing, and DDG Instant to verify if AI platforms cite your brand."
          accent="bg-indigo-500/20"
        />
        <FeatureCard
          icon={Megaphone}
          title="Brand Mentions"
          desc="Scan Reddit, Hacker News, Mastodon, Quora, Product Hunt & more for organic mentions."
          accent="bg-purple-500/20"
        />
      </motion.div>
    </motion.div>
  );
}

// ─── Scene 6: Launch ─────────────────────────────────────────────────────────

function SceneLaunch({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();

  const quickLinks = [
    { icon: BarChart3, label: "Dashboard", path: "/", color: "text-violet-400" },
    { icon: Users, label: "Competitors", path: "/competitors", color: "text-blue-400" },
    { icon: MessageSquare, label: "Citations", path: "/citations", color: "text-indigo-400" },
    { icon: Cpu, label: "AI Tools", path: "/reverse-engineer", color: "text-rose-400" },
    { icon: Terminal, label: "MCP Console", path: "/mcp", color: "text-orange-400" },
    { icon: FileText, label: "Reports", path: "/reports", color: "text-emerald-400" },
  ];

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="flex flex-col items-center text-center">
      <SceneIcon icon={Rocket} gradient="bg-gradient-to-br from-violet-600 to-cyan-400" />

      <motion.h2 variants={fadeUp} className="text-2xl font-bold text-white mb-1">
        You're Ready
      </motion.h2>
      <motion.p variants={fadeUp} className="text-white/50 text-sm mb-6 max-w-sm leading-relaxed">
        Your platform is set up. Jump into any tool below, or start from the Dashboard.
      </motion.p>

      <motion.div variants={stagger} className="w-full grid grid-cols-3 gap-2 mb-5">
        {quickLinks.map((link) => {
          const Icon = link.icon;
          return (
            <motion.button
              key={link.path}
              variants={fadeUp}
              onClick={() => { markOnboardingComplete(); navigate(link.path); }}
              className="flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl bg-charcoal/60 border border-white/8 hover:border-white/20 transition-all group"
            >
              <Icon className={`w-5 h-5 ${link.color} group-hover:scale-110 transition-transform`} />
              <span className="text-[11px] text-white/60 group-hover:text-white/80 font-medium transition-colors">{link.label}</span>
            </motion.button>
          );
        })}
      </motion.div>

      <motion.div variants={fadeUp} className="w-full flex items-center gap-2 px-4 py-3 rounded-xl bg-charcoal/40 border border-white/8 mb-5">
        <Bot className="w-5 h-5 text-cyan-400 flex-shrink-0" />
        <p className="text-xs text-white/50 text-left leading-relaxed">
          <span className="text-white/70 font-medium">AiVIS Guide</span> — your AI assistant lives in the bottom-right corner. Ask it anything about the platform.
        </p>
      </motion.div>

      <motion.button
        variants={fadeUp}
        onClick={onClose}
        className="w-full py-3 px-5 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-500 hover:from-violet-500 hover:to-cyan-400 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all shadow-lg shadow-violet-500/20"
      >
        Start Exploring
        <Rocket className="w-4 h-4" />
      </motion.button>
    </motion.div>
  );
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────

function ProgressBar({ step, total }: { step: number; total: number }) {
  const pct = ((step + 1) / total) * 100;
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-1.5 rounded-full bg-charcoal/80 overflow-hidden">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400"
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        />
      </div>
      <span className="text-xs text-white/40 tabular-nums font-medium min-w-[2.5rem] text-right">
        {step + 1}/{total}
      </span>
    </div>
  );
}

// ─── Scene labels (for accessibility) ────────────────────────────────────────

const SCENE_LABELS = [
  "Welcome",
  "Command Center",
  "First Audit",
  "Research & Intel",
  "AI Power Tools",
  "Track & Monitor",
  "Launch",
];

// ─── Main Modal ───────────────────────────────────────────────────────────────

export default function OnboardingModal({ onClose, onAnalyze }: OnboardingModalProps) {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);

  function go(next: number) {
    setDirection(next > step ? 1 : -1);
    setStep(next);
  }

  function handleSkip() {
    markOnboardingComplete();
    onClose();
  }

  function handleClose() {
    markOnboardingComplete();
    onClose();
  }

  const canGoBack = step > 0;
  const canGoForward = step < TOTAL_STEPS - 1;
  const isLaunch = step === TOTAL_STEPS - 1;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      {/* Backdrop with animated gradient */}
      <motion.div
        className="absolute inset-0 bg-black/75 backdrop-blur-lg"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onClick={handleSkip}
      />

      {/* Modal shell */}
      <motion.div
        className="relative z-10 w-full max-w-md"
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
      >
        {/* Outer glow */}
        <div className="absolute -inset-1 bg-gradient-to-r from-violet-500/15 via-cyan-500/10 to-violet-500/15 rounded-3xl blur-xl pointer-events-none" />

        <div className="relative bg-[#1e2433] border border-white/10 rounded-3xl p-6 shadow-2xl overflow-hidden">
          {/* Subtle grid pattern overlay */}
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)", backgroundSize: "24px 24px" }} />

          {/* Header */}
          <div className="relative flex items-center justify-between mb-5">
            <ProgressBar step={step} total={TOTAL_STEPS} />
            <button
              onClick={handleSkip}
              className="ml-3 p-1.5 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/5 transition-all"
              aria-label="Skip tour"
              title="Skip tour"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Scene label */}
          <div className="relative mb-4">
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/25 font-semibold">
              {SCENE_LABELS[step]}
            </p>
          </div>

          {/* Animated scene content */}
          <div className="relative min-h-[380px]">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={step}
                custom={direction}
                variants={pageVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={pageTransition}
              >
                {step === 0 && <SceneWelcome />}
                {step === 1 && <SceneCommandCenter />}
                {step === 2 && <SceneFirstAudit onAnalyze={onAnalyze} onNext={() => go(3)} />}
                {step === 3 && <SceneResearch />}
                {step === 4 && <ScenePowerTools />}
                {step === 5 && <SceneTrackMonitor />}
                {step === 6 && <SceneLaunch onClose={handleClose} />}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Navigation */}
          <div className="relative flex items-center gap-3 mt-4 pt-4 border-t border-white/5">
            {canGoBack && (
              <NavButton variant="icon" onClick={() => go(step - 1)}>
                <ArrowLeft className="w-4 h-4" />
              </NavButton>
            )}
            <NavButton variant="secondary" onClick={handleSkip} className="flex-1">
              Skip Tour
            </NavButton>
            {canGoForward && !isLaunch && step !== 2 && (
              <NavButton variant="primary" onClick={() => go(step + 1)} className="flex-[2]">
                Continue
                <ChevronRight className="w-4 h-4" />
              </NavButton>
            )}
            {step === 2 && (
              <NavButton variant="secondary" onClick={() => go(step + 1)} className="flex-1">
                Skip Audit <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
              </NavButton>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
