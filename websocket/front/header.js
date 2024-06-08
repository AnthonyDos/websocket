document.addEventListener("DOMContentLoaded", function () {
  // Créer le header
  const header = document.createElement("header");
  header.className = "main-header";

  // Ajouter du contenu au header
  const title = document.createElement("h1");
  title.textContent = "Bienvenue sur la plateforme de jeux en ligne";
  header.appendChild(title);
  document.body.insertBefore(header, document.body.firstChild);
});
