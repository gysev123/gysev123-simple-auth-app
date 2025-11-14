document.querySelector("form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const formData = new FormData(e.target);

  const response = await fetch("/log", {
    method: "POST",
    body: new URLSearchParams(formData),
  });

  const result = await response.json();
  if (result.success) {
    window.location.href = "/profile"; // Переход здесь
  } else {
    alert(result.error);
  }
});
