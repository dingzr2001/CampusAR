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

const state = {persona:'rider',step:0,audio:true,distance:30,stopped:false,lane:null,remaining:8,hazardRemaining:6,yielded:false,hazardSeen:false,errors:0,summary:false,feedback:null};
let ticker=null;
let feedbackTimeout=null;
const $ = id => document.getElementById(id);
const setText = (id,value) => { $(id).textContent=value; };

const defs = `<defs><pattern id="grass" width="24" height="24" patternUnits="userSpaceOnUse"><rect width="24" height="24" fill="#e7ebf0"/><circle cx="6" cy="8" r="2" fill="#cbd3db"/><circle cx="18" cy="19" r="2" fill="#cbd3db"/></pattern><pattern id="hatch" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="9" height="9" fill="#ed435783"/><path d="M0 0V9" stroke="#d92842" stroke-width="3"/></pattern><filter id="shadow"><feDropShadow dx="0" dy="4" stdDeviation="5" flood-color="#101318" flood-opacity=".23"/></filter></defs>`;
const bike = (x,y,scale=1) => `<g transform="translate(${x} ${y}) scale(${scale})" fill="none" stroke="#151a23" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="-18" cy="8" r="10" fill="#f7f9fc"/><circle cx="18" cy="8" r="10" fill="#f7f9fc"/><path d="M-18 8L-5-11L7 8H-18M7 8L18 8L7-9H-3M-5-11H-12M7-9H15"/></g>`;
const signal = (color) => `<g filter="url(#shadow)"><rect x="284" y="45" width="11" height="167" rx="4" fill="#58636f"/><rect x="272" y="56" width="36" height="72" rx="9" fill="#171c25" stroke="#f8fafc" stroke-width="3"/><circle cx="290" cy="74" r="7" fill="${color==='red'?'#ec394c':'#56616d'}"/><circle cx="290" cy="96" r="7" fill="#56616d"/><circle cx="290" cy="118" r="7" fill="${color==='green'?'#5ca2f6':'#56616d'}"/></g>`;

function mapArt(){const markerY=360-(30-state.distance)*0.9;return `<svg viewBox="0 0 360 430" preserveAspectRatio="xMidYMid slice" aria-label="Top down campus junction map">${defs}<rect width="360" height="430" fill="url(#grass)"/><path d="M0 166H360V278H0Z M123 0H239V430H123Z" fill="#717b88"/><path d="M0 161H360M0 282H360M119 0V430M243 0V430" stroke="#f8fafc" stroke-width="5"/><path d="M164 0V150M204 0V150M164 292V430M204 292V430M0 222H108M256 222H360" stroke="#e6ebf1" stroke-width="2" stroke-dasharray="11 12" opacity=".7"/><g fill="#f7f9fc">${Array.from({length:6},(_,i)=>`<rect x="${124+i*18}" y="135" width="10" height="22" rx="1"/>`).join('')}${Array.from({length:6},(_,i)=>`<rect x="${124+i*18}" y="287" width="10" height="22" rx="1"/>`).join('')}${Array.from({length:5},(_,i)=>`<rect x="96" y="${169+i*20}" width="22" height="10" rx="1"/>`).join('')}${Array.from({length:5},(_,i)=>`<rect x="247" y="${169+i*20}" width="22" height="10" rx="1"/>`).join('')}</g><path d="M186 418V351C186 317 187 289 178 270C165 242 159 226 166 204C172 185 184 175 185 158V60" fill="none" stroke="#10152188" stroke-width="24" stroke-linecap="round" stroke-linejoin="round"/><path d="M186 418V351C186 317 187 289 178 270C165 242 159 226 166 204C172 185 184 175 185 158V60" fill="none" stroke="#397fe6" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/><path d="M185 57l-15 22h30z" fill="#397fe6" stroke="#1c3f72" stroke-width="2"/><circle cx="186" cy="${markerY}" r="24" fill="#ffffff" filter="url(#shadow)"/><circle cx="186" cy="${markerY}" r="15" fill="#397fe6"/>${bike(186,markerY-3,.44)}<rect x="14" y="68" width="101" height="53" rx="11" fill="#ffffff" filter="url(#shadow)"/><text x="27" y="91" font-size="10" font-weight="800" fill="#244e89">JUNCTION AHEAD</text><text x="27" y="107" font-size="12" font-weight="800" fill="#111318">${state.distance} m · Straight ↑</text><circle cx="299" cy="339" r="25" fill="#ffffff" filter="url(#shadow)"/><path d="M299 326v13l8 8" fill="none" stroke="#3e5e83" stroke-width="3" stroke-linecap="round"/></svg>`}

