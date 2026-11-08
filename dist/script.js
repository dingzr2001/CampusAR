const journeys = {
  rider: [
    { stage: 'Approach the junction', detail: 'John approaches a junction. The route is shown at lane level from a top down view.', insight: 'The route follows the rider’s lane and shows the exact crossing ahead.', view: 'MAP VIEW', route: 'NEXT MANEUVER', distance: '30 m ahead', icon: '↑', title: 'Continue straight', subtitle: 'Approaching the campus junction', advisory: 'Stop to view the AR guidance and potential traffic at this junction.', advisoryType: '', action: 'Open AR', status: 'Route active', art: 'map', overlays: [] },
    { stage: 'Wait at the stop line', detail: 'At the red light, John opens AR. The live view marks the stop line, lane boundaries, and the traffic signal.', insight: 'The stop line and red signal are placed directly over the road view so John can wait in the right position.', view: 'AR VIEW · LIVE', route: 'TRAFFIC SIGNAL', distance: '24 s remaining', icon: '●', title: 'Wait behind the line', subtitle: 'Red light · remain stopped', advisory: 'Stay behind the highlighted stop line until the signal changes.', advisoryType: 'alert', action: 'Signal turns green', status: 'Red signal', art: 'riderWait', overlays: [{text:'RED LIGHT',small:'24 s remaining',cls:'warn right',top:'18%'},{text:'Stop line',cls:'center',top:'72%',left:'50%'},{text:'Bike lane',cls:'left',top:'57%'}] },
    { stage: 'Cross with care', detail: 'When the light turns green, AR marks the path forward and highlights areas where turning traffic may cross it.', insight: 'A hatched zone draws attention to possible conflicts with turning vehicles while the route stays visible.', view: 'AR VIEW · LIVE', route: 'PROCEED WITH CAUTION', distance: '17 s remaining', icon: '↑', title: 'Continue straight', subtitle: 'Watch for turning traffic', advisory: 'Caution: turning traffic may cross your path. Check the highlighted conflict zone.', advisoryType: 'danger', action: 'Restart journey', status: 'Green signal', art: 'riderGo', overlays: [{text:'GREEN LIGHT',small:'17 s remaining',cls:'green right',top:'17%'},{text:'Conflict zone',small:'Turning traffic crosses here',cls:'danger right',top:'53%'}] }
  ],
  driver: [
    { stage: 'Find the correct lane', detail: 'Mary approaches the junction. AR labels each lane and highlights the border of the lane for her right turn.', insight: 'Lane labels and a highlighted border make the intended turn lane clear before Mary reaches the junction.', view: 'AR VIEW · LIVE', route: 'LANE GUIDANCE', distance: '40 m ahead', icon: '↱', title: 'Use current lane', subtitle: 'Right turn at the junction', advisory: 'Stay in the highlighted lane. The bike lane is immediately to your right.', advisoryType: '', action: 'Approach red light', status: 'Route active', art: 'driverLane', overlays: [{text:'Left turn',cls:'left',top:'52%'},{text:'Right turn',cls:'center',left:'54%',top:'61%'},{text:'Bike lane',cls:'right',top:'74%'}] },
    { stage: 'Wait for the light', detail: 'Mary waits at the red light. The turn path and crosswalk are shown with a clear no-turn-on-red message.', insight: 'The blocked turn path makes the restriction visible before the intersection.', view: 'AR VIEW · LIVE', route: 'TRAFFIC SIGNAL', distance: '1:02 remaining', icon: '●', title: 'No turn on red', subtitle: 'Wait for the green signal', advisory: 'Do not turn. Watch the crosswalk and wait behind the stop line.', advisoryType: 'alert', action: 'Signal turns green', status: 'Red signal', art: 'driverRed', overlays: [{text:'NO TURN ON RED',small:'1:02 remaining',cls:'warn left',top:'16%'},{text:'Crosswalk',cls:'right',top:'59%'}] },
    { stage: 'Make the right turn', detail: 'With a green light, AR shows Mary’s turn and a conflict zone where people or riders could cross her path.', insight: 'The turn remains visible while a hatched area warns Mary to check for other road users.', view: 'AR VIEW · LIVE', route: 'NEXT MANEUVER', distance: '38 s remaining', icon: '↱', title: 'Make right turn', subtitle: 'Yield where paths intersect', advisory: 'Check the conflict zone for pedestrians and cyclists before completing the turn.', advisoryType: 'danger', action: 'Restart journey', status: 'Green signal', art: 'driverGo', overlays: [{text:'GREEN LIGHT',small:'38 s remaining',cls:'green left',top:'17%'},{text:'Conflict zone',small:'Exit crosswalk · yield',cls:'danger right',top:'56%'}] }
  ]
};

