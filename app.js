const $=id=>document.getElementById(id);
const css=v=>getComputedStyle(document.documentElement).getPropertyValue(v).trim();
let LOG=null,T1=0,t=0,playing=false,speed=1,base=null,pathAll=null,pathDone=null,npath=0;

/* ---------- 2. Turn raw messages into a playable timeline ---------- */
const MODES={0:'Stabilize',1:'Acro',2:'AltHold',3:'Auto',4:'Guided',5:'Loiter',6:'RTL',7:'Circle',9:'Land',11:'Drift',13:'Sport',14:'Flip',15:'AutoTune',16:'PosHold',17:'Brake',18:'Throw',19:'Avoid ADSB',20:'Guided NoGPS',21:'Smart RTL'};
function build(raw){
 const d=raw.d,A=d.ATT||[];
 if(!A.length)throw new Error('No ATT messages found. Is this an ArduPilot DataFlash .BIN log?');
 let P=(d.POS||[]).filter(r=>r.Lat||r.Lng).map(r=>({T:r.TimeUS,la:r.Lat,ln:r.Lng,h:r.RelHomeAlt!==undefined?r.RelHomeAlt:r.Alt}));
 if(!P.length&&d.GPS){const G=d.GPS.filter(g=>g.Lat&&g.Lng&&(g.Status===undefined||g.Status>=3));
  if(G.length)P=G.map(g=>({T:g.TimeUS,la:g.Lat,ln:g.Lng,h:g.Alt-G[0].Alt}))}
 const t0=Math.min(A[0].TimeUS,P.length?P[0].T:Infinity);
 const sec=x=>(x-t0)/1e6;
 const att={t:A.map(r=>sec(r.TimeUS)),r:A.map(r=>r.Roll),p:A.map(r=>r.Pitch),y:A.map(r=>r.Yaw)};
 let pos;
 if(P.length){const la0=P[0].la,ln0=P[0].ln,k=111319.5,cl=Math.cos(la0*Math.PI/180);
  pos={t:P.map(r=>sec(r.T)),x:P.map(r=>(r.ln-ln0)*cl*k),y:P.map(r=>r.h),z:P.map(r=>-(r.la-la0)*k)}}
 else if(d.BARO){const B=d.BARO;pos={t:B.map(r=>sec(r.TimeUS)),x:B.map(()=>0),y:B.map(r=>r.Alt-B[0].Alt),z:B.map(()=>0)}}
 else pos={t:[att.t[0],att.t[att.t.length-1]],x:[0,0],y:[0,0],z:[0,0]};
 const R=d.RCOU||[];
 const rc={t:R.map(r=>sec(r.TimeUS)),m:[1,2,3,4].map(i=>R.map(r=>r['C'+i]||1000))};
 const M=(d.MODE||[]).map(r=>({t:sec(r.TimeUS),n:r.Mode!==undefined?r.Mode:r.ModeNum}));
 const Bt=d.BAT||[],bat={t:Bt.map(r=>sec(r.TimeUS)),v:Bt.map(r=>r.Volt)};
 const Gs=(d.GPS||[]),gps={t:Gs.map(r=>sec(r.TimeUS)),s:Gs.map(r=>r.Spd)};
 return{att,pos,rc,M,bat,gps,cnt:raw.cnt,end:Math.max(att.t[att.t.length-1],pos.t[pos.t.length-1])};
}
const bs=(a,x)=>{let lo=0,hi=a.length-1;if(!a.length||x<a[0])return 0;while(lo<hi){const m=(lo+hi+1)>>1;if(a[m]<=x)lo=m;else hi=m-1}return lo};
const lerp=(a,i,j,f)=>a[i]+(a[j]-a[i])*f;
const angl=(a,b,f)=>a+(((b-a+540)%360)-180)*f;
const frac=(a,i,j,x)=>j>i?Math.min(1,Math.max(0,(x-a[i])/(a[j]-a[i]))):0;

