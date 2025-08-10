(() => {
/* ================== CANVAS ================== */
const cvs = document.getElementById('game');
const ctx = cvs.getContext('2d');
let W=innerWidth,H=innerHeight,DPR=Math.min(devicePixelRatio||1,2);
function resize(){W=innerWidth;H=innerHeight;cvs.width=W*DPR;cvs.height=H*DPR;cvs.style.width=W+'px';cvs.style.height=H+'px';ctx.setTransform(DPR,0,0,DPR,0,0);}
addEventListener('resize',resize); resize();

/* ================== HUD REFS ================== */
const hpEl = document.getElementById('hp');
const waveEl = document.getElementById('wave');
const goalEl = document.getElementById('goal');

/* ================== STATE ================== */
const state = {
  hp: 100,
  wave: 1,
  enemies: [],     // {x,y,hp,stun}
  drones: [],      // {x,y,vy,shotT}
  projectiles: [], // wolf laser
  lrad: []         // LRAD rings
};

/* ================== INPUT ================== */
const keys={};
addEventListener('keydown',e=>keys[e.key]=true);
addEventListener('keyup',e=>keys[e.key]=false);

// virtual stick
const stickArea=document.getElementById('stickArea'), stick=document.getElementById('stick');
let stickVec={x:0,y:0};
const stickMove=(x,y)=>{
  const r=stickArea.getBoundingClientRect(), cx=r.left+r.width/2, cy=r.top+r.height/2;
  let dx=x-cx, dy=y-cy, len=Math.hypot(dx,dy); const max=r.width*0.45;
  if(len>max){dx=dx/len*max; dy=dy/len*max; len=max;}
  stick.style.transform=`translate(${dx}px,${dy}px) translate(-50%,-50%)`;
  stickVec.x = dx/max; stickVec.y = dy/max;
};
stickArea.addEventListener('touchstart',e=>{stickMove(e.touches[0].clientX,e.touches[0].clientY);},{passive:true});
stickArea.addEventListener('touchmove', e=>{stickMove(e.touches[0].clientX,e.touches[0].clientY);},{passive:true});
stickArea.addEventListener('touchend', ()=>{stick.style.transform='translate(-50%,-50%)';stickVec.x=stickVec.y=0;});

document.getElementById('btnClaw').addEventListener('click', ()=>claw());
document.getElementById('btnLaser').addEventListener('click', ()=>laser());
document.getElementById('btnLRAD').addEventListener('click', ()=>fireLRAD());

/* ================== ENTITIES ================== */
// Wolf (силует із «шипами» + червоне око)
const wolf = { x: W*0.28, y: H*0.6, r: 28, speed: 240, eyeCd:0 };

function spawnSkeleton(x,y){
  state.enemies.push({x,y,hp:55,stun:0,tx:0});
}
function spawnWave(n){
  for(let i=0;i<n;i++){
    const x = W*0.55 + Math.random()*W*0.35;
    const y = H*0.2 + Math.random()*H*0.6;
    spawnSkeleton(x,y);
  }
  // 2 союзні дрони зверху (працюють по ворогах «листівками»)
  state.drones = [
    {x:W*0.45,y:H*0.25,vy: 15,shotT:0},
    {x:W*0.60,y:H*0.22,vy:-12,shotT:0}
  ];
}
spawnWave(8);

/* ================== ACTIONS ================== */
function claw(){
  for(const e of state.enemies){
    if(Math.hypot(e.x-wolf.x,e.y-wolf.y) < wolf.r+24) e.hp -= 30;
  }
}
function laser(){
  if(wolf.eyeCd>0) return;
  wolf.eyeCd=0.8;
  const a = 0; // напрямок «вперед праворуч»
  state.projectiles.push({x:wolf.x+14,y:wolf.y-8,a:a,v:900,life:0.22,dmg:42});
}
function fireLRAD(){
  // джерело умовно праворуч (авто з LRAD)
  const origin = {x:wolf.x+90, y:wolf.y-28};
  const a = 0; // вперед
  // 3 кільця з периметра LRAD у перспективу
  state.lrad.push({x:origin.x,y:origin.y,a:a,R:14,life:1.2});
  state.lrad.push({x:origin.x,y:origin.y,a:a,R:38,life:1.2});
  state.lrad.push({x:origin.x,y:origin.y,a:a,R:62,life:1.2});
}

/* ================== UPDATE ================== */
function update(dt){
  wolf.eyeCd=Math.max(0,wolf.eyeCd-dt);

  // рух вовка
  const vx=(keys['a']?-1:0)+(keys['d']?1:0)+stickVec.x;
  const vy=(keys['w']?-1:0)+(keys['s']?1:0)+stickVec.y;
  const L=Math.hypot(vx,vy)||1;
  wolf.x = Math.max(20,Math.min(W-20, wolf.x+(vx/L)*wolf.speed*dt));
  wolf.y = Math.max(20,Math.min(H-20, wolf.y+(vy/L)*wolf.speed*dt));

  // вороги: підбігають і «штовхають» (імітація кидка черепа)
  for(const e of state.enemies){
    if(e.stun>0){ e.stun-=dt; continue; }
    const dx=wolf.x-e.x, dy=wolf.y-e.y, d=Math.hypot(dx,dy);
    if(d>36){ const sp=85; e.x+=dx/d*sp*dt; e.y+=dy/d*sp*dt; }
    if(d<28){ state.hp=Math.max(0,state.hp-18*dt); }
  }

  // дрони: коливаються по вертикалі та «скидають листівки» (оглушають)
  for(const d of state.drones){
    d.y += d.vy*dt; if(d.y< H*0.18||d.y>H*0.35) d.vy*=-1;
    d.shotT-=dt;
    if(d.shotT<=0 && state.enemies.length){
      // знайти найближчого і оглушити
      let best=null,bestD=1e9;
      for(const e of state.enemies){ const dist=Math.hypot(e.x-d.x,e.y-d.y); if(dist<bestD){bestD=dist; best=e;} }
      if(best && bestD<260){ best.stun=Math.max(best.stun,1.6); d.shotT=1.2; }
    }
  }

  // лазер вовка
  for(const p of state.projectiles){ p.x+=Math.cos(p.a)*p.v*dt; p.y+=Math.sin(p.a)*p.v*dt; p.life-=dt; }
  state.projectiles = state.projectiles.filter(p=>p.life>0);
  for(const p of state.projectiles){
    for(const e of state.enemies){
      if(e.hp<=0) continue;
      if(Math.hypot(p.x-e.x,p.y-e.y) < 18){ e.hp-=p.dmg; p.life=0; }
    }
  }

  // LRAD кільця — «периметр» диска у перспективі + оглушення в конусі
  for(const w of state.lrad){
    w.R += 190*dt;
    for(const e of state.enemies){
      const dx=e.x-w.x, dy=e.y-w.y, dist=Math.hypot(dx,dy);
      const ang=Math.atan2(dy,dx), da=Math.abs(((ang-w.a+Math.PI)%(2*Math.PI))-Math.PI);
      if(da<0.43 && Math.abs(dist-w.R)<16){ e.stun=Math.max(e.stun,1.4); }
    }
    w.life-=dt;
  }
  state.lrad = state.lrad.filter(w=>w.life>0 && w.R<Math.hypot(W,H));

  // прибирання мертвих
  state.enemies = state.enemies.filter(e=>e.hp>0);

  // нова хвиля
  if(state.enemies.length===0){
    state.wave++; waveEl.textContent='WAVE '+state.wave;
    spawnWave(6+state.wave*2);
  }

  hpEl.textContent='HP: '+Math.round(state.hp);
  goalEl.textContent='Ціль: прорив до безпечної зони';
}

/* ================== DRAW ================== */
function drawBG(){
  ctx.fillStyle='#1a0e0e'; ctx.fillRect(0,0,W,H);
  ctx.fillStyle='rgba(255,60,60,.06)';
  for(let i=0;i<80;i++){ const x=(i*73)%W, y=(i*191)%H; ctx.fillRect(x,y,6,6); }
}
function drawWolf(){
  ctx.save();
  ctx.translate(wolf.x,wolf.y);
  // тулуб
  ctx.fillStyle='#0e0e10';
  ctx.beginPath();
  ctx.moveTo(-26, -8);
  ctx.lineTo( 18, -8);
  ctx.lineTo( 26,  0);
  ctx.lineTo( 12,  8);
  ctx.lineTo(-26,  8);
  ctx.closePath(); ctx.fill();
  // «шипи»
  ctx.beginPath();
  for(let i=-22;i<14;i+=6){ ctx.moveTo(i, -8); ctx.lineTo(i+3, -18); ctx.lineTo(i+6,-8); }
  ctx.fill();
  // голова
  ctx.beginPath(); ctx.moveTo(18,-8); ctx.lineTo(36,-4); ctx.lineTo(18,6); ctx.closePath(); ctx.fill();
  // червоне око
  ctx.fillStyle='#ff3a3a'; ctx.fillRect(25,-5,5,5);
  ctx.restore();
}
function drawSkeleton(e){
  ctx.save(); ctx.translate(e.x,e.y);
  ctx.strokeStyle = e.stun>0 ? 'rgba(255,255,140,.95)' : '#ddd';
  ctx.lineWidth=2;
  // голова
  ctx.beginPath(); ctx.arc(0,-12,6,0,Math.PI*2); ctx.stroke();
  // тулуб
  ctx.beginPath(); ctx.moveTo(0,-6); ctx.lineTo(0,10); ctx.stroke();
  // руки
  ctx.beginPath(); ctx.moveTo(-10,-2); ctx.lineTo(10,2); ctx.stroke();
  // ноги
  ctx.beginPath(); ctx.moveTo(0,10); ctx.lineTo(-7,20); ctx.moveTo(0,10); ctx.lineTo(7,20); ctx.stroke();
  ctx.restore();
}
function drawDrone(d){
  ctx.save(); ctx.translate(d.x,d.y);
  ctx.strokeStyle='rgba(200,200,220,.9)'; ctx.lineWidth=2;
  // корпус
  ctx.beginPath(); ctx.rect(-10,-6,20,12); ctx.stroke();
  // промені «листівок»
  ctx.strokeStyle='rgba(255,80,80,.75)';
  ctx.beginPath(); ctx.moveTo(0,6); ctx.lineTo(0,20); ctx.stroke();
  ctx.restore();
}
function drawLRADRing(w){
  ctx.save(); ctx.translate(w.x,w.y); ctx.rotate(w.a);
  ctx.strokeStyle='rgba(255,40,40,.9)'; ctx.lineWidth=3;
  // три контури, що імітують периметр LRAD (еліпси у перспективі)
  for(let k=0;k<3;k++){
    const R = w.R - k*22; if(R<=10) continue;
    ctx.beginPath();
    ctx.ellipse(0,0, R*1.22, R*0.62, 0, -0.38*Math.PI, 0.38*Math.PI);
    ctx.stroke();
  }
  ctx.restore();
}
function drawProjectiles(){
  ctx.strokeStyle='#ff4a4a'; ctx.lineWidth=2;
  for(const p of state.projectiles){
    ctx.beginPath(); ctx.moveTo(p.x,p.y); ctx.lineTo(p.x-10,p.y); ctx.stroke();
  }
}

function draw(){
  drawBG();
  // LRAD позаду — малюємо першим, щоб бути під юнітами
  for(const w of state.lrad) drawLRADRing(w);
  // дрони
  for(const d of state.drones) drawDrone(d);
  // вовк
  drawWolf();
  // вороги
  for(const e of state.enemies) drawSkeleton(e);
  // лазер
  drawProjectiles();
}

/* ================== LOOP ================== */
let last=performance.now();
function loop(t){
  const dt=Math.min(0.033,(t-last)/1000); last=t;
  update(dt); draw(); requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
})();
