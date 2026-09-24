uniform sampler2D tDiffuse;
uniform float uTime;
uniform float uFade;
uniform float uFlash;
uniform float uExp;
varying vec2 vUv;

float hash(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}

void main(){
  vec2 c=vUv-.5;float r=dot(c,c);vec2 off=c*r*.012;
  vec3 col;
  col.r=texture2D(tDiffuse,vUv+off).r;
  col.g=texture2D(tDiffuse,vUv).g;
  col.b=texture2D(tDiffuse,vUv-off).b;
  col*=uExp;
  col=(col*(2.51*col+.03))/(col*(2.43*col+.59)+.14);
  col=pow(max(col,0.),vec3(1./2.2));
  col*=mix(1.,smoothstep(.98,.28,length(c*vec2(1.,.92))),.85);
  float g=hash(vUv*vec2(1920.,1080.)+fract(uTime*.7)*97.)-.5;
  col+=g*.045;
  col=mix(col,vec3(1.,.84,.78),uFlash);
  col*=uFade;
  gl_FragColor=vec4(col,1.);
}
