
document.addEventListener("DOMContentLoaded",async()=>{
  const error=document.querySelector("[data-login-error]");
  try{
    if(!SUPABASE_CONFIGURED){
      error.textContent="Configure a Project URL e a chave pública em supabase/config.js.";
      return;
    }
    if(await PPStore.needsInitialSetup()){
      location.href="configuracao-inicial.html";
      return;
    }
    if(await PPStore.initializeStaff()){
      location.href="dashboard.html";
      return;
    }
  }catch(err){
    error.textContent=err.message;
  }

  const form=document.querySelector("#admin-login");
  form.addEventListener("submit",async event=>{
    event.preventDefault();
    error.textContent="";
    const data=Object.fromEntries(new FormData(form).entries());
    const button=form.querySelector("button[type=submit]");
    button.disabled=true;
    try{
      const result=await PPStore.loginStaff(data.username,data.password);
      if(result.ok) location.href="dashboard.html";
      else error.textContent=result.reason==="inactive"
        ?"Este acesso está desativado."
        :"E-mail ou senha inválidos.";
    }catch(err){error.textContent=err.message}
    finally{button.disabled=false}
  });
});
