const title = document.getElementById("title");

document.querySelector("form").addEventListener("submit", async (e) => {
  e.preventDefault();
  let buttonClicked = e.submitter || null;
  if (!buttonClicked) return;

  switch (buttonClicked.dataset.action) {
    case "checkpassword":
      const formDataPassword = new FormData();
      formDataPassword.append(
        "password",
        document.getElementById("password").value
      );
      const responsePassword = await fetch("/password-check", {
        method: "POST",
        body: new URLSearchParams(formDataPassword),
      });
      const resultCheckPassword = await responsePassword.json();
      if (resultCheckPassword.success) {
        alert(resultCheckPassword.success);
      } else {
        alert(resultCheckPassword.error);
        return;
      }
      title.innerHTML = "<p>введите новую почту</p>";
      document.getElementById("checkpassword").style.display = "none";
      document.getElementById("checkpassword").disabled = true;
      document.getElementById("password").disabled = true;
      document.getElementById("password").style.display = "none";
      document.getElementById("email").style.display = "block";
      document.getElementById("gettoken").style.display = "block";

      break;

    case "get_token":
      const formData = new FormData(e.target);
      const response = await fetch("/change-email", {
        method: "POST",
        body: new URLSearchParams(formData),
      });
      const result = await response.json();
      if (result.success) {
        alert(result.success);
      } else {
        alert(result.error);
        return;
      }

      title.innerHTML = "<p>введите токен который пришел на новую почту</p>";
      document.getElementById("token").style.display = "block";
      document.getElementById("gettoken").style.display = "none";
      document.getElementById("gettoken").disabled = true;
      document.getElementById("changeemail").style.display = "block";
      document.getElementById("email").disabled = true;
      break;

    case "changeemail":
      const formDateChange = new FormData();
      formDateChange.append("email", document.getElementById("email").value);
      formDateChange.append("token", document.getElementById("token").value);

      const responseChange = await fetch("/change-email-final", {
        method: "POST",
        body: new URLSearchParams(formDateChange),
      });
      const resultChange = await responseChange.json();
      if (resultChange.success) {
        alert(resultChange.success);
      } else {
        alert(resultChange.error);
        window.location.href = "/profile";
        return;
      }
      break;

    default:
      alert("Ошибка обработки действия!");
  }
});
