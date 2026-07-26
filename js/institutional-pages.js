
document.addEventListener("DOMContentLoaded",()=>{
  document.querySelectorAll(".institutional-page .form-step,.institutional-page .lookup-card,.institutional-page .lookup-result,.institutional-page .stat-card,.institutional-page .panel-card").forEach((item,index)=>{
    item.style.setProperty("--institutional-delay",`${Math.min(index,8)*45}ms`);
    item.classList.add("institutional-reveal-item");
  });

  const observer=new IntersectionObserver(entries=>{
    entries.forEach(entry=>{
      if(entry.isIntersecting){
        entry.target.classList.add("institutional-visible");
        observer.unobserve(entry.target);
      }
    });
  },{threshold:.08});

  document.querySelectorAll(".institutional-reveal-item").forEach(item=>observer.observe(item));
});
