async function lookupAddress() {
  const address = document.getElementById("addressInput").value;
  if (!address) return;

  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`;

  try {
    const res = await fetch(url);
    const data = await res.json();

    if (!data || data.length === 0) {
      alert("Address not found");
      return;
    }

    const lat = parseFloat(data[0].lat);
    const lon = parseFloat(data[0].lon);

    console.log("[LiveMap] Address →", lat, lon);

    // move map
    if (window.map) {
      window.map.setView([lat, lon], 10);
    }

    // open panel
    const panel = document.getElementById("panel");
    if (panel) panel.classList.remove("collapsed");

    // call EXISTING pipeline
    if (typeof window.handleMapClick === "function") {
      await window.handleMapClick(lat, lon, window.map);
    } else {
      console.error("handleMapClick not found");
    }

  } catch (err) {
    console.error("Geocode error:", err);
  }
}


window.lookupAddress = lookupAddress;


