const content = document.getElementById("main");

fetch("/SessionDataReset")
  .then((response) => {
    if (!response.ok) throw new Error("Ошибка сервера");
    return response.json();
  })
  .then((session) => {
    if (!session) {
      content.innerHTML = `
      <p>востановление пароля</p>
      <form id="formemail">
        <input type="text" name="email" placeholder="email">
        <input type="submit" value="востановить"> 
      </form>`;

      document
        .getElementById("formemail")
        .addEventListener("submit", async (e) => {
          e.preventDefault();
          const formData = new FormData(e.target);

          const response = await fetch("/password-resets", {
            method: "POST",
            body: new URLSearchParams(formData),
          });

          const result = await response.json();
          if (result.success) {
            window.location.reload();
          } else {
            alert(result.error);
          }
        });
    } else if (session.resettoken == false) {
      content.innerHTML = `<p>токен был отправлен на почту</p>
      <form id="formtoken">
        <input type="text" name="token" placeholder="token">
        <input type="submit" value="востановить"> 
      </form>`;

      document
        .getElementById("formtoken")
        .addEventListener("submit", async (e) => {
          e.preventDefault();
          const formData = new FormData(e.target);

          const response = await fetch("/tokencheck", {
            method: "POST",
            body: new URLSearchParams(formData),
          });

          const result = await response.json();
          if (result.success) {
            window.location.reload();
          } else {
            alert(result.error);
          }
        });
    } else if (session.resettoken == true) {
      content.innerHTML = `<p>придумайте новый пароль</p>
      <form id="formpassword">
        <input type="text" name="password" placeholder="password">
        <input type="submit" value="сменить"> 
      </form>`;

      document
        .getElementById("formpassword")
        .addEventListener("submit", async (e) => {
          e.preventDefault();
          const formData = new FormData(e.target);

          const response = await fetch("/confirmpasswordreset", {
            method: "POST",
            body: new URLSearchParams(formData),
          });

          const result = await response.json();
          if (result.success) {
            window.location.href = "/";
          } else {
            alert(result.error);
          }
        });
    }
  })
  .catch((error) => alert(error));
