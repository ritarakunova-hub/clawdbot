varying vec3 vW;
uniform vec3 uKey;
uniform float uI;

void main(){
  float dx=vW.x-uKey.x,dz=vW.z-uKey.z;
  float pool=exp(-(dx*dx/(2.6*2.6)+dz*dz/(4.2*4.2)));
  float refl=exp(-pow(dx/.07,2.))*exp(-abs(dz)/3.2);
  vec3 c=vec3(.75,.06,.07)*pool*.55+vec3(1.,.35,.2)*refl*.9;
  c*=smoothstep(-14.,-1.,vW.z);
  gl_FragColor=vec4(c*uI,1.);
}
