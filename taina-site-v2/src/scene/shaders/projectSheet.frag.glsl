uniform float uTime;
varying vec2 vUv;
varying float vLocalOrder;

void main() {
  // Свет меняется с красного (хаос) на золотой (порядок) — на уровне
  // материала каждого листа, не общим тоном сцены, чтобы было видно,
  // как они оседают вразнобой.
  vec3 chaosColor = vec3(0.17, 0.045, 0.045);
  vec3 orderColor = vec3(0.58, 0.44, 0.23);
  float k = smoothstep(0.0, 1.0, vLocalOrder);
  vec3 col = mix(chaosColor, orderColor, k);

  vec2 e = abs(vUv - 0.5) * 2.0;
  float edge = smoothstep(0.86, 1.0, max(e.x, e.y));
  col *= 1.0 - edge * 0.5;

  float grain = fract(sin(dot(vUv * 300.0 + uTime * 0.01, vec2(12.9898, 78.233))) * 43758.5453);
  col += (grain - 0.5) * 0.015;

  gl_FragColor = vec4(col, 1.0);
}
