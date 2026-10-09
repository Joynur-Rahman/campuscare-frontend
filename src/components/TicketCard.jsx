import { useState, useRef, useEffect } from "react";
import { MapPin, Calendar, Wrench, Users, MessageSquareText, Phone, ChevronDown, User } from "lucide-react";
import { statusLabel, statusStyle, ticketLabel, createdMs, fmtDate, fmtPhone } from "../lib/ticketUtils.js";
import { useApp } from "../context/AppContext.jsx";

export default function TicketCard({ t, onOpen, action, showContact: propShowContact, techs = [] }) {
  const { user } = useApp();
  const isAdmin = user?.role === "admin" || user?.role === "administrator";
  const isStaff = user?.role === "staff" || user?.role === "technician";
  const isStudent = user?.role === "student";
  const isStaffOrAdmin = isStaff || isAdmin;
  const showContact = propShowContact !== undefined ? propShowContact : Boolean(action || isStaffOrAdmin);

  const [callMenuOpen, setCallMenuOpen] = useState(false);
  const callMenuRef = useRef(null);

  useEffect(() => {
    if (!callMenuOpen) return;
    const handleOutsideClick = (e) => {
      if (callMenuRef.current && !callMenuRef.current.contains(e.target)) {
        setCallMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [callMenuOpen]);

  const studentName = t.userName || t.studentName || "Student";
  const phone = t.userPhone || t.phone || t.studentPhone || t.user_phone || "9876543210";
  const cleanPhone = String(phone).replace(/[^0-9]/g, "") || "9876543210";

  // Technician lookup
  const techId = t.assignedTo || t.assigned_to;
  const assignedTech = (techs || []).find(x => (x.firebaseId || x.clerk_id || x.id) === techId) || null;
  const techName = t.assignedToName || assignedTech?.name || assignedTech?.full_name || (techId ? "Technician" : null);
  const techPhone = t.assignedToPhone || assignedTech?.phone || (techId ? "9000000001" : null);
  const cleanTechPhone = techPhone ? String(techPhone).replace(/[^0-9]/g, "") : "";

  const canCallBoth = isAdmin && techName && cleanTechPhone;

  return (
    <div className="panel p-4 pb-3 h-full flex flex-col justify-between transition-all hover:shadow-md border border-slate-200/90 dark:border-slate-800/80 dark:hover:border-slate-700/80">
      {/* Top Header Badge Row */}
      <div>
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <span className="font-mono text-xs font-bold text-slate-800 dark:text-indigo-300 px-2.5 py-0.5 rounded-lg bg-slate-100 dark:bg-indigo-950/60 border border-slate-300/80 dark:border-indigo-800/50">
            {t.id}
          </span>
          <span className={`px-2.5 py-0.5 text-[11px] font-bold rounded-full border shadow-2xs ${statusStyle(t)}`}>
            {statusLabel(t)}
          </span>
          {t.priority === "High" && (
            <span className="px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300 dark:border-rose-800/60 uppercase tracking-wider">
              Urgent
            </span>
          )}
          {(t.upvotes || 0) > 1 && (
            <span className="ml-auto flex items-center gap-1 text-xs text-blue-700 dark:text-blue-300 font-bold bg-blue-100/80 dark:bg-blue-950/60 px-2.5 py-0.5 rounded-full border border-blue-300/70 dark:border-blue-900/50">
              <Users className="w-3.5 h-3.5" />
              <span>{t.upvotes}</span>
            </span>
          )}
        </div>

        {/* Title & Description */}
        <div className="mb-2">
          <h3 className="text-sm sm:text-[15px] font-bold text-slate-900 dark:text-slate-100 leading-snug">
            {ticketLabel(t)}
          </h3>
          {t.description && (
            <p className="text-[13px] text-slate-700 dark:text-slate-300 font-normal line-clamp-2 mt-1 leading-relaxed">
              {t.description}
            </p>
          )}
        </div>

        {/* Metadata info */}
        <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-xs text-slate-600 dark:text-slate-300 font-medium mb-1">
          {t.location && (
            <span className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 shrink-0 text-slate-400 dark:text-slate-500" />
              <span className="truncate max-w-[190px]">{t.location}</span>
            </span>
          )}
          <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
            <Calendar className="w-3.5 h-3.5 shrink-0" />
            <span>{t.date || fmtDate(createdMs(t))}</span>
          </span>
          {showContact && studentName && (
            <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 font-medium">
              <span className="text-slate-400">•</span>
              <span className="truncate max-w-[130px]">{studentName}</span>
              <span className="inline-flex items-center gap-1 font-mono text-[11px] text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/80 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 leading-none">
                <Phone className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                <span>{fmtPhone(phone)}</span>
              </span>
            </span>
          )}
          {t.assignedToName && (
            <span className="flex items-center gap-1.5 text-indigo-700 dark:text-indigo-400 font-semibold">
              <Wrench className="w-3.5 h-3.5 shrink-0" />
              <span>{t.assignedToName}</span>
            </span>
          )}
        </div>
      </div>

      {/* ── Bottom Action Footer: Clean, Decluttered & Dual-Call Capable ── */}
      <div className="pt-2.5 border-t border-slate-200/80 dark:border-slate-800/80 mt-auto flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          {action}
        </div>
        <div className="ml-auto flex items-center gap-2">
          {showContact && (
            <>
              {canCallBoth ? (
                <div className="relative" ref={callMenuRef}>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setCallMenuOpen(!callMenuOpen);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/60 hover:bg-sky-100 dark:hover:bg-sky-900 border border-sky-200 dark:border-sky-800 rounded-xl transition-all active:scale-95 shadow-2xs cursor-pointer"
                    title="Choose to call student or technician"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>Call</span>
                    <ChevronDown className="w-3 h-3 text-sky-500" />
                  </button>

                  {callMenuOpen && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="absolute right-0 bottom-full mb-2 w-64 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl z-50 p-1.5 space-y-1 animate-in fade-in zoom-in-95 duration-100"
                    >
                      <div className="px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        Direct Call Dispatch
                      </div>
                      <a
                        href={`tel:${cleanPhone}`}
                        onClick={() => setCallMenuOpen(false)}
                        className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-sky-50 dark:hover:bg-sky-950/60 text-slate-800 dark:text-slate-200 transition group"
                      >
                        <div className="p-1.5 rounded-lg bg-sky-100 dark:bg-sky-900/60 text-sky-700 dark:text-sky-300 group-hover:scale-105 transition-transform">
                          <User className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                            {studentName}
                          </div>
                          <div className="text-[10.5px] font-mono text-slate-500 dark:text-slate-400">
                            Student · {fmtPhone(cleanPhone)}
                          </div>
                        </div>
                      </a>

                      <a
                        href={`tel:${cleanTechPhone}`}
                        onClick={() => setCallMenuOpen(false)}
                        className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-950/60 text-slate-800 dark:text-slate-200 transition group"
                      >
                        <div className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 group-hover:scale-105 transition-transform">
                          <Wrench className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                            {techName}
                          </div>
                          <div className="text-[10.5px] font-mono text-slate-500 dark:text-slate-400">
                            Technician · {fmtPhone(cleanTechPhone)}
                          </div>
                        </div>
                      </a>
                    </div>
                  )}
                </div>
              ) : (
                <a
                  href={`tel:${isStudent && cleanTechPhone ? cleanTechPhone : cleanPhone}`}
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/60 hover:bg-sky-100 dark:hover:bg-sky-900 border border-sky-200 dark:border-sky-800 rounded-xl transition-all active:scale-95 shadow-2xs"
                  title={isStudent && cleanTechPhone ? `Call Technician (${techName})` : `Call ${studentName} (${cleanPhone})`}
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>Call</span>
                </a>
              )}
            </>
          )}

          {onOpen && (
            <button
              onClick={() => onOpen(t)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-800 dark:text-indigo-200 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800/60 rounded-xl transition-all active:scale-95 shadow-2xs shrink-0 cursor-pointer"
            >
              <MessageSquareText className="w-3.5 h-3.5" />
              <span>Details & chat</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
