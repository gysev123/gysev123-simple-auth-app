const welcome = document.getElementById("welcome");
const button = document.getElementById("button");
const emailDiv = document.getElementById("email");

fetch("/SessionData")
  .then((response) => {
    if (!response.ok) throw new Error("Ошибка сервера");
    return response.json();
  })
  .then((session) => {
    if (!session) {
      welcome.innerHTML = `<p>чтобы продолжить необходимо войти</p>`;
      button.innerHTML = `<button data-type="login" class="profileBtn">войти</button>`;
    } else {
      welcome.innerHTML = `<p>Добро пожаловать, ${session.login}</p>`;
      button.innerHTML = `<button data-type="logout" class="profileBtn">выйти</button>
      <button data-type="email" class="profileBtn visible">посмотреть почту</button>
      <button data-type="changepassword" class="profileBtn">сменить пароль</button>`;
      emailDiv.innerHTML = `<p id="emailText" class="hidden">${session.email}<\p>`;
    }
  })
  .catch((error) => console.error("Ошибка:", error));

button.onclick = function (event) {
  switch (event.target.dataset.type) {
    case "login":
      window.location.href = "/login";
      break;
    case "logout":
      if (confirm("Вы действительно хотите выйти?")) {
        fetch("/logout")
          .then(() => (window.location.href = "/"))
          .catch((error) => console.error("Ошибка:", error));
      } else {
        alert("Действие отменено.");
      }
      break;
    case "email":
      const emailT = document.querySelector(".hidden");
      const emailBtn = document.querySelector(".visible");
      emailBtn.style.display = "none";
      emailT.style.display = "block";
      break;
    case "changepassword":
      window.location.href = "/changepassword";
      break;
  }
};
