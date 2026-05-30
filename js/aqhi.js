window.aqhiData = { current: null, forecast: null };
function safeAQHI(v){ if(v==null || isNaN(v)) return "—"; return Number(v)>10 ? "10+" : Math.round(Number(v)); }
function safeRound(v){ const n=Number(v); return Number.isFinite(n)?Math.round(n):null; }
function getAQHICategory(v){ v=Number(v); if(!Number.isFinite(v)) return null; if(v<=3)return "low"; if(v<=6)return "moderate"; if(v<=10)return "high"; return "veryhigh"; }

function drawAQHIPanel(){
  const C = window.aqhiData;
  const el = document.getElementById("aqhi-content");
  if(!el || !C?.current) return;
  const v0 = safeRound(C.current.value);
  const fToday = safeRound(C.forecast?.p1);
  const fTonight = safeRound(C.forecast?.p2);
  const fTomorrow = safeRound(C.forecast?.p3);
  
  const values = [v0, fToday, fTonight, fTomorrow]
    .filter(v => v != null);
  const cats = [...new Set(values.map(getAQHICategory).filter(Boolean))];
  
  const legend = {
    low: {
      color:"#016797",
      label:"1–3 Low: Ideal air quality for outdoor activities"
    },
  
    moderate:{
      color:"#ffcb00",
      label:"4–6 Moderate: No need to modify your usual outdoor activities unless you experience symptoms"
    },
  
    high:{
      color:"#fe0002",
      label:"7–10 High: Consider reducing strenuous outdoor activities if symptoms occur"
    },
  
    veryhigh:{
      color:"#640100",
      label:"10+ Very High: Reduce or reschedule strenuous outdoor activities"
    }
  };
  
  el.innerHTML = `
    <div style="font-size:16px;font-weight:700;">${C.current.station} Air Quality (AQHI)</div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:10px;">
      <div style="text-align:center;"><div style="background:${window.getAQHIColor(v0)};width:80px;height:44px;margin:auto;display:flex;align-items:center;justify-content:center;font-weight:bold;border:1px solid #333;">${safeAQHI(v0)}</div><div style="font-size:12px;">Current</div></div>
    <div style="text-align:center;">
      <div style="background:${fToday!=null?window.getAQHIColor(fToday):"#ccc"};width:80px;height:44px;margin:auto;display:flex;align-items:center;justify-content:center;font-weight:bold;border:1px solid #333;">
        ${safeAQHI(fToday)}
      </div>
    
      <div style="font-size:12px;">Today</div>
    </div>
    
    <div style="text-align:center;">
      <div style="background:${fTonight!=null?window.getAQHIColor(fTonight):"#ccc"};width:80px;height:44px;margin:auto;display:flex;align-items:center;justify-content:center;font-weight:bold;border:1px solid #333;">
        ${safeAQHI(fTonight)}
      </div>
    
      <div style="font-size:12px;">Tonight</div>
    </div>
    
    <div style="text-align:center;">
      <div style="background:${fTomorrow!=null?window.getAQHIColor(fTomorrow):"#ccc"};width:80px;height:44px;margin:auto;display:flex;align-items:center;justify-content:center;font-weight:bold;border:1px solid #333;">
        ${safeAQHI(fTomorrow)}
      </div>
    
      <div style="font-size:12px;">Tomorrow</div>
    </div>      
    </div>
    <div style="margin-top:8px;font-size:11px;line-height:1.3;word-break:break-word;">${cats.map(c=>`<div><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${legend[c].color};margin-right:6px;"></span><b>${legend[c].label}</b></div>`).join("")}</div>
    <div style="margin-top:10px;"><strong>Last updated:</strong> ${C.current.time ? new Date(C.current.time).toLocaleString("en-CA", {timeZone: window.APP_CONFIG?.timezone || "America/Regina"}) : "Latest available"}</div>
    <div id="panel-weather" style="margin-top:10px;padding-top:8px;border-top:1px solid #ccc;font-size:13px;"><div style="color:#666;font-style:italic;">Click map for current weather</div></div>
    <div style="margin-top:10px;">
      <div style="font-weight:600;">Environment Canada Weather Alerts</div>
    
      <a href="https://weather.gc.ca/?layers=alert&province=SK" target="_blank">
        Weather Alerts
      </a>
    </div>
    
    <div style="margin-top:10px;">
      <div style="font-weight:600;">What is AQHI</div>
    
      <a href="https://www.canada.ca/en/environment-climate-change/services/air-quality-health-index.html" target="_blank">
        Air Quality Health Index
      </a>
    </div>
    
    <div style="margin-top:10px;">
      <div style="font-weight:600;">Wildfire external resources</div>
    
      <a href="https://firesmoke.ca/forecasts/current/" target="_blank">
        FireSmoke Canada – Current Forecast
      </a><br>
    
      <a href="https://weather.gc.ca/firework/firework_anim_e.html" target="_blank">
        ECCC FireWork Smoke Forecast
      </a>
    </div>
  `;
}

window.updateAQHIFromClick = async function(lat,lng){
  await window.AppData.ready;
  const stations = window.AppData.stations || [];
  const forecasts = window.AppData.forecast || [];
  let closest = null, best = Infinity;
  for(const s of stations){ const d = window.getDistance(lat,lng,s.lat,s.lon); if(d < best){best=d; closest=s;} }
  if(!closest) return;
  const norm = s =>
    String(s || "")
      .trim()
      .toUpperCase();
  
  const fc = forecasts.find(
    f => norm(f.stationName) === norm(closest.stationName)
  ) || null;
  window.aqhiData.current = { station: closest.stationName, value: closest.aqhi, time: closest.rows?.[0]?.ReadingDate };
  window.aqhiData.forecast = {
    p1: fc?.p1 ?? null,
    p2: fc?.p2 ?? null,
    p3: fc?.p3 ?? null
  };
  const existingWeather = document.getElementById("panel-weather")?.innerHTML;
  drawAQHIPanel();
  if(existingWeather){ const w=document.getElementById("panel-weather"); if(w) w.innerHTML=existingWeather; }
};
window.refreshAQHIPanel = async function(){ drawAQHIPanel(); };
window.renderPanelWeather = window.renderPanelWeather || function(){};
