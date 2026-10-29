varying vec2 vUv;
uniform sampler2D uTex;
uniform float uI;
void main(){
  vec3 c=texture2D(uTex,vUv).rgb;
  // Фон картинки почти чёрный, с еле видными силуэтами — срезаем его,
  // чтобы при сложении со сценой не проступал серый прямоугольник.
  c=max(c-vec3(.07),0.)*1.08;
  // Края картинки мягко гаснут — границы кадра не видно.
  vec2 e=smoothstep(0.,.1,vUv)*smoothstep(0.,.1,1.-vUv);
  gl_FragColor=vec4(c*e.x*e.y*uI,1.);
}
