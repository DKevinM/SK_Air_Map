window.addEventListener("load", async () => {
  console.log("App starting...");


  // ----------------------------
  // INIT MAP
  // ----------------------------
  if (typeof window.initMap === "function") {
    window.initMap();
  } else {
    console.error("initMap is not available");
    return;
  }

  console.log("Map initialized");


  // ----------------------------
  // RENDER DATA INTO LAYERS
  // ----------------------------
  if (window.renderMap) {
    window.renderMap();
  } else {
    console.warn("renderMap not found");
  }

  console.log("App ready");
});
