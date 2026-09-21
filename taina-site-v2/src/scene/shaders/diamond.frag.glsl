uniform float uTime;
uniform float uI;
varying vec3 vN;
varying vec3 vP;
varying vec3 vL;

void main(){
  vec3 n=normalize(vN);if(!gl_FrontFacing)n=-n;vec3 v=normalize(-vP);
  float ndv=abs(dot(n,v));
  vec3 kd=normalize(vec3(-.45,.65,.62));float k=dot(n,kd)*.5+.5;
  vec3 deep=vec3(.14,.003,.014);vec3 mid=vec3(.52,.016,.045);vec3 hot=vec3(.95,.12,.08);
  vec3 col=mix(deep,mid,smoothstep(.12,.88,k));col=mix(col,hot,pow(k,5.)*.42);
  vec3 q=vL*vec3(1.35,.7,1.35);float core=exp(-dot(q,q)*2.1);
  col+=vec3(1.,.22,.07)*core*.32;
  float fr=pow(1.-ndv,2.4);col+=vec3(1.,.06,.08)*fr*.42;
  col+=vec3(1.,.8,.55)*smoothstep(.82,1.,vL.y/1.15)*.22;
  col*=uI*(.965+.035*sin(uTime*3.1));
  gl_FragColor=vec4(col,1.);
}
