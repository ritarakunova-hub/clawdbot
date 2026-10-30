varying vec3 vW;
void main(){
  vec4 w=modelMatrix*vec4(position,1.);
  vW=w.xyz;
  gl_Position=projectionMatrix*viewMatrix*w;
}