/* ---------- 3. Three.js scene ---------- */
const cv=$('cv'),R=new THREE.WebGLRenderer({canvas:cv,antialias:true});
R.setPixelRatio(Math.min(devicePixelRatio||1,2));
const scene=new THREE.Scene(),cam=new THREE.PerspectiveCamera(55,1,.1,6000);
cam.position.set(18,14,22);
const ctl=new THREE.OrbitControls(cam,cv);ctl.enableDamping=true;ctl.maxPolarAngle=Math.PI*.495;
scene.add(new THREE.HemisphereLight(0xffffff,0x667788,1));
let grid=null;
function themeScene(){
 scene.background=new THREE.Color(css('--sky'));
 if(grid){scene.remove(grid);grid.geometry.dispose()}
 grid=new THREE.GridHelper(4000,400,new THREE.Color(css('--acc')),new THREE.Color(css('--grid')));
 grid.material.transparent=true;grid.material.opacity=.7;scene.add(grid);
 if(pathAll)pathAll.material.color.set(css('--path'));
 if(pathDone)pathDone.material.color.set(css('--acc'));
 if(LOG)drawBase();
}
const rig=new THREE.Group(),body=new THREE.Group();rig.add(body);scene.add(rig);
const props=[];
[[1,-1,1],[-1,1,1],[-1,-1,-1],[1,1,-1]].forEach(([sx,sz,dir],i)=>{ // M1 FR, M2 RL, M3 FL, M4 RR
 const arm=new THREE.Mesh(new THREE.BoxGeometry(.5,.03,.05),new THREE.MeshLambertMaterial({color:0x37474f}));
 arm.position.set(sx*.13,0,sz*.13);arm.rotation.y=sx*sz>0?-Math.PI/4:Math.PI/4;body.add(arm);
 const pr=new THREE.Mesh(new THREE.BoxGeometry(.3,.012,.035),new THREE.MeshBasicMaterial({color:0xffffff}));
 pr.position.set(sx*.25,.05,sz*.25);pr.userData.dir=dir;body.add(pr);props.push(pr);
});
body.add(new THREE.Mesh(new THREE.BoxGeometry(.22,.07,.22),new THREE.MeshLambertMaterial({color:0x90a4ae})));
const nose=new THREE.Mesh(new THREE.ConeGeometry(.05,.14,12),new THREE.MeshLambertMaterial({color:0xe8590c}));
nose.rotation.x=-Math.PI/2;nose.position.set(0,.02,-.17);body.add(nose);
const dropG=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]);
const drop=new THREE.Line(dropG,new THREE.LineBasicMaterial({color:0x888888,transparent:true,opacity:.6}));scene.add(drop);

function setPath(pos){
 [pathAll,pathDone].forEach(l=>l&&scene.remove(l));
 const arr=new Float32Array(pos.t.length*3);
 pos.t.forEach((_,i)=>{arr.set([pos.x[i],pos.y[i],pos.z[i]],i*3)});
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(arr,3));
 const g2=new THREE.BufferGeometry();g2.setAttribute('position',g.attributes.position);
 npath=pos.t.length;
 pathAll=new THREE.Line(g,new THREE.LineBasicMaterial({color:css('--path')}));
 pathDone=new THREE.Line(g2,new THREE.LineBasicMaterial({color:css('--acc')}));
 scene.add(pathAll,pathDone);
}

/* ---------- 4. Per-frame state ---------- */
const motCols=[...document.querySelectorAll('#mot b')];
const f1=(v,u='')=>isFinite(v)?v.toFixed(1)+u:'–';
function apply(x){
 const{att,pos,rc,M,bat,gps}=LOG;
 let i=bs(att.t,x),j=Math.min(i+1,att.t.length-1),f=frac(att.t,i,j,x);
 const roll=angl(att.r[i],att.r[j],f),pit=angl(att.p[i],att.p[j],f),yaw=angl(att.y[i],att.y[j],f);
 let a=bs(pos.t,x),b=Math.min(a+1,pos.t.length-1),g=frac(pos.t,a,b,x);
 const px=lerp(pos.x,a,b,g),py=lerp(pos.y,a,b,g),pz=lerp(pos.z,a,b,g);
 const prev=rig.position.clone();
 rig.position.set(px,py,pz);
 body.rotation.set(pit*Math.PI/180,-yaw*Math.PI/180,-roll*Math.PI/180,'YXZ');
 pathDone.geometry.setDrawRange(0,a+1);
 drop.geometry.setFromPoints([new THREE.Vector3(px,py,pz),new THREE.Vector3(px,0,pz)]);
 const dist=cam.position.distanceTo(rig.position);rig.scale.setScalar(Math.max(1,dist/10));
 if($('follow').checked){const dl=rig.position.clone().sub(ctl.target);cam.position.add(dl);ctl.target.copy(rig.position)}
 // motors
 let pw=[1000,1000,1000,1000];
 if(rc.t.length){const k=bs(rc.t,x);pw=rc.m.map(m=>m[k])}
 props.forEach((p,n)=>{const th=Math.max(0,(pw[n]-1000)/1000);p.rotation.y+=p.userData.dir*(.15+th*1.6);
  p.material.color.setHSL(.33-.33*th,.9,.5);motCols[n].style.height=(th*100)+'%'});
 // HUD
 let mn=-1;for(const m of M){if(m.t<=x)mn=m.n;else break}
 $('hMode').textContent=mn<0?'–':(MODES[mn]||'Mode '+mn);
 $('hAlt').textContent=f1(py,' m');
 let sp=NaN;if(gps.t.length)sp=gps.s[bs(gps.t,x)];else if(b>a){sp=Math.hypot(pos.x[b]-pos.x[a],pos.z[b]-pos.z[a])/(pos.t[b]-pos.t[a])}
 $('hSpd').textContent=f1(sp,' m/s');
 $('hR').textContent=f1(roll,'°');$('hP').textContent=f1(pit,'°');$('hY').textContent=f1((yaw+360)%360,'°');
 $('hV').textContent=bat.t.length?f1(bat.v[bs(bat.t,x)],' V'):'–';
 $('tm').textContent=x.toFixed(1)+' / '+T1.toFixed(1)+' s';
 $('scrub').value=T1?x/T1*1000:0;
 drawStrip(x);
}

