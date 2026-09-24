attribute vec3 aPos;
attribute vec3 aRot;
attribute vec4 aSeed;
attribute float aCell;
uniform float uTime;
varying vec2 vUv;
varying vec3 vW;
varying vec3 vN;
varying float vCell;
varying vec4 vClip;

mat3 rx(float a){float c=cos(a),s=sin(a);return mat3(1.,0.,0.,0.,c,s,0.,-s,c);}
mat3 ry(float a){float c=cos(a),s=sin(a);return mat3(c,0.,-s,0.,1.,0.,s,0.,c);}
mat3 rz(float a){float c=cos(a),s=sin(a);return mat3(c,s,0.,-s,c,0.,0.,0.,1.);}

void main(){
  float t=uTime;
  vec3 ang=aRot+vec3(sin(t*aSeed.x*.5+aSeed.z)*.32,t*aSeed.y*.06+aSeed.z,sin(t*aSeed.x*.35+aSeed.z*2.)*.22);
  mat3 R=rz(ang.z)*ry(ang.y)*rx(ang.x);
  vec3 p=R*(position*aSeed.w);
  vec3 wp=aPos+vec3(0.,sin(t*.22*aSeed.x+aSeed.z*3.)*.3,0.)+p;
  vN=R*vec3(0.,0.,1.);vW=wp;vUv=uv;vCell=aCell;
  gl_Position=projectionMatrix*viewMatrix*vec4(wp,1.);vClip=gl_Position;
}
