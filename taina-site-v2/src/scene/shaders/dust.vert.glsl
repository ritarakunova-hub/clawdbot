attribute float aS;
uniform float uTime;
uniform float uPx;
varying float vS;
varying vec3 vW;
void main(){
  vec3 p=position;
  p.y=mod(p.y+2.2+uTime*(.04+aS*.06),8.)-2.2;
  p.x+=sin(uTime*.15+aS*30.)*.4;
  vW=p;vS=aS;
  vec4 mv=viewMatrix*vec4(p,1.);
  gl_PointSize=uPx*(1.4+aS*2.6)*(11./-mv.z);
  gl_Position=projectionMatrix*mv;
}
