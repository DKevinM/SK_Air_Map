// Animated 10 m winds + forecast time slider.
//
// Particle layer ported from AB_winds/index.html. Data are the small SK files
// written every HRDPS run by AB_winds/py/sk_wind_slim.py (~40 KB each over the
// wire, vs ~19 MB for the full AB_winds files): 10 m u/v cropped to SK and
// averaged to ~7 km, on a north-up lat/lon grid with earth-relative u (east) /
// v (north). Reader convention, same as every other HRDPS reader:
//   i = (lon - lo1) / dx ,  j = (la1 - lat) / dy
// scripts/check_georeference.py (sk_wind_slim) checks placement daily.
//
// Nothing is downloaded until the layer is switched on.

(function () {
  const BASE = "https://zcunoncbyitfsilrhymv.supabase.co/storage/v1/object/public/winds/";
  const TZ = (window.APP_CONFIG && window.APP_CONFIG.timezone) || "America/Regina";
  const HOUR = 3600e3;

  const SPEED_BINS = [   // m/s upper bound -> colour (dark: must read on OSM land, forest and satellite)
    [2, "#1e3a8a"], [4, "#2563eb"], [7, "#7c3aed"], [10, "#c026d3"], [14, "#ea580c"], [Infinity, "#dc2626"]
  ];
  const PX_PER_MS = 0.45;      // screen pixels per frame per m/s: same look at every zoom
  const MAX_AGE = 70;          // frames

  const fmtLocal = t => new Date(t).toLocaleString("en-CA", {
    timeZone: TZ, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit"
  });

  // ---------- data ----------
  async function loadCatalogue() {
    const r = await fetch(BASE + "sk_slim/index.json?v=" + Date.now());
    if (!r.ok) throw new Error("wind index " + r.status);
    const idx = await r.json();
    return (idx.entries || []).map(e => ({ t: Date.parse(e.t), run: Date.parse(e.run), lead: e.lead, path: e.path }))
                              .sort((a, b) => a.t - b.t);
  }

  const snapCache = new Map();   // path -> Promise<snapshot>
  function loadSnapshot(entry) {
    if (!snapCache.has(entry.path)) {
      const p = (async () => {
        const r = await fetch(BASE + entry.path);
        if (!r.ok) throw new Error("wind file " + r.status);
        const d = await r.json();
        if (!d.meta || !d.meta.grid_version) throw new Error("old-layout wind file - refusing to draw it");
        const toF32 = a => Float32Array.from(a, x => (x === null ? NaN : x));
        return { ...entry, grid: d.grid, u: toF32(d.u), v: toF32(d.v) };
      })();
      snapCache.set(entry.path, p);
      p.catch(() => snapCache.delete(entry.path));
    }
    return snapCache.get(entry.path);
  }

  function sampleSnap(s, lat, lon) {
    const g = s.grid, fi = (lon - g.lo1) / g.dx, fj = (g.la1 - lat) / g.dy;
    if (!(fi >= 0 && fj >= 0 && fi < g.nx - 1 && fj < g.ny - 1)) return null;
    const i = fi | 0, j = fj | 0, di = fi - i, dj = fj - j, k = j * g.nx + i;
    const bl = a => a[k] * (1 - di) * (1 - dj) + a[k + 1] * di * (1 - dj) + a[k + g.nx] * (1 - di) * dj + a[k + g.nx + 1] * di * dj;
    const u = bl(s.u), v = bl(s.v);
    return (isFinite(u) && isFinite(v)) ? { u, v } : null;
  }

  // two snapshots bracketing the chosen time, blended by real time
  function makeField(a, b, t) {
    const w = (b && b.t > a.t) ? Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t))) : 0;
    return {
      t, a, b, w,
      sample(lat, lon) {
        const x = sampleSnap(a, lat, lon);
        if (!b || w === 0) return x;
        const y = sampleSnap(b, lat, lon);
        if (!x || !y) return x || y;
        return { u: x.u * (1 - w) + y.u * w, v: x.v * (1 - w) + y.v * w };
      }
    };
  }

  // ---------- panel (status, slider, legend) ----------
  function buildPanel(map) {
    const el = L.DomUtil.create("div", "wind-panel", map.getContainer());
    el.style.display = "none";
    L.DomEvent.disableClickPropagation(el);
    L.DomEvent.disableScrollPropagation(el);
    el.innerHTML = `
      <div class="wind-panel-title">Animated winds (10 m)</div>
      <div class="wind-panel-status">Loading wind…</div>
      <input class="wind-panel-slider" type="range" min="0" max="0" step="1" value="0" disabled
             aria-label="Forecast time" />
      <div class="wind-panel-row"><span class="wind-panel-when"></span><button type="button" disabled>Now</button></div>
      <div class="wind-panel-legend">${SPEED_BINS.map(([hi, c], i) => {
        const lo = i ? SPEED_BINS[i - 1][0] : 0;
        const lbl = hi === Infinity ? `${Math.round(lo * 3.6)}+` : `${Math.round(lo * 3.6)}–${Math.round(hi * 3.6)}`;
        return `<span><i style="background:${c}"></i>${lbl}</span>`;
      }).join("")}<span class="wind-panel-unit">km/h</span></div>`;
    return {
      el,
      status: el.querySelector(".wind-panel-status"),
      slider: el.querySelector(".wind-panel-slider"),
      when: el.querySelector(".wind-panel-when"),
      nowBtn: el.querySelector("button")
    };
  }

  // ---------- the layer ----------
  // Particles live in lat/lon; drawing projects them each frame. The canvas is
  // re-anchored to the map's top-left on every moveend/zoomend and hidden during
  // zoom animation (leaflet-zoom-hide), so it can never drift off the basemap.
  const WindAnimLayer = L.Layer.extend({
    onAdd(m) {
      this._map = m;
      this._canvas = L.DomUtil.create("canvas", "leaflet-zoom-hide");
      this._canvas.style.pointerEvents = "none";
      // own pane above the AQHI grid polygons (overlayPane, z 400) so the
      // particles stay visible over SK; below popups/tooltips
      if (!m.getPane("windAnim")) m.createPane("windAnim").style.zIndex = 450;
      m.getPane("windAnim").appendChild(this._canvas);
      this._ctx = this._canvas.getContext("2d");
      m.on("movestart zoomstart", this._pause, this);
      m.on("moveend zoomend resize", this._reset, this);
      if (!this._ui) this._initUI(m);
      this._ui.el.style.display = "block";
      this._reset();
      this._refresh();
      this._timers = [
        setInterval(() => this._refresh(), 10 * 60e3),     // new runs arrive every few hours
        setInterval(() => { if (this._following && this._catalogue.length) this._showTime(Date.now()); }, 60e3)
      ];
    },
    onRemove(m) {
      m.off("movestart zoomstart", this._pause, this);
      m.off("moveend zoomend resize", this._reset, this);
      cancelAnimationFrame(this._raf); this._raf = null;
      this._timers.forEach(clearInterval);
      this._canvas.remove();
      this._ui.el.style.display = "none";
    },

    _initUI(m) {
      this._ui = buildPanel(m);
      this._catalogue = []; this._hours = []; this._following = true; this._field = null;
      const { slider, nowBtn } = this._ui;
      slider.addEventListener("input", () => {
        this._following = Number(slider.value) === 0;
        this._showTime(this._following ? Date.now() : this._hours[Number(slider.value)]);
      });
      nowBtn.addEventListener("click", () => {
        this._following = true; slider.value = 0; this._showTime(Date.now());
      });
    },

    async _refresh() {
      const ui = this._ui;
      try {
        this._catalogue = await loadCatalogue();
        if (!this._catalogue.length) throw new Error("no wind files available");
        const now = Date.now(), first = Math.ceil(now / HOUR) * HOUR;
        const last = this._catalogue[this._catalogue.length - 1].t;
        this._hours = [now];
        for (let t = first; t <= last; t += HOUR) this._hours.push(t);
        ui.slider.max = this._hours.length - 1; ui.slider.disabled = false; ui.nowBtn.disabled = false;
        if (this._following) { ui.slider.value = 0; await this._showTime(now); }
      } catch (e) {
        ui.status.innerHTML = `<b style="color:#b91c1c">Wind unavailable:</b> ${e.message}`;
        console.error("Animated winds:", e);
      }
    },

    async _showTime(t) {
      const cat = this._catalogue, ui = this._ui;
      let i = cat.findIndex(e => e.t > t);
      if (i === -1) i = cat.length;
      const a = cat[Math.max(0, i - 1)], b = cat[Math.min(cat.length - 1, i)];
      const [sa, sb] = await Promise.all([loadSnapshot(a), loadSnapshot(b)]);
      this._field = makeField(sa, sb, t);
      const src = this._field.w < 0.5 ? sa : sb;
      ui.status.textContent = `Valid ${fmtLocal(t)} · HRDPS model, issued ${fmtLocal(src.run)}`;
      ui.when.textContent = this._following ? "Now" : fmtLocal(t);
    },

    _pause() {
      cancelAnimationFrame(this._raf); this._raf = null;
      this._ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
    },
    _reset() {
      const m = this._map, size = m.getSize(), dpr = window.devicePixelRatio || 1;
      L.DomUtil.setPosition(this._canvas, m.containerPointToLayerPoint([0, 0]));
      this._canvas.width = size.x * dpr; this._canvas.height = size.y * dpr;
      this._canvas.style.width = size.x + "px"; this._canvas.style.height = size.y + "px";
      this._ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this._w = size.x; this._h = size.y;
      const n = Math.min(4500, Math.round(size.x * size.y / 260));
      this._particles = Array.from({ length: n }, () => this._spawn(true));
      if (!this._raf) this._loop();
    },
    _spawn(randomAge) {
      // uniformly over the VISIBLE map, so zooming in never starves the view
      const ll = this._map.containerPointToLatLng([Math.random() * this._w, Math.random() * this._h]);
      return { lat: ll.lat, lng: ll.lng, age: randomAge ? (Math.random() * MAX_AGE) | 0 : 0 };
    },
    _loop() {
      this._raf = requestAnimationFrame(() => this._loop());
      const field = this._field;
      if (!field) return;
      const ctx = this._ctx, m = this._map;
      ctx.globalCompositeOperation = "destination-in";     // fade trails
      ctx.fillStyle = "rgba(0,0,0,0.93)";
      ctx.fillRect(0, 0, this._w, this._h);
      ctx.globalCompositeOperation = "source-over";
      const paths = SPEED_BINS.map(() => new Path2D());
      for (const p of this._particles) {
        if (++p.age > MAX_AGE) { Object.assign(p, this._spawn(false)); continue; }
        const wv = field.sample(p.lat, p.lng);
        if (!wv) { Object.assign(p, this._spawn(false)); continue; }
        const a = m.latLngToContainerPoint([p.lat, p.lng]);
        // earth-relative wind on a conformal (Web Mercator) map: east = +x, north = -y
        const bx = a.x + wv.u * PX_PER_MS, by = a.y - wv.v * PX_PER_MS;
        const ll = m.containerPointToLatLng([bx, by]);
        p.lat = ll.lat; p.lng = ll.lng;
        if (bx < 0 || by < 0 || bx > this._w || by > this._h) { Object.assign(p, this._spawn(false)); continue; }
        const s = Math.hypot(wv.u, wv.v);
        let bin = 0; while (s > SPEED_BINS[bin][0]) bin++;
        paths[bin].moveTo(a.x, a.y); paths[bin].lineTo(bx, by);
      }
      ctx.lineWidth = 2; ctx.lineCap = "round";
      paths.forEach((pth, i) => { ctx.strokeStyle = SPEED_BINS[i][1]; ctx.stroke(pth); });
    }
  });

  window.createWindAnimLayer = () => new WindAnimLayer();
})();
