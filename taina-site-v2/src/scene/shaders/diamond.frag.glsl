uniform float uTime;
uniform float uI;
uniform float uHT;
uniform float uHB;
varying vec3 vN;
varying vec3 vP;
varying vec3 vL;

void main(){
  vec3 n=normalize(vN);if(!gl_FrontFacing)n=-n;vec3 v=normalize(-vP);
  float ndv=abs(dot(n,v));
  vec3 kd=normalize(vec3(-.45,.65,.62));float k=dot(n,kd)*.5+.5;
  vec3 black=vec3(.018,.001,.003);vec3 deep=vec3(.1,.005,.012);vec3 mid=vec3(.4,.018,.028);vec3 rich=vec3(.7,.08,.055);
  vec3 col=mix(black,deep,smoothstep(.05,.35,k));col=mix(col,mid,smoothstep(.3,.6,k));col=mix(col,rich,smoothstep(.6,.86,k));
  vec3 hot=vec3(.97,.74,.5);
  float hz=exp(-vL.x*vL.x*95.)*smoothstep(.4,.72,k);
  col=mix(col,hot,clamp(hz,0.,1.)*.5);
  float fr=pow(1.-ndv,2.6);col+=vec3(.6,.05,.04)*fr*.3;
  col*=uI*(.97+.03*sin(uTime*3.1));
  gl_FragColor=vec4(col,1.);
}
