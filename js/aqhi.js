window.aqhiData = { current: null, forecast: null };
function safeAQHI(v){ if(v==null || isNaN(v)) return "—"; return Number(v)>10 ? "10+" : Math.round(Number(v)); }
function safeRound(v){ const n=Number(v); return Number.isFinite(n)?Math.round(n):null; }
function getAQHICategory(v){ v=Number(v); if(!Number.isFinite(v)) return null; if(v<=3)return "low"; if(v<=6)return "moderate"; if(v<=10)return "high"; return "veryhigh"; }

function drawAQHIPanel(){
  const C = window.aqhiData;
  const el = document.getElementById("aqhi-content");
  if(!el || !C?.current) return;
  const v0 = safeRound(C.current.value);
  const f3 = safeRound(C.forecast?.aqhi3 ?? C.forecast?.today);
  const values = [v0, f3].filter(v => v != null);
  const cats = [...new Set(values.map(getAQHICategory).filter(Boolean))];
  const legend = {
    low: {color:"#016797", label:"1–3 Low"}, moderate:{color:"#ffcb00", label:"4–6 Moderate"},
    high:{color:"#fe0002", label:"7–10 High"}, veryhigh:{color:"#640100", label:"10+ Very High"}
  };
  el.innerHTML = `
    <div style="font-size:16px;font-weight:700;">${C.current.station} Air Quality (AQHI)</div>
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-top:10px;">
      <div style="text-align:center;"><div style="background:${window.getAQHIColor(v0)};width:80px;height:44px;margin:auto;display:flex;align-items:center;justify-content:center;font-weight:bold;border:1px solid #333;">${safeAQHI(v0)}</div><div style="font-size:12px;">Current</div></div>
      <div style="text-align:center;"><div style="background:${f3!=null?window.getAQHIColor(f3):"#ccc"};width:80px;height:44px;margin:auto;display:flex;align-items:center;justify-content:center;font-weight:bold;border:1px solid #333;">${safeAQHI(f3)}</div><div style="font-size:12px;">SK Forecast</div></div>
    </div>
    <div style="margin-top:8px;font-size:11px;line-height:1.3;">${cats.map(c=>`<div><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${legend[c].color};margin-right:6px;"></span><b>${legend[c].label}</b></div>`).join("")}</div>
    <div style="margin-top:10px;"><strong>Last updated:</strong> ${C.current.time ? new Date(C.current.time).toLocaleString("en-CA", {timeZone: window.APP_CONFIG?.timezone || "America/Regina"}) : "Latest available"}</div>
    <div id="panel-weather" style="margin-top:10px;padding-top:8px;border-top:1px solid #ccc;font-size:13px;"><div style="color:#666;font-style:italic;">Click map for current weather</div></div>
    <div style="margin-top:10px;"><div style="font-weight:600;">Environment Canada Weather Alerts</div><a href="https://weather.gc.ca/?layers=alert&province=SK" target="_blank">Weather Alerts</a></div>
  `;
}

window.updateAQHIFromClick = async function(lat,lng){
  await window.AppData.ready;
  const stations = window.AppData.stations || [];
  const forecasts = window.AppData.forecast || [];
  let closest = null, best = Infinity;
  for(const s of stations){ const d = window.getDistance(lat,lng,s.lat,s.lon); if(d < best){best=d; closest=s;} }
  if(!closest) return;
  const fc = forecasts.find(f => String(f.stationName).toUpperCase() === String(closest.stationName).toUpperCase()) || null;
  window.aqhiData.current = { station: closest.stationName, value: closest.aqhi, time: closest.rows?.[0]?.ReadingDate };
  window.aqhiData.forecast = {
    aqhi3: fc?.p1 ?? null
  };
  const existingWeather = document.getElementById("panel-weather")?.innerHTML;
  drawAQHIPanel();
  if(existingWeather){ const w=document.getElementById("panel-weather"); if(w) w.innerHTML=existingWeather; }
};
window.refreshAQHIPanel = async function(){ drawAQHIPanel(); };
window.renderPanelWeather = window.renderPanelWeather || function(){};