const state = {persona:'rider',step:0,audio:true};
const $ = id => document.getElementById(id);
const setText = (id,value) => { $(id).textContent=value; };

const defs = `<defs><pattern id="grass" width="24" height="24" patternUnits="userSpaceOnUse"><rect width="24" height="24" fill="#c7ddc2"/><circle cx="6" cy="8" r="2" fill="#b1cfae"/><circle cx="18" cy="19" r="2" fill="#b1cfae"/></pattern><pattern id="hatch" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="9" height="9" fill="#ed987984"/><path d="M0 0V9" stroke="#bf6250" stroke-width="3"/></pattern><filter id="shadow"><feDropShadow dx="0" dy="4" stdDeviation="5" flood-color="#1d4745" flood-opacity=".23"/></filter></defs>`;
const bike = (x,y,scale=1) => `<g transform="translate(${x} ${y}) scale(${scale})" fill="none" stroke="#214b48" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="-18" cy="8" r="10" fill="#e7f4d5"/><circle cx="18" cy="8" r="10" fill="#e7f4d5"/><path d="M-18 8L-5-11L7 8H-18M7 8L18 8L7-9H-3M-5-11H-12M7-9H15"/></g>`;
const signal = (color) => `<g filter="url(#shadow)"><rect x="284" y="45" width="11" height="167" rx="4" fill="#55756f"/><rect x="272" y="56" width="36" height="72" rx="9" fill="#274840" stroke="#e3efe7" stroke-width="3"/><circle cx="290" cy="74" r="7" fill="${color==='red'?'#f7775a':'#55706b'}"/><circle cx="290" cy="96" r="7" fill="#55706b"/><circle cx="290" cy="118" r="7" fill="${color==='green'?'#b4e869':'#55706b'}"/></g>`;

function mapArt(){return `<svg viewBox="0 0 360 430" preserveAspectRatio="xMidYMid slice" aria-label="Top down campus junction map">${defs}<rect width="360" height="430" fill="url(#grass)"/><path d="M0 166H360V278H0Z M123 0H239V430H123Z" fill="#859996"/><path d="M0 161H360M0 282H360M119 0V430M243 0V430" stroke="#f5f8e9" stroke-width="5"/><path d="M164 0V150M204 0V150M164 292V430M204 292V430M0 222H108M256 222H360" stroke="#dceae4" stroke-width="2" stroke-dasharray="11 12" opacity=".7"/><g fill="#eef5e5">${Array.from({length:6},(_,i)=>`<rect x="${124+i*18}" y="135" width="10" height="22" rx="1"/>`).join('')}${Array.from({length:6},(_,i)=>`<rect x="${124+i*18}" y="287" width="10" height="22" rx="1"/>`).join('')}${Array.from({length:5},(_,i)=>`<rect x="96" y="${169+i*20}" width="22" height="10" rx="1"/>`).join('')}${Array.from({length:5},(_,i)=>`<rect x="247" y="${169+i*20}" width="22" height="10" rx="1"/>`).join('')}</g><path d="M186 418V351C186 317 187 289 178 270C165 242 159 226 166 204C172 185 184 175 185 158V60" fill="none" stroke="#163e3b88" stroke-width="24" stroke-linecap="round" stroke-linejoin="round"/><path d="M186 418V351C186 317 187 289 178 270C165 242 159 226 166 204C172 185 184 175 185 158V60" fill="none" stroke="#d7f56d" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/><path d="M185 57l-15 22h30z" fill="#d7f56d" stroke="#2b5044" stroke-width="2"/><circle cx="186" cy="360" r="24" fill="#fbfff5" filter="url(#shadow)"/><circle cx="186" cy="360" r="15" fill="#d4f36c"/>${bike(186,357,.44)}<rect x="14" y="68" width="101" height="53" rx="11" fill="#fbfff9" filter="url(#shadow)"/><text x="27" y="91" font-size="10" font-weight="800" fill="#32554b">JUNCTION AHEAD</text><text x="27" y="107" font-size="12" font-weight="800" fill="#163d38">30 m · Straight ↑</text><circle cx="299" cy="339" r="25" fill="#fbfff9" filter="url(#shadow)"/><path d="M299 326v13l8 8" fill="none" stroke="#3d675a" stroke-width="3" stroke-linecap="round"/></svg>`}