/* ---------- 5. Timeline strip (roll/pitch, altitude, throttle) ---------- */
function plot(g,ts,vs,x0,w,y0,y1,col,lo,hi){
 const n=ts.length;if(n<2||hi<=lo)return;const st=Math.max(1,Math.floor(n/(w*2)));
 g.beginPath();g.strokeStyle=col;g.lineWidth=1.2;
 for(let i=0;i<n;i+=st){const X=x0+ts[i]/T1*w,Y=y1-(vs[i]-lo)/(hi-lo)*(y1-y0);i?g.lineTo(X,Y):g.moveTo(X,Y)}
 g.stroke();
}
function drawBase(){
 const c=$('st'),dpr=devicePixelRatio||1,w=c.clientWidth,h=c.clientHeight;
 c.width=w*dpr;c.height=h*dpr;base=document.createElement('canvas');base.width=c.width;base.height=c.height;
 const g=base.getContext('2d');g.scale(dpr,dpr);
 g.fillStyle=css('--panel');g.fillRect(0,0,w,h);
 const L=h/3,{att,pos,rc,M}=LOG,lab=(s,y)=>{g.fillStyle=css('--mut');g.font='11px Barlow,sans-serif';g.fillText(s,6,y)};
 g.strokeStyle=css('--line');for(let k=1;k<3;k++){g.beginPath();g.moveTo(0,k*L);g.lineTo(w,k*L);g.stroke()}
 const mx=Math.max(10,...att.r.map(Math.abs),...att.p.map(Math.abs));
 plot(g,att.t,att.r,0,w,3,L-3,css('--c1'),-mx,mx);plot(g,att.t,att.p,0,w,3,L-3,css('--c2'),-mx,mx);
 lab('Roll / Pitch',12);
 const ymax=Math.max(1,...pos.y),ymin=Math.min(0,...pos.y);
 plot(g,pos.t,pos.y,0,w,L+3,2*L-3,css('--c3'),ymin,ymax);lab('Altitude',L+12);
 if(rc.t.length){const av=rc.t.map((_,k)=>(rc.m[0][k]+rc.m[1][k]+rc.m[2][k]+rc.m[3][k])/4);
  plot(g,rc.t,av,0,w,2*L+3,3*L-3,css('--acc'),1000,2000)}lab('Motor output',2*L+12);
 g.fillStyle=css('--mut');M.forEach(m=>{const X=m.t/T1*w;g.fillRect(X,0,1,h);g.fillText(MODES[m.n]||m.n,X+3,h-4)});
}
function drawStrip(x){
 const c=$('st'),g=c.getContext('2d');if(!base)return;
 g.setTransform(1,0,0,1,0,0);g.drawImage(base,0,0);
 const X=x/T1*c.width;g.fillStyle=css('--acc');g.fillRect(X-1,0,2*(devicePixelRatio||1),c.height);
}
function seekFromEvent(e){if(!LOG)return;const r=$('st').getBoundingClientRect();t=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width))*T1;if(!playing)apply(t)}
let drag=false;const st=$('st');
st.addEventListener('pointerdown',e=>{drag=true;st.setPointerCapture(e.pointerId);seekFromEvent(e)});
st.addEventListener('pointermove',e=>drag&&seekFromEvent(e));
st.addEventListener('pointerup',()=>drag=false);

