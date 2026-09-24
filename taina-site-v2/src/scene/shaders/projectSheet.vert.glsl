attribute vec3 aChaosPos;
attribute vec3 aChaosRot;
attribute vec3 aShelfPos;
attribute vec3 aShelfRot;
attribute float aDelay;

uniform float uOrder;
uniform float uTime;

varying vec2 vUv;
varying float vLocalOrder;

mat3 rx(float a) {
  float c = cos(a), s = sin(a);
  return mat3(1., 0., 0., 0., c, s, 0., -s, c);
}
mat3 ry(float a) {
  float c = cos(a), s = sin(a);
  return mat3(c, 0., -s, 0., 1., 0., s, 0., c);
}
mat3 rz(float a) {
  float c = cos(a), s = sin(a);
  return mat3(c, s, 0., -s, c, 0., 0., 0., 1.);
}

void main() {
  // «У каждого листа своя задержка» — окно оседания растянуто по aDelay,
  // так листы садятся на полку не все разом, а вразнобой по ходу скролла.
  float span = 0.5;
  float lo = clamp((uOrder - aDelay * (1.0 - span)) / span, 0.0, 1.0);
  float k = lo * lo * (3.0 - 2.0 * lo);

  vec3 rot = mix(aChaosRot, aShelfRot, k);
  mat3 R = rz(rot.z) * ry(rot.y) * rx(rot.x);
  vec3 basePos = mix(aChaosPos, aShelfPos, k);

  // Дрейф хаоса затухает по мере оседания на полку.
  vec3 jitter = vec3(sin(uTime * 0.6 + aDelay * 10.0), cos(uTime * 0.5 + aDelay * 7.0), 0.0) * 0.06 * (1.0 - k);

  vec3 wp = basePos + jitter + R * position;
  vUv = uv;
  vLocalOrder = k;
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}
