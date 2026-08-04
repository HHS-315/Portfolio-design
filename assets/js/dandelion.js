/*
 * DANDELION — a glyph-only object (dense, living, white-on-dark)
 * Structure preserved: pts array, build/frame/detach, DPR resize,
 * prefers-reduced-motion branch. Added: higher density, per-glyph churn +
 * alpha shimmer + cursor-local wave, lower placement, alpha-batched draw.
 * Pairs with a <canvas id="field"> element.
 */
(function(){
  "use strict";
  var reduce = matchMedia('(prefers-reduced-motion:reduce)').matches;
  var cv=document.getElementById('field'), ctx=cv.getContext('2d');
  var W=0,H=0,DPR=1,FS=8;
  var cx=0,cy=0,headR=0,baseX=0,baseY=0;   // cx,cy = flower-head centre
  var pts=[], N=0;
  var mouse={x:-1e5,y:-1e5,speed:0};
  var CODE=['0','1','/','\\','<','>','{','}','(',')','=','+','-','*','#','$','%','&','|',';',':','.','x','?','!','^','~'];
  var PTIP=['*','^','/','\\','x','+','\''];
  var LEDGE=['^','v','/','\\','<','>','*','x'];
  function pick(a){ return a[(Math.random()*a.length)|0]; }
  function lerp(a,b,t){ return a+(b-a)*t; }

  function resize(){
    DPR=Math.min(2,window.devicePixelRatio||1);
    W=innerWidth; H=innerHeight;
    cv.style.width=W+'px'; cv.style.height=H+'px';
    cv.width=Math.round(W*DPR); cv.height=Math.round(H*DPR); ctx.setTransform(DPR,0,0,DPR,0,0);
    FS=Math.max(6,Math.min(9,W/170));                 // smaller glyphs -> tighter grid
    ctx.textAlign='center'; ctx.textBaseline='middle';
    cx=W*0.5; cy=H*0.56; headR=Math.min(W,H)*0.135; baseX=W*0.5; baseY=H*0.92;
    build();
  }

  // ---- point makers ----
  // flower-head glyph. rn: 0 centre -> ~1 rim/tip (depth via ALPHA). set/stab for churn.
  function petal(ang,r,ch,rn){
    var tip = rn>1;
    pts.push({petal:true,ang:ang,r:r,rn:Math.min(1.1,rn),ch:ch,set:(tip?PTIP:CODE),stab:tip,swapAt:0,
      state:'on',x:cx+Math.cos(ang)*r,y:cy+Math.sin(ang)*r*0.98,vx:0,vy:0,a:1,sway:Math.random()*6.28,regrow:0});
  }
  // static glyph (stem / leaves). al = base alpha; set=null -> no churn (crisp)
  function stat(x,y,ch,al,set,stab){
    pts.push({stem:true,hx:x,hy:y,ch:ch,al:al,set:set,stab:stab,swapAt:0,x:x,y:y,state:'stem',a:1,sway:Math.random()*6.28});
  }

  function makeLeaf(bx,by,ang,len){
    var steps=Math.max(6,Math.round(len/(FS*1.05)));          // finer FS -> more rows
    var pang=ang+1.5708;
    for(var s=1;s<=steps;s++){
      var t=s/steps;
      var vx=bx+Math.cos(ang)*len*t;
      var vy=by+Math.sin(ang)*len*t + Math.pow(t,1.7)*len*0.32;   // arch then droop
      var hw=Math.sin(t*Math.PI)*headR*0.24*(0.7+Math.random()*0.3);   // width tied to headR, not FS
      var across=Math.max(1,Math.round(hw/(FS*0.82)));         // finer FS -> more across
      for(var w=-across; w<=across; w++){
        var edge=(Math.abs(w)===across);
        var wob=edge? Math.sin(s*1.9)*FS*0.6 : 0;              // toothed edge
        var frac=(across===0?0:w/across);
        var px=vx+Math.cos(pang)*frac*hw + Math.cos(ang)*wob;
        var py=vy+Math.sin(pang)*frac*hw + Math.sin(ang)*wob;
        if(edge) stat(px,py, pick(LEDGE), 0.8+Math.random()*0.2, LEDGE, true);   // teeth = outline, low churn
        else     stat(px,py, pick(CODE),  0.4+Math.random()*0.2, CODE,  false);
      }
    }
  }

  function build(){
    pts.length=0;
    var big=W>=760;

    // ---------- FLOWER HEAD (dense, Fibonacci fill + ray petals) ----------
    var Ncore=big?1000:460, GA=2.399963;              // mobile ~46% of desktop
    for(var i=0;i<Ncore;i++){
      var r=headR*Math.sqrt((i+0.5)/Ncore), a=i*GA;
      petal(a, r, pick(CODE), r/headR);
    }
    var rays=big?88:40;
    for(i=0;i<rays;i++){
      var ra=(i/rays)*Math.PI*2 + (Math.random()-0.5)*0.03;
      var tip=headR*(1.14+Math.random()*0.34), inner=headR*0.72, ps=4;
      for(var j=1;j<=ps;j++){
        var rr=inner+(tip-inner)*(j/ps);
        petal(ra, rr, (j===ps?pick(PTIP):pick(CODE)), (j===ps?1.05:0.9+0.1*(j/ps)));
      }
    }

    // ---------- STEM (still thin — density up, width NOT) ----------
    var sy=cy+headR*0.62, segs=Math.max(6,Math.round((baseY-sy)/(FS*0.9)));
    for(var s=0;s<=segs;s++){
      var tt=s/segs;
      var bx=lerp(cx,baseX,tt)+Math.sin(tt*Math.PI)*8;
      var by=lerp(sy,baseY,tt);
      stat(bx, by, '|', 0.5+Math.random()*0.2, null, true);            // 1 crisp column
      if(Math.random()<0.35) stat(bx+FS*0.42*(Math.random()<0.5?-1:1), by, Math.random()<0.3?':':'|', 0.45+Math.random()*0.2, null, true);
    }

    // ---------- LEAVES (toothed rosette) ----------
    var angs = big ? [-2.55,-2.0,-1.55,-1.1,-0.55] : [-2.3,-1.55,-0.8];
    for(var li=0;li<angs.length;li++){ makeLeaf(baseX,baseY-FS*0.4, angs[li], headR*(1.35+Math.random()*0.5)); }

    N=pts.length;
    var tot=document.getElementById('total'); if(tot) tot.textContent=N;
    if(window.console) console.log('[dandelion] glyphs rendered:', N, '('+(big?'desktop':'mobile')+', FS='+FS.toFixed(1)+')');
  }

  function detach(p,ex){
    if(p.state!=='on') return;
    p.state='fly';
    var ang=Math.atan2(p.y-mouse.y, p.x-mouse.x);
    var sp=5+Math.random()*8;
    p.vx=Math.cos(ang)*sp + 3 + (ex?ex.x:0);
    p.vy=Math.sin(ang)*sp - 5 + (ex?ex.y:0);
    p.spin=Math.random()*6.28;
  }
  function shockwave(power){
    for(var i=0;i<pts.length;i++){ var p=pts[i]; if(!p.petal||p.state!=='on') continue;
      var dx=p.x-cx, dy=p.y-cy, d=Math.sqrt(dx*dx+dy*dy)||1;
      p.state='fly'; p.vx=dx/d*power; p.vy=dy/d*power-power*0.25; p.spin=Math.random()*6.28; }
  }

  // ---- alpha-batched draw: bucket glyphs by quantized alpha, one fillStyle per bucket ----
  var NB=10, BX=[],BY=[],BC=[];
  for(var q=0;q<NB;q++){ BX.push([]); BY.push([]); BC.push([]); }

  var lastT=0;
  function frame(t){
    var dt=(t-lastT)||16; lastT=t; var dtf=Math.max(0.5,Math.min(2,dt/16.67));
    mouse.speed*=Math.pow(0.85,dtf);
    ctx.clearRect(0,0,W,H);
    for(var q=0;q<NB;q++){ BX[q].length=0; BY[q].length=0; BC[q].length=0; }

    var spin=reduce?0:Math.sin(t*0.00022)*0.03, breath=reduce?1:(1+Math.sin(t*0.0007)*0.015);
    var DET=headR*1.3, DET2=DET*DET, RW=headR*0.9, RW2=RW*RW;
    var breeze=26+Math.sin(t*0.0004)*14, on=0, shimT=t*0.004;

    for(var i=0;i<pts.length;i++){
      var p=pts[i];
      // squared distance to cursor (no sqrt) — reused for detach, churn, shimmer
      var ddx=p.x-mouse.x, ddy=p.y-mouse.y, d2=ddx*ddx+ddy*ddy;
      var near = d2<RW2;
      var base;   // resting alpha before shimmer

      if(p.stem){ // static (stem / leaves)
        var hx=p.hx+Math.sin(p.hy*0.012+t*0.0004+p.sway)*1.4;
        p.x+=(hx-p.x)*Math.min(1,0.2*dtf);
        base=p.al;
      }
      else if(p.state==='on'){
        var aa=p.ang+spin, r=p.r*breath;
        var hxp=cx+Math.cos(aa)*r+(reduce?0:Math.sin(t*0.001+p.sway)*0.4);
        var hyp=cy+Math.sin(aa)*r*0.98+(reduce?0:Math.cos(t*0.0012+p.sway)*0.4);
        p.x+=(hxp-p.x)*Math.min(1,0.22*dtf);
        p.y+=(hyp-p.y)*Math.min(1,0.22*dtf);
        p.a+=(1-p.a)*Math.min(1,0.06*dtf);
        if(!reduce && d2<DET2){ var f=1-Math.sqrt(d2)/DET; f*=f; if(Math.random()<f*(0.02+mouse.speed*0.01)*dtf) detach(p); }
        base=lerp(0.42,1.0,Math.min(1,p.rn))*p.a;
        if(p.a>0.3) on++;
      }
      else if(p.state==='fly'){
        if(!reduce){
          p.vx+=breeze*0.5*dtf; p.vy+=-6*dtf;
          p.vx+=Math.sin(p.y*0.008+t*0.0009+(p.spin||0))*5*dtf;
          p.vy+=Math.cos(p.x*0.008+t*0.001)*4*dtf;
          if(d2<19600){ var dd=Math.sqrt(d2)||1,ff=(1-dd/140)*mouse.speed*2.4; p.vx+=ddx/dd*ff; p.vy+=ddy/dd*ff; } // RR=140
          p.vx*=Math.pow(0.985,dtf); p.vy*=Math.pow(0.985,dtf);
          p.x+=p.vx*dtf; p.y+=p.vy*dtf;
          p.a-=0.003*dtf;
        } else { p.a-=0.05; }
        if(p.a<=0 || p.x<-40||p.x>W+40||p.y<-40){ p.state='gone'; p.regrow=t+2000+Math.random()*3500; p.a=0; }
        base=lerp(0.42,1.0,Math.min(1,p.rn))*p.a;
      }
      else { // gone → regrow from centre
        if(t>=p.regrow){ p.state='on'; p.ch=(p.rn>1?pick(PTIP):pick(CODE)); p.x=cx+(Math.random()-0.5)*12; p.y=cy+(Math.random()-0.5)*12; p.a=0; }
        continue;
      }

      // ---- churn: swap the character on a per-glyph timer (faster near cursor) ----
      if(!reduce && p.set && t>=p.swapAt){
        p.ch=pick(p.set);
        var per=p.stab?(1500+Math.random()*2500):(200+Math.random()*1000);
        if(near) per*=0.35;
        p.swapAt=t+per;
      }

      // ---- shimmer: per-glyph phased alpha wobble, stronger near cursor ----
      var vis=base;
      if(!reduce) vis += Math.sin(shimT+p.sway)*(near?0.28:0.12);
      if(vis<=0.03) continue;
      if(vis>1) vis=1;

      // bucket by quantized alpha (10 levels) — batches fillStyle changes
      var b=(vis*9+0.5)|0; if(b>9)b=9;
      BX[b].push(p.x); BY[b].push(p.y); BC[b].push(p.ch);
    }

    // draw each alpha bucket in one fillStyle
    ctx.font=FS+'px '+font();
    for(q=1;q<NB;q++){
      var xs=BX[q]; if(!xs.length) continue;
      ctx.fillStyle='rgba(255,255,255,'+(q/9).toFixed(3)+')';
      var ys=BY[q], cs=BC[q];
      for(var k=0;k<xs.length;k++) ctx.fillText(cs[k],xs[k],ys[k]);
    }

    var cel=document.getElementById('count'); if(cel) cel.textContent=on;
    requestAnimationFrame(frame);
  }

  var _f=null; function font(){ if(!_f)_f=getComputedStyle(document.body).fontFamily; return _f; }

  addEventListener('pointermove',function(e){
    var nx=e.clientX,ny=e.clientY;
    mouse.speed=Math.hypot(nx-(mouse.x<0?nx:mouse.x), ny-(mouse.y<0?ny:mouse.y));
    mouse.x=nx; mouse.y=ny;
  },{passive:true});
  addEventListener('pointerleave',function(){ mouse.x=-1e5; mouse.y=-1e5; mouse.speed=0; });
  addEventListener('pointerdown',function(e){ mouse.x=e.clientX; mouse.y=e.clientY;
    var dx=e.clientX-cx, dy=e.clientY-cy; if(dx*dx+dy*dy < (headR*1.6)*(headR*1.6)) shockwave(40); });

  var wi=document.getElementById('wishInput'), wh=document.getElementById('wishHint');
  if(wi){ wi.addEventListener('keydown',function(e){
    if(e.key==='Enter' && wi.value.trim()){ shockwave(80); wh.innerHTML='sent · <b>“'+wi.value.trim().replace(/[<>&]/g,'')+'”</b> — the flower will grow back.'; wi.value=''; }
  });}

  (function(){ if(reduce)return;
    var el=document.getElementById('title'); if(!el)return; var tgt=el.textContent, ch='!<>-_\\/[]{}=+*^?#$', done=Array(tgt.length).fill(false), fr=0;
    var iv=setInterval(function(){ fr++; var s='';
      for(var i=0;i<tgt.length;i++){ if(done[i]||tgt[i]===' '){s+=tgt[i];continue;}
        if(fr>i*3+(Math.random()*6)){done[i]=true;s+=tgt[i];} else s+=ch[(Math.random()*ch.length)|0]; }
      el.textContent=s; if(done.every(Boolean)){el.textContent=tgt;clearInterval(iv);} },40);
  })();

  var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.style.opacity=1;e.target.style.transform='none';io.unobserve(e.target);}});},{threshold:.12});
  [].forEach.call(document.querySelectorAll('.reveal'),function(el){el.style.opacity=0;el.style.transform='translateY(20px)';el.style.transition='opacity .9s ease,transform .9s ease';io.observe(el);});

  addEventListener('resize',resize);
  resize(); requestAnimationFrame(frame);
})();
