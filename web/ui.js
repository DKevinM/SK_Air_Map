// EXISTING
window.showStationModal = function (station) {
  const panel = document.getElementById("station-panel");
  if (!panel) return;

  panel.innerHTML = station.html;
  panel.style.display = "block";
};


// ---------------- PANEL TOGGLE ----------------
document.addEventListener("DOMContentLoaded", () => {
  const panel = document.getElementById("aqhi-panel");
  const header = document.getElementById("aqhi-header");

  if (!panel || !header) return;



  header.addEventListener("click", () => {
    panel.classList.toggle("collapsed");
  });
});


// ---------------- CLEAR SELECTION ----------------
window.clearSelection = function () {

  // 1) Clear map layers (stations + circles + markers)
  if (window.layers?.click) {
    window.layers.click.clearLayers();
  }

  // 2) Clear AQHI panel
  const aqhi = document.getElementById("aqhi-content");
  if (aqhi) aqhi.innerHTML = "";

  // 3) Clear station gauges
  const gauges = document.getElementById("station-gauges");
  if (gauges) gauges.innerHTML = "";

  // 4) Optional: clear any modal
  const modal = document.getElementById("station-panel");
  if (modal) modal.style.display = "none";

  //  PANEL RESET
  const panel = document.getElementById("panel");
  if (panel) panel.classList.remove("collapsed");  
};
