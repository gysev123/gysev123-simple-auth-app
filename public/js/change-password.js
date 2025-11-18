const login = document.getElementById("login");
const form = document.getElementById("form");

fetch("/SessionData")
  .then((response) => {
    if (!response.ok) throw new Error("Ошибка сервера");
    return response.json();
  })
  .then((session) => {
    if (!session) {
      login.innerHTML = "Чтобы сменить пароль нужно войти в аккаунт";
    } else {
      login.innerHTML = `<p>Смена пароля, ${session.login}</p>`;
      form.innerHTML = `<form action="/change-password" method="post">
      <input type="text" name="oldpassword" placeholder="старый пароль" />
      <input type="text" name="newpassword" placeholder="новый пароль" />
      <input type="submit" value="сменить" />
    </form>`;
    }
  })
  .then(async () => {
    document.querySelector("form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);

      const response = await fetch("/change-password", {
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
  })
  .catch((error) => console.error("Ошибка:", error));
