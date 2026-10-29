uniform float uTime;
uniform float uI;
uniform float uHT;
uniform float uHB;
varying vec3 vN;
varying vec3 vP;
varying vec3 vL;

void main(){
  vec3 n=normalize(vN);if(!gl_FrontFacing)n=-n;vec3 v=normalize(-vP);
  float ndv=abs(dot(n,v));
  // Тёмный гранатовый камень: грани почти чёрные, по краям силуэта
  // красный отсвет, по поясу (стык верхней и нижней пирамид) — свет
  // изнутри. Контур рисуют золотые рёбра (diamond.ts).
  vec3 col=vec3(.03,.0,.006)+vec3(.5,.03,.04)*pow(1.-ndv,2.5)*.35;
  float yy=vL.y>0.?vL.y/uHT:-vL.y/uHB;
  col+=vec3(.9,.08,.08)*pow(1.-clamp(yy,0.,1.),6.)*ndv*.5;
  col*=uI*(.97+.03*sin(uTime*3.1));
  gl_FragColor=vec4(col,1.);
}
