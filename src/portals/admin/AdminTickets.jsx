import { useState, useRef, useEffect, useMemo } from "react";
import {
  CircleCheck, Wrench, Search, Kanban, Grid3x3, SlidersHorizontal,
  ChevronDown, Flame, X, RotateCcw
} from "lucide-react";
import { useApp } from "../../context/AppContext.jsx";
import TicketCard from "../../components/TicketCard.jsx";
import { createdMs, ticketLabel } from "../../lib/ticketUtils.js";

const isResolved = t => ["resolved", "done"].includes((t?.status || "").toLowerCase().trim());
const isInProgress = t => ["in progress", "in_progress"].includes((t?.status || "").toLowerCase().trim());
const isPending = t => (t?.assignedTo || t?.assigned_to) && ["pending", "assigned", "submitted"].includes((t?.status || "").toLowerCase().trim());
const isUnassigned = t => !t?.assignedTo && !t?.assigned_to && !isResolved(t);
const isUrgent = t => !isResolved(t) && (t?.priority === "High" || t?.status === "escalated");

export default function AdminTickets({
  tickets = [],
  techs = [],
  onOpen,
  activeFilter = "all",
  onFilterChange
}) {
  const { api, showToast } = useApp();
  const [primaryTab, setPrimaryTab] = useState("all"); // "all" | "open" | "resolved"
  const [subStatusFilter, setSubStatusFilter] = useState("all"); // "all" | "unassigned" | "progress" | "pending"
  const [urgentOnly, setUrgentOnly] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [viewMode, setViewMode] = useState("grid"); // "grid" | "kanban"
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef(null);

  // Sync external activeFilter (from Dashboard navigation)
  useEffect(() => {
    if (!activeFilter) return;
    if (activeFilter === "all" || activeFilter === "reported") {
      setPrimaryTab("all");
      setSubStatusFilter("all");
      setUrgentOnly(false);
    } else if (activeFilter === "open") {
      setPrimaryTab("open");
      setSubStatusFilter("all");
      setUrgentOnly(false);
    } else if (activeFilter === "resolved") {
      setPrimaryTab("resolved");
      setSubStatusFilter("all");
      setUrgentOnly(false);
    } else if (activeFilter === "unassigned") {
      setPrimaryTab("open");
      setSubStatusFilter("unassigned");
      setUrgentOnly(false);
    } else if (activeFilter === "progress") {
      setPrimaryTab("open");
      setSubStatusFilter("progress");
      setUrgentOnly(false);
    } else if (activeFilter === "urgent") {
      setPrimaryTab("all");
      setUrgentOnly(true);
    }
  }, [activeFilter]);

  // Outside click to close filter menu
  useEffect(() => {
    if (!filterOpen) return;
    const handleOutside = e => {
      if (filterRef.current && !filterRef.current.contains(e.target)) {
        setFilterOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [filterOpen]);

  const onDuty = techs.filter(t => !t.status || t.status === "On Duty");

  // Dynamic domains
  const categories = useMemo(() => {
    return [...new Set(tickets.map(t => t.category || t.categoryDisplay?.split("—")?.[0]?.trim()).filter(Boolean))];
  }, [tickets]);

  // Counts
  const openCount = tickets.filter(t => !isResolved(t)).length;
  const resolvedCount = tickets.filter(isResolved).length;
  const unassignedCount = tickets.filter(isUnassigned).length;
  const inProgressCount = tickets.filter(isInProgress).length;
  const pendingCount = tickets.filter(isPending).length;
  const urgentCount = tickets.filter(isUrgent).length;

  const activeSubFilterCount =
    (subStatusFilter !== "all" ? 1 : 0) +
    (urgentOnly ? 1 : 0) +
    (categoryFilter !== "all" ? 1 : 0);

  const resetSubFilters = () => {
    setSubStatusFilter("all");
    setUrgentOnly(false);
    setCategoryFilter("all");
  };

  // Search filter
  const q = query.trim().toLowerCase();
  const matchesQuery = t => {
    if (!q) return true;
    return (
      (t.id && String(t.id).toLowerCase().includes(q)) ||
      (t.description && t.description.toLowerCase().includes(q)) ||
      (t.location && t.location.toLowerCase().includes(q)) ||
      (ticketLabel(t) && ticketLabel(t).toLowerCase().includes(q))
    );
  };

  // Filtered tickets
  const filteredList = useMemo(() => {
    return tickets
      .filter(t => {
        // 1. Primary Tab
        if (primaryTab === "open" && isResolved(t)) return false;
        if (primaryTab === "resolved" && !isResolved(t)) return false;

        // 2. Sub-status Filter
        if (subStatusFilter === "unassigned" && !isUnassigned(t)) return false;
        if (subStatusFilter === "progress" && !isInProgress(t)) return false;
        if (subStatusFilter === "pending" && !isPending(t)) return false;

        // 3. Urgent filter
        if (urgentOnly && !isUrgent(t)) return false;

        // 4. Category filter
        if (categoryFilter !== "all") {
          const cat = t.category || t.categoryDisplay?.split("—")?.[0]?.trim();
          if (cat !== categoryFilter) return false;
        }

        return true;
      })
      .filter(matchesQuery)
      .sort((a, b) => createdMs(b) - createdMs(a));
  }, [tickets, primaryTab, subStatusFilter, urgentOnly, categoryFilter, q]);

  async function assign(ticket, techId) {
    const tech = techs.find(t => (t.firebaseId || t.clerk_id || t.id) === techId);
    try {
      await api.assignTicket(ticket.id, techId, tech?.name || tech?.full_name);
      showToast(`Assigned ticket #${ticket.id} to ${tech?.name || tech?.full_name || "technician"}.`, "success");
    } catch (e) {
      showToast(e.message || "Assignment failed", "error");
    }
  }

  // Render action control for each ticket
  const renderAction = (t) => {
    if (isResolved(t)) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 rounded-lg">
          <CircleCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> Fixed
        </span>
      );
    }
    if (isInProgress(t)) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-blue-700 bg-blue-50 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 rounded-lg">
          <Wrench className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" /> Working ({t.acknowledged_name || t.assignedToName || "Staff"})
        </span>
      );
    }
    return (
      <select
        defaultValue=""
        onChange={e => e.target.value && assign(t, e.target.value)}
        className="assign-select text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
      >
        <option value="">
          {t.assignedTo || t.assigned_to ? `↻ Reassign (${t.assignedToName || "Assigned"})` : "⚡ Assign technician…"}
        </option>
        {onDuty.map(tech => {
          const tid = tech.firebaseId || tech.clerk_id || tech.id;
          const tname = tech.name || tech.full_name || "Staff";
          const tdept = tech.dept || tech.department || "Staff";
          return <option key={tid} value={tid}>🟢 {tname} ({tdept})</option>;
        })}
      </select>
    );
  };

  // Kanban column buckets
  const unassignedTickets = tickets.filter(isUnassigned).filter(matchesQuery);
  const inProgressTickets = tickets.filter(isInProgress).filter(matchesQuery);
  const resolvedTickets = tickets.filter(isResolved).filter(matchesQuery);

  return (
    <div className="space-y-3.5">
      {/* ── Command Bar: Primary Segmented Tabs + Filters Button + Search + View Switcher ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Left: 3 Clean Primary Tabs */}
        <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 shrink-0">
          <button
            onClick={() => { setPrimaryTab("all"); onFilterChange?.("all"); }}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              primaryTab === "all"
                ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <span>All</span>
            <span className={`min-w-5 h-5 px-1.5 rounded-full text-[11px] font-bold flex items-center justify-center leading-none ${
              primaryTab === "all"
                ? "bg-slate-100 dark:bg-slate-600 text-slate-800 dark:text-slate-100"
                : "bg-slate-200/80 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
            }`}>
              {tickets.length}
            </span>
          </button>

          <button
            onClick={() => { setPrimaryTab("open"); onFilterChange?.("open"); }}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              primaryTab === "open"
                ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <span>Open</span>
            <span className={`min-w-5 h-5 px-1.5 rounded-full text-[11px] font-bold flex items-center justify-center leading-none ${
              primaryTab === "open"
                ? "bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200"
                : "bg-slate-200/80 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
            }`}>
              {openCount}
            </span>
          </button>

          <button
            onClick={() => { setPrimaryTab("resolved"); onFilterChange?.("resolved"); }}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              primaryTab === "resolved"
                ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <span>Resolved</span>
            <span className={`min-w-5 h-5 px-1.5 rounded-full text-[11px] font-bold flex items-center justify-center leading-none ${
              primaryTab === "resolved"
                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200"
                : "bg-slate-200/80 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
            }`}>
              {resolvedCount}
            </span>
          </button>
        </div>

        {/* Right: Filter Button + Search + View Switcher */}
        <div className="flex items-center gap-2 flex-1 sm:flex-initial justify-end">
          {/* ── Filter Trigger Button & Popover ── */}
          <div className="relative" ref={filterRef}>
            <button
              onClick={() => setFilterOpen(o => !o)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-2xs shrink-0 cursor-pointer ${
                filterOpen || activeSubFilterCount > 0
                  ? "bg-iiitg-800 text-white shadow-sm"
                  : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
              }`}
              title="Filter by status, priority, or problem domain"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Filters</span>
              {activeSubFilterCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-amber-400 text-slate-950 font-black text-[10px] flex items-center justify-center">
                  {activeSubFilterCount}
                </span>
              )}
              <ChevronDown className={`w-3 h-3 transition-transform ${filterOpen ? "rotate-180" : ""}`} />
            </button>

            {filterOpen && (
              <div className="absolute right-0 top-full mt-2 w-72 sm:w-80 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl z-50 p-3.5 space-y-3.5 animate-in fade-in zoom-in-95 duration-100">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-1.5">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span className="text-xs font-extrabold uppercase tracking-wider text-slate-900 dark:text-slate-100">
                      Filter Tickets
                    </span>
                  </div>
                  {activeSubFilterCount > 0 && (
                    <button
                      onClick={resetSubFilters}
                      className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <RotateCcw className="w-3 h-3" /> Reset
                    </button>
                  )}
                </div>

                {/* Workflow Status Filter */}
                <div className="space-y-1.5">
                  <label className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Workflow Status
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      onClick={() => setSubStatusFilter("all")}
                      className={`px-2.5 py-1.5 rounded-xl text-xs font-bold text-left transition cursor-pointer ${
                        subStatusFilter === "all"
                          ? "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800"
                          : "bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                      }`}
                    >
                      All Statuses
                    </button>
                    <button
                      onClick={() => setSubStatusFilter("unassigned")}
                      className={`px-2.5 py-1.5 rounded-xl text-xs font-bold text-left flex items-center justify-between transition cursor-pointer ${
                        subStatusFilter === "unassigned"
                          ? "bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700"
                          : "bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                      }`}
                    >
                      <span>Not Assigned</span>
                      <span className="text-[10px] font-mono opacity-80">{unassignedCount}</span>
                    </button>
                    <button
                      onClick={() => setSubStatusFilter("progress")}
                      className={`px-2.5 py-1.5 rounded-xl text-xs font-bold text-left flex items-center justify-between transition cursor-pointer ${
                        subStatusFilter === "progress"
                          ? "bg-blue-50 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-700"
                          : "bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                      }`}
                    >
                      <span>Being Fixed</span>
                      <span className="text-[10px] font-mono opacity-80">{inProgressCount}</span>
                    </button>
                    <button
                      onClick={() => setSubStatusFilter("pending")}
                      className={`px-2.5 py-1.5 rounded-xl text-xs font-bold text-left flex items-center justify-between transition cursor-pointer ${
                        subStatusFilter === "pending"
                          ? "bg-purple-50 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border border-purple-300 dark:border-purple-700"
                          : "bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                      }`}
                    >
                      <span>Waiting / Disp.</span>
                      <span className="text-[10px] font-mono opacity-80">{pendingCount}</span>
                    </button>
                  </div>
                </div>

                {/* Priority Filter */}
                <div className="space-y-1.5">
                  <label className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Priority
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setUrgentOnly(false)}
                      className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                        !urgentOnly
                          ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-2xs"
                          : "bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                      }`}
                    >
                      All Priorities
                    </button>
                    <button
                      onClick={() => setUrgentOnly(true)}
                      className={`flex-1 py-1.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                        urgentOnly
                          ? "bg-rose-600 text-white shadow-2xs"
                          : "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60 hover:bg-rose-100"
                      }`}
                    >
                      <Flame className="w-3.5 h-3.5" />
                      <span>Urgent Only ({urgentCount})</span>
                    </button>
                  </div>
                </div>

                {/* Problem Domain Filter */}
                {categories.length > 0 && (
                  <div className="space-y-1.5">
                    <label className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      Problem Domain
                    </label>
                    <select
                      value={categoryFilter}
                      onChange={e => setCategoryFilter(e.target.value)}
                      className="w-full text-xs font-bold p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="all">All Domains ({categories.length})</option>
                      {categories.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Search Input */}
          <div className="relative flex-1 sm:w-56 md:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search ID, room, issue…"
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* View Mode Toggle: Grid vs Kanban */}
          <div className="flex items-center p-0.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shrink-0">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                viewMode === "grid"
                  ? "bg-white dark:bg-slate-700 text-indigo-700 dark:text-indigo-300 shadow-2xs"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
              title="Grid View"
            >
              <Grid3x3 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode("kanban")}
              className={`p-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                viewMode === "kanban"
                  ? "bg-white dark:bg-slate-700 text-indigo-700 dark:text-indigo-300 shadow-2xs"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
              title="Kanban Board View"
            >
              <Kanban className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Active Filter Chips (Removes cognitive load) ── */}
      {activeSubFilterCount > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap px-0.5 pt-0.5 text-xs">
          <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">Filtered:</span>
          {subStatusFilter === "unassigned" && (
            <button
              onClick={() => setSubStatusFilter("all")}
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg font-bold bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-700 hover:bg-amber-100 cursor-pointer"
            >
              <span>Not Assigned</span>
              <X className="w-3 h-3" />
            </button>
          )}
          {subStatusFilter === "progress" && (
            <button
              onClick={() => setSubStatusFilter("all")}
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg font-bold bg-blue-50 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-300 dark:border-blue-700 hover:bg-blue-100 cursor-pointer"
            >
              <span>Being Fixed</span>
              <X className="w-3 h-3" />
            </button>
          )}
          {subStatusFilter === "pending" && (
            <button
              onClick={() => setSubStatusFilter("all")}
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg font-bold bg-purple-50 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-300 dark:border-purple-700 hover:bg-purple-100 cursor-pointer"
            >
              <span>Assigned / Waiting</span>
              <X className="w-3 h-3" />
            </button>
          )}
          {urgentOnly && (
            <button
              onClick={() => setUrgentOnly(false)}
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg font-bold bg-rose-50 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300 dark:border-rose-700 hover:bg-rose-100 cursor-pointer"
            >
              <Flame className="w-3 h-3 text-rose-500" />
              <span>Urgent Only</span>
              <X className="w-3 h-3" />
            </button>
          )}
          {categoryFilter !== "all" && (
            <button
              onClick={() => setCategoryFilter("all")}
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg font-bold bg-indigo-50 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-700 hover:bg-indigo-100 cursor-pointer"
            >
              <span>{categoryFilter}</span>
              <X className="w-3 h-3" />
            </button>
          )}
          <button
            onClick={resetSubFilters}
            className="text-[11px] font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 underline ml-1 cursor-pointer"
          >
            Clear all
          </button>
        </div>
      )}

      {/* ── View 1: Kanban Board Mode ── */}
      {viewMode === "kanban" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
          {/* Column 1: Unassigned */}
          <div className="flex flex-col rounded-2xl bg-slate-100/70 dark:bg-slate-900/40 p-3.5 border border-amber-300/60 dark:border-amber-700/50">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-amber-200/80 dark:border-amber-800/50">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  Needs Assignment
                </h4>
              </div>
              <span className="min-w-5 h-5 px-1.5 rounded-full text-[11px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 flex items-center justify-center">
                {unassignedTickets.length}
              </span>
            </div>
            <div className="space-y-3 flex-1 overflow-y-auto max-h-[calc(100vh-260px)] pr-1">
              {unassignedTickets.map(t => (
                <TicketCard key={t.id} t={t} onOpen={onOpen} action={renderAction(t)} techs={techs} />
              ))}
              {unassignedTickets.length === 0 && (
                <div className="text-center py-10 text-xs text-slate-400 font-medium">
                  Zero tickets awaiting dispatch 🎉
                </div>
              )}
            </div>
          </div>

          {/* Column 2: In Progress */}
          <div className="flex flex-col rounded-2xl bg-slate-100/70 dark:bg-slate-900/40 p-3.5 border border-blue-300/60 dark:border-blue-700/50">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-blue-200/80 dark:border-blue-800/50">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  Being Fixed
                </h4>
              </div>
              <span className="min-w-5 h-5 px-1.5 rounded-full text-[11px] font-bold bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 flex items-center justify-center">
                {inProgressTickets.length}
              </span>
            </div>
            <div className="space-y-3 flex-1 overflow-y-auto max-h-[calc(100vh-260px)] pr-1">
              {inProgressTickets.map(t => (
                <TicketCard key={t.id} t={t} onOpen={onOpen} action={renderAction(t)} techs={techs} />
              ))}
              {inProgressTickets.length === 0 && (
                <div className="text-center py-10 text-xs text-slate-400 font-medium">
                  No tickets currently in progress
                </div>
              )}
            </div>
          </div>

          {/* Column 3: Resolved */}
          <div className="flex flex-col rounded-2xl bg-slate-100/70 dark:bg-slate-900/40 p-3.5 border border-emerald-300/60 dark:border-emerald-700/50">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-emerald-200/80 dark:border-emerald-800/50">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  Fixed / Done
                </h4>
              </div>
              <span className="min-w-5 h-5 px-1.5 rounded-full text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 flex items-center justify-center">
                {resolvedTickets.length}
              </span>
            </div>
            <div className="space-y-3 flex-1 overflow-y-auto max-h-[calc(100vh-260px)] pr-1">
              {resolvedTickets.map(t => (
                <TicketCard key={t.id} t={t} onOpen={onOpen} action={renderAction(t)} techs={techs} />
              ))}
              {resolvedTickets.length === 0 && (
                <div className="text-center py-10 text-xs text-slate-400 font-medium">
                  No resolved tickets yet
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── View 2: Grid View Mode ── */}
      {viewMode === "grid" && (
        <>
          {filteredList.length === 0 ? (
            <div className="text-center py-14 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 border-dashed panel">
              <CircleCheck className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-700 dark:text-slate-200">All clear</p>
              <p className="text-xs text-slate-400 mt-1">No tickets match the selected filter or search.</p>
              {activeSubFilterCount > 0 && (
                <button
                  onClick={resetSubFilters}
                  className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Reset all filters
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
              {filteredList.map(t => (
                <TicketCard key={t.id} t={t} onOpen={onOpen} action={renderAction(t)} techs={techs} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
