const journeys = {
  rider: [
    { stage: 'Approach the junction', detail: 'John can open AR while rolling toward the junction. The route stays aligned with the bike lane.', insight: 'The bike lane starts on the near right and crosses diagonally to the far-left side after the junction.', view: 'MAP VIEW', route: 'NEXT MANEUVER', distance: '30 m ahead', icon: '↑', title: 'Continue straight', subtitle: 'Approaching the campus junction', advisory: 'Open AR as you approach to see the bike lane and crossing markings.', advisoryType: '', action: 'Open AR', status: 'Route active', art: 'map', overlays: [] },
    { stage: 'Wait at the stop line', detail: 'AR remains open while John approaches the red light. The stop line and bike lane edges stay highlighted as the view moves.', insight: 'The camera sits in the right-side bike lane. The diagonal crossing leads to the bike lane beyond the junction.', view: 'AR VIEW · LIVE', route: 'TRAFFIC SIGNAL', distance: '24 s remaining', icon: '●', title: 'Wait behind the line', subtitle: 'Red light · remain stopped', advisory: 'Stay behind the highlighted stop line until the signal changes.', advisoryType: 'alert', action: 'Signal turns green', status: 'Red signal', art: 'riderWait', overlays: [] },
    { stage: 'Cross with care', detail: 'The camera follows John across the diagonal bike crossing, then keeps moving in the far-side bike lane.', insight: 'The highlighted crossing shifts the camera from the near-right bike lane to the far-left bike lane. Ride beyond the junction to finish.', view: 'AR VIEW · LIVE', route: 'PROCEED WITH CAUTION', distance: '17 s remaining', icon: '↑', title: 'Continue straight', subtitle: 'Watch for turning traffic', advisory: 'Caution: turning traffic may cross your path. Check the highlighted conflict zone.', advisoryType: 'danger', action: 'Check crossing', status: 'Green signal', art: 'riderGo', overlays: [] }
  ],
  driver: [
    { stage: 'Find the correct lane', detail: 'Mary approaches the junction. AR labels each lane and highlights the border of the lane for her right turn.', insight: 'Lane labels and a highlighted border make the intended turn lane clear before Mary reaches the junction.', view: 'AR VIEW · LIVE', route: 'LANE GUIDANCE', distance: '40 m ahead', icon: '↱', title: 'Use current lane', subtitle: 'Right turn at the junction', advisory: 'Stay in the highlighted lane. The bike lane is immediately to your right.', advisoryType: '', action: 'Approach red light', status: 'Route active', art: 'driverLane', overlays: [{text:'Left turn',cls:'left',top:'52%'},{text:'Right turn',cls:'center',left:'54%',top:'61%'},{text:'Bike lane',cls:'right',top:'74%'}] },
    { stage: 'Wait for the light', detail: 'Mary waits at the red light. The turn path and crosswalk are shown with a clear no-turn-on-red message.', insight: 'The blocked turn path makes the restriction visible before the intersection.', view: 'AR VIEW · LIVE', route: 'TRAFFIC SIGNAL', distance: '1:02 remaining', icon: '●', title: 'No turn on red', subtitle: 'Wait for the green signal', advisory: 'Do not turn. Watch the crosswalk and wait behind the stop line.', advisoryType: 'alert', action: 'Signal turns green', status: 'Red signal', art: 'driverRed', overlays: [{text:'NO TURN ON RED',small:'1:02 remaining',cls:'warn left',top:'16%'},{text:'Crosswalk',cls:'right',top:'59%'}] },
    { stage: 'Make the right turn', detail: 'With a green light, AR shows Mary’s turn and a conflict zone where people or riders could cross her path.', insight: 'The turn remains visible while a hatched area warns Mary to check for other road users.', view: 'AR VIEW · LIVE', route: 'NEXT MANEUVER', distance: '38 s remaining', icon: '↱', title: 'Make right turn', subtitle: 'Yield where paths intersect', advisory: 'Check the conflict zone for pedestrians and cyclists before completing the turn.', advisoryType: 'danger', action: 'Restart journey', status: 'Green signal', art: 'driverGo', overlays: [{text:'GREEN LIGHT',small:'38 s remaining',cls:'green left',top:'17%'},{text:'Conflict zone',small:'Exit crosswalk · yield',cls:'danger right',top:'56%'}] }
  ]
};

const state = {persona:'rider',step:0,audio:true,distance:30,visualDistance:null,stopped:false,lane:null,remaining:20,hazardRemaining:12,yielded:false,hazardSeen:false,errors:0,summary:false,feedback:null};
let ticker=null;
let feedbackTimeout=null;
let motionFrame=null;
const $ = id => document.getElementById(id);
const setText = (id,value) => { $(id).textContent=value; };

const defs = `<defs><pattern id="grass" width="24" height="24" patternUnits="userSpaceOnUse"><rect width="24" height="24" fill="#e7ebf0"/><circle cx="6" cy="8" r="2" fill="#cbd3db"/><circle cx="18" cy="19" r="2" fill="#cbd3db"/></pattern><pattern id="hatch" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="9" height="9" fill="#ed435783"/><path d="M0 0V9" stroke="#d92842" stroke-width="3"/></pattern><filter id="shadow"><feDropShadow dx="0" dy="4" stdDeviation="5" flood-color="#101318" flood-opacity=".23"/></filter></defs>`;
const bike = (x,y,scale=1) => `<g transform="translate(${x} ${y}) scale(${scale})" fill="none" stroke="#151a23" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="-18" cy="8" r="10" fill="#f7f9fc"/><circle cx="18" cy="8" r="10" fill="#f7f9fc"/><path d="M-18 8L-5-11L7 8H-18M7 8L18 8L7-9H-3M-5-11H-12M7-9H15"/></g>`;
const signal = (color) => `<g filter="url(#shadow)"><rect x="284" y="45" width="11" height="167" rx="4" fill="#58636f"/><rect x="272" y="56" width="36" height="72" rx="9" fill="#171c25" stroke="#f8fafc" stroke-width="3"/><circle cx="290" cy="74" r="7" fill="${color==='red'?'#ec394c':'#56616d'}"/><circle cx="290" cy="96" r="7" fill="#56616d"/><circle cx="290" cy="118" r="7" fill="${color==='green'?'#5ca2f6':'#56616d'}"/></g>`;

