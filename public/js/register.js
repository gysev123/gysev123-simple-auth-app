document.querySelector("form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const formData = new FormData(e.target);
  let buttonClicked = e.submitter || null;
  if (!buttonClicked) return;

  switch (buttonClicked.dataset.action) {
    case "get_token":
      const response = await fetch("/send-confirmation", {
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

      document.getElementById("confitmemail").style.display = "block";
      document.getElementById("token").style.display = "block";
      document.getElementById("gettoken").style.display = "none";
      document.getElementById("email").disabled = true;
      break;

    case "confirm_email":
      const formDataConfirm = new FormData();
      formDataConfirm.append("token", document.getElementById("token").value);
      formDataConfirm.append("email", document.getElementById("email").value);
      const responseCheck = await fetch("/verify-email", {
        method: "POST",
        body: new URLSearchParams(formDataConfirm),
      });
      const resultCheck = await responseCheck.json();
      if (resultCheck.success) {
        alert(resultCheck.success);
      } else {
        alert(resultCheck.error);
        return;
      }
      document.getElementById("token").disabled = true;
      document.getElementById("confitmemail").disabled = true;
      document.getElementById("reg").disabled = false;

      break;

    case "register":
      const formDateReg = new FormData();
      formDateReg.append("email", document.getElementById("email").value);
      formDateReg.append("password", document.getElementById("password").value);
      formDateReg.append("login", document.getElementById("login").value);

      const resultReg = await fetch("/reg", {
        method: "POST",
        body: new URLSearchParams(formDateReg),
      });
      const resultReq = await resultReg.json();
      if (resultReq.success) {
        alert(resultReq.success);
      } else {
        alert(resultReq.error);
        window.location.href = "/"
        return;
      }
      break;

    default:
      alert("Ошибка обработки действия!");
  }
});
