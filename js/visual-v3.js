
document.addEventListener("DOMContentLoaded",()=>{
  document.body.classList.add("v3-ready");

  const interactiveSelectors=".card,.panel-card,.stat-card,.timeline-card,.feature-card,.setting-card,.question-editor-row";
  document.querySelectorAll(interactiveSelectors).forEach(card=>{
    card.classList.add("v3-surface");
    card.addEventListener("pointermove",event=>{
      if(window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;
      const rect=card.getBoundingClientRect();
      card.style.setProperty("--mx",`${event.clientX-rect.left}px`);
      card.style.setProperty("--my",`${event.clientY-rect.top}px`);
    });
  });

  const counters=document.querySelectorAll(".stat-card strong,[data-total],[data-review],[data-approved],[data-rejected]");
  const animateCounter=element=>{
    const target=Number(element.textContent);
    if(!Number.isFinite(target)||target<1)return;
    const duration=650;
    const start=performance.now();
    const tick=now=>{
      const progress=Math.min((now-start)/duration,1);
      element.textContent=Math.round(target*(1-Math.pow(1-progress,3)));
      if(progress<1)requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  counters.forEach(animateCounter);

  document.querySelectorAll("button,.button").forEach(button=>{
    button.addEventListener("pointerdown",()=>button.classList.add("is-pressed"));
    ["pointerup","pointerleave","pointercancel"].forEach(type=>button.addEventListener(type,()=>button.classList.remove("is-pressed")));
  });

  document.querySelectorAll("dialog").forEach(dialog=>{
    dialog.addEventListener("click",event=>{
      const rect=dialog.getBoundingClientRect();
      const outside=event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom;
      if(outside&&dialog.open)dialog.close();
    });
  });
});