function mapArt(){
  const markerY=360-(30-state.distance)*0.9;
  const crossingTop=Array.from({length:6},(_,i)=>`<rect x="${124+i*18}" y="136" width="10" height="20" rx="1"/>`).join('');
  const crossingNear=Array.from({length:6},(_,i)=>`<rect x="${124+i*18}" y="289" width="10" height="20" rx="1"/>`).join('');
  const crossingLeft=Array.from({length:5},(_,i)=>`<rect x="96" y="${169+i*20}" width="22" height="10" rx="1"/>`).join('');
  const crossingRight=Array.from({length:5},(_,i)=>`<rect x="247" y="${169+i*20}" width="22" height="10" rx="1"/>`).join('');
  return `<svg viewBox="0 0 360 430" preserveAspectRatio="xMidYMid slice" aria-label="Top down junction map showing the bike lane on the near right, crossing diagonally to the far left">${defs}
    <rect width="360" height="430" fill="url(#grass)"/>
    <path d="M0 166H360V278H0Z M123 0H239V430H123Z" fill="#717b88"/>
    <path d="M0 161H360M0 282H360M119 0V430M243 0V430" stroke="#f8fafc" stroke-width="5"/>
    <path d="M181 0V150M181 292V430M0 222H108M256 222H360" stroke="#e6ebf1" stroke-width="2" stroke-dasharray="11 12" opacity=".7"/>
    <g fill="#f7f9fc">${crossingTop}${crossingNear}${crossingLeft}${crossingRight}</g>
    <path d="M205 430V278H239V430Z M123 166V0H157V166Z" fill="#438beb45"/>
    <path d="M205 430V278M239 430V278M123 166V0M157 166V0" stroke="#3d86e9" stroke-width="3" opacity=".85"/>
    <path d="M205 278L123 166M239 278L157 166" fill="none" stroke="#6aa7f1" stroke-width="3" stroke-dasharray="10 8"/>
    <path d="M222 418V278" fill="none" stroke="#397fe6" stroke-width="11" stroke-linecap="round"/>
    <path d="M222 278L140 166" fill="none" stroke="#397fe6" stroke-width="11" stroke-linecap="round" stroke-dasharray="15 11"/>
    <path d="M140 166V59" fill="none" stroke="#397fe6" stroke-width="11" stroke-linecap="round"/>
    <path d="M140 51l-14 22h28z" fill="#397fe6" stroke="#1c3f72" stroke-width="2"/>
    <circle cx="222" cy="${markerY}" r="24" fill="#ffffff" filter="url(#shadow)"/>
    <circle cx="222" cy="${markerY}" r="15" fill="#397fe6"/>${bike(222,markerY-3,.44)}
    <rect x="14" y="68" width="101" height="53" rx="11" fill="#ffffff" filter="url(#shadow)"/>
    <text x="27" y="91" font-size="10" font-weight="800" fill="#244e89">JUNCTION AHEAD</text>
    <text x="27" y="107" font-size="12" font-weight="800" fill="#111318">${state.distance>0?state.distance+' m':'At junction'} · Straight ↑</text>
    <circle cx="299" cy="339" r="25" fill="#ffffff" filter="url(#shadow)"/>
    <path d="M299 326v13l8 8" fill="none" stroke="#3e5e83" stroke-width="3" stroke-linecap="round"/></svg>`;
}

