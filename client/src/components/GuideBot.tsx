// client/src/components/GuideBot.tsx
// Refactored: config → constants/guideBotConfig, markdown → utils/renderMarkdown,
// API logic → hooks/useGuideBotChat. This file is now a lean UI shell.
import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageCircle,
  X,
  Send,
  Bot,
  User,
  Sparkles,
  Loader2,
  AlertCircle,
  HelpCircle,
  Ticket,
  CheckCircle2,
  ChevronLeft,
  ListTodo,
  Clock,
  XCircle,
  Mic,
  MicOff,
} from 'lucide-react';

import { getSuggestions, DEFAULT_SUGGESTIONS, getGreeting, RELATED_PAGES, getProactiveHint, PROACTIVE_HINT_DELAY_MS, PROACTIVE_HINT_DISPLAY_MS } from '../constants/guideBotConfig';
import renderMarkdown from '../utils/renderMarkdown';
import { useGuideBotChat } from '../hooks/useGuideBotChat';
import { useSupportTickets } from '../hooks/useSupportTickets';
import { useAgentTasks, taskLabel, statusMeta } from '../hooks/useAgentTasks';
import { SUPPORT_TICKET_CATEGORIES } from '@shared/types';
import type { SupportTicketCategory, SupportTicketPriority } from '@shared/types';

/* ────────────────────────────────────────────────────────────────────────────
 * GuideBot Component
 * ──────────────────────────────────────────────────────────────────────────── */
