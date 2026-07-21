
document.addEventListener("DOMContentLoaded",()=>{
  document.querySelectorAll(".mobile-menu").forEach(button=>button.addEventListener("click",()=>document.querySelector(".mobile-nav")?.classList.toggle("open")));
  const observer=new IntersectionObserver(entries=>entries.forEach(entry=>entry.isIntersecting&&entry.target.classList.add("visible")),{threshold:.12});
  document.querySelectorAll(".reveal").forEach(element=>observer.observe(element));
});
