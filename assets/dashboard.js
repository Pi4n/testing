/* global window, Chart */
/**
 * Dashboard Logic
 * Displays live Marketability Index for selected student.
 * All data fetched from Oracle via /.netlify/functions/get-state.
 */

(function () {
  "use strict";

  const App = window.App;
  let radar = null;

  function getSelectedStudentId() {
    const sel = App.$id("studentSelect");
    return sel.value || null;
  }

  function setTierBadge(tier, index) {
    const badge = App.$id("tierBadge");
    badge.textContent = tier;
    badge.className =
      index >= 80
        ? "badge text-bg-success"
        : index >= 65
        ? "badge text-bg-primary"
        : index >= 50
        ? "badge text-bg-warning"
        : "badge text-bg-danger";
  }

  function fmtPct01(x) {
    return `${Math.round(x * 100)}%`;
  }

  function showEmpty(show) {
    App.$id("emptyState").classList.toggle("d-none", !show);
  }

  function showLoading(show) {
    App.$id("loadingState").classList.toggle("d-none", !show);
  }

  async function render() {
    showLoading(true);

    let state;
    try {
      state = await App.get(true);
    } catch (err) {
      showLoading(false);
      App.notify("Failed to load data from Oracle", "danger");
      return;
    }

    showLoading(false);

    const sel = App.$id("studentSelect");

    if (state.students.length === 0) {
      showEmpty(true);
      sel.innerHTML = "";
      // Clear KPI displays
      App.$id("miValue").textContent = "—";
      App.$id("miExplain").textContent = "Add students to begin tracking";
      App.$id("acadText").textContent = "—";
      App.$id("cocText").textContent = "—";
      App.$id("acadBar").style.width = "0%";
      App.$id("cocBar").style.width = "0%";
      App.$id("tierBadge").textContent = "—";
      App.$id("tierBadge").className = "badge text-bg-secondary align-self-start";
      return;
    }

    showEmpty(false);

    const prior = getSelectedStudentId();
    sel.innerHTML = state.students
      .map(
        (s) =>
          `<option value="${App.escapeHtml(s.student_id)}">${App.escapeHtml(s.full_name)} (${App.escapeHtml(s.matric_no)})</option>`
      )
      .join("");

    if (prior && state.students.some((s) => s.student_id === prior)) {
      sel.value = prior;
    }

    const studentId = getSelectedStudentId() || state.students[0].student_id;
    sel.value = studentId;

    const student = state.students.find((s) => s.student_id === studentId);
    const program = state.programs.find((p) => p.program_id === student?.program_id);

    App.$id("studentMeta").innerHTML = [
      `<div>${App.escapeHtml(student?.email ?? "")}</div>`,
      `<div class="small">${App.escapeHtml(program?.program_name ?? "—")}</div>`
    ].join("");

    const m = App.computeMarketability(state, studentId);
    const acadPct = Math.round(m.academic01 * 100);
    const cocPct = Math.round(m.coCurr01 * 100);

    App.$id("acadBar").style.width = `${acadPct}%`;
    App.$id("cocBar").style.width = `${cocPct}%`;

    App.$id("acadText").textContent = `GPA: ${m.academicDetails.gpa} | Completed credits: ${m.academicDetails.totalCredits}`;
    App.$id("cocText").textContent = `Activities logged: ${m.coCurrDetails.totalActivities} | Breadth bonus: ${fmtPct01(m.breadth01)}`;

    App.$id("miValue").textContent = String(m.marketabilityIndex);
    App.$id("miExplain").textContent = `Academic ${acadPct}% + Co-curricular ${cocPct}% + breadth bonus`;
    setTierBadge(m.tier, m.marketabilityIndex);

    const data = {
      labels: ["Academic", "Co-curricular"],
      datasets: [
        {
          label: "Achievement",
          data: [acadPct, cocPct],
          borderColor: "rgba(59, 130, 246, 0.95)",
          backgroundColor: "rgba(59, 130, 246, 0.25)",
          pointBackgroundColor: "rgba(59, 130, 246, 1)",
          pointBorderColor: "#1e293b",
          pointHoverBackgroundColor: "#93c5fd",
          pointHoverBorderColor: "#1e293b"
        }
      ]
    };

    const ctx = App.$id("radarChart").getContext("2d");
    if (!radar) {
      radar = new Chart(ctx, {
        type: "radar",
        data,
        options: {
          responsive: true,
          scales: {
            r: {
              min: 0,
              max: 100,
              ticks: { stepSize: 20, color: "#94a3b8", backdropColor: "transparent" },
              grid: { color: "rgba(148, 163, 184, 0.15)" },
              angleLines: { color: "rgba(148, 163, 184, 0.15)" },
              pointLabels: { color: "#e2e8f0", font: { size: 12, weight: "500" } }
            }
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (tt) => `${tt.label}: ${tt.formattedValue}/100`
              }
            }
          }
        }
      });
    } else {
      radar.data = data;
      radar.update();
    }
  }

  function init() {
    App.$id("studentSelect").addEventListener("change", () => render());
    render();
  }

  init();
})();