function roadBase(signalColor='red') {
  // Both road edges share the same vanishing point, (180, 80).
  // The bike lane uses the outer right strip near the rider and the outer left strip beyond the junction.
  const nearCrosswalk=Array.from({length:8},(_,i)=>{
    const x=84+i*25;
    return `<path d="M${x} 288h14l4 27h-18z"/>`;
  }).join('');
  const farCrosswalk=Array.from({length:7},(_,i)=>{
    const x=125+i*16;
    return `<path d="M${x} 188h9l3 14h-12z"/>`;
  }).join('');
  return `<rect width="360" height="430" fill="#e9edf2"/>
    <path d="M0 86L143 74L122 203L0 205Z M360 86L217 74L238 203L360 205Z" fill="#c8cfd8"/>
    <path d="M0 110L139 98M0 145L134 132M360 110L221 98M360 145L226 132" stroke="#a8b3c0" stroke-width="3"/>
    <path d="M178 80H182L240 205H120Z" fill="#606c79"/>
    <path d="M180 92V178" stroke="#f8fafc" stroke-width="3" stroke-dasharray="11 10"/>
    <path d="M0 205H360V285H0Z" fill="#7d8794"/>
    <path d="M0 244H360" stroke="#f8fafc" stroke-width="3" stroke-dasharray="18 17"/>
    <path d="M82 285H278L348 430H12Z" fill="#65717e"/>
    <path d="M0 285H82L12 430H0Z M278 285H360V430H348Z" fill="#c7cfd8"/>
    <path d="M82 285L12 430M278 285L348 430" stroke="#ffffff" stroke-width="4"/>
    <path d="M180 419V336" stroke="#f4f7fa" stroke-width="3" stroke-dasharray="14 15"/>
    <g fill="#f8fafc">${farCrosswalk}${nearCrosswalk}</g>
    <path d="M49 338H311" stroke="#ffffff" stroke-width="7"/>
    <path d="M237 285H278L348 430H278Z" fill="#438beb40"/>
    <path d="M120 205L178 80H179L145 205Z" fill="#438beb40"/>
    <path d="M237 285L278 430M278 285L348 430M120 205L178 80M145 205L179 80" fill="none" stroke="#4a91ed" stroke-width="4" opacity=".9"/>
    <path d="M237 285L120 205M278 285L145 205" fill="none" stroke="#6aa7f1" stroke-width="3" stroke-dasharray="12 9"/>
    ${signal(signalColor)}`;
}
// Project a lane-level world into the rider's camera. World z=0 is the near stop
// line; the crossing ends at z=22. The camera follows the bike route across it.
function riderCamera(){
  const travelled=-(state.visualDistance ?? state.distance);
  const t=Math.max(0,Math.min(1,travelled/22));
  const eased=t*t*(3-2*t);
  return {z:travelled-2,x:4.4-8.8*eased};
}
function riderProject(x,z){
  const camera=riderCamera(),depth=Math.max(0,z-camera.z);
  return [180+(x-camera.x)*210/(depth+4),72+1450/(depth+4)];
}
function riderSceneArt(green=false){
  const camera=riderCamera(),near=camera.z,far=camera.z+100;
  const point=(x,z)=>riderProject(x,z).map(v=>v.toFixed(1)).join(',');
  const quad=(left,right,start,end,fill,extra='')=>{
    const a=Math.max(start,near),b=Math.min(end,far);
    return b<=a?'':`<polygon points="${point(left,a)} ${point(right,a)} ${point(right,b)} ${point(left,b)}" fill="${fill}" ${extra}/>`;
  };
  const band=(left,right,z,fill,extra='')=>quad(left,right,z,z+.22,fill,extra);
  const stripe=(x,start,end,width,fill)=>quad(x-width/2,x+width/2,start,end,fill);
  let markings='';
  for(let z=Math.floor(near/8)*8;z<far;z+=8){
    markings+=stripe(0,z,z+3,.07,'#e9eef4');
    if(z<0)markings+=stripe(3.4,z,z+3,.11,'#ecf6ff');
    if(z>22)markings+=stripe(-3.4,z,z+3,.11,'#ecf6ff');
  }
  let crosswalk='';
  for(let x=-7;x<8;x+=1.7){
    crosswalk+=quad(x,x+1.05,-2.6,-1.6,'#f9fbff');
    crosswalk+=quad(x,x+1.05,22.8,23.8,'#f9fbff');
  }
  const routeX=z=>z<=0?4.4:z>=22?-4.4:4.4-8.8*(z/22);
  const routeStart=Math.max(near, -40);
  const routePoints=[];
  for(let z=routeStart;z<=Math.min(far,90);z+=1.5)routePoints.push(point(routeX(z),z));
  let crossingFill='';
  const crossingLeft=[],crossingRight=[];
  for(let z=Math.max(near,0);z<=22;z+=2){
    const next=Math.min(22,z+2);
    crossingFill+=`<polygon points="${point(routeX(z)-1.05,z)} ${point(routeX(z)+1.05,z)} ${point(routeX(next)+1.05,next)} ${point(routeX(next)-1.05,next)}" fill="#4b9ff0" opacity=".22"/>`;
    crossingLeft.push(point(routeX(z)-1.05,z));
    crossingRight.push(point(routeX(z)+1.05,z));
    if(next===22){crossingLeft.push(point(routeX(22)-1.05,22));crossingRight.push(point(routeX(22)+1.05,22))}
  }
  const crossingEdges=`<polyline points="${crossingLeft.join(' ')}" fill="none" stroke="#75c8ff" stroke-width="3.5"/><polyline points="${crossingRight.join(' ')}" fill="none" stroke="#75c8ff" stroke-width="3.5"/>`;
  const route=`<polyline points="${routePoints.join(' ')}" fill="none" stroke="#338bf7" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="8 6" opacity=".95"/>`;
  const stop=near<.8?`${quad(3.2,5.65,-.25,.9,'#3d9bff','opacity=".55" filter="url(#lane-glow)"')}${quad(3.3,5.55,-.12,.52,'#6ebaff','opacity=".9"')}${quad(3.35,5.5,0,.4,'#fff','stroke="#1687ed" stroke-width="1.6"')}`:'';
  const farStop=near<22?`${band(-5.5,-3.35,22,'#edf8ff','opacity=".85"')}`:'';
  const conflict=green&&state.hazardRemaining>0?quad(-1.2,1.8,9,14,'url(#hatch)','data-conflict="true" stroke="#e44357" stroke-width="1.5"'):'';
  const signalLight=green?'#59ad69':'#eb3c53';
  const signalHud=`<g filter="url(#shadow)"><rect x="303" y="78" width="7" height="79" rx="3" fill="#65707d"/><rect x="289" y="82" width="34" height="62" rx="9" fill="#171c25" stroke="#fff" stroke-width="3"/><circle cx="306" cy="98" r="7" fill="${green?'#4b5563':signalLight}"/><circle cx="306" cy="117" r="7" fill="${green?signalLight:'#4b5563'}"/></g>`;
  return `<svg viewBox="0 0 360 430" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Bike-lane camera moving across the highlighted junction markings"><defs><pattern id="hatch" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="9" height="9" fill="#ffe1e6"/><path d="M0 0V9" stroke="#e44357" stroke-width="3"/></pattern><filter id="lane-glow" x="-60%" y="-100%" width="220%" height="300%"><feGaussianBlur stdDeviation="5"/></filter><filter id="shadow"><feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#111318" flood-opacity=".3"/></filter></defs>
    <rect width="360" height="430" fill="#dce3eb"/>
    ${quad(-7.4,7.4,near,far,'#c8d0da')}
    ${quad(-5.5,5.5,-100,0,'#626f7e')}
    ${quad(-100,100,0,22,'#737f8d')}
    ${quad(-5.5,5.5,22,120,'#626f7e')}
    ${quad(3.35,5.5,-100,0,'#3f617e')}
    ${quad(-5.5,-3.35,22,120,'#3f617e')}
    ${markings}${crosswalk}
    ${stripe(3.35,-100,0,.13,'#77c6ff')}${stripe(5.5,-100,0,.13,'#77c6ff')}
    ${stripe(-5.5,22,120,.13,'#77c6ff')}${stripe(-3.35,22,120,.13,'#77c6ff')}
    ${crossingFill}${crossingEdges}${route}${conflict}${farStop}${stop}${signalHud}
    <path d="M180 391l-11 18h22z" fill="#2783f2" stroke="#fff" stroke-width="2" filter="url(#shadow)"/>
  </svg>`;
}
function riderWaitArt(){return riderSceneArt(false)}
function riderGoArt(){return riderSceneArt(true)}
function driverBase(signalColor='red') {
  const nearCrosswalk=Array.from({length:9},(_,i)=>{
    const x=182+i*18;
    return `<path d="M${x} 249h12l7 24h-15z"/>`;
  }).join('');
  const exitCrosswalk=Array.from({length:6},(_,i)=>{
    const y=170+i*14;
    return `<path d="M388 ${y}h36v8h-36z"/>`;
  }).join('');
  return `<rect width="520" height="350" fill="#e9edf2"/>
    <path d="M0 72L154 61L180 153L0 169Z M520 70L364 60L337 151L520 167Z" fill="#c8cfd8"/>
    <path d="M0 93L161 81M0 122L169 110M520 92L356 80M520 121L347 108" stroke="#a8b3c0" stroke-width="3"/>
    <path d="M228 85H292L338 159H182Z" fill="#606c79"/>
    <path d="M260 91V151" stroke="#f8fafc" stroke-width="3" stroke-dasharray="12 10"/>
    <path d="M0 158H520V247H0Z" fill="#7d8794"/>
    <path d="M0 202H520" stroke="#f4f7fa" stroke-width="3" stroke-dasharray="20 17"/>
    <path d="M0 246H520" stroke="#ffffff" stroke-width="4"/>
    <path d="M82 350L182 246H338L438 350Z" fill="#65717e"/>
    <path d="M0 350L174 246H184L110 350Z M520 350L346 246H336L410 350Z" fill="#c7cfd8"/>
    <path d="M82 350L182 246M438 350L338 246" stroke="#ffffff" stroke-width="4"/>
    <path d="M260 350V280" stroke="#f4f7fa" stroke-width="3" stroke-dasharray="12 12"/>
    <g fill="#eaf4e8">${nearCrosswalk}${exitCrosswalk}</g>
    <path d="M172 281H348" stroke="#ffffff" stroke-width="7"/>
    <path d="M0 234H520" stroke="#70a9ed" stroke-width="4" opacity=".85"/>
    <g filter="url(#shadow)"><rect x="443" y="72" width="8" height="119" rx="3" fill="#58636f"/><rect x="433" y="77" width="28" height="57" rx="7" fill="#171c25" stroke="#f8fafc" stroke-width="2"/><circle cx="447" cy="91" r="5" fill="${signalColor==='red'?'#ec394c':'#56616d'}"/><circle cx="447" cy="106" r="5" fill="#56616d"/><circle cx="447" cy="121" r="5" fill="${signalColor==='green'?'#5ca2f6':'#56616d'}"/></g>`;
}
function driverLaneArt(){return `<svg viewBox="0 0 520 350" preserveAspectRatio="xMidYMid slice" aria-label="Landscape car display with a four-way junction and highlighted right-turn lane">${defs}${driverBase('green')}
  <path d="M252 350L257 281M351 350L316 281" fill="none" stroke="#397fe6" stroke-width="7"/>
  <path d="M296 345C296 292 310 248 345 221C369 202 407 201 496 201" fill="none" stroke="#397fe6" stroke-width="10" stroke-linecap="round"/>
  <path d="M503 201l-25-14v28z" fill="#397fe6"/>
  <path d="M343 350L314 282" stroke="#f8fafc" stroke-width="3" stroke-dasharray="11 9"/>
  ${bike(410,297,.47)}</svg>`}
