gsap.registerPlugin(ScrollTrigger);

/* ================= HERO CINEMATIC ================= */

gsap.from(".mini", {
opacity: 0,
y: -30,
duration: 1
});

gsap.from(".nome", {
opacity: 0,
y: 40,
duration: 1,
delay: 0.3
});

gsap.from(".frase", {
opacity: 0,
y: 40,
duration: 1,
delay: 0.6
});

/* ================= FUNDO HERO ANIMADO ================= */

const canvas = document.getElementById("hero-bg");
const ctx = canvas.getContext("2d");

let w, h;
let t = 0;

function resize(){
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
}

window.addEventListener("resize", resize);
resize();

function draw(){
    t += 0.005;

    ctx.clearRect(0,0,w,h);

    // gradiente base
    const gradient = ctx.createLinearGradient(0,0,w,h);
    gradient.addColorStop(0, "#fff");
    gradient.addColorStop(1, "#f3ebe7");

    ctx.fillStyle = gradient;
    ctx.fillRect(0,0,w,h);

    // ondas orgânicas (efeito premium)
    for(let i = 0; i < 3; i++){

        ctx.beginPath();

        for(let x = 0; x < w; x++){

            const y =
                Math.sin(x * 0.002 + t + i) * 40 +
                Math.sin(x * 0.004 + t * 1.5 + i) * 20 +
                h / 2;

            ctx.lineTo(x, y);
        }

        ctx.strokeStyle = `rgba(111,81,81,${0.08 + i * 0.05})`;
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    requestAnimationFrame(draw);
}

draw();

/* ================= REAÇÃO AO MOUSE ================= */

canvas.addEventListener("mousemove", (e)=>{
    const x = e.clientX / w;
    const y = e.clientY / h;

    canvas.style.filter = `
        hue-rotate(${x * 10}deg)
        brightness(${1 + y * 0.1})
    `;
});

/* ================= TEXTO APARECENDO LETRA POR LETRA ================= */

function splitText(element){
const text = element.innerText;
element.innerHTML = "";

text.split("").forEach((char) => {
const span = document.createElement("span");
span.innerText = char;
span.style.opacity = 0;
element.appendChild(span);
});

return element.querySelectorAll("span");
}

const frase = document.querySelector(".frase");

if(frase){
const chars = splitText(frase);

gsap.to(chars,{
opacity:1,
stagger:0.03,
duration:0.5,
ease:"power2.out"
});
}

/* ================= TIMELINE CINEMATIC ================= */

const items = document.querySelectorAll(".timeline-item");

items.forEach((item) => {
gsap.to(item,{
opacity:1,
y:0,
duration:1,
ease:"power3.out",
scrollTrigger:{
trigger:item,
start:"top 80%"
}
});
});

gsap.registerPlugin(ScrollTrigger);

/* ================= LINHA CRESCENDO ================= */
gsap.to(".timeline-progress", {
    height: "100%",
    ease: "none",
    scrollTrigger: {
        trigger: ".timeline",
        start: "top 30%",
        end: "bottom 80%",
        scrub: true
    }
});

/* ================= BOLINHA ACOMPANHANDO ================= */
gsap.to(".timeline-line", {
    "--progress": "100%",
    ease: "none",
    scrollTrigger: {
        trigger: ".timeline",
        start: "top 30%",
        end: "bottom 80%",
        scrub: true
    }
});

/* ================= PARALLAX SUAVE ================= */

gsap.to(".hero-cinematic::before",{
y:100,
scrollTrigger:{
scrub:true
}
});

/* ================= CAROUSEL DRAG + INERCIA ================= */

const track = document.getElementById("track");

let isDown = false;
let startX;
let scrollLeft;

if(track){

track.addEventListener("mousedown",(e)=>{
isDown = true;
startX = e.pageX - track.offsetLeft;
scrollLeft = track.scrollLeft;
});

track.addEventListener("mouseleave",()=> isDown = false);
track.addEventListener("mouseup",()=> isDown = false);

track.addEventListener("mousemove",(e)=>{
if(!isDown) return;
e.preventDefault();
const x = e.pageX - track.offsetLeft;
const walk = (x - startX) * 2;
track.scrollLeft = scrollLeft - walk;
});

/* AUTO SCROLL SUAVE */
let autoScroll = true;

setInterval(()=>{
if(autoScroll){
track.scrollLeft += 1;
}
},20);

track.addEventListener("mouseenter",()=> autoScroll = false);
track.addEventListener("mouseleave",()=> autoScroll = true);

}

/* ================= CAROUSEL ANIMAÇÃO ================= */

gsap.utils.toArray(".track img").forEach((img, i) => {
  gsap.to(img, {
    opacity: 1,
    scale: 1,
    duration: 0.8,
    delay: i * 0.1,
    scrollTrigger: {
      trigger: img,
      start: "left 85%",
      toggleClass: "visible"
    }
  });
});

/* ================= FINAL DRAMÁTICO ================= */

gsap.from(".final h2",{
opacity:0,
y:50,
duration:1,
scrollTrigger:{
trigger:".final",
start:"top 80%"
}
});

gsap.from(".texto-final",{
opacity:0,
y:50,
duration:1,
delay:0.3,
scrollTrigger:{
trigger:".final",
start:"top 80%"
}
});

gsap.from(".btn-final",{
scale:0.8,
opacity:0,
duration:0.8,
delay:0.6,
scrollTrigger:{
trigger:".final",
start:"top 80%"
}
});