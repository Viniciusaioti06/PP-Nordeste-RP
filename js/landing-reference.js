
document.addEventListener("DOMContentLoaded",()=>{
  const hero=document.querySelector(".reference-hero");
  const officer=document.querySelector(".hero-officer-back");
  const disc=document.querySelector(".visual-gold-disc");

  if(hero&&officer&&!window.matchMedia("(prefers-reduced-motion: reduce)").matches){
    hero.addEventListener("pointermove",event=>{
      const rect=hero.getBoundingClientRect();
      const x=(event.clientX-rect.left)/rect.width-.5;
      const y=(event.clientY-rect.top)/rect.height-.5;
      officer.style.transform=`translate(${x*14}px, ${28+y*8}px)`;
      if(disc)disc.style.transform=`translateX(calc(-50% + ${x*-10}px)) translateY(${y*-8}px)`;
    });
    hero.addEventListener("pointerleave",()=>{
      officer.style.transform="translateY(28px)";
      if(disc)disc.style.transform="translateX(-50%)";
    });
  }

  const processLines=[...document.querySelectorAll(".process-line")];
  processLines.forEach((line,index)=>{
    line.style.setProperty("--line-index",index);
  });

  const marquees=document.querySelectorAll(".marquee-track");
  marquees.forEach(track=>{
    if(track.scrollWidth<window.innerWidth*2){
      track.innerHTML+=track.innerHTML;
    }
  });

  const sectionLinks=document.querySelectorAll('a[href^="#"]');
  sectionLinks.forEach(link=>{
    link.addEventListener("click",event=>{
      const target=document.querySelector(link.getAttribute("href"));
      if(!target)return;
      event.preventDefault();
      target.scrollIntoView({behavior:"smooth",block:"start"});
    });
  });
});
