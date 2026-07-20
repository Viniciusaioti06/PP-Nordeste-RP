
document.addEventListener("DOMContentLoaded",()=>{
  document.querySelectorAll(".mobile-menu").forEach(btn=>{
    btn.addEventListener("click",()=>{
      const nav=document.querySelector(".mobile-nav");
      nav?.classList.toggle("open");
    });
  });
  const observer=new IntersectionObserver(entries=>{
    entries.forEach(entry=>entry.isIntersecting&&entry.target.classList.add("visible"));
  },{threshold:.12});
  document.querySelectorAll(".reveal").forEach(el=>observer.observe(el));
});
function ppEscape(value){
  return String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
}
function ppFormatDate(value){
  return new Intl.DateTimeFormat("pt-BR",{dateStyle:"short",timeStyle:"short"}).format(new Date(value));
}
function ppToast(message){
  let toast=document.querySelector(".toast");
  if(!toast){toast=document.createElement("div");toast.className="toast";document.body.appendChild(toast);}
  toast.textContent=message;toast.classList.add("show");setTimeout(()=>toast.classList.remove("show"),2500);
}
