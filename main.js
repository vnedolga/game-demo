(() => {
  // ===== Canvas =====
  const cvs = document.getElementById('game');
  const ctx = cvs.getContext('2d');
  let W=innerWidth,H=innerHeight,DPR=Math.min(devicePixelRatio||1,2);
  function resize(){W=innerWidth;H=innerHeight;cvs.width=W*DPR;cvs.height=H*DPR;cvs.style.width=W+'px';cvs.style.height=H+'px';ctx.setTransform(DPR,0,0,DPR,0,0);}
  addEventListener('resize',resize); resize();

  // ===== HUD refs =====
  const hpEl = document.getElementById('hp');
  const waveEl = document.getElementById('wave');
  const goalEl = document.getElementById('goal');

  // ===== State =====
  const state = {
    hp: 100, wave: 1,
    enemies: [], projectiles: [], lrad: [],
    time: 0
  };

  // ===== Player (Кібер Вовк) =====
  const wolf = { x: W*0.28, y: H*0.6, r: 22, speed: 230, eyeCd: 0 };

  // ===== Input: keyboard + virtual stick & buttons =====
  const keys={}; addEventListener('keydown',e=>keys[e.key]=true); addEventListener('keyup',e=>keys[e.key]=false);
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

  // ===== Enemies =====
  function spawnSkeleton(x,y){ state.enemies.push({x,y,r:16,hp:45,stun:0,t:0}); }
  function spawnWave(n){
    for(let i=0;i<n;i++){
      const x = W*0.55 + Math.random()*W*0.35;
      const y = H*0.2 + Math.random()*H*0.6;
      spawnSkeleton(x,y);
    }
  }
  spawnWave(8);

  // ===== Actions =====
  function claw(){
    for(const e of state.enemies){
      if(Math.hypot(e.x-wolf.x,e.y-wolf.y) < 46) e.hp -= 28;
    }
  }
  function laser(){
    if(wolf.eyeCd>0) return;
    wolf.eyeCd=0.8;
    const a = 0; // вперед праворуч
    state.projectiles.push({x:wolf.x+12,y:wolf.y-6,a:a,v:900,life:0.22,dmg:40});
  }
  function fireLRAD(){
    const origin = {x:wolf.x+70, y:wolf.y-20}; // точка «LRAD/авто» праворуч від вовка
    const dir = 0; // вперед праворуч
    // Стартовий “периметровий” контур + ще 2 кільця в перспективі
    state.lrad.push({x:origin.x,y:origin.y,a:dir,R:12,life:1.2});
    state.lrad.push({x:origin.x,y:origin.y,a:dir,R:36,life:1.2});
    state.lrad.push({x:origin.x,y:origin.y,a:dir,R:60,life:1.2});
  }

  // ===== Update =====
  function update(dt){
    state.time+=dt; wolf.eyeCd=Math.max(0,wolf.eyeCd-dt);

    // рух вовка
    const vx=(keys['a']?-1:0)+(keys['d']?1:0)+stickVec.x;
    const vy=(keys['w']?-1:0)+(keys['s']?1:0)+stickVec.y;
    const L=Math.hypot(vx,vy)||1;
    wolf.x = Math.max(16,Math.min(W-16, wolf.x + (vx/L)*wolf.speed*dt));
    wolf.y = Math.max(16,Math.min(H-16, wolf.y + (vy/L)*wolf.speed*dt));

    // вороги
    for(const e of state.enemies){
      e.t+=dt; if(e.stun>0){ e.stun-=dt; continue; }
      const dx=wolf.x-e.x, dy=wolf.y-e.y, d=Math.hypot(dx,dy);
      if(d>28){ const sp=80; e.x+=dx/d*sp*dt; e.y+=dy/d*sp*dt; }
      // "кидок черепа" (просто шкодить, якщо підійшов близько)
      if(d<26){ state.hp=Math.max(0,state.hp-18*dt); }
    }

    // лазерні постріли
    for(const p of state.projectiles){ p.x+=Math.cos(p.a)*p.v*dt; p.y+=Math.sin(p.a)*p.v*dt; p.life-=dt; }
    state.projectiles = state.projectiles.filter(p=>p.life>0);

    // зіткнення кулі з ворогами
    for(const p of state.projectiles){
      for(const e of state.enemies){
        if(e.hp<=0) continue;
        if(Math.hypot(p.x-e.x,p.y-e.y) < e.r+3){ e.hp-=p.dmg; p.life=0; }
      }
    }

    // LRAD кільця: рухаються вперед і оглушають
    for(const w of state.lrad){
      w.R += 180*dt; // розширення
      // уявний конус у напрямку w.a
      for(const e of state.enemies){
        const dx=e.x-w.x, dy=e.y-w.y;
        const ang=Math.atan2(dy,dx), da=Math.abs(((ang-w.a+Math.PI)%(2*Math.PI))-Math.PI);
        const dist=Math.hypot(dx,dy);
        if(da<0.45 && Math.abs(dist-w.R)<15){ e.stun=Math.max(e.stun,1.4); }
      }
      w.life-=dt;
    }
    state.lrad = state.lrad.filter(w=>w.life>0 && w.R<Math.hypot(W,H));

    // видаляємо мертвих
    state.enemies = state.enemies.filter(e=>e.hp>0);

    // хвилі
    if(state.enemies.length===0){
      state.wave++; waveEl.textContent='WAVE '+state.wave;
      spawnWave(6+state.wave*2);
    }

    // HUD
    hpEl.textContent='HP: '+Math.round(state.hp);
    goalEl.textContent = 'Ціль: тримайся та проривайся';
  }

  // ===== Draw =====
  function draw(){
    // фон/ґрунт
    ctx.clearRect(0,0,W,H);
    ctx.fillStyle='#1a0e0e'; ctx.fillRect(0,0,W,H);
    // уламки
    ctx.fillStyle='rgba(255,50,50,.06)';
    for(let i=0;i<60;i++){ const x=(i*73)%W, y=(i*191)%H; ctx.fillRect(x,y,6,6); }

    // LRAD кільця, що «імітують форму диска» (еліпси/дуги в перспективі)
    for(const w of state.lrad){
      ctx.save(); ctx.translate(w.x,w.y); ctx.rotate(w.a);
      ctx.strokeStyle='rgba(255,40,40,.85)'; ctx.lineWidth=3;
      // периметровий контур + ще два
      for(let k=0;k<3;k++){
        const R = w.R - k*22; if(R<=8) continue;
        ctx.beginPath(); ctx.ellipse(0,0,R*1.2, R*0.6, 0, -0.38*Math.PI, 0.38*Math.PI);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Вовк (силует + червоне око)
    ctx.save(); ctx.translate(wolf.x,wolf.y);
    ctx.fillStyle='#111'; ctx.beginPath(); ctx.arc(0,0,wolf.r,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(12,-6,10,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#ff3a3a'; ctx.fillRect(17,-10,5,5);
    ctx.restore();

    // Вороги (скелети як кільця)
    for(const e of state.enemies){
      ctx.save(); ctx.translate(e.x,e.y);
      ctx.strokeStyle = e.stun>0 ? 'rgba(255,255,120,.95)' : '#ddd';
      ctx.lineWidth=2; ctx.beginPath(); ctx.arc(0,0,e.r,0,Math.PI*2); ctx.stroke();
      ctx.restore();
    }

    // Лазерні постріли
    ctx.strokeStyle='#ff4545'; ctx.lineWidth=2;
    for(const p of state.projectiles){
      ctx.beginPath(); ctx.moveTo(p.x,p.y); ctx.lineTo(p.x-10,p.y); ctx.stroke();
    }
  }

  // ===== Loop =====
  let last=performance.now();
  function loop(t){
    const dt=Math.min(0.033,(t-last)/1000); last=t;
    update(dt); draw(); requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
