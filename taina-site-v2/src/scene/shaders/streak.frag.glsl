varying vec2 vUv;
uniform vec3 uCol;
uniform float uI;
uniform float uT;
uniform float uF;
void main(){
  vec2 c=vUv-.5;
  float a=exp(-pow(abs(c.y)*uT,2.));
  float b=pow(max(1.-abs(c.x)*2.,0.),uF);
  gl_FragColor=vec4(uCol*a*b*uI,1.);
}
