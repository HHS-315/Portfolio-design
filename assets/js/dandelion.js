/*
 * DANDELION — a glyph-only object (dense, living, white-on-dark)
 * + intro sequence: glyphs assemble into "PORTFOLIO", scatter, then converge
 *   into the dandelion (once, on first load; skipped under reduced-motion).
 * Pairs with a <canvas id="field"> element. No dependencies.
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

  // ---- intro state ----
  var introDone = reduce;            // reduced-motion → straight to the live flower
  var introStarted=false;            // set on the first build(); prevents restart on resize
  var IT_TEXT=900, IT_SCAT=700, IT_FORM=1400;
  var introT0=0, scatterInit=false, formInit=false;

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
    var Ncore=big?1000:460, GA=2.399963;
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

    // ---------- STEM (thin) ----------
    var sy=cy+headR*0.62, segs=Math.max(6,Math.round((baseY-sy)/(FS*0.9)));
    for(var s=0;s<=segs;s++){
      var tt=s/segs;
      var bx=lerp(cx,baseX,tt)+Math.sin(tt*Math.PI)*8;
      var by=lerp(sy,baseY,tt);
      stat(bx, by, '|', 0.5+Math.random()*0.2, null, true);
      if(Math.random()<0.35) stat(bx+FS*0.42*(Math.random()<0.5?-1:1), by, Math.random()<0.3?':':'|', 0.45+Math.random()*0.2, null, true);
    }

    // ---------- LEAVES (toothed rosette) ----------
    var angs = big ? [-2.55,-2.0,-1.55,-1.1,-0.55] : [-2.3,-1.55,-0.8];
    for(var li=0;li<angs.length;li++){ makeLeaf(baseX,baseY-FS*0.4, angs[li], headR*(1.35+Math.random()*0.5)); }

    N=pts.length;
    var tot=document.getElementById('total'); if(tot) tot.textContent=N;

    // per-glyph final (rest) target + intro base alpha + form delay
    for(i=0;i<N;i++){ var p=pts[i];
      if(p.petal){ p.fx=cx+Math.cos(p.ang)*p.r; p.fy=cy+Math.sin(p.ang)*p.r*0.98; p.introBase=lerp(0.42,1.0,Math.min(1,p.rn)); }
      else       { p.fx=p.hx; p.fy=p.hy; p.introBase=p.al; }
      p.fdelay=Math.random()*400;
    }

    if(!introDone && !introStarted){
      // FIRST build only → arm the intro
      introStarted=true;
      var tc=extractText('PORTFOLIO');
      assignText(tc);
      tc=null;                                  // release the coord array
      introT0=0; scatterInit=false; formInit=false;
    } else {
      // resize mid-intro must not restart it → finish it; otherwise it's already live
      if(introStarted && !introDone) introDone=true;
      for(i=0;i<N;i++){ p=pts[i]; p.x=p.fx; p.y=p.fy; if(p.petal) p.a=1; }
    }

    if(window.console) console.log('[dandelion] glyphs:', N, '('+(big?'desktop':'mobile')+', headR='+headR.toFixed(0)+', FS='+FS.toFixed(1)+')');
  }

  // ---- extract "PORTFOLIO" pixel coordinates from an offscreen canvas (once) ----
  function extractText(str){
    var off=document.createElement('canvas'), o=off.getContext('2d');
    var fam=font();
    o.font='700 200px '+fam;
    var w0=o.measureText(str).width || (str.length*120);
    var fs=Math.min((W*0.76)/w0*200, H*0.42);      // fit ~76% width; cap height (mobile auto-shrinks)
    fs=Math.max(18, fs);
    o.font='700 '+fs+'px '+fam;
    var tw=Math.ceil(o.measureText(str).width)+6, th=Math.ceil(fs*1.28)+6;
    off.width=tw; off.height=th;                    // (resizing clears the context)
    o=off.getContext('2d');
    o.font='700 '+fs+'px '+fam; o.textAlign='center'; o.textBaseline='middle'; o.fillStyle='#fff';
    o.fillText(str, tw/2, th/2);
    var img=o.getImageData(0,0,tw,th).data;
    var step=Math.max(3, Math.round(FS*0.7));
    var ox=W/2, oy=H*0.46, arr=[];
    for(var yy=0; yy<th; yy+=step){
      var row=yy*tw;
      for(var xx=0; xx<tw; xx+=step){
        if(img[(row+xx)*4+3] > 128) arr.push({x:ox+(xx-tw/2), y:oy+(yy-th/2)});
      }
    }
    return arr;
  }

  // map text coords onto glyphs. M>=N → downsample (crisp); M<N → first M form text,
  // the leftover glyphs are flagged .extra (alpha 0 → fade in during the form phase).
  function assignText(tc){
    var M=tc.length, order=[], i;
    for(i=0;i<N;i++) order.push(i);
    for(i=N-1;i>0;i--){ var j=(Math.random()*(i+1))|0, tmp=order[i]; order[i]=order[j]; order[j]=tmp; }
    for(var k=0;k<N;k++){ var p=pts[order[k]];
      if(k<M){ var idx=(M>=N)? Math.floor(k*M/N) : k; p.tx=tc[idx].x; p.ty=tc[idx].y; p.extra=false; p.x=p.tx; p.y=p.ty; p.a=0.001; }
      else   { p.extra=true; p.x=p.fx; p.y=p.fy; p.a=0; }
    }
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
    if(!introDone) return;
    for(var i=0;i<pts.length;i++){ var p=pts[i]; if(!p.petal||p.state!=='on') continue;
      var dx=p.x-cx, dy=p.y-cy, d=Math.sqrt(dx*dx+dy*dy)||1;
      p.state='fly'; p.vx=dx/d*power; p.vy=dy/d*power-power*0.25; p.spin=Math.random()*6.28; }
  }

  // ---- alpha-batched draw: bucket glyphs by quantized alpha, one fillStyle per bucket ----
  var NB=10, BX=[],BY=[],BC=[];
  for(var q=0;q<NB;q++){ BX.push([]); BY.push([]); BC.push([]); }

  // ---- churn helper (character swap on a per-glyph timer) ----
  function churn(p,t,near){
    if(!reduce && p.set && t>=p.swapAt){
      p.ch=pick(p.set);
      var per=p.stab?(1500+Math.random()*2500):(200+Math.random()*1000);
      if(near) per*=0.35;
      p.swapAt=t+per;
    }
  }
  function bucket(x,y,ch,vis){ if(vis<=0.03) return; if(vis>1)vis=1; var b=(vis*9+0.5)|0; if(b>9)b=9; BX[b].push(x);BY[b].push(y);BC[b].push(ch); }

  // ---- INTRO frame (text → scatter → form) ----
  function easeOutCubic(x){ return 1-Math.pow(1-x,3); }
  function introFrame(t,dtf){
    if(introT0===0){ introT0=t; }
    var e=t-introT0, shimT=t*0.004;
    var phase = e<IT_TEXT?'text' : e<IT_TEXT+IT_SCAT?'scatter' : e<IT_TEXT+IT_SCAT+IT_FORM?'form' : 'end';

    if(phase==='end'){ introDone=true; liveFrame(t,dtf); return; }   // seamless handoff

    if(phase==='scatter' && !scatterInit){
      scatterInit=true;
      for(var i=0;i<N;i++){ var p=pts[i]; if(p.extra) continue;
        var a=Math.atan2(p.y-cy, p.x-cx)+(Math.random()-0.5)*1.2, sp=4+Math.random()*7;
        p.vx=Math.cos(a)*sp; p.vy=Math.sin(a)*sp-2; }
    }
    if(phase==='form' && !formInit){
      formInit=true;
      for(var i2=0;i2<N;i2++){ var p2=pts[i2]; p2.sx0=p2.x; p2.sy0=p2.y; }
    }

    var fe = e-(IT_TEXT+IT_SCAT);   // elapsed inside form
    for(var k=0;k<N;k++){ var p=pts[k];
      churn(p,t,false);
      var vis;
      if(phase==='text'){
        if(p.extra){ continue; }
        p.x=p.tx; p.y=p.ty; vis=p.introBase;
      } else if(phase==='scatter'){
        if(p.extra){ continue; }
        p.vx+=Math.sin(p.y*0.01+t*0.001)*3*dtf; p.vy+=Math.cos(p.x*0.01+t*0.001)*3*dtf;
        p.vx*=Math.pow(0.94,dtf); p.vy*=Math.pow(0.94,dtf);
        p.x+=p.vx*dtf; p.y+=p.vy*dtf;
        var m=38;                                        // keep them on-screen (soft walls)
        if(p.x<m){p.x=m;p.vx*=-0.4;} else if(p.x>W-m){p.x=W-m;p.vx*=-0.4;}
        if(p.y<m){p.y=m;p.vy*=-0.4;} else if(p.y>H-m){p.y=H-m;p.vy*=-0.4;}
        vis=p.introBase;
      } else { // form
        var pr=(fe-p.fdelay)/(IT_FORM-p.fdelay); if(pr<0)pr=0; else if(pr>1)pr=1;
        var ee=easeOutCubic(pr);
        if(p.extra){ p.x=p.fx; p.y=p.fy; p.a=ee; vis=p.introBase*ee; }
        else       { p.x=p.sx0+(p.fx-p.sx0)*ee; p.y=p.sy0+(p.fy-p.sy0)*ee; p.a=1; vis=p.introBase; }
      }
      if(!reduce) vis += Math.sin(shimT+p.sway)*0.10;
      bucket(p.x,p.y,p.ch,vis);
    }
  }

  // ---- LIVE frame (original behaviour: hover-detach, shimmer, churn, regrow) ----
  function liveFrame(t,dtf){
    var spin=reduce?0:Math.sin(t*0.00022)*0.03, breath=reduce?1:(1+Math.sin(t*0.0007)*0.015);
    var DET=headR*1.3, DET2=DET*DET, RW=headR*0.9, RW2=RW*RW;
    var breeze=26+Math.sin(t*0.0004)*14, on=0, shimT=t*0.004;

    for(var i=0;i<pts.length;i++){
      var p=pts[i];
      var ddx=p.x-mouse.x, ddy=p.y-mouse.y, d2=ddx*ddx+ddy*ddy;
      var near = d2<RW2;
      var base;

      if(p.stem){
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
          if(d2<19600){ var dd=Math.sqrt(d2)||1,ff=(1-dd/140)*mouse.speed*2.4; p.vx+=ddx/dd*ff; p.vy+=ddy/dd*ff; }
          p.vx*=Math.pow(0.985,dtf); p.vy*=Math.pow(0.985,dtf);
          p.x+=p.vx*dtf; p.y+=p.vy*dtf;
          p.a-=0.003*dtf;
        } else { p.a-=0.05; }
        if(p.a<=0 || p.x<-40||p.x>W+40||p.y<-40){ p.state='gone'; p.regrow=t+2000+Math.random()*3500; p.a=0; }
        base=lerp(0.42,1.0,Math.min(1,p.rn))*p.a;
      }
      else {
        if(t>=p.regrow){ p.state='on'; p.ch=(p.rn>1?pick(PTIP):pick(CODE)); p.x=cx+(Math.random()-0.5)*12; p.y=cy+(Math.random()-0.5)*12; p.a=0; }
        continue;
      }

      churn(p,t,near);

      var vis=base;
      if(!reduce) vis += Math.sin(shimT+p.sway)*(near?0.28:0.12);
      bucket(p.x,p.y,p.ch,vis);
    }

    var cel=document.getElementById('count'); if(cel) cel.textContent=on;
  }

  var lastT=0;
  function frame(t){
    var dt=(t-lastT)||16; lastT=t; var dtf=Math.max(0.5,Math.min(2,dt/16.67));
    mouse.speed*=Math.pow(0.85,dtf);
    ctx.clearRect(0,0,W,H);
    for(var q=0;q<NB;q++){ BX[q].length=0; BY[q].length=0; BC[q].length=0; }

    if(introDone) liveFrame(t,dtf); else introFrame(t,dtf);

    ctx.font=FS+'px '+font();
    for(q=1;q<NB;q++){
      var xs=BX[q]; if(!xs.length) continue;
      ctx.fillStyle='rgba(255,255,255,'+(q/9).toFixed(3)+')';
      var ys=BY[q], cs=BC[q];
      for(var k=0;k<xs.length;k++) ctx.fillText(cs[k],xs[k],ys[k]);
    }
    requestAnimationFrame(frame);
  }

  var _f=null; function font(){ if(!_f)_f=getComputedStyle(document.body).fontFamily; return _f; }

  addEventListener('pointermove',function(e){
    var nx=e.clientX,ny=e.clientY;
    mouse.speed=Math.hypot(nx-(mouse.x<0?nx:mouse.x), ny-(mouse.y<0?ny:mouse.y));
    mouse.x=nx; mouse.y=ny;
  },{passive:true});
  addEventListener('pointerleave',function(){ mouse.x=-1e5; mouse.y=-1e5; mouse.speed=0; });
  addEventListener('pointerdown',function(e){ if(!introDone) return; mouse.x=e.clientX; mouse.y=e.clientY;
    var dx=e.clientX-cx, dy=e.clientY-cy; if(dx*dx+dy*dy < (headR*1.6)*(headR*1.6)) shockwave(40); });

  var wi=document.getElementById('wishInput'), wh=document.getElementById('wishHint');
  if(wi){ wi.addEventListener('keydown',function(e){
    if(e.key==='Enter' && wi.value.trim()){ shockwave(80); if(wh) wh.innerHTML='sent · <b>“'+wi.value.trim().replace(/[<>&]/g,'')+'”</b> — the flower will grow back.'; wi.value=''; }
  });}

  var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.style.opacity=1;e.target.style.transform='none';io.unobserve(e.target);}});},{threshold:.12});
  [].forEach.call(document.querySelectorAll('.reveal'),function(el){el.style.opacity=0;el.style.transform='translateY(20px)';el.style.transition='opacity .9s ease,transform .9s ease';io.observe(el);});

  addEventListener('resize',resize);
  resize(); requestAnimationFrame(frame);
})();