function roadBase(signalColor='red') {
  const stripes=Array.from({length:8},(_,i)=>{
    const x=101+i*20;
    return `<path d="M${x} 288h12l6 27h-16z"/>`;
  }).join('');
  return `<rect width="360" height="430" fill="#c8e2d8"/>
    <path d="M0 88L92 73L108 199L0 207Z M360 85L273 72L255 201L360 207Z" fill="#a9c9b9"/>
    <path d="M0 110L96 97M0 145L101 132M360 111L269 98M360 145L264 130" stroke="#8cad9e" stroke-width="3"/>
    <path d="M152 113H208L246 207H114Z" fill="#778f8b"/>
    <path d="M180 120V190" stroke="#e1eee8" stroke-width="3" stroke-dasharray="12 12"/>
    <path d="M0 205H360V286H0Z" fill="#829994"/>
    <path d="M0 244H360" stroke="#e1eee8" stroke-width="3" stroke-dasharray="18 17"/>
    <path d="M0 286H360" stroke="#f1f7ec" stroke-width="4"/>
    <path d="M0 430L108 284H252L360 430Z" fill="#708b88"/>
    <path d="M0 430L101 285H110L38 430Z M360 430L259 285H250L322 430Z" fill="#a9c7b4"/>
    <path d="M0 430L108 284M360 430L252 284" stroke="#f4f8e9" stroke-width="4"/>
    <path d="M180 425V348" stroke="#dfebe4" stroke-width="3" stroke-dasharray="14 15"/>
    <g fill="#eaf4e9">${stripes}</g>
    <path d="M60 334H300" stroke="#f7faf3" stroke-width="7"/>
    <path d="M122 430L151 286M238 430L209 286" stroke="#d2ef78" stroke-width="5" opacity=".85"/>
    ${signal(signalColor)}`;
}
function riderWaitArt(){return `<svg viewBox="0 0 360 430" preserveAspectRatio="xMidYMid slice" aria-label="AR view of a continuous four-way junction, crosswalk and stop line">${defs}${roadBase('red')}
  <path d="M61 334H299" stroke="#ffc46f" stroke-width="11" stroke-linecap="round" opacity=".9"/>
  <path d="M61 334H299" stroke="#fff6e5" stroke-width="2" stroke-dasharray="12 8"/>
  ${bike(180,382,.88)}</svg>`}
function riderGoArt(){return `<svg viewBox="0 0 360 430" preserveAspectRatio="xMidYMid slice" aria-label="AR view of a four-way junction with a conflict zone across the rider route">${defs}${roadBase('green')}
  <path d="M15 229C91 229 143 237 180 252C215 267 239 276 280 275" fill="none" stroke="#f8b68e" stroke-width="10" stroke-dasharray="18 12" opacity=".85"/>
  <path d="M145 224Q180 219 216 231L223 278Q180 288 143 274Z" fill="url(#hatch)" stroke="#d27760" stroke-width="2"/>
  <path d="M180 420V178" fill="none" stroke="#314a4488" stroke-width="26" stroke-linecap="round"/>
  <path d="M180 420V178" fill="none" stroke="#d8f66e" stroke-width="11" stroke-linecap="round" stroke-dasharray="21 14"/>
  <path d="M180 169l-16 27h32z" fill="#d8f66e"/>
  ${bike(180,382,.88)}</svg>`}