export default function GuideBot() {
  const { pathname } = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [hasUnread, setHasUnread] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Voice input
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const supportsVoice = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const toggleVoice = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) return;

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = navigator.language || 'en-US';
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = Array.from(event.results)
        .map((r) => r[0].transcript)
        .join('');
      setInput(transcript);
      // Auto-submit on final result
      if (event.results[event.results.length - 1].isFinal) {
        setIsListening(false);
      }
    };

    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  };

  // Ticket creation mini-form state
  const [showTicketForm, setShowTicketForm] = useState(false);
  const [showTasks, setShowTasks] = useState(false);
  const [tkSubject, setTkSubject] = useState('');
  const [tkCategory, setTkCategory] = useState<SupportTicketCategory>('general');
  const [tkPriority, setTkPriority] = useState<SupportTicketPriority>('normal');
  const [tkDescription, setTkDescription] = useState('');
  const [tkSuccess, setTkSuccess] = useState<string | null>(null);

  const { messages, isLoading, error, usageInfo, isFallbackMode, sendMessage, clearChat, token } =
    useGuideBotChat(pathname);
  const { createTicket, isLoading: tkLoading, error: tkError, clearError: tkClearError } = useSupportTickets();
  const { tasks, isLoading: tasksLoading, cancelTask } = useAgentTasks(isOpen && showTasks);

  const [suggestions, setSuggestions] = useState<string[]>(() => getSuggestions(pathname));
  const relatedPages = RELATED_PAGES[pathname] || [];
  const greeting = getGreeting(pathname);

  // ── Proactive thought bubble ──
  const [proactiveHint, setProactiveHint] = useState<string | null>(null);
  const [hintDismissed, setHintDismissed] = useState<Set<string>>(() => new Set());
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hintHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Clear any pending timers on page change or when chat opens
    if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
    if (hintHideTimerRef.current) clearTimeout(hintHideTimerRef.current);
    setProactiveHint(null);

    // Only show hints when chat is closed and user hasn't dismissed on this page
    if (isOpen || hintDismissed.has(pathname)) return;

    hintTimerRef.current = setTimeout(() => {
      if (isOpen) return; // re-check in case they opened chat during timeout
      const hint = getProactiveHint(pathname);
      if (!hint) return;
      setProactiveHint(hint);

      // Auto-hide after display duration
      hintHideTimerRef.current = setTimeout(() => {
        setProactiveHint(null);
      }, PROACTIVE_HINT_DISPLAY_MS);
    }, PROACTIVE_HINT_DELAY_MS);

    return () => {
      if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
      if (hintHideTimerRef.current) clearTimeout(hintHideTimerRef.current);
    };
  }, [pathname, isOpen, hintDismissed]);

  const dismissHint = () => {
    setProactiveHint(null);
    if (hintHideTimerRef.current) clearTimeout(hintHideTimerRef.current);
    setHintDismissed((prev) => new Set(prev).add(pathname));
  };

  // Rotate suggestions when page changes or chat is cleared
  useEffect(() => {
    setSuggestions(getSuggestions(pathname));
  }, [pathname]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 300);
  }, [isOpen]);

  // Clear unread badge when opened
  useEffect(() => {
    if (isOpen) setHasUnread(false);
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    sendMessage(input).then((sent) => {
      if (sent && !isOpen) setHasUnread(true);
    });
    setInput('');
  };

  const handleSuggestion = (text: string) => {
    sendMessage(text).then((sent) => {
      if (sent && !isOpen) setHasUnread(true);
    });
  };

  const handlePasteShareUrl = async () => {
    try {
      if (!navigator?.clipboard?.readText) {
        setInput('Read results from this share URL: ');
        inputRef.current?.focus();
        return;
      }

      const clipText = (await navigator.clipboard.readText()).trim();
      if (!clipText) {
        setInput('Read results from this share URL: ');
        inputRef.current?.focus();
        return;
      }

      const match = clipText.match(/https?:\/\/[^\s]+\/(report\/[A-Za-z0-9._-]+|api\/public\/audits\/[A-Za-z0-9._-]+)/i);
      if (!match) {
        setInput('Read results from this share URL: ');
        inputRef.current?.focus();
        return;
      }

      const prompt = `Read results from this share URL: ${clipText}`;
      sendMessage(prompt).then((sent) => {
        if (sent && !isOpen) setHasUnread(true);
      });
    } catch {
      setInput('Read results from this share URL: ');
      inputRef.current?.focus();
    }
  };

  const openTicketFromChat = () => {
    const userMsgs = messages.filter((m) => m.role === 'user').slice(-3);
    const prefill = userMsgs.map((m) => m.content).join('\n\n');
    setTkDescription(prefill);
    setTkSubject('');
    setTkCategory('general');
    setTkPriority('normal');
    setTkSuccess(null);
    tkClearError();
    setShowTicketForm(true);
  };

  const handleTicketSubmit = async () => {
    if (!tkSubject.trim() || !tkDescription.trim()) return;
    const result = await createTicket({
      subject: tkSubject.trim(),
      category: tkCategory,
      priority: tkPriority,
      description: tkDescription.trim(),
    });
    if (result) {
      setTkSuccess(`Ticket ${result.ticket_number} created!`);
      setTimeout(() => {
        setShowTicketForm(false);
        setTkSuccess(null);
      }, 2500);
    }
  };

  // Don't render on auth page
  if (pathname === '/auth') return null;

  return (
    <>
      {/* ── Floating trigger button ── */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
            onClick={() => { dismissHint(); setIsOpen(true); }}
            className="fixed bottom-20 right-6 z-[45] w-16 h-16 rounded-full overflow-hidden shadow-lg shadow-black/30 hover:shadow-cyan-400/20 hover:scale-105 transition-all duration-200 group ring-2 ring-white/10 hover:ring-cyan-400/30"
            aria-label="Open BIX"
          >
            <img src="/bix-agent.png" alt="BIX guide agent" className="w-full h-full object-cover" loading="lazy" decoding="async" />
            <div className="absolute bottom-0 inset-x-0 bg-black/70 py-0.5">
              <span className="block text-center text-[9px] font-bold tracking-[0.15em] text-cyan-300">BIX</span>
            </div>
            {hasUnread && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-cyan-400 rounded-full border-2 border-[#0d1117] animate-pulse" />
            )}
          </motion.button>
        )}
      </AnimatePresence>

      {/* ── Proactive thought bubble ── */}
      <AnimatePresence>
        {!isOpen && proactiveHint && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="fixed bottom-[7.5rem] right-6 z-50 max-w-[260px]"
          >
            <div className="relative rounded-xl border border-cyan-400/20 bg-[#1e2736] px-3.5 py-2.5 shadow-lg shadow-black/30">
              <button
                onClick={dismissHint}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/20 transition-colors"
                aria-label="Dismiss hint"
              >
                <X className="h-3 w-3" />
              </button>
              <div className="flex items-start gap-2">
                <Sparkles className="h-3.5 w-3.5 text-cyan-400 shrink-0 mt-0.5" />
                <p className="text-xs text-white/75 leading-relaxed">{proactiveHint}</p>
              </div>
              {/* Speech bubble tail */}
              <div className="absolute -bottom-1.5 right-6 w-3 h-3 rotate-45 border-r border-b border-cyan-400/20 bg-[#1e2736]" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Chat panel ── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="fixed bottom-20 right-6 z-50 w-[380px] max-w-[calc(100vw-2rem)] h-[560px] max-h-[calc(100vh-3rem)] bg-[#323a4c] border border-white/12 rounded-2xl shadow-2xl shadow-black/40 flex flex-col overflow-hidden"
          >
            {/* ── Header ── */}
            <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-white/20 to-white/12 border-b border-white/12 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full overflow-hidden ring-1 ring-white/15 shrink-0">
                  <img src="/bix-agent.png" alt="BIX guide agent" className="w-full h-full object-cover" loading="lazy" decoding="async" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white flex items-center gap-1.5">
                    BIX
                    <span className="text-[9px] font-medium tracking-wide text-cyan-300/70 uppercase">Boundaries in Excess</span>
                  </h3>
                  <p className="text-[11px] text-white/55 leading-tight flex items-center gap-1.5">
                    <span>Platform agent</span>
                    {isFallbackMode && (
                      <span className="px-1.5 py-0.5 rounded-full bg-charcoal-light border border-white/10 text-white/70 text-[10px] font-medium">
                        Fallback mode
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {token && (
                  <button
                    onClick={() => { setShowTasks(!showTasks); setShowTicketForm(false); }}
                    className={`p-1.5 hover:bg-charcoal/60 rounded-full transition-colors text-xs ${showTasks ? 'text-cyan-300' : 'text-white/55 hover:text-white/85'}`}
                    title="My Tasks"
                  >
                    <ListTodo className="w-4 h-4" />
                  </button>
                )}
                {messages.length > 0 && (
                  <button
                    onClick={() => { clearChat(); setSuggestions(getSuggestions(pathname)); }}
                    className="p-1.5 text-white/55 hover:text-white/85 hover:bg-charcoal/60 rounded-full transition-colors text-xs"
                    title="Clear chat"
                  >
                    Clear
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 text-white/55 hover:text-white hover:bg-charcoal/60 rounded-full transition-colors"
                  aria-label="Close assistant"
                >
                  <X className="w-4.5 h-4.5" />
                </button>
              </div>
            </div>

            {/* ── Ticket creation form (overlay) ── */}
            {showTicketForm ? (
              <div
                className="flex-1 overflow-y-auto px-4 py-3 space-y-3"
                style={{ scrollbarWidth: 'thin', scrollbarColor: '#475569 transparent' }}
              >
                <button
                  onClick={() => setShowTicketForm(false)}
                  className="flex items-center gap-1 text-xs text-white/50 hover:text-white/70 transition-colors mb-1"
                >
                  <ChevronLeft className="w-3 h-3" />
                  Back to chat
                </button>

                {tkSuccess ? (
                  <div className="flex flex-col items-center gap-2 py-6">
                    <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                    <p className="text-sm text-emerald-300 font-medium">{tkSuccess}</p>
                  </div>
                ) : (
                  <>
                    <p className="text-xs text-white/55 font-medium">Create Support Ticket</p>
                    <input
                      value={tkSubject}
                      onChange={(e) => setTkSubject(e.target.value)}
                      placeholder="Subject"
                      maxLength={200}
                      className="w-full rounded-lg bg-white/[0.06] border border-white/10 px-3 py-2 text-xs text-white placeholder:text-white/35 focus:outline-none focus:ring-1 focus:ring-white/20"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={tkCategory}
                        onChange={(e) => setTkCategory(e.target.value as SupportTicketCategory)}
                        className="rounded-lg bg-white/[0.06] border border-white/10 px-2 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-white/20"
                      >
                        {SUPPORT_TICKET_CATEGORIES.map((c) => (
                          <option key={c.value} value={c.value} className="bg-[#323a4c]">{c.label}</option>
                        ))}
                      </select>
                      <select
                        value={tkPriority}
                        onChange={(e) => setTkPriority(e.target.value as SupportTicketPriority)}
                        className="rounded-lg bg-white/[0.06] border border-white/10 px-2 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-white/20"
                      >
                        <option value="low" className="bg-[#323a4c]">Low</option>
                        <option value="normal" className="bg-[#323a4c]">Normal</option>
                        <option value="high" className="bg-[#323a4c]">High</option>
                        <option value="urgent" className="bg-[#323a4c]">Urgent</option>
                      </select>
                    </div>
                    <textarea
                      value={tkDescription}
                      onChange={(e) => setTkDescription(e.target.value)}
                      placeholder="Describe the issue..."
                      maxLength={5000}
                      rows={5}
                      className="w-full rounded-lg bg-white/[0.06] border border-white/10 px-3 py-2 text-xs text-white placeholder:text-white/35 focus:outline-none focus:ring-1 focus:ring-white/20 resize-none"
                    />
                    {tkError && (
                      <p className="text-[10px] text-red-300">{tkError}</p>
                    )}
                    <button
                      onClick={handleTicketSubmit}
                      disabled={tkLoading || tkSubject.trim().length < 3 || tkDescription.trim().length < 10}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-cyan-500/15 border border-cyan-400/25 text-cyan-300 text-xs font-medium hover:bg-cyan-500/25 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    >
                      {tkLoading ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Send className="w-3.5 h-3.5" />
                      )}
                      Submit Ticket
                    </button>
                  </>
                )}
              </div>
            ) : showTasks ? (
            /* ── Tasks panel ── */
            <div
              className="flex-1 overflow-y-auto px-4 py-3 space-y-2"
              style={{ scrollbarWidth: 'thin', scrollbarColor: '#475569 transparent' }}
            >
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-white/55 font-medium">My Tasks</p>
                <button
                  onClick={() => setShowTasks(false)}
                  className="flex items-center gap-1 text-[10px] text-white/40 hover:text-white/60 transition-colors"
                >
                  <ChevronLeft className="w-3 h-3" />
                  Back
                </button>
              </div>

              {tasksLoading && tasks.length === 0 && (
                <div className="flex items-center gap-2 py-6 justify-center">
                  <Loader2 className="w-4 h-4 text-white/50 animate-spin" />
                  <span className="text-xs text-white/50">Loading tasks…</span>
                </div>
              )}

              {!tasksLoading && tasks.length === 0 && (
                <div className="text-center py-8">
                  <ListTodo className="w-8 h-8 text-white/20 mx-auto mb-2" />
                  <p className="text-xs text-white/40">No tasks yet</p>
                  <p className="text-[10px] text-white/30 mt-1">
                    Try: &quot;schedule audit for example.com&quot;
                  </p>
                </div>
              )}

              {tasks.map((task) => {
                const meta = statusMeta(task.status);
                return (
                  <div
                    key={task.id}
                    className="rounded-lg bg-white/[0.04] border border-white/8 px-3 py-2.5 space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-white/80">
                        {taskLabel(task.task_type)}
                      </span>
                      <span className={`text-[10px] font-medium ${meta.color}`}>
                        {task.status === 'running' && (
                          <Loader2 className="w-3 h-3 inline mr-1 animate-spin" />
                        )}
                        {task.status === 'completed' && (
                          <CheckCircle2 className="w-3 h-3 inline mr-1" />
                        )}
                        {task.status === 'failed' && (
                          <XCircle className="w-3 h-3 inline mr-1" />
                        )}
                        {task.status === 'pending' && (
                          <Clock className="w-3 h-3 inline mr-1" />
                        )}
                        {meta.label}
                      </span>
                    </div>

                    {/* Payload summary */}
                    <p className="text-[10px] text-white/40 truncate">
                      {task.payload?.urls
                        ? (task.payload.urls as string[]).slice(0, 2).join(', ')
                        : task.payload?.query
                          ? String(task.payload.query)
                          : task.payload?.url
                            ? String(task.payload.url)
                            : task.payload?.brand
                              ? String(task.payload.brand)
                              : ''}
                    </p>

                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-white/30">
                        {new Date(task.created_at).toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      {task.status === 'pending' && (
                        <button
                          onClick={() => cancelTask(task.id)}
                          className="text-[10px] text-red-300/60 hover:text-red-300 transition-colors"
                        >
                          Cancel
                        </button>
                      )}
                    </div>

                    {task.error && (
                      <p className="text-[10px] text-red-300/70 truncate">{task.error}</p>
                    )}
                  </div>
                );
              })}
            </div>
            ) : (
            /* ── Messages area ── */
            <div
              className="flex-1 overflow-y-auto px-4 py-3 space-y-3 scroll-smooth"
              style={{ scrollbarWidth: 'thin', scrollbarColor: '#475569 transparent' }}
              role="log"
              aria-label="Chat messages"
              aria-live="polite"
            >
              {/* Welcome message */}
              <div className="flex gap-2.5">
                <div className="w-7 h-7 social-icon-chip bg-gradient-to-br from-white/28 to-white/15 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="w-3.5 h-3.5 text-white" />
                </div>
                <div className="bg-gradient-to-br from-cyan-500/10 to-transparent border border-cyan-400/15 rounded-xl rounded-tl-md px-3.5 py-2.5 max-w-[280px]">
                  <p className="text-sm text-cyan-100/85 leading-relaxed">{greeting}</p>
                </div>
              </div>

              {/* Quick suggestions (only when no messages yet) */}
              {messages.length === 0 && (
                <>
                  <div className="flex flex-wrap gap-2 pl-9">
                    {suggestions.map((s) => (
                      <button
                        key={s}
                        onClick={() => handleSuggestion(s)}
                        className="text-xs px-3 py-1.5 rounded-full bg-charcoal-light border border-white/10 text-white/85 hover:bg-charcoal/80 hover:border-white/12 transition-all duration-150"
                      >
                        {s}
                      </button>
                    ))}
                    <button
                      onClick={() => setSuggestions(getSuggestions(pathname))}
                      className="text-[10px] px-2.5 py-1.5 rounded-full border border-white/8 text-white/40 hover:text-white/70 hover:border-white/15 transition-all duration-150"
                      title="Show different suggestions"
                    >
                      ↻ More
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2 pl-9 pt-1">
                    <button
                      onClick={handlePasteShareUrl}
                      className="text-xs px-3 py-1.5 rounded-full border border-emerald-300/35 bg-emerald-500/12 text-emerald-200 hover:bg-emerald-500/18 transition-all duration-150"
                    >
                      Paste share URL
                    </button>
                    <button
                      onClick={() => setInput('Read results from this share URL: https://aivis.biz/report/')}
                      className="text-xs px-3 py-1.5 rounded-full border border-white/10 bg-charcoal-light text-white/80 hover:text-white hover:bg-charcoal/80 transition-all duration-150"
                    >
                      Share URL template
                    </button>
                  </div>
                  {relatedPages.length > 0 && (
                    <div className="pl-9 pt-2">
                      <p className="text-[10px] text-white/35 mb-1.5">Related pages</p>
                      <div className="flex flex-wrap gap-1.5">
                        {relatedPages.map((rp) => (
                          <Link
                            key={rp.path}
                            to={rp.path}
                            className="text-[10px] px-2.5 py-1 rounded-full border border-cyan-400/15 bg-cyan-500/8 text-cyan-300/70 hover:text-cyan-200 hover:bg-cyan-500/15 transition-all duration-150"
                          >
                            {rp.label} →
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Chat messages */}
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                >
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                      msg.role === 'user'
                        ? 'bg-gradient-to-br from-white/22 to-white/14'
                        : 'bg-gradient-to-br from-white/28 to-white/15'
                    }`}
                  >
                    {msg.role === 'user' ? (
                      <User className="w-3.5 h-3.5 text-white" />
                    ) : (
                      <Bot className="w-3.5 h-3.5 text-white" />
                    )}
                  </div>
                  <div
                    className={`rounded-xl px-3.5 py-2.5 max-w-[280px] ${
                      msg.role === 'user'
                        ? 'bg-gradient-to-br from-white/22/80 to-white/14/80 border border-white/10 rounded-tr-md'
                        : 'bg-gradient-to-br from-cyan-500/10 to-transparent border border-cyan-400/15 rounded-tl-md'
                    }`}
                  >
                    {msg.role === 'assistant' ? (
                      <div className="[&_p]:text-cyan-100/85 [&_strong]:text-cyan-200 [&_a]:text-cyan-300 [&_li]:text-cyan-100/85">
                        {renderMarkdown(msg.content)}
                      </div>
                    ) : (
                      <p className="text-sm text-white leading-relaxed">{msg.content}</p>
                    )}
                  </div>
                </div>
              ))}

              {/* Loading indicator */}
              {isLoading && (
                <div className="flex gap-2.5">
                  <div className="w-7 h-7 social-icon-chip bg-gradient-to-br from-white/28 to-white/15 flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="w-3.5 h-3.5 text-white" />
                  </div>
                  <div className="bg-gradient-to-br from-cyan-500/10 to-transparent border border-cyan-400/15 rounded-xl rounded-tl-md px-3.5 py-2.5">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-3.5 h-3.5 text-cyan-300/85 animate-spin" />
                      <span className="text-xs text-cyan-200/55">Thinking…</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="flex items-start gap-2 mx-2 p-2.5 rounded-lg card-charcoal">
                  <AlertCircle className="w-4 h-4 text-white/80 shrink-0 mt-0.5" />
                  <p className="text-xs text-white/80 leading-relaxed">{error}</p>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
            )}

            {/* ── Usage indicator ── */}
            {usageInfo && usageInfo.limit > 0 && (
              <div className="px-4 py-1.5 border-t border-white/10 bg-charcoal-deep">
                <div className="flex items-center justify-between text-[10px] text-white/60">
                  <span>{usageInfo.used}/{usageInfo.limit} messages today</span>
                  <span>{Math.max(0, usageInfo.limit - usageInfo.used)} remaining</span>
                </div>
                <div className="w-full h-1 bg-charcoal-light rounded-full mt-1 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-white/28 to-white/15 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, (usageInfo.used / usageInfo.limit) * 100)}%` }}
                  />
                </div>
              </div>
            )}

            {/* ── Input area ── */}
            <form
              onSubmit={handleSubmit}
              className="px-3 py-3 border-t border-white/12 bg-charcoal-solid shrink-0"
            >
              {!token ? (
                <div className="text-center py-2">
                  <p className="text-xs text-white/55 mb-2">Sign in to talk to BIX</p>
                  <a
                    href="/auth?mode=signin"
                    className="text-xs text-cyan-300 hover:text-cyan-200 font-medium transition-colors"
                  >
                    Sign in →
                  </a>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Send a URL to audit, or tell me what to do…"
                    maxLength={1000}
                    required
                    disabled={isLoading}
                    enterKeyHint="send"
                    className="flex-1 field-vivid rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-white/50 border border-white/10 focus:outline-none focus:border-[#f97316]/45 focus:ring-1 focus:ring-[#0ea5e9]/40 disabled:opacity-50 transition-all"
                  />
                  {supportsVoice && (
                    <button
                      type="button"
                      onClick={toggleVoice}
                      className={`p-2.5 rounded-full transition-all duration-200 shrink-0 ${
                        isListening
                          ? 'bg-red-500/20 text-red-400 ring-2 ring-red-400/40 animate-pulse'
                          : 'social-icon-chip bg-gradient-to-br from-white/15 to-white/8 text-white/60 hover:text-white hover:shadow-lg hover:shadow-white/10'
                      }`}
                      aria-label={isListening ? 'Stop listening' : 'Voice input'}
                      title={isListening ? 'Stop listening' : 'Voice input'}
                    >
                      {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={isLoading || !input.trim()}
                    className="p-2.5 social-icon-chip bg-gradient-to-br from-white/28 to-white/15 text-white disabled:opacity-40 hover:shadow-lg hover:shadow-white/20 transition-all duration-200 shrink-0"
                    aria-label="Send message"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Help Center + Ticket links */}
              <div className="mt-2 flex items-center justify-center gap-3">
                <Link
                  to="/help"
                  className="inline-flex items-center gap-1 text-[11px] text-white/45 hover:text-white/70 transition-colors"
                >
                  <HelpCircle className="w-3 h-3" />
                  Help Center
                </Link>
                {token && (
                  <button
                    onClick={openTicketFromChat}
                    className="inline-flex items-center gap-1 text-[11px] text-white/45 hover:text-cyan-300 transition-colors"
                    type="button"
                  >
                    <Ticket className="w-3 h-3" />
                    Create Ticket
                  </button>
                )}
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
