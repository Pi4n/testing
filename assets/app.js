/* global window, fetch */
/**
 * CCS3402 Marketability App — Core Application Module
 * 
 * Migrated from localStorage to Live Oracle Database via Netlify Serverless Functions.
 * All data operations are asynchronous and route through /.netlify/functions/* endpoints.
 * 
 * Exposed globally as window.App
 */

(function () {
  "use strict";

  // ============================================================
  // CONFIGURATION
  // ============================================================
  
  const API_BASE = "/.netlify/functions";
  
  const ENDPOINTS = {
    getState: `${API_BASE}/get-state`,
    manageStudents: `${API_BASE}/manage-students`,
    manageCourses: `${API_BASE}/manage-courses`,
    manageLearningOutcomes: `${API_BASE}/manage-learning-outcomes`,
    manageEnrollments: `${API_BASE}/manage-enrollments`,
    manageCocurriculum: `${API_BASE}/manage-cocurriculum`,
    managePrograms: `${API_BASE}/manage-programs`,
    manageSkills: `${API_BASE}/manage-skills`
  };

  // In-memory cache for the current session (NOT persisted)
  let _stateCache = null;
  let _fetchPromise = null;

  // ============================================================
  // STATE MANAGEMENT - Live Oracle DB via Netlify Functions
  // ============================================================

  /**
   * Returns an empty state structure for graceful handling of
   * a clean, empty database (zero rows).
   */
  function emptyState() {
    return {
      meta: { version: 1, fetchedAt: new Date().toISOString() },
      programs: [],
      courses: [],
      students: [],
      learningOutcomes: [],
      employabilitySkills: [],
      loSkillMappings: [],
      coCurriculum: [],
      coCurrSkillMappings: [],
      enrollments: [],
      studentCoCurriculum: []
    };
  }

  /**
   * Fetches the complete application state from the live Oracle database.
   * Routes through /.netlify/functions/get-state and handles transformation server-side.
   * Returns a deep copy to prevent accidental mutation.
   */
  async function get(forceRefresh = false) {
    if (_stateCache && !forceRefresh) {
      return JSON.parse(JSON.stringify(_stateCache));
    }

    if (_fetchPromise) {
      const result = await _fetchPromise;
      return JSON.parse(JSON.stringify(result));
    }

    _fetchPromise = (async () => {
      try {
        const response = await fetch(ENDPOINTS.getState, {
          method: "GET",
          headers: { "Content-Type": "application/json" }
        });

        if (!response.ok) {
          console.error("Failed to fetch state:", response.status, response.statusText);
          _stateCache = emptyState();
          return _stateCache;
        }

        const data = await response.json();
        _stateCache = data || emptyState();
        return _stateCache;
      } catch (error) {
        console.error("Network error fetching state:", error);
        _stateCache = emptyState();
        return _stateCache;
      } finally {
        _fetchPromise = null;
      }
    })();

    const result = await _fetchPromise;
    return JSON.parse(JSON.stringify(result));
  }

  function invalidateCache() {
    _stateCache = null;
  }

  /**
   * Generic POST helper for serverless function calls
   */
  async function postJson(endpoint, payload) {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const errorMsg = data.error || data.message || `Request failed: ${response.status}`;
      throw new Error(errorMsg);
    }

    invalidateCache();
    return data;
  }

  // ============================================================
  // ENTITY MANAGEMENT
  // ============================================================

  const Students = {
    async create(student) { return postJson(ENDPOINTS.manageStudents, student); }
  };

  const Programs = {
    async create(program) { return postJson(ENDPOINTS.managePrograms, program); }
  };

  const Skills = {
    async create(skill) { return postJson(ENDPOINTS.manageSkills, skill); }
  };

  const Courses = {
    async upsert(course) { return postJson(ENDPOINTS.manageCourses, course); }
  };

  const LearningOutcomes = {
    async upsert(lo) { return postJson(ENDPOINTS.manageLearningOutcomes, lo); },
    async delete(lo_id) { return postJson(ENDPOINTS.manageLearningOutcomes, { action: "delete", lo_id }); }
  };

  const Enrollments = {
    async create(enrollment) { return postJson(ENDPOINTS.manageEnrollments, enrollment); },
    async delete(enrollment_id) { return postJson(ENDPOINTS.manageEnrollments, { action: "delete", enrollment_id }); }
  };

  const Cocurriculum = {
    async upsertActivity(activity) { return postJson(ENDPOINTS.manageCocurriculum, { type: "activity", ...activity }); },
    async createSkillMapping(mapping) { return postJson(ENDPOINTS.manageCocurriculum, { type: "skill-mapping", ...mapping }); },
    async deleteSkillMapping(mapping_id) { return postJson(ENDPOINTS.manageCocurriculum, { type: "skill-mapping", action: "delete", mapping_id }); },
    async createParticipation(record) { return postJson(ENDPOINTS.manageCocurriculum, { type: "participation", ...record }); },
    async deleteParticipation(record_id) { return postJson(ENDPOINTS.manageCocurriculum, { type: "participation", action: "delete", record_id }); }
  };

  // ============================================================
  // MARKETABILITY SCORING — Pure functions
  // ============================================================

  const GRADE_POINTS = {
    "A+": 4.0, A: 4.0, "A-": 3.7,
    "B+": 3.3, B: 3.0, "B-": 2.7,
    "C+": 2.3, C: 2.0, "C-": 1.7,
    "D+": 1.3, D: 1.0, F: 0.0
  };

  function clamp01(x) { return Math.max(0, Math.min(1, x)); }
  function clamp100(x) { return Math.max(0, Math.min(100, x)); }

  function gradeTo01(grade) {
    const gp = GRADE_POINTS[grade];
    if (gp == null) return 0;
    return clamp01(gp / 4.0);
  }

  function computeAcademicAchievement(state, studentId) {
    const enrolls = state.enrollments.filter(
      (e) => e.student_id === studentId && (e.status || "").toLowerCase() === "completed"
    );
    if (enrolls.length === 0) return { score01: 0, details: { totalCredits: 0, gpa: 0 } };

    let totalCredits = 0;
    let weightedPoints = 0;
    for (const e of enrolls) {
      const course = state.courses.find((c) => c.course_id === e.course_id);
      const ch = Number(course?.credit_hours ?? 0);
      const gp = GRADE_POINTS[e.grade] ?? 0;
      totalCredits += ch;
      weightedPoints += gp * ch;
    }
    const gpa = totalCredits > 0 ? weightedPoints / totalCredits : 0;
    return { score01: clamp01(gpa / 4.0), details: { totalCredits, gpa: Number(gpa.toFixed(2)) } };
  }

  function computeCoCurrAchievement(state, studentId) {
    const rows = state.studentCoCurriculum.filter((r) => r.student_id === studentId);
    if (rows.length === 0) return { score01: 0, details: { totalActivities: 0 } };

    const bySkill = new Map();
    for (const r of rows) {
      const ach = clamp01(Number(r.achievement ?? 0));
      const mappings = state.coCurrSkillMappings.filter((m) => m.cocurr_id === r.cocurr_id);
      if (mappings.length === 0) {
        bySkill.set("__generic__", (bySkill.get("__generic__") ?? 0) + ach * 0.25);
      } else {
        for (const m of mappings) {
          const strength = clamp01(Number(m.mapping_strength ?? 0));
          bySkill.set(m.skill_id, (bySkill.get(m.skill_id) ?? 0) + ach * strength);
        }
      }
    }

    const contributions = Array.from(bySkill.values());
    const avg = contributions.length ? contributions.reduce((a, b) => a + b, 0) / contributions.length : 0;
    return { score01: clamp01(avg / 1.25), details: { totalActivities: rows.length } };
  }

  function computeBreadthBonus01(state, studentId) {
    const skillSet = new Set();
    const completed = state.enrollments.some(
      (e) => e.student_id === studentId && (e.status || "").toLowerCase() === "completed"
    );
    if (completed) {
      for (const m of state.loSkillMappings) skillSet.add(m.skill_id);
    }
    const rows = state.studentCoCurriculum.filter((r) => r.student_id === studentId);
    for (const r of rows) {
      const mappings = state.coCurrSkillMappings.filter((m) => m.cocurr_id === r.cocurr_id);
      for (const m of mappings) skillSet.add(m.skill_id);
    }
    return clamp01(skillSet.size / 8);
  }

  function computeMarketability(state, studentId) {
    const acad = computeAcademicAchievement(state, studentId);
    const coc = computeCoCurrAchievement(state, studentId);
    const breadth = computeBreadthBonus01(state, studentId);

    const combined01 = clamp01(0.6 * acad.score01 + 0.4 * coc.score01 + 0.1 * breadth);
    const index = clamp100(Math.round(combined01 * 100));
    const tier = index >= 80 ? "Excellent" : index >= 65 ? "Good" : index >= 50 ? "Developing" : "Needs Improvement";

    return {
      marketabilityIndex: index, tier,
      academic01: acad.score01, coCurr01: coc.score01, breadth01: breadth,
      academicDetails: acad.details, coCurrDetails: coc.details
    };
  }

  // ============================================================
  // UTILITIES
  // ============================================================

  function escapeHtml(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function $id(id) {
    const el = document.getElementById(id);
    if (!el) throw new Error(`Missing element #${id}`);
    return el;
  }

  function $idOptional(id) {
    return document.getElementById(id);
  }

  function notify(message, type = "info") {
    let container = document.getElementById("appNotify");
    if (!container) {
      container = document.createElement("div");
      container.id = "appNotify";
      container.style.cssText = "position:fixed;top:80px;right:20px;z-index:9999;max-width:340px;";
      document.body.appendChild(container);
    }
    const colorMap = {
      success: { bg: "rgba(34, 197, 94, 0.18)", border: "#22c55e", color: "#4ade80" },
      danger: { bg: "rgba(239, 68, 68, 0.18)", border: "#ef4444", color: "#f87171" },
      info: { bg: "rgba(59, 130, 246, 0.18)", border: "#3b82f6", color: "#93c5fd" }
    };
    const colors = colorMap[type] || colorMap.info;

    const toast = document.createElement("div");
    toast.style.cssText = `
      background: ${colors.bg};
      border: 1px solid ${colors.border};
      color: ${colors.color};
      padding: 12px 16px;
      border-radius: 10px;
      margin-bottom: 10px;
      font-size: 0.9rem;
      box-shadow: 0 4px 14px rgba(0,0,0,0.3);
      backdrop-filter: blur(8px);
    `;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transition = "opacity 0.3s";
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  // ============================================================
  // PUBLIC API
  // ============================================================

  window.App = {
    get, invalidateCache, emptyState,
    Students, Programs, Skills, Courses,
    LearningOutcomes, Enrollments, Cocurriculum,
    gradeTo01, computeMarketability,
    escapeHtml, $id, $idOptional, notify,
    ENDPOINTS
  };
})();