function driverBase(signalColor='red') {
  const nearCrosswalk=Array.from({length:9},(_,i)=>{
    const x=182+i*18;
    return `<path d="M${x} 249h12l7 24h-15z"/>`;
  }).join('');
  const exitCrosswalk=Array.from({length:6},(_,i)=>{
    const y=170+i*14;
    return `<path d="M388 ${y}h36v8h-36z"/>`;
  }).join('');
  return `<rect width="520" height="350" fill="#c6e1d9"/>
    <path d="M0 72L154 61L180 153L0 169Z M520 70L364 60L337 151L520 167Z" fill="#aac8bb"/>
    <path d="M0 93L161 81M0 122L169 110M520 92L356 80M520 121L347 108" stroke="#8eaa9e" stroke-width="3"/>
    <path d="M228 85H292L338 159H182Z" fill="#758d8a"/>
    <path d="M260 91V151" stroke="#e7f2e9" stroke-width="3" stroke-dasharray="12 10"/>
    <path d="M0 158H520V247H0Z" fill="#819893"/>
    <path d="M0 202H520" stroke="#d9e7e1" stroke-width="3" stroke-dasharray="20 17"/>
    <path d="M0 246H520" stroke="#f4f8e9" stroke-width="4"/>
    <path d="M82 350L182 246H338L438 350Z" fill="#718b87"/>
    <path d="M0 350L174 246H184L110 350Z M520 350L346 246H336L410 350Z" fill="#a8c5b3"/>
    <path d="M82 350L182 246M438 350L338 246" stroke="#f8faf0" stroke-width="4"/>
    <path d="M260 350V280" stroke="#e0ece4" stroke-width="3" stroke-dasharray="12 12"/>
    <g fill="#eaf4e8">${nearCrosswalk}${exitCrosswalk}</g>
    <path d="M172 281H348" stroke="#f5faf0" stroke-width="7"/>
    <path d="M0 234H520" stroke="#c7e899" stroke-width="4" opacity=".85"/>
    <g filter="url(#shadow)"><rect x="443" y="72" width="8" height="119" rx="3" fill="#54746d"/><rect x="433" y="77" width="28" height="57" rx="7" fill="#284840" stroke="#e4f0e8" stroke-width="2"/><circle cx="447" cy="91" r="5" fill="${signalColor==='red'?'#f77a5b':'#536d68'}"/><circle cx="447" cy="106" r="5" fill="#536d68"/><circle cx="447" cy="121" r="5" fill="${signalColor==='green'?'#b8ea6a':'#536d68'}"/></g>`;
}
function driverLaneArt(){return `<svg viewBox="0 0 520 350" preserveAspectRatio="xMidYMid slice" aria-label="Landscape car display with a four-way junction and highlighted right-turn lane">${defs}${driverBase('green')}
  <path d="M252 350L257 281M351 350L316 281" fill="none" stroke="#d9f66e" stroke-width="7"/>
  <path d="M296 345C296 292 310 248 345 221C369 202 407 201 496 201" fill="none" stroke="#d9f66e" stroke-width="10" stroke-linecap="round"/>
  <path d="M503 201l-25-14v28z" fill="#d9f66e"/>
  <path d="M343 350L314 282" stroke="#e5f2df" stroke-width="3" stroke-dasharray="11 9"/>
  ${bike(410,297,.47)}</svg>`}
function driverRedArt(){return `<svg viewBox="0 0 520 350" preserveAspectRatio="xMidYMid slice" aria-label="Landscape car display showing red light, stop line and no turn">${defs}${driverBase('red')}
  <path d="M296 344C296 292 310 250 345 223C369 204 407 203 496 203" fill="none" stroke="#f6b56e" stroke-width="12" stroke-dasharray="16 13" opacity=".8"/>
  <path d="M171 281H349" stroke="#ffbd6d" stroke-width="10"/>
  <path d="M171 281H349" stroke="#fff5df" stroke-width="2" stroke-dasharray="11 8"/>
  <circle cx="354" cy="240" r="18" fill="#fff1e9" stroke="#d87963" stroke-width="3"/>
  <path d="M346 232l16 16M362 232l-16 16" stroke="#d87963" stroke-width="4" stroke-linecap="round"/></svg>`}
function driverGoArt(){return `<svg viewBox="0 0 520 350" preserveAspectRatio="xMidYMid slice" aria-label="Landscape car display showing a right turn and conflict zone where its route crosses the exit crosswalk">${defs}${driverBase('green')}
  <path d="M380 164H433V247H380Z" fill="url(#hatch)" stroke="#d77e62" stroke-width="2"/>
  <path d="M296 344C296 292 310 250 345 223C369 204 407 203 496 203" fill="none" stroke="#324e4888" stroke-width="25" stroke-linecap="round"/>
  <path d="M296 344C296 292 310 250 345 223C369 204 407 203 496 203" fill="none" stroke="#d9f66e" stroke-width="11" stroke-linecap="round" stroke-dasharray="22 14"/>
  <path d="M504 203l-26-15v30z" fill="#d9f66e"/>
  <g transform="translate(411 228)" fill="none" stroke="#2d5b50" stroke-width="3"><circle cy="-16" r="5" fill="#e5f4e7"/><path d="M0-10l-3 18m3-11l12 8M-3 8l-11 13M-3 8l11 13"/></g></svg>`}
