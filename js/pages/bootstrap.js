
document.addEventListener("DOMContentLoaded", async () => {
  const form = document.querySelector("#initial-setup-form");
  const error = document.querySelector("[data-setup-error]");

  try {
    requireConfig();
    if (!(await Auth.needsBootstrap())) {
      location.href = "login.html";
      return;
    }
  } catch (err) {
    error.textContent = err.message;
    return;
  }

  form.addEventListener("submit", async event => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    error.textContent = "";
    if (data.password.length < 8) {
      error.textContent = "A senha deve possuir pelo menos 8 caracteres.";
      return;
    }
    if (data.password !== data.confirmPassword) {
      error.textContent = "As senhas não coincidem.";
      return;
    }
    try {
      await Auth.bootstrap(data);
      await Auth.signIn(data.email, data.password);
      location.href = "dashboard.html";
    } catch (err) {
      error.textContent = err.message;
    }
  });
});