function driverRedArt(){return `<svg viewBox="0 0 520 350" preserveAspectRatio="xMidYMid slice" aria-label="Landscape car display showing red light, stop line and no turn">${defs}${driverBase('red')}
  <path d="M296 344C296 292 310 250 345 223C369 204 407 203 496 203" fill="none" stroke="#ef7080" stroke-width="12" stroke-dasharray="16 13" opacity=".8"/>
  <path d="M171 281H349" stroke="#ed4357" stroke-width="10"/>
  <path d="M171 281H349" stroke="#ffffff" stroke-width="2" stroke-dasharray="11 8"/>
  <circle cx="354" cy="240" r="18" fill="#fff1f2" stroke="#d92842" stroke-width="3"/>
  <path d="M346 232l16 16M362 232l-16 16" stroke="#d92842" stroke-width="4" stroke-linecap="round"/></svg>`}
function driverGoArt(){return `<svg viewBox="0 0 520 350" preserveAspectRatio="xMidYMid slice" aria-label="Landscape car display showing a right turn and conflict zone where its route crosses the exit crosswalk">${defs}${driverBase('green')}
  <path data-conflict="true" d="M380 164H433V247H380Z" fill="url(#hatch)" stroke="#d77e62" stroke-width="2"/>
  <path d="M296 344C296 292 310 250 345 223C369 204 407 203 496 203" fill="none" stroke="#14192388" stroke-width="25" stroke-linecap="round"/>
  <path d="M296 344C296 292 310 250 345 223C369 204 407 203 496 203" fill="none" stroke="#397fe6" stroke-width="11" stroke-linecap="round" stroke-dasharray="22 14"/>
  <path d="M504 203l-26-15v30z" fill="#397fe6"/>
  <g transform="translate(411 228)" fill="none" stroke="#151a23" stroke-width="3"><circle cy="-16" r="5" fill="#f8fafc"/><path d="M0-10l-3 18m3-11l12 8M-3 8l-11 13M-3 8l11 13"/></g></svg>`}
