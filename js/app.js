
document.addEventListener("DOMContentLoaded",()=>{
  document.querySelectorAll(".mobile-menu").forEach(button=>{
    const nav=document.querySelector(".mobile-nav");
    if(!nav)return;

    const closeMenu=()=>{
      nav.classList.remove("open");
      button.classList.remove("active");
      button.setAttribute("aria-expanded","false");
      document.body.classList.remove("public-menu-open");
    };

    button.addEventListener("click",event=>{
      event.stopPropagation();
      const willOpen=!nav.classList.contains("open");
      nav.classList.toggle("open",willOpen);
      button.classList.toggle("active",willOpen);
      button.setAttribute("aria-expanded",String(willOpen));
      document.body.classList.toggle("public-menu-open",willOpen);
    });

    nav.querySelectorAll("a").forEach(link=>link.addEventListener("click",closeMenu));
    document.addEventListener("click",event=>{
      if(nav.classList.contains("open")&&!nav.contains(event.target)&&!button.contains(event.target)){
        closeMenu();
      }
    });
    window.addEventListener("resize",()=>{if(window.innerWidth>760)closeMenu()});
  });

  const observer=new IntersectionObserver(
    entries=>entries.forEach(entry=>entry.isIntersecting&&entry.target.classList.add("visible")),
    {threshold:.12}
  );
  document.querySelectorAll(".reveal").forEach(element=>observer.observe(element));
});
