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
  var IT_TEXT=1750, IT_SCAT=850, IT_FORM=1650;   // longer hold on "PORTFOLIO" before it scatters
  var INTRO_FAM="'Plus Jakarta Sans','Helvetica Neue',Arial,sans-serif";  // shape of the "PORTFOLIO" letters

  // ---- ABOUT→WORK decompose (scroll-linked downward fall) ----
  var FALL_T_END   = 0.70;   // WorkTransition progress at which the flower is fully gone
  var FALL_DIST    = 1.15;   // × viewport height each glyph ultimately drops
  var FALL_DRIFT   = 90;     // px of horizontal sway while falling
  var FALL_ROT     = 3.4;    // max tumble (radians)
  var FALL_MAXDELAY= 0.45;   // topmost glyphs start falling this much later than the lowest
  var introT0=0, scatterInit=false, formInit=false;
  var quoteShown=false;
  // fire once when the intro finishes forming the flower (unlocks the scroll lock)
  var introDoneFired=false;
  function fireIntroDone(){ if(introDoneFired) return; introDoneFired=true;
    try{ window.dispatchEvent(new CustomEvent('dandelion:introdone')); }catch(e){} }
  // the hero tagline appears only once the flower has finished forming
  function showQuote(){ if(quoteShown) return; quoteShown=true;
    [].forEach.call(document.querySelectorAll('.hero__quote, .hero__intro'),function(q){ q.style.opacity='1'; q.style.transform='none'; }); }

  function resize(){
    DPR=Math.min(2,window.devicePixelRatio||1);
    W=innerWidth; H=innerHeight;
    cv.style.width=W+'px'; cv.style.height=H+'px';
    cv.width=Math.round(W*DPR); cv.height=Math.round(H*DPR); ctx.setTransform(DPR,0,0,DPR,0,0);
    FS=Math.max(6,Math.min(9,W/170));                 // smaller glyphs -> tighter grid
    ctx.textAlign='center'; ctx.textBaseline='middle';
    var mob=W<=640;                                    // lift the flower on mobile so text isn't covered
    cx=W*0.5; cy=H*(mob?0.48:0.56); headR=Math.min(W,H)*0.135; baseX=W*0.5; baseY=H*(mob?0.84:0.92);
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
      // fall seeds: lower glyphs (yNorm→1) drop first; each tumbles/drifts differently
      var yNorm=(p.fy-(cy-headR))/((baseY-(cy-headR))||1); if(yNorm<0)yNorm=0; else if(yNorm>1)yNorm=1;
      p.fallDelay=(1-yNorm)*FALL_MAXDELAY;
      p.frot=(Math.random()*2-1);
      p.fdrift=Math.random()*6.2832;
      p.fspd=0.85+Math.random()*0.5;
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
      if(introStarted && !introDone){ introDone=true; fireIntroDone(); }
      for(i=0;i<N;i++){ p=pts[i]; p.x=p.fx; p.y=p.fy; if(p.petal) p.a=1; }
    }

    if(window.console) console.log('[dandelion] glyphs:', N, '('+(big?'desktop':'mobile')+', headR='+headR.toFixed(0)+', FS='+FS.toFixed(1)+')');
  }

  // ---- extract "PORTFOLIO" pixel coordinates from an offscreen canvas (once) ----
  function extractText(str){
    var off=document.createElement('canvas'), o=off.getContext('2d');
    var fam=INTRO_FAM;                              // Montserrat Bold letterforms
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
      if(k<M){ var idx=(M>=N)? Math.floor(k*M/N) : k; p.tx=tc[idx].x; p.ty=tc[idx].y; p.extra=false;
        // start slightly off the letter so "PORTFOLIO" gently coalesces instead of popping in
        var aa=Math.random()*6.28318, sp=24+Math.random()*44;
        p.ax=p.tx+Math.cos(aa)*sp; p.ay=p.ty+Math.sin(aa)*sp;
        p.x=p.ax; p.y=p.ay; p.a=0.001; }
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
  function easeInOutCubic(x){ return x<0.5 ? 4*x*x*x : 1-Math.pow(-2*x+2,3)/2; }
  function introFrame(t,dtf){
    if(introT0===0){ introT0=t; }
    var e=t-introT0, shimT=t*0.004;
    var T1=IT_TEXT, T2=IT_TEXT+IT_SCAT, T3=IT_TEXT+IT_SCAT+IT_FORM;
    var phase = e<T1?'text' : e<T2?'scatter' : e<T3?'form' : 'end';

    if(phase==='end'){ introDone=true; fireIntroDone(); showQuote(); liveFrame(t,dtf); return; }   // flower formed → reveal tagline, hand off

    if(phase==='scatter' && !scatterInit){
      scatterInit=true;
      for(var i=0;i<N;i++){ var p=pts[i]; if(p.extra) continue;
        // blow outward from the word's centre, softly and with varied speed
        var a=Math.atan2(p.y-cy, p.x-cx)+(Math.random()-0.5)*1.0, sp=3+Math.random()*6;
        p.vx=Math.cos(a)*sp; p.vy=Math.sin(a)*sp-1.6; }
    }
    if(phase==='form' && !formInit){
      formInit=true;
      for(var i2=0;i2<N;i2++){ var p2=pts[i2]; p2.sx0=p2.x; p2.sy0=p2.y;
        p2.curl=(Math.random()<0.5?-1:1)*(10+Math.random()*30); }   // arc amount for a swirling reform
    }

    var fe = e-T2;   // elapsed inside form
    for(var k=0;k<N;k++){ var p=pts[k];
      churn(p,t,false);
      var vis;
      if(phase==='text'){
        if(p.extra){ continue; }
        // assemble: slide in from the jittered start + fade up, then hold the word
        var ae=easeOutCubic(Math.min(1, e/700));   // assemble in ~700ms, then hold the word
        p.x=p.ax+(p.tx-p.ax)*ae; p.y=p.ay+(p.ty-p.ay)*ae; p.a=ae;
        vis=p.introBase*ae;
      } else if(phase==='scatter'){
        if(p.extra){ continue; }
        var se=(e-T1)/IT_SCAT;
        p.vx+=Math.sin(p.y*0.01+t*0.001)*2.4*dtf; p.vy+=Math.cos(p.x*0.01+t*0.001)*2.4*dtf;
        p.vx*=Math.pow(0.95,dtf); p.vy*=Math.pow(0.95,dtf);
        p.x+=p.vx*dtf; p.y+=p.vy*dtf;
        var m=38;                                        // keep them on-screen (soft walls)
        if(p.x<m){p.x=m;p.vx*=-0.4;} else if(p.x>W-m){p.x=W-m;p.vx*=-0.4;}
        if(p.y<m){p.y=m;p.vy*=-0.4;} else if(p.y>H-m){p.y=H-m;p.vy*=-0.4;}
        vis=p.introBase*lerp(1,0.5,Math.min(1,se));       // dim as the word dissolves to dust
      } else { // form
        var pr=(fe-p.fdelay)/(IT_FORM-p.fdelay); if(pr<0)pr=0; else if(pr>1)pr=1;
        var ee=easeInOutCubic(pr);
        if(p.extra){ p.x=p.fx; p.y=p.fy; p.a=ee; vis=p.introBase*ee; }
        else {
          var dx=p.fx-p.sx0, dy=p.fy-p.sy0, dl=Math.sqrt(dx*dx+dy*dy)||1, mid=Math.sin(ee*Math.PI);
          p.x=p.sx0+dx*ee + (-dy/dl)*p.curl*mid;          // arc in along a perpendicular bow
          p.y=p.sy0+dy*ee + ( dx/dl)*p.curl*mid;
          p.a=1; vis=p.introBase*lerp(0.5,1,ee);          // brighten back up as it settles
        }
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

  // ---- scroll-linked downward decompose (ABOUT→WORK) ----
  function fallProgress(){
    if(!introDone) return 0;
    var WT=window.WorkTransition; if(!WT) return 0;
    var T=WT.progress();
    if(reduce) return T>=0.5?1:0;             // reduced motion → instant switch, no fall animation
    var fp=T/FALL_T_END;
    return fp<0?0:fp>1?1:fp;
  }
  function resetToRest(){                       // snap the flower back to its formed shape
    for(var i=0;i<pts.length;i++){ var p=pts[i];
      p.x=p.fx; p.y=p.fy; p.a=1; if(p.petal) p.state='on';
      p.vx=0; p.vy=0;
    }
  }
  function fallFrame(fallP){                    // glyphs drop, drift and tumble — reversible with scroll
    ctx.font=FS+'px '+font(); ctx.fillStyle='#fff';
    for(var i=0;i<pts.length;i++){ var p=pts[i];
      var lp=(fallP-p.fallDelay)/(1-p.fallDelay); if(lp<0)lp=0; else if(lp>1)lp=1;
      lp*=p.fspd; if(lp>1)lp=1;
      var e=lp*lp;                              // gravity — accelerate downward
      var y=p.fy + e*H*FALL_DIST;
      if(y>H+FS) continue;                      // off the bottom → skip (cost drops as it falls)
      var x=p.fx + Math.sin(p.fdrift+fallP*3)*FALL_DRIFT*lp;
      var base=p.petal?lerp(0.42,1,Math.min(1,p.rn)):(p.al||0.6);
      var vis=base*(1-0.30*lp); if(vis<=0.03) continue; if(vis>1)vis=1;
      var ang=p.frot*lp*FALL_ROT;
      ctx.globalAlpha=vis;
      if(ang){ ctx.save(); ctx.translate(x,y); ctx.rotate(ang); ctx.fillText(p.ch,0,0); ctx.restore(); }
      else ctx.fillText(p.ch,x,y);
    }
    ctx.globalAlpha=1;
  }

  var lastT=0, running=false, falling=false;
  function flush(){
    ctx.font=FS+'px '+font();
    for(var q=1;q<NB;q++){
      var xs=BX[q]; if(!xs.length) continue;
      ctx.fillStyle='rgba(255,255,255,'+(q/9).toFixed(3)+')';
      var ys=BY[q], cs=BC[q];
      for(var k=0;k<xs.length;k++) ctx.fillText(cs[k],xs[k],ys[k]);
    }
  }
  function frame(t){
    var dt=(t-lastT)||16; lastT=t; var dtf=Math.max(0.5,Math.min(2,dt/16.67));
    mouse.speed*=Math.pow(0.85,dtf);
    ctx.clearRect(0,0,W,H);
    for(var q=0;q<NB;q++){ BX[q].length=0; BY[q].length=0; BC[q].length=0; }

    if(!introDone){ introFrame(t,dtf); flush(); requestAnimationFrame(frame); return; }

    var fallP=fallProgress();
    if(fallP>0.0001){
      if(!falling){ falling=true; resetToRest(); }
      if(fallP<1){ fallFrame(fallP); requestAnimationFrame(frame); }
      else { running=false; }                  // fully gone → canvas cleared, stop the loop
      return;
    }
    if(falling){ falling=false; resetToRest(); } // scrolled back up → resume the living flower
    liveFrame(t,dtf); flush(); requestAnimationFrame(frame);
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

  // hide the tagline until the intro finishes forming the flower — set instantly
  // (transition off) so it doesn't flash-then-fade at load. reduced-motion skips
  // the intro so it stays visible; JS-off keeps the CSS default = visible.
  (function(){ if(introDone) return;
    [].forEach.call(document.querySelectorAll('.hero__quote, .hero__intro'),function(q){
      q.style.transition='none'; q.style.opacity='0'; q.style.transform='translateY(14px)';
      void q.offsetWidth;                                 // commit before re-enabling transition
      q.style.transition='opacity .9s ease, transform .9s ease';
    });
  })();

  addEventListener('resize',resize);
  // resume the loop when scrolling back up re-forms the flower (loop self-stops once fallen)
  addEventListener('scroll',function(){ if(!running && introDone && fallProgress()<1){ running=true; requestAnimationFrame(frame); } },{passive:true});
  // Wait (briefly) for Montserrat so the offscreen "PORTFOLIO" is shaped in it,
  // then start — never block first paint for more than half a second.
  var started=false;
  function start(){ if(started) return; started=true; running=true; resize(); requestAnimationFrame(frame); }
  if(!introDone && document.fonts && document.fonts.load){
    document.fonts.load("700 200px 'Plus Jakarta Sans'").then(start,start);
    setTimeout(start,500);
  } else { start(); }
})();
