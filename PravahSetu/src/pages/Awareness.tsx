import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen,
  Search,
  AlertTriangle,
  ShieldCheck,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CreditCard,
  MailWarning,
  TrendingDown,
  Headphones,
  Share2,
  UserX,
  Briefcase,
  ShoppingBag,
  ArrowRight,
  ShieldAlert,
  HelpCircle,
  RotateCw,
  Sparkles,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { AWARENESS_ARTICLES } from '../data/mockAwareness';
import { AwarenessArticle } from '../types';
import { Link } from 'react-router-dom';

// Fisher-Yates shuffle to pick random items reliably
function getRandomArticles(count = 3): AwarenessArticle[] {
  const shuffled = [...AWARENESS_ARTICLES].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

export const Awareness: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);
  
  // Randomly selected 3 articles on each page load/refresh
  const [randomArticles, setRandomArticles] = useState<AwarenessArticle[]>(() => getRandomArticles(3));
  const [showAllArticles, setShowAllArticles] = useState(false);

  const categories = ['ALL', 'Financial Safety', 'Digital Identity', 'Impersonation', 'Employment Scams', 'Consumer Protection', 'Social Privacy'];

  // If user searches or chooses a specific category, show matching articles from all articles.
  // Otherwise, show the 2-3 randomized articles picked for this session.
  const isFiltering = searchQuery.trim().length > 0 || activeCategory !== 'ALL' || showAllArticles;

  const baseArticles = isFiltering ? AWARENESS_ARTICLES : randomArticles;

  const filteredArticles = baseArticles.filter((article) => {
    const matchesSearch =
      article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      article.subtitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      article.shortDesc.toLowerCase().includes(searchQuery.toLowerCase()) ||
      article.redFlags.some((f) => f.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCategory =
      activeCategory === 'ALL' || article.category === activeCategory;

    return matchesSearch && matchesCategory;
  });

  const handleShuffle = () => {
    setRandomArticles(getRandomArticles(3));
    setShowAllArticles(false);
  };

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'CreditCard':
        return <CreditCard className="w-6 h-6 text-rose-600" />;
      case 'MailWarning':
        return <MailWarning className="w-6 h-6 text-amber-600" />;
      case 'TrendingDown':
        return <TrendingDown className="w-6 h-6 text-purple-600" />;
      case 'Headphones':
        return <Headphones className="w-6 h-6 text-blue-600" />;
      case 'Share2':
        return <Share2 className="w-6 h-6 text-indigo-600" />;
      case 'UserX':
        return <UserX className="w-6 h-6 text-red-600" />;
      case 'Briefcase':
        return <Briefcase className="w-6 h-6 text-orange-600" />;
      case 'ShoppingBag':
      default:
        return <ShoppingBag className="w-6 h-6 text-teal-600" />;
    }
  };

  const toggleFaq = (key: string) => {
    setExpandedFaq(expandedFaq === key ? null : key);
  };

  return (
    <div className="flex flex-col w-full min-h-screen bg-slate-50 py-10 sm:py-16 text-left">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full space-y-10">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyber-50 text-cyber-700 border border-cyber-200 text-xs font-bold uppercase tracking-wider">
            <BookOpen className="w-3.5 h-3.5" />
            <span>Cyber Threat Knowledge Base</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold text-navy-900 tracking-tight">
            Cybersecurity Awareness Center
          </h1>
          <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
            Recognize scam patterns before they strike. Learn the red flags, immediate countermeasures, and prevention tips curated by cyber defense specialists.
          </p>
        </div>

        {/* Search & Category Filter Bar */}
        <div className="max-w-3xl mx-auto space-y-4">
          <div className="relative">
            <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search threat topics (e.g., 'UPI PIN', 'Telegram task', 'electricity bill', 'APK')..."
              className="w-full pl-12 pr-4 py-3.5 rounded-2xl border border-slate-200 bg-white shadow-subtle focus:outline-none focus:ring-2 focus:ring-cyber-500 text-sm font-medium text-slate-900 placeholder:text-slate-400"
            />
          </div>

          {/* Categories Pill Bar */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none text-xs">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={`px-3.5 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all ${
                  activeCategory === cat
                    ? 'bg-cyber-600 text-white shadow-sm'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Active Selection Banner & Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>
              {isFiltering
                ? `Showing ${filteredArticles.length} threat topics`
                : `Spotlight Alert: Showing 3 rotating threat advisories (Auto-refreshes on every visit)`}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleShuffle}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all"
              title="Shuffle and show other threat advisories"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>Shuffle Topics</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setShowAllArticles(!showAllArticles);
                setActiveCategory('ALL');
                setSearchQuery('');
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyber-50 hover:bg-cyber-100 text-cyber-700 border border-cyber-200 text-xs font-bold transition-all"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{showAllArticles ? 'Show Top 3 Only' : 'View All Topics'}</span>
            </button>
          </div>
        </div>

        {/* Articles Grid */}
        <div className="space-y-8">
          {filteredArticles.map((article) => (
            <Card
              key={article.id}
              id={article.id}
              className="border-slate-200 shadow-card overflow-hidden hover:border-cyber-300 transition-all"
            >
              <div className="p-6 sm:p-8 bg-white border-b border-slate-100">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0">
                      {getIcon(article.iconName)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-cyber-700">
                          {article.category}
                        </span>
                        <Badge
                          variant={article.severity === 'critical' ? 'danger' : 'warning'}
                          size="sm"
                        >
                          {article.severity.toUpperCase()} RISK
                        </Badge>
                      </div>
                      <h3 className="text-xl font-extrabold text-slate-900 tracking-tight mt-0.5">
                        {article.title}
                      </h3>
                    </div>
                  </div>

                  <Link to="/report">
                    <Button variant="outline" size="sm" rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
                      Report Similar Fraud
                    </Button>
                  </Link>
                </div>

                <p className="text-sm font-semibold text-cyber-900 bg-cyber-50/70 p-3 rounded-xl border border-cyber-100/80 mb-3">
                  {article.subtitle}
                </p>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  {article.shortDesc}
                </p>
              </div>

              <CardContent className="p-6 sm:p-8 bg-slate-50/50 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Red Flags */}
                  <div className="p-5 rounded-2xl bg-white border border-rose-100 shadow-2xs">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-rose-700 flex items-center gap-2 mb-3">
                      <AlertTriangle className="w-4 h-4 text-rose-600" />
                      Warning Signs & Red Flags
                    </h4>
                    <ul className="space-y-2.5 text-xs text-slate-700">
                      {article.redFlags.map((flag, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-rose-500 font-bold shrink-0">•</span>
                          <span className="leading-relaxed">{flag}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Immediate Actions */}
                  <div className="p-5 rounded-2xl bg-white border border-emerald-100 shadow-2xs">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-2 mb-3">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      Immediate Actions (Golden Hour)
                    </h4>
                    <ul className="space-y-2.5 text-xs text-slate-700">
                      {article.immediateActions.map((action, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-emerald-600 font-bold shrink-0">✓</span>
                          <span className="leading-relaxed font-medium">{action}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Prevention Checklist */}
                <div className="p-5 rounded-2xl bg-white border border-slate-200">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2 mb-3">
                    <CheckCircle2 className="w-4 h-4 text-cyber-600" />
                    Long-Term Prevention Checklist
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-600">
                    {article.preventionTips.map((tip, idx) => (
                      <div key={idx} className="flex items-start gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                        <span className="w-1.5 h-1.5 rounded-full bg-cyber-500 mt-1.5 shrink-0" />
                        <span className="leading-relaxed">{tip}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* FAQs */}
                {article.faq && article.faq.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                      Frequently Asked Questions
                    </h4>
                    {article.faq.map((faqItem, idx) => {
                      const faqKey = `${article.id}-${idx}`;
                      const isExpanded = expandedFaq === faqKey;
                      return (
                        <div
                          key={faqKey}
                          className="rounded-xl border border-slate-200 bg-white overflow-hidden transition-all"
                        >
                          <button
                            type="button"
                            onClick={() => toggleFaq(faqKey)}
                            className="w-full p-3.5 text-left text-xs sm:text-sm font-bold text-slate-800 flex items-center justify-between gap-2 hover:bg-slate-50 transition"
                          >
                            <span>{faqItem.question}</span>
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                            )}
                          </button>
                          {isExpanded && (
                            <div className="p-3.5 pt-0 text-xs text-slate-600 leading-relaxed border-t border-slate-100 bg-slate-50/50">
                              {faqItem.answer}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};
