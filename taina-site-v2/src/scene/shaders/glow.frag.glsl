varying vec2 vUv;
uniform vec3 uCol;
uniform float uI;
uniform float uPow;
void main(){
  vec2 c=vUv-.5;float d=length(c)*2.;float g=pow(max(1.-d,0.),uPow);
  gl_FragColor=vec4(uCol*g*uI,1.);
}
