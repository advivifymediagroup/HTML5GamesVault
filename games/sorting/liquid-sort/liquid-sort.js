(function(){
  const canvas=document.getElementById("game"),ctx=canvas.getContext("2d"),W=canvas.width,H=canvas.height,CAP=4;
  const colors=["#ef4444","#06d4f7","#22c55e","#fbbf24","#ec4899","#8b5cf6","#f97316","#14b8a6","#a3e635"];
  const els=["level","moves","time","best","status","overlay","overTitle","overMsg","stars","modalStats","restartOverlay"].reduce((a,id)=>(a[id]=document.getElementById(id),a),{});
  let level=+H5GV.store.get("liquid-sort-level",1),tubes=[],picked=-1,moves=0,seconds=0,paused=true,history=[],timer,anim=null;
  const count=()=>Math.min(colors.length,3+Math.floor((level-1)/2));
  function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
  function make(){
    const n=count(),pool=[]; for(let c=0;c<n;c++) for(let i=0;i<CAP;i++) pool.push(c);
    shuffle(pool); tubes=[]; for(let i=0;i<n;i++) tubes.push(pool.slice(i*CAP,i*CAP+CAP)); tubes.push([],[]);
    if(done()) return make();
  }
  function topRun(t){if(!t.length)return 0;let c=t[t.length-1],n=1;while(n<t.length&&t[t.length-1-n]===c)n++;return n}
  function can(a,b){const A=tubes[a],B=tubes[b];return a!==b&&A.length&&B.length<CAP&&(!B.length||B[B.length-1]===A[A.length-1])&&!(B.length===0&&topRun(A)===A.length)}
  function pour(a,b){const A=tubes[a],B=tubes[b],n=Math.min(topRun(A),CAP-B.length),c=A[A.length-1];for(let i=0;i<n;i++){A.pop();B.push(c)}return {n,c}}
  function done(){return tubes.every(t=>!t.length||(t.length===CAP&&t.every(x=>x===t[0])))}
  function start(){make();picked=-1;moves=0;seconds=0;history=[];paused=false;els.overlay.classList.remove("show");clearInterval(timer);timer=setInterval(()=>{if(!paused){seconds++;stats()}},1000);stats();draw();els.status.textContent="Click a tube to lift its top color."}
  function stats(){els.level.textContent=level;els.moves.textContent=moves;els.time.textContent=H5GV.formatTime(seconds);els.best.textContent=H5GV.store.get("liquid-best-"+level,"—")}
  function layout(){const n=tubes.length,per=n>6?Math.ceil(n/2):n,rows=Math.ceil(n/per),tw=Math.min(58,Math.floor((W-48)/per)-12),th=rows>1?162:260,gap=(W-per*tw)/(per+1),top=(H-(rows*th+(rows-1)*28))/2;return tubes.map((_,i)=>{const r=Math.floor(i/per),c=i%per,inRow=Math.min(per,n-r*per),g=(W-inRow*tw)/(inRow+1);return{x:g+c*(tw+g),y:top+r*(th+28),w:tw,h:th}})}
  function hit(x,y){return layout().findIndex(b=>x>=b.x-10&&x<=b.x+b.w+10&&y>=b.y-24&&y<=b.y+b.h+12)}
  function click(i){if(paused||i<0)return;if(picked<0){if(tubes[i].length){picked=i;H5GV.audio.click();els.status.textContent="Choose a destination tube.";draw()}return} if(i===picked){picked=-1;draw();return} if(!can(picked,i)){H5GV.audio.wrong();els.status.textContent="That pour is blocked.";picked=tubes[i].length?i:-1;draw();return} history.push({t:tubes.map(x=>x.slice()),m:moves,s:seconds});const res=pour(picked,i);anim={from:picked,to:i,color:res.c,t:0};picked=-1;moves++;H5GV.audio.correct();els.status.textContent=`Poured ${res.n} layer${res.n>1?"s":""}.`;stats();draw();if(done())setTimeout(win,280)}
  function undo(){if(paused||!history.length)return;const h=history.pop();tubes=h.t;moves=h.m;seconds=h.s;picked=-1;stats();draw();els.status.textContent="Move undone."}
  function win(){paused=true;clearInterval(timer);H5GV.audio.done();const old=H5GV.store.get("liquid-best-"+level,null);if(!old||moves<old)H5GV.store.set("liquid-best-"+level,moves);els.overTitle.textContent=`Level ${level} complete`;els.overMsg.textContent="Every tube is cleanly sorted.";els.stars.textContent=moves<=count()*5?"★★★":moves<=count()*7?"★★☆":"★☆☆";els.modalStats.textContent=`Moves ${moves} · Time ${H5GV.formatTime(seconds)}`;els.restartOverlay.textContent=level>=12?"Replay":"Next Level";els.overlay.classList.add("show");H5GV.store.set("liquid-sort-level",Math.min(12,level+1));if(level<12)level++}
  function tube(b,t,sel){const r=b.w/2,seg=(b.h-10)/CAP;ctx.save();ctx.beginPath();ctx.moveTo(b.x,b.y);ctx.lineTo(b.x,b.y+b.h-r);ctx.arc(b.x+r,b.y+b.h-r,r,Math.PI,0,true);ctx.lineTo(b.x+b.w,b.y);ctx.closePath();ctx.clip();ctx.fillStyle="rgba(255,255,255,.06)";ctx.fillRect(b.x,b.y,b.w,b.h);t.forEach((c,i)=>{const y=b.y+b.h-5-(i+1)*seg;const g=ctx.createLinearGradient(b.x,y,b.x+b.w,y);g.addColorStop(0,shade(colors[c],-30));g.addColorStop(.5,colors[c]);g.addColorStop(1,shade(colors[c],-48));ctx.fillStyle=g;ctx.fillRect(b.x+2,y,b.w-4,seg-2);ctx.fillStyle="rgba(255,255,255,.35)";ctx.font="700 13px Space Grotesk";ctx.textAlign="center";ctx.fillText(c+1,b.x+b.w/2,y+seg*.62);if(c%2){ctx.globalAlpha=.18;ctx.fillRect(b.x+6,y+seg*.32,b.w-12,3);ctx.globalAlpha=1}});ctx.restore();ctx.strokeStyle=sel?"#06d4f7":"rgba(255,255,255,.58)";ctx.lineWidth=sel?4:2;ctx.stroke();ctx.beginPath();ctx.moveTo(b.x-6,b.y);ctx.lineTo(b.x+b.w+6,b.y);ctx.stroke()}
  function draw(){ctx.clearRect(0,0,W,H);const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,"#10213f");g.addColorStop(1,"#071426");ctx.fillStyle=g;ctx.fillRect(0,0,W,H);layout().forEach((b,i)=>tube(b,tubes[i],i===picked));if(anim&&anim.t++<12)requestAnimationFrame(draw);else anim=null}
  function shade(hex,amt){let n=parseInt(hex.slice(1),16),r=Math.max(0,Math.min(255,(n>>16)+amt)),g=Math.max(0,Math.min(255,(n>>8&255)+amt)),b=Math.max(0,Math.min(255,(n&255)+amt));return`rgb(${r},${g},${b})`}
  canvas.addEventListener("pointerdown",e=>{const r=canvas.getBoundingClientRect();click(hit((e.clientX-r.left)*W/r.width,(e.clientY-r.top)*H/r.height))});
  document.getElementById("newBtn").addEventListener("click",start);document.getElementById("undoBtn").addEventListener("click",undo);els.restartOverlay.addEventListener("click",start);
  H5GV.wireCommonControls({onRestart:start,onPause:()=>{paused=!paused;document.getElementById("pauseBtn").textContent=paused?"Resume":"Pause";els.status.textContent=paused?"Paused.":"Pouring resumed.";draw()}});
  stats();draw();
})();
