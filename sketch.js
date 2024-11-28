// Vertex shader - håndterer placeringen af vertices (hjørnepunkter)
let vert = `
attribute vec3 aPosition;     // Indgangsposition for vertex
attribute vec2 aTexCoord;     // Tekstur koordinater
varying vec2 vTexCoord;       // Videresender tekstur koordinater til fragment shader

void main() {
  vTexCoord = aTexCoord;     // Send tekstur koordinater videre
  vec4 positionVec4 = vec4(aPosition, 1.0);  // Konverter position til 4D
  positionVec4.xy = positionVec4.xy * 2.0 - 1.0;  // Konverter fra pixel koordinater til clip space (-1 til 1)
  gl_Position = positionVec4;  // Sæt den endelige vertex position
}`;

// Fragment shader - håndterer farven for hver pixel
let frag = `
precision mediump float;      // Sæt præcision for floating point tal
varying vec2 vTexCoord;       // Modtag tekstur koordinater fra vertex shader
uniform vec2 u_resolution;    // Canvas opløsning
uniform float u_time;         // Tid brugt til animation

// Generer en blød farvepalette ved hjælp af cosinus bølger
vec3 palette(float t) {
    vec3 a = vec3(0.5, 0.5, 0.5);    // Offset
    vec3 b = vec3(0.5, 0.5, 0.5);    // Amplitude
    vec3 c = vec3(1.0, 1.0, 1.0);    // Frekvens
    vec3 d = vec3(0.263, 0.416, 0.557);  // Fase
    return a + b * cos(6.28318 * (c * t + d));  // Returner interpoleret farve
}

// Beregn mandelbulb distance feltet
float mandelbulb(vec3 p) {
    vec3 w = p;
    float m = dot(w, w);     // Længde i kvadrat
    float dz = 1.0;          // Distance estimator
    
    // Mandelbulb foldning iterationer
    for(int i = 0; i < 4; i++) {
        dz = 8.0 * pow(sqrt(m), 7.0) * dz + 1.0;
        float r = length(w);
        float b = 8.0 * acos(w.y / r);    // Theta vinkel
        float a = 8.0 * atan(w.x, w.z);   // Phi vinkel
        
        // Mandelbulb formel
        w = p + pow(r, 8.0) * vec3(sin(b) * sin(a), cos(b), sin(b) * cos(a));
        m = dot(w, w);
        if(m > 256.0)    // Undslip betingelse
            break;
    }
    return 0.25 * log(m) * sqrt(m) / dz;  // Returner distance estimation
}

// Transformer og skaler rummet
float map(vec3 p) {
    float t = u_time * 0.1;  // Sænk tiden
    float scale = 1.0 + sin(t) * 0.1;  // Pulserende skalering
    
    // Opret rotationsmatricer
    mat3 rot = mat3(
        cos(t), 0.0, sin(t),    // Y-akse rotation
        0.0, 1.0, 0.0,
        -sin(t), 0.0, cos(t)
    ) * mat3(
        1.0, 0.0, 0.0,          // X-akse rotation
        0.0, cos(t*0.7), -sin(t*0.7),
        0.0, sin(t*0.7), cos(t*0.7)
    );
    
    p *= scale;    // Anvend skalering
    p *= rot;      // Anvend rotation
    return mandelbulb(p) / scale;
}

// Beregn overfladenormaler til belysning
vec3 calcNormal(vec3 p) {
    vec2 e = vec2(0.001, 0.0);  // Lille offset til afledt
    // Beregn gradient ved hjælp af centrale differencer
    return normalize(vec3(
        map(p + e.xyy) - map(p - e.xyy),  // x normal
        map(p + e.yxy) - map(p - e.yxy),  // y normal
        map(p + e.yyx) - map(p - e.yyx)   // z normal
    ));
}

void main() {
    // Opsæt skærmkoordinater
    vec2 uv = vTexCoord - 0.5;  // Centrer UV koordinater
    uv.x *= u_resolution.x/u_resolution.y;  // Korriger for aspekt ratio
    
    // Kamera opsætning
    vec3 ro = vec3(0.0, 0.0, 5.0);  // Kamera position
    vec3 rd = normalize(vec3(uv * 0.8, -1.0));  // Stråle retning
    
    float t = 0.0;      // Stråle distance rejst
    float mint = 0.001;  // Minimum trace distance
    float maxt = 8.0;    // Maximum trace distance
    
    // Ray marching loop
    for(int i = 0; i < 80; i++) {
        float h = map(ro + rd * t);  // Få distance til overflade
        if(h < 0.001 * t || t > maxt) break;  // Ramt overflade eller nået max distance
        t += h;  // March langs stråle
    }
    
    vec3 col = vec3(0.0);  // Endelig farve
    
    // Hvis vi rammer overfladen
    if(t < maxt) {
        vec3 pos = ro + rd * t;  // Træfposition
        vec3 nor = calcNormal(pos);  // Overfladenormal
        
        // Belysningsberegning
        vec3 light = normalize(vec3(sin(u_time*0.5), 0.6, cos(u_time*0.5)));  // Bevægende lys
        float dif = max(0.0, dot(nor, light));  // Diffust lys
        float amb = 0.5 + 0.5 * dot(nor, vec3(0.0, 1.0, 0.0));  // Ambient lys
        
        // Anvend farve og belysning
        col = palette(length(pos)*0.2 + u_time*0.1);  // Basisfarve
        col *= dif * 0.8 + amb * 0.2;  // Anvend belysning
    }
    
    // Tilføj distancebaseret glød
    col += vec3(0.1, 0.2, 0.3) * (1.0 / (1.0 + t * t * 0.05));
    
    // Gamma korrektion
    col = pow(col, vec3(0.4545));
    
    gl_FragColor = vec4(col, 1.0);  // Output endelig farve
}`;

// p5.js opsætning
let mandelbulbShader;

// Initialiser canvas og shader
function setup() {
    createCanvas(1024,1024, WEBGL);
    mandelbulbShader = createShader(vert, frag);  // Opret shader program
    shader(mandelbulbShader);  // Brug shaderen
    noStroke();  // Ingen outline på former
}

// Hovedrenderingsloop
function draw() {
    // Opdater shader uniforms
    mandelbulbShader.setUniform('u_resolution', [width, height]);  // Send canvas størrelse
    mandelbulbShader.setUniform('u_time', frameCount * 0.016);    // Send tid (skaleret)
    rect(0, 0, width, height);  // Tegn fullscreen firkant
}

// Håndter vinduesstørrelse ændringer
function windowResized() {
    resizeCanvas(min(windowWidth, windowHeight), min(windowWidth, windowHeight));
}