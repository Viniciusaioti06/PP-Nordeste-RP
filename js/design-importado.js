
document.addEventListener("DOMContentLoaded",()=>{
  const menuButton=document.querySelector(".imported-menu-toggle");
  const navMenu=document.querySelector(".imported-nav-menu");
  const menuIcon=menuButton?.querySelector("i");

  const closeMenu=()=>{
    navMenu?.classList.remove("active");
    menuButton?.setAttribute("aria-expanded","false");
    menuIcon?.classList.remove("bi-x-lg");
    menuIcon?.classList.add("bi-list");
    document.body.classList.remove("imported-menu-open");
  };

  menuButton?.addEventListener("click",()=>{
    const open=!navMenu?.classList.contains("active");
    navMenu?.classList.toggle("active",open);
    menuButton.setAttribute("aria-expanded",String(open));
    menuIcon?.classList.toggle("bi-list",!open);
    menuIcon?.classList.toggle("bi-x-lg",open);
    document.body.classList.toggle("imported-menu-open",open);
  });

  navMenu?.querySelectorAll("a").forEach(link=>link.addEventListener("click",closeMenu));
  window.addEventListener("resize",()=>{if(window.innerWidth>1050)closeMenu()});

  const track=document.querySelector(".imported-brand-track");
  if(track&&!window.matchMedia("(prefers-reduced-motion: reduce)").matches){
    if(track.scrollWidth<window.innerWidth*2)track.innerHTML+=track.innerHTML;
  }

  const observer=new IntersectionObserver(entries=>{
    entries.forEach(entry=>{
      if(entry.isIntersecting){
        entry.target.classList.add("visible");
        observer.unobserve(entry.target);
      }
    });
  },{threshold:.1});
  document.querySelectorAll(".reveal").forEach(element=>observer.observe(element));

  document.querySelectorAll('a[href^="#"]').forEach(link=>{
    link.addEventListener("click",event=>{
      const id=link.getAttribute("href");
      if(!id||id==="#")return;
      const target=document.querySelector(id);
      if(!target)return;
      event.preventDefault();
      target.scrollIntoView({behavior:"smooth",block:"start"});
    });
  });
});
