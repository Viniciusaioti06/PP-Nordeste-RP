
window.escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, char => ({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
}[char]));

window.formatDate = value => value
  ? new Intl.DateTimeFormat("pt-BR",{dateStyle:"short",timeStyle:"short"}).format(new Date(value))
  : "—";

window.showToast = message => {
  let toast = document.querySelector(".toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.className = "toast";
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2800);
};

window.requireConfig = () => {
  if (!window.APP_CONFIGURED || !window.supabaseClient) {
    throw new Error("Supabase não configurado. Preencha supabase/config.js.");
  }
};