function roadBase(signalColor='red') {
  const stripes=Array.from({length:8},(_,i)=>{
    const x=101+i*20;
    return `<path d="M${x} 288h12l6 27h-16z"/>`;
  }).join('');
  return `<rect width="360" height="430" fill="#e9edf2"/>
    <path d="M0 88L92 73L108 199L0 207Z M360 85L273 72L255 201L360 207Z" fill="#c8cfd8"/>
    <path d="M0 110L96 97M0 145L101 132M360 111L269 98M360 145L264 130" stroke="#a8b3c0" stroke-width="3"/>
    <path d="M152 113H208L246 207H114Z" fill="#606c79"/>
    <path d="M180 120V190" stroke="#f8fafc" stroke-width="3" stroke-dasharray="12 12"/>
    <path d="M0 205H360V286H0Z" fill="#7d8794"/>
    <path d="M0 244H360" stroke="#f8fafc" stroke-width="3" stroke-dasharray="18 17"/>
    <path d="M0 286H360" stroke="#ffffff" stroke-width="4"/>
    <path d="M0 430L108 284H252L360 430Z" fill="#65717e"/>
    <path d="M0 430L101 285H110L38 430Z M360 430L259 285H250L322 430Z" fill="#c7cfd8"/>
    <path d="M0 430L108 284M360 430L252 284" stroke="#ffffff" stroke-width="4"/>
    <path d="M180 425V348" stroke="#f4f7fa" stroke-width="3" stroke-dasharray="14 15"/>
    <g fill="#f8fafc">${stripes}</g>
    <path d="M60 334H300" stroke="#ffffff" stroke-width="7"/>
    <path d="M122 430L151 286M238 430L209 286" stroke="#5b9deb" stroke-width="5" opacity=".85"/>
    ${signal(signalColor)}`;
}
function riderWaitArt(){return `<svg viewBox="0 0 360 430" preserveAspectRatio="xMidYMid slice" aria-label="AR view of a continuous four-way junction, crosswalk and stop line">${defs}${roadBase('red')}
  <path d="M61 334H299" stroke="#ed4357" stroke-width="11" stroke-linecap="round" opacity=".9"/>
  <path d="M61 334H299" stroke="#ffffff" stroke-width="2" stroke-dasharray="12 8"/>
  ${bike(180,382,.88)}</svg>`}
