uniform float uReveal; // 0..1, проявление листа — без сглаживания, 1:1 со скроллом
uniform float uTime;
varying vec3 vN;
varying vec2 vUv;
varying vec3 vP;

void main(){
  vec3 n = normalize(vN);
  vec3 v = normalize(-vP);
  float fr = pow(1.0 - abs(dot(n, v)), 2.0);
  float k = clamp(uReveal, 0.0, 1.0);

  vec3 dark = vec3(0.02, 0.017, 0.018);
  vec3 mid = vec3(0.22, 0.15, 0.12);
  vec3 lit = vec3(0.58, 0.46, 0.36);
  vec3 col = mix(dark, mix(mid, lit, smoothstep(0.35, 1.0, k)), smoothstep(0.0, 0.4, k));
  col += fr * 0.12 * k;

  float grain = fract(sin(dot(vUv * 512.0 + uTime * 0.02, vec2(12.9898, 78.233))) * 43758.5453);
  col += (grain - 0.5) * 0.012;

  gl_FragColor = vec4(col, 1.0);
}