/* ---------- 6. Loading, controls, loop ---------- */
function load(raw,name){
 try{LOG=build(raw)}catch(e){$('err').textContent=e.message;return}
 T1=LOG.end;t=0;playing=false;$('play').textContent='Play';$('err').textContent='';
 $('empty').hidden=true;$('hud').hidden=false;$('msgs').hidden=false;$('fname').textContent=name;
 $('msgList').innerHTML=Object.entries(LOG.cnt).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<div><span>${k}</span><span>${v}</span></div>`).join('');
 setPath(LOG.pos);themeScene();
 const p0=LOG.pos;let ext=10;p0.t.forEach((_,i)=>{ext=Math.max(ext,Math.abs(p0.x[i]),Math.abs(p0.z[i]),p0.y[i])});
 cam.position.set(ext*.8,ext*.6+6,ext*.8+10);ctl.target.set(0,0,0);apply(0);
}
async function openFile(f){
 if(!f)return;$('err').textContent='Reading '+f.name+'…';$('empty').hidden=false;
 await new Promise(r=>setTimeout(r,30));
 try{load(parseBin(await f.arrayBuffer()),f.name)}catch(e){$('err').textContent='Could not read file: '+e.message}
}
$('file').onchange=e=>openFile(e.target.files[0]);
addEventListener('dragover',e=>e.preventDefault());
addEventListener('drop',e=>{e.preventDefault();openFile(e.dataTransfer.files[0])});
$('play').onclick=()=>{if(!LOG)return;if(t>=T1)t=0;playing=!playing;$('play').textContent=playing?'Pause':'Play'};
$('scrub').oninput=e=>{if(LOG){t=e.target.value/1000*T1;apply(t)}};
$('spd').onchange=e=>speed=+e.target.value;

function demo(){
 const d={ATT:[],POS:[],RCOU:[],BAT:[],MODE:[{TimeUS:0,Mode:2},{TimeUS:8e6,Mode:5},{TimeUS:50e6,Mode:9}]};
 const cl=x=>Math.max(0,Math.min(1,x));
 for(let k=0;k<=60*25;k++){
  const s=k/25,a=.35*Math.max(0,Math.min(42,s-8)),Rr=40,e=Rr*(1-Math.cos(a)),n=Rr*Math.sin(a);
  const fl=cl((s-8)/2)*(s<50?1:cl((52-s)/2));
  const alt=s<8?20*s/8:s>50?Math.max(0,20*(60-s)/10):20+4*Math.sin(.3*(s-8));
  const roll=26*fl+Math.sin(s*3)*.8,pit=-6*fl+Math.cos(s*2)*.6,yaw=((a*180/Math.PI)%360+360)%360;
  const T=Math.round(s*1e6);
  d.ATT.push({TimeUS:T,Roll:roll,Pitch:pit,Yaw:yaw});
  if(k%3===0)d.POS.push({TimeUS:T,Lat:20+n/111319.5,Lng:77+e/(111319.5*Math.cos(20*Math.PI/180)),RelHomeAlt:alt});
  if(k%2===0){const b=s>50?1300-(s-50)*20:1450+(s<8?120:0);
   d.RCOU.push({TimeUS:T,C1:b-3*roll+3*pit,C2:b+3*roll-3*pit,C3:b+3*roll+3*pit,C4:b-3*roll-3*pit})}
  if(k%25===0)d.BAT.push({TimeUS:T,Volt:16.8-s*.012});
 }
 load({d,cnt:{ATT:d.ATT.length,POS:d.POS.length,RCOU:d.RCOU.length,BAT:d.BAT.length,MODE:3}},'Demo flight (generated)');
}
$('demo').onclick=demo;

let last=performance.now();
function frame(now){
 requestAnimationFrame(frame);const dt=Math.min(.1,(now-last)/1000);last=now;
 if(LOG&&playing){t+=dt*speed;if(t>=T1){t=T1;playing=false;$('play').textContent='Play'}}
 if(LOG)apply(t);
 ctl.update();R.render(scene,cam);
}
function resize(){const m=document.querySelector('main');R.setSize(m.clientWidth,m.clientHeight,false);cam.aspect=m.clientWidth/m.clientHeight;cam.updateProjectionMatrix();if(LOG)drawBase()}
new ResizeObserver(resize).observe(document.querySelector('main'));
new ResizeObserver(()=>LOG&&drawBase()).observe($('st'));
matchMedia('(prefers-color-scheme: dark)').addEventListener('change',themeScene);
themeScene();resize();requestAnimationFrame(frame);
