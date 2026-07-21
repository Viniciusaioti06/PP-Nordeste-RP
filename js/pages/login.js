
document.addEventListener("DOMContentLoaded", async () => {
  const form = document.querySelector("#admin-login");
  const error = document.querySelector("[data-login-error]");

  try {
    requireConfig();
    if (await Auth.needsBootstrap()) {
      location.href = "configuracao-inicial.html";
      return;
    }
    if (await Auth.session()) {
      location.href = "dashboard.html";
      return;
    }
  } catch (err) {
    error.textContent = err.message;
  }

  form.addEventListener("submit", async event => {
    event.preventDefault();
    error.textContent = "";
    const data = Object.fromEntries(new FormData(form).entries());
    const button = form.querySelector("button[type=submit]");
    button.disabled = true;
    try {
      await Auth.signIn(data.email, data.password);
      location.href = "dashboard.html";
    } catch (err) {
      error.textContent = err.message;
    } finally {
      button.disabled = false;
    }
  });
});
