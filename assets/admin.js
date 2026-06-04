/* global window, sessionStorage */
/**
 * Admin Panel Logic — Full CRUD + Analytics
 * Manages: Students, Programs, Skills, Learning Outcomes
 * Analytics: Tier distribution, top students, avg MI by program
 */

(function () {
  "use strict";

  const App = window.App;
  const AUTH_KEY = "ccs3402_admin_authenticated";
  const ADMIN_USER = "admin";
  const ADMIN_PASS = "admin123";

  // ============================================================
  // AUTHENTICATION
  // ============================================================

  function isAuthenticated() {
    return sessionStorage.getItem(AUTH_KEY) === "true";
  }

  function setAuthenticated(value) {
    if (value) sessionStorage.setItem(AUTH_KEY, "true");
    else sessionStorage.removeItem(AUTH_KEY);
  }

  function showLogin() {
    App.$id("loginSection").classList.remove("d-none");
    App.$id("adminPanel").classList.add("d-none");
  }

  async function showAdmin() {
    App.$id("loginSection").classList.add("d-none");
    App.$id("adminPanel").classList.remove("d-none");
    await renderAll();
  }

  function initAuth() {
    App.$id("loginForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const user = App.$id("adminUser").value.trim();
      const pass = App.$id("adminPass").value;
      const err = App.$id("loginError");

      if (user === ADMIN_USER && pass === ADMIN_PASS) {
        setAuthenticated(true);
        err.classList.add("d-none");
        App.$id("adminPass").value = "";
        await showAdmin();
      } else {
        err.classList.remove("d-none");
        App.$id("adminPass").value = "";
        App.$id("adminPass").focus();
      }
    });

    App.$id("logoutBtn").addEventListener("click", () => {
      setAuthenticated(false);
      App.$id("adminUser").value = "";
      App.$id("adminPass").value = "";
      App.$id("loginError").classList.add("d-none");
      showLogin();
    });
  }

  // ============================================================
  // COUNTS
  // ============================================================

  function setCounts(state) {
    App.$id("countLO").textContent = String(state.learningOutcomes.length);
    App.$id("countSkills").textContent = String(state.employabilitySkills.length);
    App.$id("countLOMap").textContent = String(state.loSkillMappings.length);
    App.$id("countStudents").textContent = String(state.students.length);
    App.$id("countPrograms").textContent = String(state.programs.length);
    App.$id("countCourses").textContent = String(state.courses.length);
    App.$id("countEnrollments").textContent = String(state.enrollments.length);
    App.$id("countCocurrLogs").textContent = String(state.studentCoCurriculum.length);
  }

  // ============================================================
  // ANALYTICS
  // ============================================================

  function tierColor(index) {
    if (index >= 80) return { bg: "#16a34a", label: "Excellent" };
    if (index >= 65) return { bg: "#3b82f6", label: "Good" };
    if (index >= 50) return { bg: "#f59e0b", label: "Developing" };
    return { bg: "#ef4444", label: "Needs Improvement" };
  }

  function renderAnalytics(state) {
    // Compute MI for every student
    const studentScores = state.students.map((s) => {
      const m = App.computeMarketability(state, s.student_id);
      const program = state.programs.find((p) => p.program_id === s.program_id);
      return {
        student: s,
        program,
        ...m
      };
    });

    // ---- Average MI by Program ----
    const programAnalyticsEl = App.$id("programAnalytics");
    if (state.programs.length === 0) {
      programAnalyticsEl.innerHTML = `<div class="text-secondary small">No programs in database yet.</div>`;
    } else {
      const byProgram = state.programs.map((p) => {
        const studs = studentScores.filter((s) => s.program?.program_id === p.program_id);
        const avg = studs.length
          ? Math.round(studs.reduce((acc, s) => acc + s.marketabilityIndex, 0) / studs.length)
          : 0;
        return {
          program: p,
          studentCount: studs.length,
          avgMI: avg
        };
      });

      programAnalyticsEl.innerHTML = byProgram
        .map((row) => {
          const color = tierColor(row.avgMI);
          const widthPct = Math.max(2, row.avgMI);
          return `
          <div class="mb-3" data-testid="program-analytics-row">
            <div class="d-flex justify-content-between mb-1">
              <div class="small">
                <span class="fw-semibold">${App.escapeHtml(row.program.program_name)}</span>
                <span class="text-secondary"> · ${row.studentCount} student${row.studentCount === 1 ? "" : "s"}</span>
              </div>
              <div class="mono small">${row.avgMI}</div>
            </div>
            <div class="progress" style="height: 8px;">
              <div class="progress-bar" style="width: ${widthPct}%; background: ${color.bg};"></div>
            </div>
          </div>`;
        })
        .join("");
    }

    // ---- Top Students Leaderboard ----
    const leaderEl = App.$id("leaderboard");
    if (studentScores.length === 0) {
      leaderEl.innerHTML = `<div class="text-secondary small">No students in database yet.</div>`;
    } else {
      const top = studentScores
        .slice()
        .sort((a, b) => b.marketabilityIndex - a.marketabilityIndex)
        .slice(0, 10);

      leaderEl.innerHTML = top
        .map((s, idx) => {
          const color = tierColor(s.marketabilityIndex);
          const medal = idx === 0 ? "&#129351;" : idx === 1 ? "&#129352;" : idx === 2 ? "&#129353;" : `#${idx + 1}`;
          return `
          <div class="d-flex justify-content-between align-items-center py-2" style="border-bottom: 1px solid var(--border);" data-testid="leaderboard-row">
            <div class="d-flex align-items-center gap-2">
              <span class="mono small text-secondary" style="min-width: 32px;">${medal}</span>
              <div>
                <div class="fw-semibold small">${App.escapeHtml(s.student.full_name)}</div>
                <div class="text-secondary small">${App.escapeHtml(s.student.matric_no)} · ${App.escapeHtml(s.program?.program_name ?? "—")}</div>
              </div>
            </div>
            <div class="text-end">
              <div class="mono fw-semibold">${s.marketabilityIndex}</div>
              <div class="small" style="color: ${color.bg};">${color.label}</div>
            </div>
          </div>`;
        })
        .join("");
    }

    // ---- Tier Distribution ----
    const tierEl = App.$id("tierDistribution");
    if (studentScores.length === 0) {
      tierEl.innerHTML = `<div class="text-secondary small">No students to analyze.</div>`;
    } else {
      const tiers = {
        Excellent: { count: 0, color: "#16a34a", min: 80 },
        Good: { count: 0, color: "#3b82f6", min: 65 },
        Developing: { count: 0, color: "#f59e0b", min: 50 },
        "Needs Improvement": { count: 0, color: "#ef4444", min: 0 }
      };

      for (const s of studentScores) {
        tiers[s.tier].count += 1;
      }

      const total = studentScores.length;
      tierEl.innerHTML = `
        <div class="d-flex" style="height: 24px; border-radius: 8px; overflow: hidden; border: 1px solid var(--border);">
          ${Object.entries(tiers)
            .map(([name, t]) => {
              const pct = total ? (t.count / total) * 100 : 0;
              return pct > 0
                ? `<div style="background: ${t.color}; width: ${pct}%; display: flex; align-items: center; justify-content: center; color: white; font-size: 0.75rem; font-weight: 600;" title="${name}: ${t.count}">${t.count > 0 ? t.count : ""}</div>`
                : "";
            })
            .join("")}
        </div>
        <div class="d-flex flex-wrap gap-3 mt-3">
          ${Object.entries(tiers)
            .map(
              ([name, t]) => `
              <div class="d-flex align-items-center gap-2 small">
                <span style="display:inline-block; width: 12px; height: 12px; border-radius: 3px; background: ${t.color};"></span>
                <span>${name}: <span class="mono">${t.count}</span></span>
              </div>`
            )
            .join("")}
        </div>`;
    }
  }

  // ============================================================
  // LEARNING OUTCOMES
  // ============================================================

  function clearLOForm() {
    App.$id("lo_id").value = "";
    App.$id("lo_code").value = "";
    App.$id("domain").value = "Academic";
    App.$id("description").value = "";
  }

  function renderLOTable(state) {
    const filter = App.$id("filter").value.trim().toLowerCase();
    const rows = state.learningOutcomes
      .slice()
      .sort((a, b) => String(a.lo_code).localeCompare(String(b.lo_code)))
      .filter((lo) => {
        if (!filter) return true;
        return (
          String(lo.lo_code).toLowerCase().includes(filter) ||
          String(lo.description).toLowerCase().includes(filter)
        );
      });

    const tbody = App.$id("loTable");
    if (rows.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" class="text-secondary text-center py-3">${
        state.learningOutcomes.length === 0
          ? "No Learning Outcomes yet. Create your first one."
          : "No matches."
      }</td></tr>`;
      return;
    }

    tbody.innerHTML = rows
      .map(
        (lo) => `
        <tr>
          <td class="mono">${App.escapeHtml(lo.lo_code)}</td>
          <td>${App.escapeHtml(lo.domain)}</td>
          <td>${App.escapeHtml(lo.description)}</td>
          <td class="text-end">
            <button class="btn btn-sm btn-outline-secondary me-1" data-edit="${App.escapeHtml(lo.lo_id)}">Edit</button>
            <button class="btn btn-sm btn-outline-danger" data-del="${App.escapeHtml(lo.lo_id)}">Delete</button>
          </td>
        </tr>`
      )
      .join("");

    tbody.querySelectorAll("[data-edit]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-edit");
        const state = await App.get();
        const cur = state.learningOutcomes.find((x) => x.lo_id === id);
        if (!cur) return;
        App.$id("lo_id").value = cur.lo_id;
        App.$id("lo_code").value = cur.lo_code;
        App.$id("domain").value = cur.domain;
        App.$id("description").value = cur.description;
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    });

    tbody.querySelectorAll("[data-del]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-del");
        if (!id || !confirm("Delete this learning outcome?")) return;
        try {
          await App.LearningOutcomes.delete(id);
          App.notify("Learning outcome deleted", "success");
          await renderAll();
        } catch (err) {
          App.notify(`Delete failed: ${err.message}`, "danger");
        }
      });
    });
  }

  // ============================================================
  // STUDENTS
  // ============================================================

  function clearStudentForm() {
    App.$id("stu_full_name").value = "";
    App.$id("stu_matric_no").value = "";
    App.$id("stu_email").value = "";
    App.$id("stu_program_id").value = "";
  }

  function renderStudentProgramDropdown(state) {
    const sel = App.$id("stu_program_id");
    const helpEl = App.$id("studentFormHelp");

    if (state.programs.length === 0) {
      sel.innerHTML = `<option value="">No programs available</option>`;
      sel.disabled = true;
      if (helpEl) {
        helpEl.innerHTML = `<span class="text-danger">No programs exist.</span> Switch to the <b>Programs</b> tab to create one.`;
      }
    } else {
      sel.disabled = false;
      sel.innerHTML =
        `<option value="">Select a program...</option>` +
        state.programs
          .map(
            (p) =>
              `<option value="${App.escapeHtml(p.program_id)}">${App.escapeHtml(p.program_name)} (${App.escapeHtml(p.faculty)})</option>`
          )
          .join("");
      if (helpEl) {
        helpEl.textContent = `${state.programs.length} program(s) available.`;
      }
    }
  }

  function renderStudentTable(state) {
    const tbody = App.$id("studentTable");
    const programById = new Map(state.programs.map((p) => [p.program_id, p]));

    if (state.students.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" class="text-secondary text-center py-3">No students yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = state.students
      .map((s) => {
        const program = programById.get(s.program_id);
        return `
        <tr>
          <td class="mono">${App.escapeHtml(s.matric_no)}</td>
          <td>${App.escapeHtml(s.full_name)}</td>
          <td class="small text-secondary">${App.escapeHtml(s.email)}</td>
          <td class="small">${App.escapeHtml(program?.program_name ?? "—")}</td>
        </tr>`;
      })
      .join("");
  }

  // ============================================================
  // PROGRAMS
  // ============================================================

  function clearProgramForm() {
    App.$id("prog_name").value = "";
    App.$id("prog_faculty").value = "";
    App.$id("prog_credits").value = "120";
  }

  function renderProgramTable(state) {
    const tbody = App.$id("programTable");
    if (state.programs.length === 0) {
      tbody.innerHTML = `<tr><td colspan="3" class="text-secondary text-center py-3">No programs yet.</td></tr>`;
      return;
    }
    tbody.innerHTML = state.programs
      .map(
        (p) => `
        <tr>
          <td>${App.escapeHtml(p.program_name)}</td>
          <td class="small text-secondary">${App.escapeHtml(p.faculty)}</td>
          <td class="text-end mono">${p.total_credits}</td>
        </tr>`
      )
      .join("");
  }

  // ============================================================
  // SKILLS
  // ============================================================

  function clearSkillForm() {
    App.$id("sk_name").value = "";
    App.$id("sk_type").value = "Cognitive";
    App.$id("sk_desc").value = "";
  }

  function renderSkillTable(state) {
    const tbody = App.$id("skillTable");
    if (state.employabilitySkills.length === 0) {
      tbody.innerHTML = `<tr><td colspan="3" class="text-secondary text-center py-3">No skills yet.</td></tr>`;
      return;
    }
    tbody.innerHTML = state.employabilitySkills
      .map(
        (s) => `
        <tr>
          <td>${App.escapeHtml(s.skill_name)}</td>
          <td class="small">${App.escapeHtml(s.skill_type)}</td>
          <td class="small text-secondary">${App.escapeHtml(s.description || "—")}</td>
        </tr>`
      )
      .join("");
  }

  // ============================================================
  // RENDER ALL
  // ============================================================

  async function renderAll() {
    try {
      const state = await App.get(true);
      setCounts(state);
      renderAnalytics(state);
      renderLOTable(state);
      renderStudentProgramDropdown(state);
      renderStudentTable(state);
      renderProgramTable(state);
      renderSkillTable(state);
    } catch (err) {
      console.error("Failed to render admin panel:", err);
      App.notify("Failed to load data from Oracle database", "danger");
    }
  }

  // ============================================================
  // HANDLERS
  // ============================================================

  function initHandlers() {
    App.$id("clearBtn").addEventListener("click", () => clearLOForm());
    App.$id("studentClearBtn").addEventListener("click", () => clearStudentForm());
    App.$id("programClearBtn").addEventListener("click", () => clearProgramForm());
    App.$id("skillClearBtn").addEventListener("click", () => clearSkillForm());

    App.$id("filter").addEventListener("input", async () => {
      const state = await App.get();
      renderLOTable(state);
    });

    // Learning Outcome submit
    App.$id("loForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const lo_id = App.$id("lo_id").value || null;
      const payload = {
        lo_code: App.$id("lo_code").value.trim(),
        domain: App.$id("domain").value,
        description: App.$id("description").value.trim()
      };
      if (lo_id) payload.lo_id = lo_id;
      if (!payload.lo_code || !payload.description) {
        App.notify("Please fill in all required fields", "danger");
        return;
      }
      try {
        await App.LearningOutcomes.upsert(payload);
        App.notify(lo_id ? "Learning outcome updated" : "Learning outcome created", "success");
        clearLOForm();
        await renderAll();
      } catch (err) {
        App.notify(`Save failed: ${err.message}`, "danger");
      }
    });

    // Student submit
    App.$id("studentForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const payload = {
        full_name: App.$id("stu_full_name").value.trim(),
        matric_no: App.$id("stu_matric_no").value.trim(),
        email: App.$id("stu_email").value.trim(),
        program_id: App.$id("stu_program_id").value
      };
      if (!payload.full_name || !payload.matric_no || !payload.email || !payload.program_id) {
        App.notify("Please fill in all required fields including program selection", "danger");
        return;
      }
      try {
        await App.Students.create(payload);
        App.notify(`Student "${payload.full_name}" created`, "success");
        clearStudentForm();
        await renderAll();
      } catch (err) {
        App.notify(`Failed to create student: ${err.message}`, "danger");
      }
    });

    // Program submit
    App.$id("programForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const payload = {
        program_name: App.$id("prog_name").value.trim(),
        faculty: App.$id("prog_faculty").value.trim(),
        total_credits: Number(App.$id("prog_credits").value) || 120
      };
      if (!payload.program_name || !payload.faculty) {
        App.notify("Please fill in all required fields", "danger");
        return;
      }
      try {
        await App.Programs.create(payload);
        App.notify(`Program "${payload.program_name}" created`, "success");
        clearProgramForm();
        await renderAll();
      } catch (err) {
        App.notify(`Failed to create program: ${err.message}`, "danger");
      }
    });

    // Skill submit
    App.$id("skillForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const payload = {
        skill_name: App.$id("sk_name").value.trim(),
        skill_type: App.$id("sk_type").value,
        description: App.$id("sk_desc").value.trim()
      };
      if (!payload.skill_name) {
        App.notify("Skill name is required", "danger");
        return;
      }
      try {
        await App.Skills.create(payload);
        App.notify(`Skill "${payload.skill_name}" created`, "success");
        clearSkillForm();
        await renderAll();
      } catch (err) {
        App.notify(`Failed to create skill: ${err.message}`, "danger");
      }
    });
  }

  async function init() {
    initAuth();
    initHandlers();
    if (isAuthenticated()) {
      await showAdmin();
    } else {
      showLogin();
    }
  }

  init();
})();
