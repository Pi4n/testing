/* global window */
/**
 * Index Page Logic — Landing page
 * Verifies live database connection on page load.
 * No seed/reset/mock functionality.
 */

(function () {
  "use strict";

  const App = window.App;
  if (!App) return;

  async function checkConnection() {
    const statusEl = document.getElementById("dbStatus");
    if (!statusEl) return;

    try {
      const state = await App.get();
      const totals = {
        programs: state.programs?.length ?? 0,
        students: state.students?.length ?? 0,
        courses: state.courses?.length ?? 0,
        skills: state.employabilitySkills?.length ?? 0
      };
      const total = totals.programs + totals.students + totals.courses + totals.skills;

      if (total === 0) {
        statusEl.className = "text-secondary";
        statusEl.textContent = "Connected to Oracle database. Tables are currently empty - use Admin Management to begin.";
      } else {
        statusEl.className = "text-success";
        statusEl.innerHTML = `Connected to Oracle database. Live records: <span class="mono">${totals.programs}</span> programs, <span class="mono">${totals.students}</span> students, <span class="mono">${totals.courses}</span> courses, <span class="mono">${totals.skills}</span> skills.`;
      }
    } catch (err) {
      statusEl.className = "text-danger";
      statusEl.textContent = "Could not connect to Oracle database. Please verify Netlify Functions are deployed and environment variables are set.";
    }
  }

  checkConnection();
})();
