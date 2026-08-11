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
  var fallCur=0, keeperN=0, keeperList=[];  // fallCur: smoothed shown progress; keeperList: bottom-strip glyphs
  var canvasOn=true;                        // #field intersects the viewport (IntersectionObserver)
  var mouse={x:-1e5,y:-1e5,speed:0};
  var CODE=['0','1','/','\\','<','>','{','}','(',')','=','+','-','*','#','$','%','&','|',';',':','.','x','?','!','^','~'];
  var PTIP=['*','^','/','\\','x','+','\''];
  var LEDGE=['^','v','/','\\','<','>','*','x'];
  function pick(a){ return a[(Math.random()*a.length)|0]; }
  function lerp(a,b,t){ return a+(b-a)*t; }
  function smooth(a,b,x){ if(x<=a)return 0; if(x>=b)return 1; x=(x-a)/(b-a); return x*x*(3-2*x); }

  // ---- intro state ----
  var introDone = reduce;            // reduced-motion → straight to the live flower
  var introStarted=false;            // set on the first build(); prevents restart on resize
  var IT_TEXT=1750, IT_SCAT=850, IT_FORM=1650;   // longer hold on "PORTFOLIO" before it scatters
  var INTRO_FAM="'Plus Jakarta Sans','Helvetica Neue',Arial,sans-serif";  // shape of the "PORTFOLIO" letters

  // ---- ABOUT→WORK decompose: head bursts UP, arcs over, rains into a bottom ASCII strip ----
  var DEBUG           = false; // overlay: target vs shown progress + keeper count
  var FALL_T_END      = 0.70;  // WorkTransition progress at which the decompose completes
  var FALL_LERP       = 0.15;  // smoothing — the SHOWN progress eases toward the scroll target (0.12–0.18)
  // delay windows (progress units) — widened so 1000+ glyphs spread across the whole decompose
  // instead of the head vanishing within a few px. Petals lead; the green parts start as the
  // petals finish (slight overlap) and trail to the end.
  var PETAL_DELAY     = 0.45;  // petals fall spread across this early window (was 0.24 → too abrupt)
  var GREEN_DELAY_ST  = 0.38;  // stem/leaves begin here (overlaps the petal tail)…
  var GREEN_DELAY_SP  = 0.45;  // …and trail over this much (stem → leaves → roots last)
  var GAMMA_MIN       = 0.85;  // per-glyph flight-progress curve: <1 rushes early, >1 lingers longer
  var GAMMA_VAR       = 1.05;  // fgamma ∈ [GAMMA_MIN, GAMMA_MIN+GAMMA_VAR] — varied yet all land at the end
  var RISE_PEAK       = 0.34;  // apex of the upward launch, as a fraction of viewport height
  var RISE_PEAK_VAR   = 0.26;  // per-glyph apex variation
  var FALL_DRIFT      = 120;   // px of horizontal sway mid-flight (fades to 0 on landing)
  var FALL_ROT        = 6.5;   // max tumble (radians) mid-flight (returns upright on landing)
  var FALL_BURST      = 240;   // px radial spread applied to the fading (non-landing) glyphs
  var LAND_GAP        = 1.10;  // strip slot spacing = (MEASURED glyph width) × this — desktop density
  var LAND_GAP_MOB    = 1.80;  // …× this on mobile (W≤640) so the row isn't overcrowded
  var LAND_MARGIN     = 1.8;   // strip baseline sits FS × this above the bottom edge
  var LAND_DARK       = 0.90;  // landed glyphs darken toward black by this much (dark on light blocks)
  var LAND_CHURN_MIN  = 60;    // bottom-strip character-swap period (ms) — fast flicker…
  var LAND_CHURN_MAX  = 260;   // …random up to here (the live flower stays at its calmer 200–1200ms)
  var LAND_SHIM_SPEED = 0.012; // bottom-strip alpha-shimmer speed (live flower uses 0.004)
  var LAND_SHIM_AMP   = 0.26;  // bottom-strip alpha-shimmer amplitude (was 0.14 when landed)
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
      // ---- decompose seeds (set ONCE per build → deterministic + reversible) ----
      // fall ORDER reversed vs. before: the flower HEAD (top) goes first, then the
      // stem, then leaves, roots last. Petals get an early window; the green parts a
      // later one, so the head visibly bursts before the stem/leaves collapse after it.
      if(p.petal){
        var hn=(p.fy-(cy-headR*1.5))/(headR*2.4); if(hn<0)hn=0; else if(hn>1)hn=1;
        p.fallDelay=hn*PETAL_DELAY;                                   // top petals lead
      } else {
        var gn=(p.fy-(cy-headR*0.4))/((baseY-(cy-headR*0.4))||1); if(gn<0)gn=0; else if(gn>1)gn=1;
        p.fallDelay=GREEN_DELAY_ST+gn*GREEN_DELAY_SP;                 // stem → leaves → roots
      }
      p.frot=(Math.random()*2-1);
      p.fdrift=Math.random()*6.2832;
      p.fgamma=GAMMA_MIN+Math.random()*GAMMA_VAR;   // flight-progress curve — varied speed, all land at end
      p.fpeak=(RISE_PEAK+Math.random()*RISE_PEAK_VAR)*(p.petal?1.15:0.8);  // petals launch higher
      p.fscale=0.40+Math.random()*0.30;         // mid-flight shrink (recede), restored on landing
      // radial direction from the flower centre → spread for the fading (non-landing) glyphs
      var rdx=p.fx-cx, rdy=p.fy-cy, rl=Math.sqrt(rdx*rdx+rdy*rdy)||1;
      p.bx=rdx/rl; p.by=rdy/rl;
      p.fburst=0.55+Math.random()*0.85;
      p.keeper=false; p.slotX=0; p.landY=0;     // set below for the bottom-strip glyphs
    }

    // ---- choose which glyphs LAND in the bottom ASCII strip (the rest fade away) ----
    // With 1000+ glyphs a full row would overlap into mush, so keep only as many as fit
    // at LAND_GAP spacing. Sort by x and sample evenly into slots → left origins map to
    // left slots (minimal crossing, no duplicates), fixed once per build (deterministic).
    // Measure the REAL glyph width (JetBrains Mono is narrower than FS) so the strip packs to
    // near-touching instead of looking gappy. Slot count is capped by N (never exceeds the
    // available glyphs / the 1000-ish total), and mobile uses a wider gap so it isn't overcrowded.
    ctx.font=FS+'px '+font();
    var charW=ctx.measureText('0').width||FS*0.6;
    var gap=charW*(W<=640?LAND_GAP_MOB:LAND_GAP);
    var slots=Math.max(6,Math.floor(W/gap)); if(slots>N)slots=N;
    keeperN=slots; keeperList=[];
    var order2=[]; for(i=0;i<N;i++) order2.push(i);
    order2.sort(function(a,b){ return (pts[a].fx-pts[b].fx)||(pts[a].fy-pts[b].fy); });
    var landY=H-FS*LAND_MARGIN, denom=(slots>1?slots-1:1);
    for(var s2=0;s2<slots;s2++){
      var kp=pts[order2[Math.round(s2*(N-1)/denom)]];
      kp.keeper=true; kp.slotX=(s2+0.5)*(W/slots); kp.landY=landY;
      keeperList.push(kp);                    // lightweight strip pass iterates only these
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
  function churn(p,t,near,fast){
    if(!reduce && p.set && t>=p.swapAt){
      p.ch=pick(p.set);
      var per = fast ? (LAND_CHURN_MIN+Math.random()*(LAND_CHURN_MAX-LAND_CHURN_MIN))   // bottom strip: quick flicker
                     : (p.stab?(1500+Math.random()*2500):(200+Math.random()*1000));      // live flower: calmer
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

  // Every position/colour below is a PURE function of lp (= f(fallP, per-glyph seeds)), so the
  // exact same progress yields the exact same frame whichever way you scrolled → fully reversible.
  // Two fates: KEEPERS launch up, arc over and settle into the bottom strip (then blink); the
  // rest launch up, arc over and fade out mid-fall (and fade back in when you scroll up).
  function fallFrame(t, fallP){
    ctx.font=FS+'px '+font();
    for(var i=0;i<pts.length;i++){ var p=pts[i];
      var lp=(fallP-p.fallDelay)/(1-p.fallDelay); if(lp<0)lp=0; else if(lp>1)lp=1;
      lp=Math.pow(lp,p.fgamma);                          // per-glyph speed curve (all still reach 1)
      var flowerBase=p.petal?lerp(0.42,1,Math.min(1,p.rn)):(p.al||0.6);
      var ez=lp*lp;                                       // gravity-accelerated descent baseline
      var arc=p.fpeak*H*Math.sin(Math.PI*lp);             // upward launch → apex → back down

      if(p.keeper){
        var land=smooth(0.72,1,lp);                       // 0 mid-flight → 1 fully settled
        var y=p.fy+(p.landY-p.fy)*ez-arc;                 // parabola onto the slot baseline
        var exz=1-Math.pow(1-lp,3);                       // ease toward the slot x, then settle
        var x=p.fx+(p.slotX-p.fx)*exz+Math.sin(p.fdrift+fallP*4)*FALL_DRIFT*(1-lp);
        var colorT=land*LAND_DARK;                        // white in flight → dark once landed
        var v=(255*(1-colorT))|0;
        var vis=lerp(flowerBase,0.94,land); if(!reduce) vis+=Math.sin(t*LAND_SHIM_SPEED+p.sway)*LAND_SHIM_AMP*land;
        if(vis<=0.03) continue; if(vis>1)vis=1;
        var ang=p.frot*FALL_ROT*lp*(1-land);              // tumble in flight, upright on landing
        var sc=1-p.fscale*Math.sin(Math.PI*lp)*(1-land);  // recede mid-flight, full size settled
        if(!reduce && land>0.5) churn(p,t,false,true);    // fast flicker on the landed strip (per-glyph phase)
        ctx.globalAlpha=vis; ctx.fillStyle='rgb('+v+','+v+','+v+')';
        ctx.save(); ctx.translate(x,y); if(ang)ctx.rotate(ang); if(sc!==1)ctx.scale(sc,sc); ctx.fillText(p.ch,0,0); ctx.restore();
      } else {
        var fade=smooth(0.06,0.62,lp);                    // fades out over the first ~⅔ of its fall
        var vis2=flowerBase*(1-fade); if(vis2<=0.03) continue; if(vis2>1)vis2=1;
        var be=1-Math.pow(1-Math.min(1,lp/0.4),3);        // radial spread eases in early
        var y2=p.fy+(H+FS*8-p.fy)*ez-arc;
        var x2=p.fx+p.bx*FALL_BURST*p.fburst*be+Math.sin(p.fdrift+fallP*4)*FALL_DRIFT*lp;
        var colorT2=Math.min(1,lp*1.1)*0.82, v2=(255*(1-colorT2))|0;
        var ang2=p.frot*FALL_ROT*lp, sc2=1-p.fscale*lp;
        ctx.globalAlpha=vis2; ctx.fillStyle='rgb('+v2+','+v2+','+v2+')';
        ctx.save(); ctx.translate(x2,y2); if(ang2)ctx.rotate(ang2); if(sc2!==1)ctx.scale(sc2,sc2); ctx.fillText(p.ch,0,0); ctx.restore();
      }
    }
    ctx.globalAlpha=1; ctx.fillStyle='#fff';
  }

  var lastT=0, rafId=0, falling=false;
  function flush(){
    ctx.font=FS+'px '+font();
    for(var q=1;q<NB;q++){
      var xs=BX[q]; if(!xs.length) continue;
      ctx.fillStyle='rgba(255,255,255,'+(q/9).toFixed(3)+')';
      var ys=BY[q], cs=BC[q];
      for(var k=0;k<xs.length;k++) ctx.fillText(cs[k],xs[k],ys[k]);
    }
  }
  // whether the loop should keep spinning: the page is visible and #field is on screen.
  // (The strip lives on a position:fixed canvas, so once decomposed there is ALWAYS something
  //  blinking on screen — the loop must not stop just because ABOUT scrolled away.)
  function alive(){ return canvasOn && document.visibilityState==='visible'; }
  // Loop resumed after a pause (tab return, etc.): if a long gap elapsed, scatter every glyph's
  // churn deadline so they don't all swap on the same frame (avoids one synchronized flicker burst).
  function reseedChurn(t){ for(var i=0;i<pts.length;i++) pts[i].swapAt = t + Math.random()*600; }

  function frame(t){
    rafId=0;                                   // this frame is now running → slot is free
    var dt=(t-lastT)||16; lastT=t;
    if(dt>500) reseedChurn(t);                 // paused & resumed → desync the swap phases
    var dtf=Math.max(0.5,Math.min(2,dt/16.67));
    mouse.speed*=Math.pow(0.85,dtf);
    ctx.clearRect(0,0,W,H);
    for(var q=0;q<NB;q++){ BX[q].length=0; BY[q].length=0; BC[q].length=0; }

    if(!introDone){ introFrame(t,dtf); flush(); kick(); return; }

    // SMOOTHING: the trajectory is a pure function of the SHOWN progress (fallCur), but fallCur
    // only eases toward the scroll target — so a jumpy wheel/trackpad glides instead of snapping,
    // while "same progress = same frame" still holds once it settles (like about-lines.js LERP).
    var target=fallProgress();
    if(reduce) fallCur=target;
    else { fallCur+=(target-fallCur)*FALL_LERP; if(Math.abs(target-fallCur)<0.0008) fallCur=target; }
    if(DEBUG) updateDbg(target);

    if(fallCur>0.0001){
      if(!falling){ falling=true; resetToRest(); }
      if(fallCur>=0.9999) stripFrame(t);       // fully decomposed → draw ONLY the landed strip (cheap)
      else fallFrame(t,fallCur);               // mid-flight → full pass (arc + fade + landing)
      if(alive()) kick();                      // strip is always on the fixed canvas → keep blinking
      return;
    }
    if(falling){ falling=false; resetToRest(); } // scrolled back up → resume the living flower
    liveFrame(t,dtf); flush();
    if(alive()) kick();
  }

  // Lightweight bottom-strip pass: at full decompose every keeper is landed (upright, full size,
  // dark) so we skip the flight math and the 1000-glyph sweep — iterate keepers only and blink.
  function stripFrame(t){
    ctx.font=FS+'px '+font();
    var v=(255*(1-LAND_DARK))|0;
    ctx.fillStyle='rgb('+v+','+v+','+v+')';    // constant across keepers → set once, not per glyph
    for(var i=0;i<keeperList.length;i++){ var p=keeperList[i];
      var vis=0.94; if(!reduce) vis+=Math.sin(t*LAND_SHIM_SPEED+p.sway)*LAND_SHIM_AMP;
      if(vis<=0.03) continue; if(vis>1)vis=1;
      if(!reduce) churn(p,t,false,true);
      ctx.globalAlpha=vis;
      ctx.fillText(p.ch, p.slotX, p.landY);
    }
    ctx.globalAlpha=1; ctx.fillStyle='#fff';
  }
  var _dbg=null;
  function updateDbg(target){
    if(!_dbg){ _dbg=document.createElement('div');
      _dbg.style.cssText='position:fixed;left:8px;top:8px;z-index:99999;font:11px/1.5 ui-monospace,monospace;color:#7fd;background:rgba(0,0,0,.72);padding:6px 9px;white-space:pre;pointer-events:none;border:1px solid #275';
      document.body.appendChild(_dbg); }
    _dbg.textContent='fallP target '+target.toFixed(3)+'\n      shown  '+fallCur.toFixed(3)+'\nkeepers '+keeperN+'   N '+N;
  }
  // Single-token scheduler: rafId is the SOLE source of truth for "a frame is queued".
  // scroll/resize can re-arm the loop freely without ever double-scheduling or leaving it
  // wedged (a boolean flag could desync from the real rAF state during rapid ABOUT↔WORK
  // oscillation and strand the flower). The loop idles only once the smoothing has SETTLED
  // AND ABOUT is fully off-screen (so it always finishes easing to the target, and the bottom
  // strip keeps blinking while ABOUT is on screen); any scroll back re-kicks it.
  function kick(){ if(rafId===0){ rafId=requestAnimationFrame(frame); } }
  if(DEBUG) window.__fdbg=function(){ return {target:fallProgress(),cur:fallCur,keepers:keeperN}; };  // test/inspection hook

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

  // Resume paths — the loop stops only when the tab is hidden or #field leaves the viewport, so
  // it must be re-armed on any of these. kick() de-dupes, so extra calls are harmless.
  function resume(){ if(introDone && alive()) kick(); }
  addEventListener('resize',function(){ resize(); resume(); });
  addEventListener('scroll',resume,{passive:true});
  document.addEventListener('visibilitychange',resume);   // tab back → restart the blink
  // stop when #field scrolls out of view (it's position:fixed full-viewport, so effectively never,
  // but this is the safety valve the stop condition relies on); restart when it returns.
  try{ new IntersectionObserver(function(es){ canvasOn=es[es.length-1].isIntersecting; if(canvasOn) resume(); }).observe(cv); }
  catch(e){ canvasOn=true; }
  // Wait (briefly) for Montserrat so the offscreen "PORTFOLIO" is shaped in it,
  // then start — never block first paint for more than half a second.
  var started=false;
  function start(){ if(started) return; started=true; resize(); kick(); }
  if(!introDone && document.fonts && document.fonts.load){
    document.fonts.load("700 200px 'Plus Jakarta Sans'").then(start,start);
    setTimeout(start,500);
  } else { start(); }
})();
