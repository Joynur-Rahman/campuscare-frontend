import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Star, X, Check, Loader2, Sparkles, Wrench } from 'lucide-react';
import { useApp } from '../context/AppContext.jsx';
import { useBodyScrollLock } from '../lib/useBodyScrollLock.js';
import { ticketLabel, shortTicketId } from '../lib/ticketUtils.js';

const RATING_LABELS = {
  1: 'Poor resolution / Unresolved',
  2: 'Needs improvement',
  3: 'Satisfactory / Average',
  4: 'Good service & prompt fix',
  5: 'Excellent resolution! Highly satisfied',
};

const QUICK_TAGS = [
  '⚡ Fast fix',
  '🔧 Polite technician',
  '✅ Clean work',
  '💬 Good communication',
  '👍 Fully resolved',
];

export default function RatingModal({ ticket: ticketProp, t: tProp, onClose, onRated }) {
  useBodyScrollLock();
  const { api, showToast } = useApp();
  const ticket = ticketProp || tProp || {};

  const [rating, setRating] = useState(ticket?.rating || 5);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState(ticket?.feedbackComment || '');
  const [selectedTags, setSelectedTags] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const activeRating = hoverRating || rating;

  const toggleTag = (tag) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!rating || submitting) return;
    setSubmitting(true);
    try {
      const fullFeedback = [
        selectedTags.join(', '),
        comment.trim()
      ].filter(Boolean).join(' — ');

      if (api?.submitFeedback) {
        await api.submitFeedback(ticket.id, rating, fullFeedback);
      } else if (api?.tickets?.submitFeedback) {
        await api.tickets.submitFeedback(ticket.id, rating, fullFeedback);
      }
      ticket.rating = rating;
      if (fullFeedback) ticket.feedbackComment = fullFeedback;
      onRated?.(rating);
      showToast?.(`Thank you! Rated ${rating}★ for ticket ${shortTicketId(ticket)}`, 'success');
      onClose();
    } catch (err) {
      console.error('[RatingModal] Error submitting rating:', err);
      showToast?.(err.message || 'Failed to submit rating. Please try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const modalNode = (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white dark:bg-[#121417] rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden text-slate-800 dark:text-slate-100 animate-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-[#17191c] dark:to-[#111215] border-b border-amber-200/60 dark:border-slate-700/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-amber-500/10 dark:bg-amber-400/10 text-amber-600 dark:text-amber-400">
              <Sparkles className="w-5 h-5" />
            </span>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white leading-tight">
                Rate Resolution &amp; Service
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Help us improve campus maintenance quality
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4">
          {/* Ticket Context Pill */}
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 flex items-start gap-2.5">
            <span
              title={`Full ID: ${ticket.id}`}
              className="font-mono text-xs font-black text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shrink-0"
            >
              {shortTicketId(ticket)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                {ticketLabel(ticket)}
              </p>
              {ticket.assignedToName && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                  <Wrench className="w-3 h-3 text-amber-500" />
                  <span>Technician: {ticket.assignedToName}</span>
                </p>
              )}
            </div>
          </div>

          {/* Star Rating Section */}
          <div className="text-center py-2">
            <div className="flex items-center justify-center gap-2 sm:gap-3">
              {[1, 2, 3, 4, 5].map((star) => {
                const filled = star <= activeRating;
                return (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    className="p-1.5 rounded-xl transition-transform hover:scale-125 active:scale-95 cursor-pointer focus:outline-hidden"
                    title={`${star} Star${star > 1 ? 's' : ''}`}
                  >
                    <Star
                      className={`w-8 h-8 sm:w-9 sm:h-9 transition-colors ${
                        filled
                          ? 'fill-amber-400 text-amber-500 drop-shadow-sm'
                          : 'text-slate-300 dark:text-slate-600'
                      }`}
                    />
                  </button>
                );
              })}
            </div>
            <p className="text-xs font-bold text-amber-700 dark:text-amber-400 mt-2 min-h-[18px]">
              {RATING_LABELS[activeRating] || 'Click a star to rate'}
            </p>
          </div>

          {/* Quick Tags */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Quick Feedback
            </label>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_TAGS.map((tag) => {
                const active = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all border cursor-pointer ${
                      active
                        ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                        : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Optional comment */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Additional Note (Optional)
            </label>
            <textarea
              rows={2}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Any details about the resolution or technician..."
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-amber-500 resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 active:bg-amber-800 rounded-xl shadow-md transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
            >
              {submitting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Check className="w-3.5 h-3.5 stroke-[3]" />
              )}
              <span>Submit Rating</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return typeof document !== 'undefined'
    ? createPortal(modalNode, document.body)
    : modalNode;
}
