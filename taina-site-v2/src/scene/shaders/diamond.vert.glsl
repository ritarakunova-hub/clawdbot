varying vec3 vN;
varying vec3 vP;
varying vec3 vL;
void main(){
  vL=position;
  vN=normalize(normalMatrix*normal);
  vec4 mv=modelViewMatrix*vec4(position,1.);
  vP=mv.xyz;
  gl_Position=projectionMatrix*mv;
}