const art = {map:mapArt,riderWait:riderWaitArt,riderGo:riderGoArt,driverLane:driverLaneArt,driverRed:driverRedArt,driverGo:driverGoArt};

function render(){
  const item=journeys[state.persona][state.step];
  document.body.classList.toggle('driver-mode',state.persona==='driver');
  document.querySelectorAll('.persona').forEach(btn=>{const active=btn.dataset.persona===state.persona;btn.classList.toggle('active',active);btn.setAttribute('aria-pressed',active)});
  $('stage-list').innerHTML=journeys[state.persona].map((stage,i)=>`<button class="stage-item ${i===state.step?'active':''}" data-step="${i}" ${i===state.step?'aria-current="step"':''}><span class="stage-number">0${i+1}</span><strong>${stage.stage}</strong></button>`).join('');
  setText('app-subtitle',state.persona==='rider'?'Scooter journey':'Car journey');setText('desktop-title',state.persona==='rider'?'Scooter junction guidance':'Driver junction guidance');
  setText('view-label',item.view);setText('scene-step',`0${state.step+1} / 03`);setText('route-label',item.route);setText('distance',item.distance);setText('maneuver-icon',item.icon);setText('maneuver-title',item.title);setText('maneuver-detail',item.subtitle);setText('advisory-text',item.advisory);setText('primary-button',item.action);$('primary-button').innerHTML=`${item.action}<span>↗</span>`;setText('footer-status',item.status);setText('footer-audio',state.audio?'Audio on':'Audio off');
  $('advisory').className=`advisory ${item.advisoryType}`;$('scene-art').innerHTML=art[item.art]();$('scene-overlays').innerHTML=item.overlays.map(o=>`<div class="overlay ${o.cls}" style="top:${o.top};${o.left?'left:'+o.left+';':''}">${o.text}${o.small?`<small>${o.small}</small>`:''}</div>`).join('');
  setText('details-count',`0${state.step+1} / 03`);setText('details-title',item.stage);setText('details-description',item.detail);setText('insight-copy',item.insight);
  $('back-button').disabled=state.step===0;$('back-button').style.opacity=state.step===0?'.35':'1';$('next-button').setAttribute('aria-label',state.step===2?'Restart journey':'Next stage');
}
function setPersona(persona){state.persona=persona;state.step=0;$('mode-menu').hidden=true;$('mode-button').setAttribute('aria-expanded','false');render()}
function next(){state.step=(state.step+1)%3;render()}
document.querySelectorAll('.persona').forEach(b=>b.addEventListener('click',()=>setPersona(b.dataset.persona)));
document.querySelectorAll('[data-menu-persona]').forEach(b=>b.addEventListener('click',()=>setPersona(b.dataset.menuPersona)));
$('stage-list').addEventListener('click',e=>{const b=e.target.closest('[data-step]');if(b){state.step=Number(b.dataset.step);render()}});
$('primary-button').addEventListener('click',next);$('next-button').addEventListener('click',next);
$('back-button').addEventListener('click',()=>{if(state.step>0){state.step--;render()}});
$('sound-button').addEventListener('click',()=>{state.audio=!state.audio;$('sound-button').classList.toggle('muted',!state.audio);$('sound-button').textContent=state.audio?'◖))':'◖×';$('sound-button').setAttribute('aria-pressed',String(state.audio));render()});
$('mode-button').addEventListener('click',()=>{const menu=$('mode-menu');menu.hidden=!menu.hidden;$('mode-button').setAttribute('aria-expanded',String(!menu.hidden))});
document.addEventListener('click',e=>{if(!e.target.closest('#mode-button')&&!e.target.closest('#mode-menu')){$('mode-menu').hidden=true;$('mode-button').setAttribute('aria-expanded','false')}});
document.addEventListener('keydown',e=>{if(e.key==='ArrowRight')next();if(e.key==='ArrowLeft'&&state.step>0){state.step--;render()}if(e.key==='Escape'){$('mode-menu').hidden=true;$('mode-button').setAttribute('aria-expanded','false')}});
render();
