/* global window */
/**
 * Activity Logging Logic
 * - Staff Module: Courses, Activities, Activity→Skill mappings
 * - Student Module: Enrollments, Participation
 * All data live from Oracle via Netlify Functions with Option B transformations.
 */

(function () {
  "use strict";

  const App = window.App;

  // ============================================================
  // HELPERS
  // ============================================================

  function option(label, value) {
    return `<option value="${App.escapeHtml(value)}">${App.escapeHtml(label)}</option>`;
  }

  function placeholderOption(label) {
    return `<option value="" disabled>${App.escapeHtml(label)}</option>`;
  }

  function setCounts(state) {
    App.$id("countCourses").textContent = String(state.courses.length);
    App.$id("countActivities").textContent = String(state.coCurriculum.length);
    App.$id("countSkills").textContent = String(state.employabilitySkills.length);
    App.$id("countStudents").textContent = String(state.students.length);
  }

  // ============================================================
  // DROPDOWN POPULATION
  // ============================================================

  function renderSelects(state) {
    // Program dropdown (for course form)
    const programSel = App.$id("programSelect");
    if (state.programs.length === 0) {
      programSel.innerHTML = placeholderOption("No programs available - add via API");
      programSel.disabled = true;
    } else {
      programSel.disabled = false;
      programSel.innerHTML = state.programs
        .map((p) => option(p.program_name, p.program_id))
        .join("");
    }

    // Activity dropdown
    const cocSel = App.$id("map_cocurr");
    if (state.coCurriculum.length === 0) {
      cocSel.innerHTML = placeholderOption("No activities yet - add one above");
      cocSel.disabled = true;
    } else {
      cocSel.disabled = false;
      cocSel.innerHTML = state.coCurriculum
        .map((a) => option(a.activity_name, a.cocurr_id))
        .join("");
    }

    // Skill dropdown
    const skillSel = App.$id("map_skill");
    if (state.employabilitySkills.length === 0) {
      skillSel.innerHTML = placeholderOption("No skills available");
      skillSel.disabled = true;
    } else {
      skillSel.disabled = false;
      skillSel.innerHTML = state.employabilitySkills
        .map((s) => option(s.skill_name, s.skill_id))
        .join("");
    }

    // Student dropdowns
    const enrStudent = App.$id("enr_student");
    const ccStudent = App.$id("cc_student");

    if (state.students.length === 0) {
      const empty = placeholderOption("No students yet - create in Admin");
      enrStudent.innerHTML = empty;
      ccStudent.innerHTML = empty;
      enrStudent.disabled = true;
      ccStudent.disabled = true;
    } else {
      enrStudent.disabled = false;
      ccStudent.disabled = false;
      const studentOptions = state.students
        .map((s) => option(`${s.full_name} (${s.matric_no})`, s.student_id))
        .join("");
      enrStudent.innerHTML = studentOptions;
      ccStudent.innerHTML = studentOptions;
    }

    // Course dropdown for enrollments
    const enrCourse = App.$id("enr_course");
    if (state.courses.length === 0) {
      enrCourse.innerHTML = placeholderOption("No courses yet - add one above");
      enrCourse.disabled = true;
    } else {
      enrCourse.disabled = false;
      enrCourse.innerHTML = state.courses
        .map((c) => option(`${c.course_code} — ${c.course_name}`, c.course_id))
        .join("");
    }

    // Activity dropdown for participation
    const ccAct = App.$id("cc_activity");
    if (state.coCurriculum.length === 0) {
      ccAct.innerHTML = placeholderOption("No activities yet - add one above");
      ccAct.disabled = true;
    } else {
      ccAct.disabled = false;
      ccAct.innerHTML = state.coCurriculum
        .map((a) => option(`${a.activity_name} (${a.category})`, a.cocurr_id))
        .join("");
    }
  }

  // ============================================================
  // TABLE RENDERING
  // ============================================================

  function renderCcMappings(state) {
    const tbody = App.$id("ccMapTable");
    const skillById = new Map(state.employabilitySkills.map((s) => [s.skill_id, s]));
    const actById = new Map(state.coCurriculum.map((a) => [a.cocurr_id, a]));

    if (state.coCurrSkillMappings.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="text-secondary text-center py-3">No mappings yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = state.coCurrSkillMappings
      .map((m) => {
        const act = actById.get(m.cocurr_id);
        const sk = skillById.get(m.skill_id);
        return `
        <tr>
          <td>${App.escapeHtml(act?.activity_name ?? "—")}</td>
          <td>${App.escapeHtml(sk?.skill_name ?? "—")}</td>
          <td><span class="small">${App.escapeHtml(m.knowledge_type ?? "—")}</span></td>
          <td class="text-end mono">${Number(m.mapping_strength ?? 0).toFixed(2)}</td>
          <td class="text-end">
            <button class="btn btn-sm btn-outline-danger" data-del-ccmap="${App.escapeHtml(m.mapping_id)}" data-testid="cc-map-delete-btn-${App.escapeHtml(m.mapping_id)}">Delete</button>
          </td>
        </tr>`;
      })
      .join("");

    tbody.querySelectorAll("[data-del-ccmap]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-del-ccmap");
        if (!id) return;
        if (!confirm("Delete this mapping?")) return;
        try {
          await App.Cocurriculum.deleteSkillMapping(id);
          App.notify("Mapping deleted", "success");
          await renderAll();
        } catch (err) {
          App.notify(`Delete failed: ${err.message}`, "danger");
        }
      });
    });
  }

  function renderStudentTables(state) {
    const studentById = new Map(state.students.map((s) => [s.student_id, s]));
    const courseById = new Map(state.courses.map((c) => [c.course_id, c]));
    const actById = new Map(state.coCurriculum.map((a) => [a.cocurr_id, a]));

    const enrTbody = App.$id("enrTable");
    const ccTbody = App.$id("ccTable");

    enrTbody.innerHTML =
      state.enrollments.length === 0
        ? `<tr><td colspan="6" class="text-secondary text-center py-3">No enrollments logged.</td></tr>`
        : state.enrollments
            .map((e) => {
              const stu = studentById.get(e.student_id);
              const crs = courseById.get(e.course_id);
              return `
              <tr>
                <td class="mono">${App.escapeHtml(stu?.matric_no ?? "—")}</td>
                <td>${App.escapeHtml(crs?.course_code ?? "—")}</td>
                <td>${App.escapeHtml(e.semester ?? "")}</td>
                <td><span class="small">${App.escapeHtml(e.status ?? "")}</span></td>
                <td>${App.escapeHtml(e.grade ?? "")}</td>
                <td class="text-end">
                  <button class="btn btn-sm btn-outline-danger" data-del-enr="${App.escapeHtml(e.enrollment_id)}" data-testid="enrollment-delete-btn-${App.escapeHtml(e.enrollment_id)}">Delete</button>
                </td>
              </tr>`;
            })
            .join("");

    ccTbody.innerHTML =
      state.studentCoCurriculum.length === 0
        ? `<tr><td colspan="6" class="text-secondary text-center py-3">No co-curricular participation logged.</td></tr>`
        : state.studentCoCurriculum
            .map((r) => {
              const stu = studentById.get(r.student_id);
              const act = actById.get(r.cocurr_id);
              return `
              <tr>
                <td class="mono">${App.escapeHtml(stu?.matric_no ?? "—")}</td>
                <td>${App.escapeHtml(act?.activity_name ?? "—")}</td>
                <td>${App.escapeHtml(r.semester ?? "")}</td>
                <td>${App.escapeHtml(r.role ?? "")}</td>
                <td class="text-end mono">${Number(r.achievement ?? 0).toFixed(2)}</td>
                <td class="text-end">
                  <button class="btn btn-sm btn-outline-danger" data-del-cc="${App.escapeHtml(r.record_id)}" data-testid="participation-delete-btn-${App.escapeHtml(r.record_id)}">Delete</button>
                </td>
              </tr>`;
            })
            .join("");

    enrTbody.querySelectorAll("[data-del-enr]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-del-enr");
        if (!confirm("Delete this enrollment?")) return;
        try {
          await App.Enrollments.delete(id);
          App.notify("Enrollment deleted", "success");
          await renderAll();
        } catch (err) {
          App.notify(`Delete failed: ${err.message}`, "danger");
        }
      });
    });

    ccTbody.querySelectorAll("[data-del-cc]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-del-cc");
        if (!confirm("Delete this participation record?")) return;
        try {
          await App.Cocurriculum.deleteParticipation(id);
          App.notify("Participation deleted", "success");
          await renderAll();
        } catch (err) {
          App.notify(`Delete failed: ${err.message}`, "danger");
        }
      });
    });
  }

  // ============================================================
  // FORM CLEARERS
  // ============================================================

  function clearCourseForm() {
    ["course_id", "course_code", "course_name"].forEach((id) => (App.$id(id).value = ""));
    App.$id("course_type").value = "Core";
    App.$id("credit_hours").value = "3";
  }

  function clearActivityForm() {
    ["cocurr_id", "activity_name", "organizer", "category"].forEach((id) => (App.$id(id).value = ""));
    App.$id("is_credit_bearing").value = "false";
    App.$id("activity_credit_hours").value = "0";
  }

  function clearEnrollmentForm() {
    App.$id("enr_semester").value = "";
    App.$id("enr_status").value = "In Progress";
    App.$id("enr_grade").value = "A";
  }

  function clearParticipationForm() {
    App.$id("cc_semester").value = "";
    App.$id("cc_role").value = "";
    App.$id("cc_achievement").value = "0.7";
  }

  // ============================================================
  // MAIN RENDER
  // ============================================================

  async function renderAll() {
    try {
      const state = await App.get(true);
      const empty = App.$id("emptyState");
      const ok =
        state.programs.length > 0 &&
        state.students.length > 0 &&
        state.employabilitySkills.length > 0;
      empty.classList.toggle("d-none", ok);

      setCounts(state);
      renderSelects(state);
      renderCcMappings(state);
      renderStudentTables(state);
    } catch (err) {
      console.error("Failed to render logging page:", err);
      App.notify("Failed to load data", "danger");
    }
  }

  // ============================================================
  // FORM HANDLERS
  // ============================================================

  function initHandlers() {
    App.$id("courseClearBtn").addEventListener("click", () => clearCourseForm());
    App.$id("activityClearBtn").addEventListener("click", () => clearActivityForm());
    App.$id("enrClearBtn").addEventListener("click", () => clearEnrollmentForm());
    App.$id("ccClearBtn").addEventListener("click", () => clearParticipationForm());

    // COURSE FORM
    App.$id("courseForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const program_id = App.$id("programSelect").value;
      const course_id = App.$id("course_id").value || null;

      const payload = {
        course_code: App.$id("course_code").value.trim(),
        course_name: App.$id("course_name").value.trim(),
        course_type: App.$id("course_type").value,
        credit_hours: Number(App.$id("credit_hours").value),
        program_id
      };
      if (course_id) payload.course_id = course_id;

      if (!payload.course_code || !payload.course_name || !program_id) {
        App.notify("Please fill in all required fields", "danger");
        return;
      }

      try {
        await App.Courses.upsert(payload);
        App.notify(course_id ? "Course updated" : "Course created", "success");
        clearCourseForm();
        await renderAll();
      } catch (err) {
        App.notify(`Save failed: ${err.message}`, "danger");
      }
    });

    // ACTIVITY FORM
    App.$id("activityForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const cocurr_id = App.$id("cocurr_id").value || null;
      const payload = {
        activity_name: App.$id("activity_name").value.trim(),
        organizer: App.$id("organizer").value.trim(),
        category: App.$id("category").value.trim(),
        is_credit_bearing: App.$id("is_credit_bearing").value === "true",
        credit_hours: Number(App.$id("activity_credit_hours").value)
      };
      if (cocurr_id) payload.cocurr_id = cocurr_id;

      if (!payload.activity_name || !payload.organizer || !payload.category) {
        App.notify("Please fill in all required fields", "danger");
        return;
      }

      try {
        await App.Cocurriculum.upsertActivity(payload);
        App.notify(cocurr_id ? "Activity updated" : "Activity created", "success");
        clearActivityForm();
        await renderAll();
      } catch (err) {
        App.notify(`Save failed: ${err.message}`, "danger");
      }
    });

    // SKILL MAPPING FORM
    App.$id("ccSkillMapForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const payload = {
        cocurr_id: App.$id("map_cocurr").value,
        skill_id: App.$id("map_skill").value,
        knowledge_type: App.$id("map_knowledge").value,
        mapping_strength: Number(App.$id("map_strength").value)
      };

      if (!payload.cocurr_id || !payload.skill_id) {
        App.notify("Please select both activity and skill", "danger");
        return;
      }

      if (Number.isNaN(payload.mapping_strength)) {
        App.notify("Invalid strength value", "danger");
        return;
      }

      try {
        await App.Cocurriculum.createSkillMapping(payload);
        App.notify("Skill mapping added", "success");
        await renderAll();
      } catch (err) {
        App.notify(`Save failed: ${err.message}`, "danger");
      }
    });

    // ENROLLMENT FORM
    App.$id("enrollmentForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const payload = {
        student_id: App.$id("enr_student").value,
        course_id: App.$id("enr_course").value,
        semester: App.$id("enr_semester").value.trim(),
        status: App.$id("enr_status").value,
        grade: App.$id("enr_grade").value
      };

      if (!payload.student_id || !payload.course_id || !payload.semester) {
        App.notify("Please fill in all required fields", "danger");
        return;
      }

      try {
        await App.Enrollments.create(payload);
        App.notify("Enrollment added", "success");
        clearEnrollmentForm();
        await renderAll();
      } catch (err) {
        App.notify(`Save failed: ${err.message}`, "danger");
      }
    });

    // PARTICIPATION FORM
    App.$id("participationForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const payload = {
        student_id: App.$id("cc_student").value,
        cocurr_id: App.$id("cc_activity").value,
        semester: App.$id("cc_semester").value.trim(),
        role: App.$id("cc_role").value.trim(),
        achievement: Number(App.$id("cc_achievement").value)
      };

      if (!payload.student_id || !payload.cocurr_id || !payload.semester || !payload.role) {
        App.notify("Please fill in all required fields", "danger");
        return;
      }

      if (Number.isNaN(payload.achievement)) {
        App.notify("Invalid achievement value", "danger");
        return;
      }

      try {
        await App.Cocurriculum.createParticipation(payload);
        App.notify("Participation added", "success");
        clearParticipationForm();
        await renderAll();
      } catch (err) {
        App.notify(`Save failed: ${err.message}`, "danger");
      }
    });
  }

  async function init() {
    initHandlers();
    await renderAll();
  }

  init();
})();
