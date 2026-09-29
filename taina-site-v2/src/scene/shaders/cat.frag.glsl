varying vec2 vUv;
uniform sampler2D uTex;
uniform float uVis;
uniform float uBlink;
void main(){
  vec3 t=texture2D(uTex,vUv).rgb;
  float lum=dot(t,vec3(.3,.59,.11));
  float eyes=smoothstep(.5,.92,lum)*(1.-uBlink);
  float body=.16;
  float fall=smoothstep(.5,.16,length(vUv-.5));
  gl_FragColor=vec4(t*(body+eyes*2.6)*fall*uVis,1.);
}
