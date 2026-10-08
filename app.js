'use strict';
// No JavaScript packages required. A self-contained WebXR immersive-ar + WebGL app.
// Local coordinates are METERS. The bounding rectangle is 0.08m x 0.05m.
(() => {
  const enter = document.querySelector('#enter');
  const status = document.querySelector('#status');
  const hud = document.querySelector('#hud');
  const hudStatus = document.querySelector('#hudStatus');
  const heightInput = document.querySelector('#height');
  const heightLabel = document.querySelector('#heightLabel');
  const sideInput = document.querySelector('#side');
  const colorInput = document.querySelector('#color');
  const exit = document.querySelector('#exit');
  let session = null, gl, program, buffer, refSpace, hit, hitSource;
  let shapeCount = 0, reticleCount = 0;
  let tableHeight = 0.73;
  let yaw = 0;
  let placed = false;
  let point = [0, tableHeight, -0.5];
  let flip = false;
  let lastTime = null;
  let lastSecondButtons = new WeakMap();
  let reticle = null;
  let controllerHint = '';
  const pal = {mint:[.27,1,.72],yellow:[1,.88,.13],magenta:[1,.32,.89]};
  const color = () => pal[colorInput.value] || pal.mint;
  const $ = x => document.querySelector(x);
  const updateHeight = () => { tableHeight = Number(heightInput.value)/100; heightLabel.textContent = heightInput.value+' cm'; point[1]=tableHeight; };
  heightInput.addEventListener('input', updateHeight);
  sideInput.addEventListener('change', () => {flip=sideInput.value==='right'; if(gl) buildBuffers();});
  colorInput.addEventListener('change', () => {if(gl) buildBuffers();});
  updateHeight();
  function inform(msg) {status.textContent=msg; hudStatus.textContent=msg;}
  async function check() {
    if (!navigator.xr) {enter.textContent='WebXR not available';inform('Open this page with the Meta Quest Browser over HTTPS.');return;}
    try {
      const supported = await navigator.xr.isSessionSupported('immersive-ar');
      enter.disabled=!supported;
      enter.textContent=supported ? 'Enter passthrough AR' : 'Immersive AR unsupported here';
      inform(supported ? 'Ready. Put a flat piece of cardboard on a well-lit table.' : 'This browser does not support immersive-ar. Try the Quest Browser.');
    } catch(e) {enter.textContent='AR support check failed';inform(String(e.message||e));}
  }
  const vs = `attribute vec2 a_pos; attribute vec4 a_color;
    uniform mat4 u_vp; uniform vec3 u_position; uniform float u_yaw;
    varying vec4 v_color;
    void main(){
      float cs=cos(u_yaw),sn=sin(u_yaw);
      vec3 wp = u_position + vec3(cs*a_pos.x-sn*a_pos.y,0.002,sn*a_pos.x+cs*a_pos.y);
      gl_Position=u_vp*vec4(wp,1.0);v_color=a_color;
    }`;
  const fs = `precision mediump float; varying vec4 v_color;
    void main(){gl_FragColor=v_color;}`;
  function shader(type,source) {const sh=gl.createShader(type);gl.shaderSource(sh,source);gl.compileShader(sh);
    if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(sh));return sh;}
  function initGL() {
    const canvas=document.createElement('canvas');canvas.style.display='none';document.body.appendChild(canvas);
    gl=canvas.getContext('webgl',{alpha:true,antialias:true,depth:true,premultipliedAlpha:false,xrCompatible:true});
    if(!gl)throw Error('WebGL unavailable');
    program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,vs));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,fs));gl.linkProgram(program);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
    buffer=gl.createBuffer();
    gl.useProgram(program);
    gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
    gl.disable(gl.CULL_FACE);gl.disable(gl.DEPTH_TEST);
    buildBuffers();
  }
  function verticesBuilder(){
    const result=[];
    function v(x,z,rgba) { result.push(x,z,...rgba); }
    function tri(a,b,c,rgba) {v(...a,rgba);v(...b,rgba);v(...c,rgba);}
    function line(a,b,w,rgba) {
      const dx=b[0]-a[0],dz=b[1]-a[1],d=Math.hypot(dx,dz);
      if(d<1e-8)return;
      const nx=-dz*w/2/d,nz=dx*w/2/d;
      const p=[a[0]+nx,a[1]+nz],q=[a[0]-nx,a[1]-nz],r=[b[0]-nx,b[1]-nz],s=[b[0]+nx,b[1]+nz];
      tri(p,q,r,rgba);tri(p,r,s,rgba);
    }
    // A symmetric-free scoop/fin profile modeled on the drawn cardboard outline.
    const raw=[[0,0],[.062,0],[.067,.001],[.071,.006],[.074,.014],[.077,.025],[.079,.036],[.080,.045],[.079,.050],[.076,.049],[.072,.043],[.066,.034],[.059,.026],[.051,.019],[.043,.015],[.035,.013],[.025,.012],[.012,.010],[0,.010]];
    const toLocal = p => [((flip ? .08-p[0] : p[0])-.04),p[1]-.025];
    const poly=raw.map(toLocal), c=color();
    // Almost transparent infill + bright, thick 1.8 mm cutting contour.
    for(let i=1;i<poly.length-1;i++)tri(poly[0],poly[i],poly[i+1],[...c,.12]);
    for(let i=0;i<poly.length;i++)line(poly[i],poly[(i+1)%poly.length],.0018,[...c,.96]);
    // Dashed 1 cm tab fold line.
    for(let z=.001;z<.009;z+=.004)line(toLocal([.01,z]),toLocal([.01,Math.min(z+.002,.009)]),.0011,[1,1,1,.75]);
    // 20 mm scale bar next to profile. This is for sanity-checking real-world scale.
    line(toLocal([.012,-.007]),toLocal([.032,-.007]),.0011,[1,1,1,.95]);
    line(toLocal([.012,-.004]),toLocal([.012,-.010]),.0011,[1,1,1,.95]);
    line(toLocal([.032,-.004]),toLocal([.032,-.010]),.0011,[1,1,1,.95]);
    shapeCount=result.length/6;
    // Reticle is separate in vertex array; placed under pointed-at tabletop.
    line([-.009,0],[.009,0],.0013,[1,1,1,.9]);line([0,-.009],[0,.009],.0013,[1,1,1,.9]);
    reticleCount=result.length/6-shapeCount;
    return new Float32Array(result);
  }
  function buildBuffers(){
    const vertices=verticesBuilder();
    if(gl){gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,vertices,gl.STATIC_DRAW);}
  }
  function mult(a,b){const out=new Float32Array(16);
    for(let col=0;col<4;col++)for(let row=0;row<4;row++)for(let k=0;k<4;k++)out[col*4+row]+=a[k*4+row]*b[col*4+k];
    return out;
  }
  function direction(q){ // Quaternion rotates (0,0,-1)
    const x=q.x,y=q.y,z=q.z,w=q.w;
    return [-(2*(x*z+w*y)), -(2*(y*z-w*x)), -(1-2*(x*x+y*y))];
  }
  function rayOnTable(pose){
    const p=pose.transform.position,dir=direction(pose.transform.orientation);
    if(Math.abs(dir[1])<.045)return null;
    const t=(tableHeight-p.y)/dir[1];
    if(t<.06||t>4)return null;
    return [p.x+t*dir[0],tableHeight,p.z+t*dir[2]];
  }
  function poseHit(frame,source){
    if(!source||!source.targetRaySpace)return null;
    const pose=frame.getPose(source.targetRaySpace,refSpace);
    return pose ? rayOnTable(pose) : null;
  }
  function place(event) {
    const p=poseHit(event.frame,event.inputSource)||reticle;
    if(!p){inform('Point a controller downward at the table, then press trigger.');return;}
    point=[...p];placed=true;inform('Placed! Trace with a blunt marker. Remove headset before cutting.');
  }
  function squeeze(event) {
    const pose=event.inputSource.gripSpace && event.frame.getPose(event.inputSource.gripSpace,refSpace);
    if(!pose) {inform('Controller grip tracking unavailable. Use thumbstick up/down to set height.');return;}
    tableHeight=Math.min(1.4,Math.max(.3,pose.transform.position.y));
    heightInput.value=String(Math.round(tableHeight*100));heightLabel.textContent=heightInput.value+' cm';
    point[1]=tableHeight;
    inform('Table height sampled: '+Math.round(tableHeight*100)+' cm. Point trigger to place.');
  }
  function updateControls(frame,dt){
    let near=null;
    for(const source of session.inputSources) {
      let h=poseHit(frame,source);
      if(h && !near)near=h;
      if(!source.gamepad)continue;
      const gp=source.gamepad,axes=gp.axes;
      const stickX=axes.length>2?axes[2]:0,stickY=axes.length>3?axes[3]:0;
      if(Math.abs(stickX)>.22)yaw+=stickX*dt*.78;
      if(Math.abs(stickY)>.5) {
        // Controlled continuous nudge, up to 3 centimeters/sec.
        tableHeight=Math.max(.3,Math.min(1.4,tableHeight-stickY*dt*.03));
        point[1]=tableHeight;
        heightInput.value=String(Math.round(tableHeight*100));heightLabel.textContent=heightInput.value+' cm';
      }
      const prev=lastSecondButtons.get(source)||false;
      const flipPressed=!!gp.buttons[4]?.pressed;
      if(flipPressed&&!prev){flip=!flip;sideInput.value=flip?'right':'left';buildBuffers();inform('Flipped template.');}
      lastSecondButtons.set(source,flipPressed);
    }
    reticle=near;
    if(!near&&!placed) {
      const viewer=frame.getViewerPose(refSpace);
      if(viewer)reticle=rayOnTable(viewer);
    }
  }
  function draw(frame,time) {
    if(!session)return;
    session.requestAnimationFrame(draw);
    const dt=lastTime==null?0:Math.min(.05,(time-lastTime)/1000);lastTime=time;
    const viewer=frame.getViewerPose(refSpace);if(!viewer)return;
    updateControls(frame,dt);
    gl.bindFramebuffer(gl.FRAMEBUFFER,session.renderState.baseLayer.framebuffer);
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    const ap=gl.getAttribLocation(program,'a_pos'),ac=gl.getAttribLocation(program,'a_color');
    gl.enableVertexAttribArray(ap);gl.enableVertexAttribArray(ac);
    gl.vertexAttribPointer(ap,2,gl.FLOAT,false,24,0);
    gl.vertexAttribPointer(ac,4,gl.FLOAT,false,24,8);
    const vpUniform=gl.getUniformLocation(program,'u_vp'),posUniform=gl.getUniformLocation(program,'u_position'),yawUniform=gl.getUniformLocation(program,'u_yaw');
    for(const view of viewer.views){
      const viewport=session.renderState.baseLayer.getViewport(view);
      gl.viewport(viewport.x,viewport.y,viewport.width,viewport.height);
      gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
      gl.uniformMatrix4fv(vpUniform,false,mult(view.projectionMatrix,view.transform.inverse.matrix));
      if(placed){gl.uniform3fv(posUniform,point);gl.uniform1f(yawUniform,yaw);gl.drawArrays(gl.TRIANGLES,0,shapeCount);}
      // Preview moves with the controller ray until user places it.
      else if(reticle){gl.uniform3fv(posUniform,reticle);gl.uniform1f(yawUniform,yaw);gl.drawArrays(gl.TRIANGLES,0,shapeCount);}
      if(reticle){gl.uniform3fv(posUniform,reticle);gl.uniform1f(yawUniform,0);gl.drawArrays(gl.TRIANGLES,shapeCount,reticleCount);}
    }
  }
  async function start(){
    enter.disabled=true;
    try{
      if(!gl)initGL();
      // Ask for the XR session immediately inside the button click's user gesture.
      // A prior `await makeXRCompatible()` may otherwise lose transient activation.
      const sessionRequest = navigator.xr.requestSession('immersive-ar',{
        requiredFeatures:['local-floor'], optionalFeatures:['dom-overlay'], domOverlay:{root:hud}
      });
      session=await sessionRequest;
      await gl.makeXRCompatible();
      session.updateRenderState({baseLayer:new XRWebGLLayer(session,gl,{alpha:true,depth:true,antialias:true})});
      refSpace=await session.requestReferenceSpace('local-floor');
      session.addEventListener('select',place);session.addEventListener('squeeze',squeeze);
      session.addEventListener('end',()=>{session=null;hud.style.display='none';lastTime=null;lastSecondButtons=new WeakMap();enter.disabled=false;enter.textContent='Enter passthrough AR';inform('AR session ended.');});
      hud.style.display=session.domOverlayState?.type==='screen'?'flex':'none';
      placed=false;lastTime=null;reticle=null;
      inform('Point at tabletop and press trigger/pinch to place outline.');
      session.requestAnimationFrame(draw);
    }catch(e){
      if(session){await session.end().catch(()=>{});session=null;}
      inform('Could not start AR: '+(e.message||e));enter.disabled=false;
    }
  }
  enter.addEventListener('click',start);
  exit.addEventListener('click',()=>session?.end());
  check();
})();