const art = {map:mapArt,riderWait:riderWaitArt,riderGo:riderGoArt,driverLane:driverLaneArt,driverRed:driverRedArt,driverGo:driverGoArt};

function cue(text){
  if(!state.audio || !('speechSynthesis' in window)) return;
  try { window.speechSynthesis.cancel(); const voice=new SpeechSynthesisUtterance(text); voice.rate=1.05; voice.volume=.65; window.speechSynthesis.speak(voice); } catch(_) {}
}
function showFeedback(message,type='info'){
  state.feedback={message,type};
  renderFeedback();
  clearTimeout(feedbackTimeout);
  feedbackTimeout=setTimeout(()=>{state.feedback=null;renderFeedback()},3800);
}
function renderFeedback(){
  const toast=$('feedback-toast');
  toast.hidden=!state.feedback;
  if(state.feedback){toast.className=`feedback-toast ${state.feedback.type}`;toast.textContent=state.feedback.message}
}
function clearTicker(){if(ticker){clearInterval(ticker);ticker=null}}
function clearMotion(){if(motionFrame){cancelAnimationFrame(motionFrame);motionFrame=null}state.visualDistance=null}
function riderOverlays(){
  const signal=state.step===1?'RED LIGHT':'GREEN LIGHT';
  const seconds=state.step===1?state.remaining:state.hazardRemaining;
  const stopY=riderProject(4.4,0)[1];
  const stopVisible=state.distance>=0&&stopY>95&&stopY<425;
  const stopTop=Math.max(12,Math.min(78,stopY/430*100-9));
  const laneBeyond=state.distance<=-22;
  const onCrossing=state.distance<0&&!laneBeyond;
  const lanePosition=onCrossing?'center':laneBeyond?'left':'right';
  const laneStyle=onCrossing?'top:66%;left:50%':'top:69%';
  const laneText=onCrossing?'Bike crossing':'Bike lane';
  return `<button type="button" class="overlay ${state.step===1?'warn':'green'} right" data-hint="0" style="top:16%">${signal}<small>${state.step===2&&seconds===0?'Crossing clear':String(seconds).padStart(2,'0')+' s remaining'}</small></button>`
    +(state.step===1&&stopVisible?`<button type="button" class="overlay marking-label" data-hint="1" style="top:${stopTop}%;left:50%">Highlighted stop line</button>`:'')
    +(state.step===2&&state.hazardRemaining>0&&state.distance>-22?`<button type="button" class="overlay danger left" data-hint="1" style="top:47%">Conflict zone<small>Yield to turning traffic</small></button>`:'')
    +`<button type="button" class="overlay lane-label ${lanePosition}" data-hint="2" style="${laneStyle}">${laneText}</button>`;
}
function animateRiderCamera(from,to){
  clearMotion();
  state.visualDistance=from;
  const started=performance.now(),duration=680;
  const frame=now=>{
    const t=Math.min(1,(now-started)/duration),ease=t*t*(3-2*t);
    state.visualDistance=from+(to-from)*ease;
    if(state.persona==='rider'&&state.step>0){
      $('scene-art').innerHTML=art[journeys.rider[state.step].art]();
      $('scene-overlays').innerHTML=riderOverlays()+(state.step===2&&state.hazardRemaining>0?'<div class="moving-actor rider-actor" aria-hidden="true"><svg viewBox="0 0 40 24"><rect x="4" y="5" width="30" height="14" rx="4"/><circle cx="12" cy="20" r="3"/><circle cx="28" cy="20" r="3"/></svg></div>':'');
    }
    if(t<1)motionFrame=requestAnimationFrame(frame);
    else{motionFrame=null;state.visualDistance=null;render()}
  };
  motionFrame=requestAnimationFrame(frame);
}
function resetJourney(persona=state.persona){
  clearTicker();clearMotion();clearTimeout(feedbackTimeout);
  Object.assign(state,{persona,step:0,distance:persona==='driver'?40:30,stopped:false,lane:null,remaining:20,hazardRemaining:12,yielded:false,hazardSeen:false,errors:0,summary:false,feedback:null});
  $('mode-menu').hidden=true;$('mode-button').setAttribute('aria-expanded','false');
  render();
}
function enterStep(step){
  clearTicker();clearMotion();clearTimeout(feedbackTimeout);state.feedback=null;state.step=step;state.summary=false;
  if(step===1){
    state.remaining=20;
    cue(state.persona==='rider'?'Red light. Wait behind the stop line.':'No turn on red. Wait for the signal.');
  }
  if(step===2){
    state.hazardRemaining=12;state.yielded=false;state.hazardSeen=false;
    cue('Signal changed. Check the highlighted conflict zone before proceeding.');
  }
  render();
  if(step===1||step===2) ticker=setInterval(()=>{
    if(state.step===1){
      state.remaining--;
      if(state.remaining<=0){enterStep(2);return}
      render();
    }else if(state.step===2){
      state.hazardRemaining=Math.max(0,state.hazardRemaining-1);
      render();
      if(state.hazardRemaining===0){clearTicker();if(state.distance<=-30){state.summary=true;render();cue('Journey complete.')}else{showFeedback('Conflict zone clear. Check your surroundings, then proceed.','success');cue('Conflict zone clear. Proceed when safe.')}}
    }
  },1000);
}
function actionPrimary(){
  if(state.step===0){
    if(state.persona==='rider'){
      enterStep(1);showFeedback('AR is on. Follow the highlighted bike lane and stop for red.','success');return;
    }
    showFeedback(state.lane==='right'?'Right-turn lane confirmed. Continue toward the stop line.':'Select the right-turn lane before the junction.',state.lane==='right'?'success':'info');return;
  }
  if(state.step===1){showFeedback('Red light. Wait behind the stop line.','info');return}
  if(state.step===2){
    if(state.hazardRemaining>0){showFeedback(state.persona==='rider'?'Turning traffic is crossing your route. Yield first.':'The exit crosswalk is occupied. Yield first.','danger');return}
    if(state.persona==='rider'){demoMove();return}
    showFeedback('Crossing clear. Look again before continuing.','success');
  }
}
function actionSecondary(){
  if(state.step===0){
    if(state.persona==='rider'){
      showFeedback('Open AR while approaching. Stop only for the red signal and stop line.','info');return;
    }
    showFeedback('For a right turn, select the lane beside the bike lane.','info');return;
  }
  if(state.step===1){showFeedback(state.persona==='rider'?'The signal is red. Stay behind the stop line.':'No turn on red. Wait behind the stop line.','danger');cue('Red signal. Wait.');return}
  if(state.step===2){state.yielded=true;showFeedback(state.hazardRemaining>0?'Good choice. Wait for the crossing to clear.':'The crossing is clear. Check once more, then proceed.','success');cue('Yielding at the conflict zone.');}
}
function demoMove(){
  if(state.summary)return;
  if(state.persona==='rider'){
    const from=state.distance;
    if(state.step===0&&from<=0){showFeedback('At the stop line. Open AR to check the signal.','info');return}
    if(state.step===1&&from<=0){showFeedback('Red light. Remain behind the highlighted stop line.','danger');return}
    if(state.step===2&&state.hazardRemaining>0&&from<=0){showFeedback('Turning traffic is crossing. Yield before riding through.','danger');return}
    state.distance=Math.max(state.step<2?0:-50,from-10);
    state.stopped=state.step===1&&state.distance===0;
    render();
    if(state.step>0)animateRiderCamera(from,state.distance);
    if(state.step===0&&state.distance===0)showFeedback('At the stop line. Open AR to check the signal.','info');
    if(state.step===1&&state.distance===0)showFeedback('Red light. Wait behind the highlighted line.','info');
    if(state.step===2&&state.distance===-50){
      setTimeout(()=>{if(state.persona==='rider'&&state.step===2&&state.distance===-50){clearTicker();clearMotion();state.summary=true;render();cue('Journey complete.')}},720);
    }
    return;
  }
  if(state.distance<=-40){showFeedback('Journey endpoint reached. Reset to start again.');return}
  state.distance-=10;
  state.stopped=false;
  if(state.step===0&&state.distance<=0){
    if(state.persona==='driver'){
      if(state.lane!=='right'){state.errors++;render();showFeedback('At the stop line. Choose the right-turn lane before continuing.','danger');return}
      enterStep(1);showFeedback('At the stop line. No turn on red.','danger');return;
    }
      render();showFeedback('At the stop line. Open AR to check the signal.','info');return;
  }
  if(state.step===1&&state.distance<0){state.errors++;render();showFeedback('Red light: you crossed the stop line. Stop and wait.','danger');cue('Red light. Stop.');return}
  if(state.step===2&&state.distance<0&&state.hazardRemaining>0){state.errors++;render();showFeedback('Conflict zone occupied. Yield before continuing.','danger');cue('Conflict ahead. Yield.');return}
  if(state.step===2&&state.distance<=-30&&state.hazardRemaining===0){clearTicker();state.summary=true;render();cue('Journey complete.');return}
  render();
  if(state.step===0)showFeedback(`${state.distance} m to the stop line.`,'info');
  else if(state.step===2&&state.hazardRemaining===0)showFeedback('Route ahead is clear. Check again and continue.','success');
}
function demoStop(){
  state.stopped=!state.stopped;render();
  showFeedback(state.stopped?'Stopped. Check the signal and surrounding traffic.':'Movement resumed.','info');
}
function renderDemoControls(){
  const location=state.distance>0?`${state.distance} m before stop line`:state.distance===0?'At stop line':`${Math.abs(state.distance)} m beyond stop line`;
  const stage=state.step===0?'Approach':state.step===1?'Red light':'Green light';
  const html=`<div class="demo-head"><span>PRESENTER CONTROLS</span><span class="demo-stage">${stage}</span></div><div class="demo-location">${location} <span>· ${state.stopped?'Stopped':'Moving'}</span></div><div class="demo-actions"><button type="button" class="demo-move" data-demo-action="move" ${state.summary?'disabled':''}>Move +10 m <span>→</span></button><button type="button" data-demo-action="stop">${state.stopped?'Resume':'Stop'}</button><button type="button" data-demo-action="signal" ${state.step!==1?'disabled':''}>Green light</button><button type="button" data-demo-action="reset">Reset</button></div>`;
  $('desktop-demo-console').innerHTML=html;
  $('mobile-demo-console').innerHTML=html;
}
function render(){
  const item=journeys[state.persona][state.step];
  const driver=state.persona==='driver';
  document.body.classList.toggle('driver-mode',driver);
  document.querySelectorAll('.persona').forEach(btn=>{const active=btn.dataset.persona===state.persona;btn.classList.toggle('active',active);btn.setAttribute('aria-pressed',String(active))});
  $('stage-list').innerHTML=journeys[state.persona].map((stage,i)=>`<button class="stage-item ${i===state.step?'active':''}" data-step="${i}" ${i===state.step?'aria-current="step"':''}><span class="stage-number">0${i+1}</span><strong>${stage.stage}</strong></button>`).join('');
  setText('app-subtitle',driver?'Car journey':'Scooter journey');setText('desktop-title',driver?'Driver junction simulator':'Scooter junction simulator');
  setText('view-label',item.view);setText('scene-step',`0${state.step+1} / 03 · ${state.distance>0?state.distance+' m':state.distance===0?'LINE':'+'+Math.abs(state.distance)+' m'}`);
  setText('route-label',item.route);setText('maneuver-icon',item.icon);setText('maneuver-title',item.title);setText('maneuver-detail',item.subtitle);
  setText('footer-audio',state.audio?'Audio on':'Audio off');
  $('sound-button').classList.toggle('muted',!state.audio);$('sound-button').textContent=state.audio?'◖))':'◖×';$('sound-button').setAttribute('aria-pressed',String(state.audio));
  let distance=item.distance,advisory=item.advisory,advisoryType=item.advisoryType,primary=item.action,secondary='',status=item.status;
  if(state.step===0){
    if(driver){
      distance=state.distance>0?`${state.distance} m ahead`:state.distance===0?'At stop line':`${Math.abs(state.distance)} m beyond`;primary='Check lane';secondary='Help';
      advisory=state.lane==='right'?'Right-turn lane selected. The bike lane is beside you.':state.lane?'That lane does not serve this turn. Select the right-turn lane.':'Select the lane for the right turn.';
      advisoryType=state.lane&&state.lane!=='right'?'danger':'';
      status=state.lane==='right'?'Lane confirmed':'Choose a lane';
    }else{
      distance=state.distance>0?`${state.distance} m ahead`:state.distance===0?'At stop line':`${Math.abs(state.distance)} m beyond`;primary='Open AR';secondary='Why stop?';
      advisory=state.distance===0?'At the stop line. Open AR to check the signal.':'Open AR while moving to see the bike lane and stop line ahead.';
      status=state.distance===0?'At stop line':'Approaching';
    }
  }else if(state.step===1){
    distance=`00:${String(state.remaining).padStart(2,'0')} · ${state.distance>0?state.distance+' m to line':state.distance===0?'at line':'past line'}`;primary='Check signal';secondary=driver?'Why wait?':'Why stop?';status='Red signal';
    advisory=driver?'No turn on red. Watch the crosswalk and wait.':state.distance>0?'Keep AR on as you approach. Stop at the highlighted line for red.':'Stay behind the highlighted stop line until the signal changes.';
    advisoryType='alert';
  }else{
    distance=state.hazardRemaining>0?`Occupied · ${state.hazardRemaining}s`:'Crossing clear';
    primary=!driver&&state.hazardRemaining===0?'Continue riding':'Check crossing';secondary='Yield';status=state.hazardRemaining>0?'Conflict ahead':!driver&&state.distance<=-22?'Beyond junction':'Clear to check';
    advisory=state.hazardRemaining>0?(driver?'Pedestrian is using the exit crosswalk. Yield.':'Turning traffic is crossing the bike route. Yield.'):(driver?'Conflict area is clear. Check again, then proceed.':state.distance<=-22?'Continue in the far-side bike lane.':'Conflict area is clear. Check again, then follow the crossing.');
    advisoryType=state.hazardRemaining>0?'danger':'';
    if(!driver&&state.distance<=-22){setText('maneuver-title','Stay in bike lane');setText('maneuver-detail','Continue beyond the junction')}
  }
  setText('distance',distance);setText('advisory-text',advisory);$('advisory').className=`advisory ${advisoryType}`;
  $('primary-button').innerHTML=`${primary}<span>↗</span>`;
  const secondaryButton=$('secondary-button');secondaryButton.hidden=!secondary;secondaryButton.textContent=secondary;
  setText('footer-status',status);
  const laneRow=$('choice-row');laneRow.hidden=!(driver&&state.step===0);
  if(!laneRow.hidden)laneRow.innerHTML=[['left','Left'],['right','Right'],['bike','Bike']].map(([key,label])=>`<button class="lane-choice ${state.lane===key?'selected':''}" data-lane="${key}" aria-pressed="${state.lane===key}">${label}</button>`).join('');
  $('scene-art').innerHTML=art[item.art]();
  const travel=Math.max(0,((driver?40:30)-state.distance)/10);
  $('scene-art').style.transform=!driver?'none':`translateY(${Math.min(travel,7)*5}px) scale(${1+Math.min(travel,7)*.085})`;
  $('scene').classList.toggle('hazard-cleared',state.step===2&&state.hazardRemaining===0);
  const overlays=item.overlays.map((o,i)=>{
    let small=o.small||'';
    if(state.step===1&&i===0)small=`00:${String(state.remaining).padStart(2,'0')} remaining`;
    if(state.step===2&&i===0)small=state.hazardRemaining>0?`${state.hazardRemaining}s · crossing active`:'Crossing clear';
    const top=!driver&&state.step===1&&i===1?`${Math.min(89,79+travel*5)}%`:o.top;
    return `<button type="button" class="overlay ${o.cls}" data-hint="${i}" style="top:${top};${o.left?'left:'+o.left+';':''}">${o.text}${small?`<small>${small}</small>`:''}</button>`;
  }).join('');
  const actor=state.step===2&&state.hazardRemaining>0?`<div class="moving-actor ${driver?'driver-actor':'rider-actor'}" style="animation-delay:-${12-state.hazardRemaining}s" aria-hidden="true">${driver?'<svg viewBox="0 0 26 42"><circle cx="13" cy="7" r="5"/><path d="M13 13v15M13 18L4 26M13 18l9 7M13 28l-7 12M13 28l9 12"/></svg>':'<svg viewBox="0 0 40 24"><rect x="4" y="5" width="30" height="14" rx="4"/><circle cx="12" cy="20" r="3"/><circle cx="28" cy="20" r="3"/></svg>'}</div>`:'';
  $('scene-overlays').innerHTML=!driver&&state.step>0?riderOverlays()+actor:overlays+actor;
  setText('details-count',`0${state.step+1} / 03`);setText('details-title',item.stage);setText('details-description',item.detail);setText('insight-copy',item.insight);
  $('back-button').disabled=state.step===0;$('back-button').style.opacity=state.step===0?'.35':'1';
  $('summary').hidden=!state.summary;
  renderDemoControls();
  if(state.summary){
    const first=driver?'Selected the right-turn lane':'Opened AR while approaching in the bike lane';
    $('summary').innerHTML=`<div class="summary-card" role="dialog" aria-modal="true" aria-labelledby="summary-title"><div class="summary-kicker">JOURNEY COMPLETE</div><h2 id="summary-title">You made it through.</h2><p>Review the decisions that guided this crossing.</p><div class="summary-line"><span>01</span>${first}</div><div class="summary-line"><span>02</span>Waited for the red signal</div><div class="summary-line"><span>03</span>${state.yielded?'Yielded at the conflict zone':'Proceeded after the conflict cleared'}</div><div class="summary-note">${state.errors?`${state.errors} unsafe choice${state.errors===1?'':'s'} prompted a warning. Try again to compare.`:'No unsafe choices in this run.'}</div><button id="replay-button">Replay journey</button><button id="switch-button">Try ${driver?'scooter rider':'car driver'} scenario</button></div>`;
  }
  renderFeedback();
}
$('primary-button').addEventListener('click',actionPrimary);
document.addEventListener('click',e=>{const button=e.target.closest('[data-demo-action]');if(!button)return;const action=button.dataset.demoAction;if(action==='move')demoMove();if(action==='stop')demoStop();if(action==='signal'&&state.step===1)enterStep(2);if(action==='reset')resetJourney()});
$('secondary-button').addEventListener('click',actionSecondary);
$('back-button').addEventListener('click',()=>{if(state.step>0)enterStep(state.step-1)});
$('choice-row').addEventListener('click',e=>{
  const b=e.target.closest('[data-lane]');if(!b)return;
  state.lane=b.dataset.lane;render();
  if(state.lane==='right')showFeedback('Right-turn lane selected. Continue toward the signal.','success');
  else{state.errors++;showFeedback(state.lane==='bike'?'The bike lane is for riders. Choose the right-turn lane.':'The left lane does not serve this right turn.','danger')}
});
$('scene-overlays').addEventListener('click',e=>{
  const b=e.target.closest('[data-hint]');if(!b)return;
  const index=Number(b.dataset.hint);const item=journeys[state.persona][state.step];
  if(state.step===0&&state.persona==='driver'&&index<3){state.lane=['left','right','bike'][index];render();showFeedback(state.lane==='right'?'Right-turn lane selected.':'Choose the right-turn lane. ',state.lane==='right'?'success':'danger');return}
  if(state.step===2&&index===1){state.hazardSeen=true;showFeedback(state.hazardRemaining>0?'This red zone overlaps your route. Yield until it clears.':'The conflict zone has cleared. Check once more before moving.',state.hazardRemaining>0?'danger':'success');return}
  showFeedback(state.step===1?(index===0?'Red signal: remain stopped.':'This marking shows where to wait or cross.'):'This label identifies the road area in the AR view.');
});
$('stage-list').addEventListener('click',e=>{const b=e.target.closest('[data-step]');if(b)enterStep(Number(b.dataset.step))});
document.querySelectorAll('.persona').forEach(b=>b.addEventListener('click',()=>resetJourney(b.dataset.persona)));
document.querySelectorAll('[data-menu-persona]').forEach(b=>b.addEventListener('click',()=>resetJourney(b.dataset.menuPersona)));
$('sound-button').addEventListener('click',()=>{state.audio=!state.audio;if(!state.audio&&'speechSynthesis' in window)window.speechSynthesis.cancel();render();if(state.audio)cue('Audio guidance enabled.')});
$('mode-button').addEventListener('click',()=>{const menu=$('mode-menu');menu.hidden=!menu.hidden;$('mode-button').setAttribute('aria-expanded',String(!menu.hidden))});
$('summary').addEventListener('click',e=>{if(e.target.id==='replay-button')resetJourney();if(e.target.id==='switch-button')resetJourney(state.persona==='rider'?'driver':'rider')});
document.addEventListener('click',e=>{if(!e.target.closest('#mode-button')&&!e.target.closest('#mode-menu')){$('mode-menu').hidden=true;$('mode-button').setAttribute('aria-expanded','false')}});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){$('mode-menu').hidden=true;$('mode-button').setAttribute('aria-expanded','false')}});
render();
