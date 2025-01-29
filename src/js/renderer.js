export function updateUI(updates) {
  for (const [id, value] of Object.entries(updates)) {
    const element = document.getElementById(id);
    if (element) {
      if (id == "profitability" || id == "game_time"){
        element.innerHTML = value;
      }
      else {
        element.textContent = value;
      }
    }
  }
}

export function showNotification(message, type = "info") {
  const notification = document.createElement("div");
  notification.className = `notification ${type}`;
  notification.textContent = message;

  document.body.appendChild(notification);

  setTimeout(() => {
    document.body.removeChild(notification);
  }, 3000);
}

export function bindButton(id, callback) {
  const button = document.getElementById(id);
  if (button) {
    button.addEventListener("click", callback);
  }
}

module.exports = {
  updateUI,
  showNotification,
  bindButton,
};
