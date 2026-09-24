uniform vec3 uKeyPos;
uniform vec3 uCurPos;
uniform float uKeyI;
uniform float uCurI;
varying float vS;
varying vec3 vW;
void main(){
  vec2 c=gl_PointCoord-.5;float d=length(c)*2.;float m=smoothstep(1.,.2,d);
  float lk=exp(-pow(distance(vW,uKeyPos),2.)/(6.*6.))*uKeyI;
  float lc=exp(-pow(distance(vW,uCurPos),2.)/(3.2*3.2))*uCurI;
  vec3 col=vec3(1.,.3,.18)*lk+vec3(1.,.78,.4)*lc;
  gl_FragColor=vec4(col*m*(.35+vS*.65)*1.3,1.);
}
