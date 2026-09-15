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

    // Real bug, confirmed directly (2026-09-15, ACA_realestate): a bare
    // or near-bare postal code isn't reliably in Nominatim's Canadian
    // data. It doesn't just fail loudly - it silently falls back to
    // matching whatever place name IS in the query (e.g.
    // "T5K 0N2, Edmonton, AB" quietly drops the postal code and returns
    // all of Edmonton's city centre instead), which here would silently
    // jump the map to the wrong spot and show that location's
    // stations/AQHI as if they were the address typed.
    //
    // place_rank is the real precision signal (30 = building, 26 = street,
    // lower = city/county/etc). Threshold is 22, not street-level 26: a
    // real named plaza/square address tested at place_rank 25 and was a
    // false positive at the tighter cutoff. 22 still comfortably catches
    // the real failure mode (whole-city substitution, rank ~12-16) with
    // margin, while accepting anything neighbourhood-and-up specific.
    //
    // importance is NOT a precision signal despite looking like one - it
    // measures a place's general notability (population, Wikipedia
    // links, etc), not how exactly it was located. A real, perfectly-
    // precise residential building match (place_rank 30) confirmed
    // directly with importance as low as 0.0000563 - Nominatim's
    // standard default for any ordinary address with no independent
    // notability. Do not add an importance-based check here without
    // re-verifying against a real ordinary address first.
    const placeRank = data[0].place_rank;
    if (typeof placeRank === "number" && placeRank < 22) {
      alert(
        "Could not precisely locate \"" + address + "\" - it matched " +
        data[0].display_name + ", which is too broad to be useful here.\n\n" +
        "A postal code alone is often not precise enough in our map data - " +
        "try a full street address (e.g. \"123 Jasper Ave, Edmonton, AB\"), " +
        "or click directly on the map."
      );
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