function riderGoArt(){return `<svg viewBox="0 0 360 430" preserveAspectRatio="xMidYMid slice" aria-label="AR view of a four-way junction with a conflict zone across the rider route">${defs}${roadBase('green')}
  <path d="M15 229C91 229 143 237 180 252C215 267 239 276 280 275" fill="none" stroke="#ef7280" stroke-width="10" stroke-dasharray="18 12" opacity=".85"/>
  <path data-conflict="true" d="M145 224Q180 219 216 231L223 278Q180 288 143 274Z" fill="url(#hatch)" stroke="#d92842" stroke-width="2"/>
  <path d="M180 420V178" fill="none" stroke="#14192388" stroke-width="26" stroke-linecap="round"/>
  <path d="M180 420V178" fill="none" stroke="#397fe6" stroke-width="11" stroke-linecap="round" stroke-dasharray="21 14"/>
  <path d="M180 169l-16 27h32z" fill="#397fe6"/>
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
function resetJourney(persona=state.persona){
  clearTicker();clearTimeout(feedbackTimeout);
  Object.assign(state,{persona,step:0,distance:30,stopped:false,lane:null,remaining:8,hazardRemaining:6,yielded:false,hazardSeen:false,errors:0,summary:false,feedback:null});
  $('mode-menu').hidden=true;$('mode-button').setAttribute('aria-expanded','false');
  render();
}
function enterStep(step){
  clearTicker();clearTimeout(feedbackTimeout);state.feedback=null;state.step=step;state.summary=false;
  if(step===1){
    state.remaining=8;
    cue(state.persona==='rider'?'Red light. Wait behind the stop line.':'No turn on red. Wait for the signal.');
  }
  if(step===2){
    state.hazardRemaining=6;state.yielded=false;state.hazardSeen=false;
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
      if(state.hazardRemaining===0){clearTicker();showFeedback('Conflict zone clear. Check your surroundings, then proceed.','success');cue('Conflict zone clear. Proceed when safe.')}
    }
  },1000);
}
function actionPrimary(){
  if(state.step===0){
    if(state.persona==='rider'){
      if(state.distance>0){state.distance=Math.max(0,state.distance-10);render();if(state.distance===0)showFeedback('You reached the junction. Stop before opening AR.');return}
      if(!state.stopped){state.stopped=true;render();showFeedback('Stopped at the line. AR is available.','success');return}
      enterStep(1);return;
    }
    if(state.lane!=='right'){state.errors++;showFeedback('Choose the right-turn lane before approaching the light.','danger');return}
    enterStep(1);return;
  }
  if(state.step===1){showFeedback('Holding position while the red signal counts down.','info');return}
  if(state.step===2){
    if(state.hazardRemaining>0){state.errors++;showFeedback(state.persona==='rider'?'Turning traffic is crossing your route. Yield first.':'The exit crosswalk is occupied. Yield first.','danger');cue('Conflict ahead. Yield.');return}
    clearTicker();state.summary=true;render();cue('Journey complete.');
  }
}
function actionSecondary(){
  if(state.step===0){
    if(state.persona==='rider'){
      if(!state.stopped){state.errors++;showFeedback('Stop at the line before opening the AR view.','danger');return}
      enterStep(1);return;
    }
    showFeedback('For a right turn, select the lane beside the bike lane.','info');return;
  }
  if(state.step===1){state.errors++;showFeedback(state.persona==='rider'?'The signal is red. Stay behind the stop line.':'No turn on red. Wait behind the stop line.','danger');cue('Red signal. Wait.');return}
  if(state.step===2){state.yielded=true;showFeedback(state.hazardRemaining>0?'Good choice. Wait for the crossing to clear.':'The crossing is clear. Check once more, then proceed.','success');cue('Yielding at the conflict zone.');}
}
function render(){
  const item=journeys[state.persona][state.step];
  const driver=state.persona==='driver';
  document.body.classList.toggle('driver-mode',driver);
  document.querySelectorAll('.persona').forEach(btn=>{const active=btn.dataset.persona===state.persona;btn.classList.toggle('active',active);btn.setAttribute('aria-pressed',String(active))});
  $('stage-list').innerHTML=journeys[state.persona].map((stage,i)=>`<button class="stage-item ${i===state.step?'active':''}" data-step="${i}" ${i===state.step?'aria-current="step"':''}><span class="stage-number">0${i+1}</span><strong>${stage.stage}</strong></button>`).join('');
  setText('app-subtitle',driver?'Car journey':'Scooter journey');setText('desktop-title',driver?'Driver junction simulator':'Scooter junction simulator');
  setText('view-label',item.view);setText('scene-step',`0${state.step+1} / 03`);
  setText('route-label',item.route);setText('maneuver-icon',item.icon);setText('maneuver-title',item.title);setText('maneuver-detail',item.subtitle);
  setText('footer-audio',state.audio?'Audio on':'Audio off');
  $('sound-button').classList.toggle('muted',!state.audio);$('sound-button').textContent=state.audio?'◖))':'◖×';$('sound-button').setAttribute('aria-pressed',String(state.audio));
  let distance=item.distance,advisory=item.advisory,advisoryType=item.advisoryType,primary=item.action,secondary='',status=item.status;
  if(state.step===0){
    if(driver){
      distance='40 m ahead';primary='Continue to light';secondary='Help';
      advisory=state.lane==='right'?'Right-turn lane selected. The bike lane is beside you.':state.lane?'That lane does not serve this turn. Select the right-turn lane.':'Select the lane for the right turn.';
      advisoryType=state.lane&&state.lane!=='right'?'danger':'';
      status=state.lane==='right'?'Lane confirmed':'Choose a lane';
    }else{
      distance=`${state.distance} m ahead`;primary=state.distance>0?'Move 10 m':state.stopped?'Open AR':'Stop at line';secondary=state.stopped?'':'Open AR';
      advisory=state.stopped?'Stopped at the line. Open AR to inspect the crossing.':state.distance===0?'At the junction. Stop before opening AR.':'Move closer, then stop before opening AR.';
      status=state.stopped?'Stopped':'Approaching';
    }
  }else if(state.step===1){
    distance=`00:${String(state.remaining).padStart(2,'0')}`;primary='Hold position';secondary=driver?'Turn now':'Cross now';status='Red signal';
    advisory=driver?'No turn on red. Watch the crosswalk and wait.':'Stay behind the stop line until the signal changes.';
    advisoryType='alert';
  }else{
    distance=state.hazardRemaining>0?`Occupied · ${state.hazardRemaining}s`:'Crossing clear';
    primary=driver?'Make right turn':'Continue straight';secondary='Yield';status=state.hazardRemaining>0?'Conflict ahead':'Clear to check';
    advisory=state.hazardRemaining>0?(driver?'Pedestrian is using the exit crosswalk. Yield.':'Turning traffic is crossing the straight route. Yield.'):'Conflict area is clear. Check again, then proceed.';
    advisoryType=state.hazardRemaining>0?'danger':'';
  }
  setText('distance',distance);setText('advisory-text',advisory);$('advisory').className=`advisory ${advisoryType}`;
  $('primary-button').innerHTML=`${primary}<span>↗</span>`;
  const secondaryButton=$('secondary-button');secondaryButton.hidden=!secondary;secondaryButton.textContent=secondary;
  setText('footer-status',status);
  const laneRow=$('choice-row');laneRow.hidden=!(driver&&state.step===0);
  if(!laneRow.hidden)laneRow.innerHTML=[['left','Left'],['right','Right'],['bike','Bike']].map(([key,label])=>`<button class="lane-choice ${state.lane===key?'selected':''}" data-lane="${key}" aria-pressed="${state.lane===key}">${label}</button>`).join('');
  $('scene-art').innerHTML=art[item.art]();
  $('scene').classList.toggle('hazard-cleared',state.step===2&&state.hazardRemaining===0);
  const overlays=item.overlays.map((o,i)=>{
    let small=o.small||'';
    if(state.step===1&&i===0)small=`00:${String(state.remaining).padStart(2,'0')} remaining`;
    if(state.step===2&&i===0)small=state.hazardRemaining>0?`${state.hazardRemaining}s · crossing active`:'Crossing clear';
    return `<button type="button" class="overlay ${o.cls}" data-hint="${i}" style="top:${o.top};${o.left?'left:'+o.left+';':''}">${o.text}${small?`<small>${small}</small>`:''}</button>`;
  }).join('');
  const actor=state.step===2&&state.hazardRemaining>0?`<div class="moving-actor ${driver?'driver-actor':'rider-actor'}" style="animation-delay:-${6-state.hazardRemaining}s" aria-hidden="true">${driver?'<svg viewBox="0 0 26 42"><circle cx="13" cy="7" r="5"/><path d="M13 13v15M13 18L4 26M13 18l9 7M13 28l-7 12M13 28l9 12"/></svg>':'<svg viewBox="0 0 40 24"><rect x="4" y="5" width="30" height="14" rx="4"/><circle cx="12" cy="20" r="3"/><circle cx="28" cy="20" r="3"/></svg>'}</div>`:'';
  $('scene-overlays').innerHTML=overlays+actor;
  setText('details-count',`0${state.step+1} / 03`);setText('details-title',item.stage);setText('details-description',item.detail);setText('insight-copy',item.insight);
  $('back-button').disabled=state.step===0;$('back-button').style.opacity=state.step===0?'.35':'1';
  $('summary').hidden=!state.summary;
  if(state.summary){
    const first=driver?'Selected the right-turn lane':'Stopped before opening AR';
    $('summary').innerHTML=`<div class="summary-card" role="dialog" aria-modal="true" aria-labelledby="summary-title"><div class="summary-kicker">JOURNEY COMPLETE</div><h2 id="summary-title">You made it through.</h2><p>Review the decisions that guided this crossing.</p><div class="summary-line"><span>01</span>${first}</div><div class="summary-line"><span>02</span>Waited for the red signal</div><div class="summary-line"><span>03</span>${state.yielded?'Yielded at the conflict zone':'Proceeded after the conflict cleared'}</div><div class="summary-note">${state.errors?`${state.errors} unsafe choice${state.errors===1?'':'s'} prompted a warning. Try again to compare.`:'No unsafe choices in this run.'}</div><button id="replay-button">Replay journey</button><button id="switch-button">Try ${driver?'scooter rider':'car driver'} scenario</button></div>`;
  }
  renderFeedback();
}
$('primary-button').addEventListener('click',actionPrimary);
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
