(() => {
/* ============ CANVAS ============ */
const cvs = document.getElementById('game');
const ctx = cvs.getContext('2d');
let W=innerWidth,H=innerHeight,DPR=Math.min(devicePixelRatio||1,2);
function resize(){W=innerWidth;H=innerHeight;cvs.width=W*DPR;cvs.height=H*DPR;cvs.style.width=W+'px';cvs.style.height=H+'px';ctx.setTransform(DPR,0,0,DPR,0,0);}
addEventListener('resize',resize); resize();

/* ============ HUD ============ */
const hpEl=document.getElementById('hp');
const waveEl=document.getElementById('wave');
const goalEl=document.getElementById('goal');

/* ============ INPUT ============ */
const keys={}; addEventListener('keydown',e=>keys[e.key]=true); addEventListener('keyup',e=>keys[e.key]=false);
const stickArea=document.getElementById('stickArea'), stick=document.getElementById('stick');
let stickVec={x:0,y:0};
const stickMove=(x,y)=>{const r=stickArea.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;
  let dx=x-cx,dy=y-cy,len=Math.hypot(dx,dy),max=r.width*0.45;
  if(len>max){dx=dx/len*max;dy=dy/len*max;} stick.style.transform=`translate(${dx}px,${dy}px) translate(-50%,-50%)`;
  stickVec.x=dx/max; stickVec.y=dy/max;};
stickArea.addEventListener('touchstart',e=>{stickMove(e.touches[0].clientX,e.touches[0].clientY)},{passive:true});
stickArea.addEventListener('touchmove', e=>{stickMove(e.touches[0].clientX,e.touches[0].clientY)},{passive:true});
stickArea.addEventListener('touchend',  ()=>{stick.style.transform='translate(-50%,-50%)';stickVec.x=stickVec.y=0;});
document.getElementById('btnClaw').addEventListener('click', ()=>claw());
document.getElementById('btnLaser').addEventListener('click', ()=>laser());
document.getElementById('btnLRAD').addEventListener('click', ()=>fireLRAD());

/* ============ STATE ============ */
const state={
  hp:100,maxHp:100,
  wave:1,
  enemies:[], // {x,y,hp,stun,type,throwT,vx,vy,fx}
  skulls:[],  // ворожі “черепи” як снаряди
  drones:[],  // союзні дрони
  shots:[],   // лазер вовка
  lrad:[],    // кільця LRAD
  time:0, shake:0,
};
const wolf={x:W*0.28,y:H*0.6,r:26,speed:240,eyeCd:0,ifr:0}; // ifr = коротка невразливість після урону

/* ============ SPAWN ============ */
function spawnSkeleton(x,y,type="runner"){
  const hp= type==="runner"?55:70;
  state.enemies.push({x,y,hp,stun:0,type,throwT:1.5+Math.random()*1.0,vx:0,vy:0,fx:0});
}
function spawnWave(n){
  for(let i=0;i<n;i++){
    const x=W*0.55+Math.random()*W*0.35, y=H*0.2+Math.random()*H*0.6;
    spawnSkeleton(x,y, i%3===0?"thrower":"runner");
  }
  // 2 союзні дрони
  state.drones=[{x:W*0.5,y:H*0.25,vy:18,shotT:0},{x:W*0.65,y:H*0.22,vy:-16,shotT:0}];
}
spawnWave(8);

/* ============ ACTIONS ============ */
function claw(){
  for(const e of state.enemies){
    if(Math.hypot(e.x-wolf.x,e.y-wolf.y) < wolf.r+24){ e.hp-=30; e.fx=1; kickback(e, 140); }
  }
}
function laser(){
  if(wolf.eyeCd>0) return; wolf.eyeCd=0.75;
  state.shots.push({x:wolf.x+14,y:wolf.y-8,a:0,v:920,life:0.22,dmg:42});
}
let lradCd=0;
function fireLRAD(){
  if(lradCd>0) return; lradCd=6; // кулдаун
  const origin={x:wolf.x+90,y:wolf.y-28}, a=0;
  state.lrad.push({x:origin.x,y:origin.y,a,R:12,life:1.2});
  state.lrad.push({x:origin.x,y:origin.y,a,R:36,life:1.2});
  state.lrad.push({x:origin.x,y:origin.y,a,R:60,life:1.2});
  state.shake = Math.max(state.shake, 6);
}

/* ============ HELPERS ============ */
function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
function kickback(e, power){
  const dx=e.x-wolf.x, dy=e.y-wolf.y, d=Math.hypot(dx,dy)||1;
  e.vx += (dx/d)*power; e.vy += (dy/d)*power;
}

/* ============ UPDATE ============ */
function update(dt){
  state.time+=dt; wolf.eyeCd=Math.max(0,wolf.eyeCd-dt); wolf.ifr=Math.max(0,wolf.ifr-dt); lradCd=Math.max(0,lradCd-dt);
  state.shake = Math.max(0, state.shake - 20*dt);

  // рух вовка
  const vx=(keys['a']?-1:0)+(keys['d']?1:0)+stickVec.x;
  const vy=(keys['w']?-1:0)+(keys['s']?1:0)+stickVec.y;
  const L=Math.hypot(vx,vy)||1;
  wolf.x=clamp(wolf.x+(vx/L)*wolf.speed*dt, 16, W-16);
  wolf.y=clamp(wolf.y+(vy/L)*wolf.speed*dt, 16, H-16);

  // вороги
  for(const e of state.enemies){
    // постефект удару
    e.fx = Math.max(0, e.fx - 3*dt);

    // інерція від відкидання
    e.x += e.vx*dt; e.y += e.vy*dt; e.vx*=0.85; e.vy*=0.85;

    if(e.stun>0){ e.stun-=dt; continue; }
    const dx=wolf.x-e.x, dy=wolf.y-e.y, d=Math.hypot(dx,dy);

    if(e.type==="runner"){
      if(d>34){ const sp=90; e.x+=dx/d*sp*dt; e.y+=dy/d*sp*dt; }
      if(d<26 && wolf.ifr<=0){ state.hp=Math.max(0,state.hp-20*dt); wolf.ifr=0.2; }
    } else { // thrower
      // тримають дистанцію ~120 і кидають “черепи”
      const want=120;
      if(d>want+10){ const sp=85; e.x+=dx/d*sp*dt; e.y+=dy/d*sp*dt; }
      if(d<want-10){ const sp=85; e.x-=dx/d*sp*dt; e.y-=dy/d*sp*dt; }
      e.throwT-=dt;
      if(e.throwT<=0 && d<220){
        e.throwT=1.8+Math.random()*0.8;
        // кидок
        const ang=Math.atan2(dy,dx), sp=320;
        state.skulls.push({x:e.x,y:e.y,a:ang,v:sp,life:1.3});
      }
    }
  }

  // ворожі “черепи”
  for(const s of state.skulls){
    s.x+=Math.cos(s.a)*s.v*dt; s.y+=Math.sin(s.a)*s.v*dt; s.life-=dt;
    if(Math.hypot(s.x-wolf.x,s.y-wolf.y)<18 && wolf.ifr<=0){
      state.hp=Math.max(0,state.hp-18); s.life=0; wolf.ifr=0.25; state.shake=8;
    }
  }
  state.skulls=state.skulls.filter(s=>s.life>0);

  // дрони — оглушення “листівками”
  for(const d of state.drones){
    d.y += d.vy*dt; if(d.y<H*0.18||d.y>H*0.35) d.vy*=-1;
    d.shotT-=dt;
    if(d.shotT<=0 && state.enemies.length){
      let best=null,bestD=1e9;
      for(const e of state.enemies){ const dist=Math.hypot(e.x-d.x,e.y-d.y); if(dist<bestD){bestD=dist; best=e;} }
      if(best && bestD<280){ best.stun=Math.max(best.stun,1.7); d.shotT=1.1; }
    }
  }

  // лазер вовка
  for(const p of state.shots){ p.x+=Math.cos(p.a)*p.v*dt; p.y+=Math.sin(p.a)*p.v*dt; p.life-=dt; }
  for(const p of state.shots){
    for(const e of state.enemies){
      if(e.hp<=0) continue;
      if(Math.hypot(p.x-e.x,p.y-e.y) < 18){ e.hp-=p.dmg; e.fx=1; p.life=0; }
    }
  }
  state.shots=state.shots.filter(p=>p.life>0);

  // LRAD: кільця з “периметра” диска + оглушення в конусі
  for(const w of state.lrad){
    w.R += 190*dt; w.life-=dt;
    for(const e of state.enemies){
      const dx=e.x-w.x, dy=e.y-w.y, dist=Math.hypot(dx,dy);
      const ang=Math.atan2(dy,dx), da=Math.abs(((ang-w.a+Math.PI)%(2*Math.PI))-Math.PI);
      if(da<0.43 && Math.abs(dist-w.R)<16){ e.stun=Math.max(e.stun,1.5); e.fx=Math.max(e.fx,0.6); }
    }
  }
  state.lrad=state.lrad.filter(w=>w.life>0 && w.R<Math.hypot(W,H));

  // видаляємо мертвих
  state.enemies=state.enemies.filter(e=>e.hp>0);

  // хвилі
  if(state.enemies.length===0){ state.wave++; waveEl.textContent='WAVE '+state.wave; spawnWave(6+state.wave*2); }

  // HUD
  hpEl.textContent='HP: '+Math.round(state.hp);
  goalEl.textContent = lradCd>0 ? `LRAD перезарядка: ${Math.ceil(lradCd)}с` : 'Ціль: прорив до безпечної зони';

  if(state.hp<=0) goalEl.textContent='ПОРАЗКА — перезапусти сторінку';
}

/* ============ DRAW ============ */
function drawBG(){
  ctx.fillStyle='#130909'; ctx.fillRect(0,0,W,H);
  // “земля з уламками”
  const g=ctx.createRadialGradient(W*0.6,H*0.45,60,W*0.6,H*0.45,Math.max(W,H));
  g.addColorStop(0,'#2a1414'); g.addColorStop(1,'#080808'); ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
  ctx.fillStyle='rgba(255,60,60,.06)'; for(let i=0;i<90;i++){ const x=(i*73)%W, y=(i*191)%H; ctx.fillRect(x,y,6,6); }
}
function drawWolf(){
  ctx.save(); ctx.translate(wolf.x,wolf.y);
  // тулуб
  ctx.fillStyle='#0e0e10'; ctx.beginPath(); ctx.moveTo(-26,-8); ctx.lineTo(18,-8); ctx.lineTo(26,0); ctx.lineTo(12,8); ctx.lineTo(-26,8); ctx.closePath(); ctx.fill();
  // “шипи”
  ctx.beginPath(); for(let i=-22;i<14;i+=6){ ctx.moveTo(i,-8); ctx.lineTo(i+3,-18); ctx.lineTo(i+6,-8); } ctx.fill();
  // голова
  ctx.beginPath(); ctx.moveTo(18,-8); ctx.lineTo(36,-4); ctx.lineTo(18,6); ctx.closePath(); ctx.fill();
  // червоне око
  ctx.fillStyle= wolf.ifr>0 ? '#ff9a9a' : '#ff3a3a'; ctx.fillRect(25,-5,5,5);
  ctx.restore();
}
function drawSkeleton(e){
  ctx.save(); ctx.translate(e.x,e.y); ctx.lineWidth=2;
  const hit = e.fx>0? e.fx : 0;
  ctx.strokeStyle = e.stun>0 ? 'rgba(255,255,140,.95)' : (hit? 'rgba(255,120,120,.95)' : '#ddd');
  // голова
  ctx.beginPath(); ctx.arc(0,-12,6,0,Math.PI*2); ctx.stroke();
  // тулуб
  ctx.beginPath(); ctx.moveTo(0,-6); ctx.lineTo(0,10); ctx.stroke();
  // руки
  ctx.beginPath(); ctx.moveTo(-10,-2); ctx.lineTo(10,2); ctx.stroke();
  // ноги
  ctx.beginPath(); ctx.moveTo(0,10); ctx.lineTo(-7,20); ctx.moveTo(0,10); ctx.lineTo(7,20); ctx.stroke();
  // позначка типу
  if(e.type==="thrower"){ ctx.fillStyle='rgba(255,120,120,.6)'; ctx.fillRect(-6,-24,12,3); }
  ctx.restore();
}
function drawDrone(d){
  ctx.save(); ctx.translate(d.x,d.y);
  ctx.strokeStyle='rgba(200,200,220,.9)'; ctx.lineWidth=2;
  ctx.beginPath(); ctx.rect(-10,-6,20,12); ctx.stroke();
  // промінь “листівок”
  ctx.strokeStyle='rgba(255,80,80,.75)'; ctx.beginPath(); ctx.moveTo(0,6); ctx.lineTo(0,22); ctx.stroke();
  ctx.restore();
}
function drawSkull(s){
  ctx.save(); ctx.translate(s.x,s.y); ctx.fillStyle='#e9e9e9'; ctx.beginPath(); ctx.arc(0,0,4,0,Math.PI*2); ctx.fill(); ctx.restore();
}
function drawLRADRing(w){
  ctx.save(); ctx.translate(w.x,w.y); ctx.rotate(w.a);
  ctx.strokeStyle='rgba(255,40,40,.9)'; ctx.lineWidth=3;
  for(let k=0;k<3;k++){ const R=w.R-k*22; if(R<=10) continue;
    ctx.beginPath(); ctx.ellipse(0,0,R*1.22,R*0.62,0,-0.38*Math.PI,0.38*Math.PI); ctx.stroke(); }
  ctx.restore();
}
function drawShots(){
  ctx.strokeStyle='#ff4a4a'; ctx.lineWidth=2;
  for(const p of state.shots){ ctx.beginPath(); ctx.moveTo(p.x,p.y); ctx.lineTo(p.x-10,p.y); ctx.stroke(); }
}

function draw(){
  // camera shake
  const sx=(Math.random()-0.5)*state.shake, sy=(Math.random()-0.5)*state.shake;
  ctx.save(); ctx.translate(sx,sy);

  drawBG();
  for(const w of state.lrad) drawLRADRing(w);
  for(const d of state.drones) drawDrone(d);
  drawWolf();
  for(const e of state.enemies) drawSkeleton(e);
  for(const s of state.skulls) drawSkull(s);
  drawShots();

  ctx.restore();
}

/* ============ LOOP ============ */
let last=performance.now();
function loop(t){ const dt=Math.min(0.033,(t-last)/1000); last=t; update(dt); draw(); requestAnimationFrame(loop); }
requestAnimationFrame(loop);
})();
