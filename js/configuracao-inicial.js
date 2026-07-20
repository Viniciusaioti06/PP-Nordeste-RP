
document.addEventListener("DOMContentLoaded",async()=>{
  const form=document.querySelector("#initial-setup-form");
  const error=document.querySelector("[data-setup-error]");
  if(!SUPABASE_CONFIGURED){
    error.textContent="Configure supabase/config.js antes de criar o administrador.";
    form.querySelector("button").disabled=true;
    return;
  }
  try{
    if(!(await PPStore.needsInitialSetup())){
      location.href="login.html";return;
    }
  }catch(err){error.textContent=err.message;return}

  form.addEventListener("submit",async event=>{
    event.preventDefault();error.textContent="";
    const data=Object.fromEntries(new FormData(form).entries());
    if(data.password.length<8){error.textContent="A senha deve possuir pelo menos 8 caracteres.";return}
    if(data.password!==data.confirmPassword){error.textContent="As senhas não coincidem.";return}
    const button=form.querySelector("button[type=submit]");button.disabled=true;
    try{
      const result=await PPStore.createInitialAdmin(data);
      if(!result.ok){
        error.textContent=result.error?.message||"Não foi possível criar o administrador.";
        return;
      }
      await PPStore.loginStaff(data.email,data.password);
      location.href="dashboard.html";
    }catch(err){error.textContent=err.message}
    finally{button.disabled=false}
  });
});
