const sqlite3 = require("sqlite3").verbose();
const { ipcRenderer } = require("electron");
const { v4: uuidv4 } = require("uuid");

const db = new sqlite3.Database("./src/data/field_database.db", (err) => {
  if (err) {
    console.error("Database connection error:", err.message);
  } else {
    console.log("Connected to the SQLite database.");
    loadUsers(); // Load users at startup
  }
});

// Load users from the database
function loadUsers() {
  db.all("SELECT * FROM users", [], (err, rows) => {
    if (err) {
      console.error("Error loading users:", err.message);
      return;
    }

    const userList = document.getElementById("user-list");
    userList.innerHTML = ""; // Clear the list

    if (rows.length === 0) {
      userList.innerHTML = "<p>No users found. Add one!</p>";
    } else {
      rows.forEach((user) => {
        const li = document.createElement("li");
        li.classList.add("user-item");
        li.dataset.id = user.id;
        li.dataset.hashfield = user.hashfield;

        // User icon
        const userIcon = document.createElement("img");
        userIcon.src = "./img/user_icon.png"; // Replace with your user icon path
        userIcon.alt = "User Icon";
        userIcon.classList.add("user-icon");

        // Username
        const username = document.createElement("span");
        username.classList.add("user-name");
        username.classList.add("unselectable");
        username.textContent = user.username;

        // Delete button
        const deleteButton = document.createElement("button");
        deleteButton.classList.add("delete-btn");
        deleteButton.classList.add("unselectable");
        const deleteIcon = document.createElement("img");
        deleteIcon.src = "./img/delete_icon.png"; // Replace with your delete icon path
        deleteIcon.alt = "Delete";
        deleteButton.appendChild(deleteIcon);
        deleteButton.addEventListener("click", (e) => {
          e.stopPropagation(); // Prevent event propagation
          confirmDeleteUser(user);
        });

        // Add user icon, name, and delete button to the list
        li.appendChild(userIcon);
        li.appendChild(username);
        li.appendChild(deleteButton);

        // Handle user selection on click
        li.addEventListener("click", () => {
          document
            .querySelectorAll("#user-list li")
            .forEach((item) => item.classList.remove("selected"));
          li.classList.add("selected");
        });

        // Double-click to start the game
        li.addEventListener("dblclick", () => {
          ipcRenderer.send("load-game", user);
        });

        userList.appendChild(li);
      });
    }
  });
}

// Check the number of users before opening the user creation modal
document.getElementById("add-user").addEventListener("click", () => {
  db.get("SELECT COUNT(*) AS count FROM users", [], (err, row) => {
    if (err) {
      console.error("Error checking users:", err.message);
      return;
    }

    if (row.count >= 3) {
      alert("You can't create more than 3 farmers!");
    } else {
      openUserCreationModal();
    }
  });
});

// Open the user creation modal
function openUserCreationModal() {
  const modal = document.getElementById("modal");
  modal.style.display = "flex";
  const input = document.getElementById("username-input");
  input.value = "";
  input.focus();
}

// Close the modal when clicking outside its content
document.getElementById("modal").addEventListener("click", (event) => {
  if (event.target === document.getElementById("modal")) {
    document.getElementById("modal").style.display = "none"; // Close the modal
  }
});

// Submit the form and add the user
document.getElementById("modal-submit").addEventListener("click", () => {
  const input = document.getElementById("username-input");
  const username = input.value.trim();

  if (!username) {
    alert("Please enter a username!");
    return;
  }

  const id = uuidv4();
  const hashfield = uuidv4();

  // Add user data to the database
  db.run(
    "INSERT INTO users (id, username, hashfield) VALUES (?, ?, ?)",
    [id, username, hashfield],
    (err) => {
      if (err) {
        console.error("Error adding user:", err.message);
        return;
      }

      // Add field details to the database
      db.run(
        "INSERT INTO fieldsdetails (hashfield, dimension, rentability, bleamount, money, basic_agri, rare_agri, epic_agri, legendary_agri, dimension_perc, prod_perc) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          hashfield,
          10, // dimension
          0, // rentability
          0, // wheat amount
          500, // money
          1, // basic_agri
          0, // rare_agri
          0, // epic_agri
          0, // legendary_agri
          0, // dimension perc
          0, // prod_perc
        ],
        (err) => {
          if (err) {
            console.error("Error adding field details:", err.message);
            return;
          }

          closeModal(); // Close the modal
          loadUsers(); // Reload the user list
        }
      );
    }
  );
});

// Close the modal after adding a user
function closeModal() {
  const modal = document.getElementById("modal");
  modal.style.display = "none";
}

// Confirm user deletion
function confirmDeleteUser(user) {
  const confirmation = confirm(
    `Are you sure you want to delete user "${user.username}"?`
  );
  if (confirmation) {
    deleteUser(user);
  }
}

// Delete a user
function deleteUser(user) {
  const { id, hashfield } = user;

  db.run("DELETE FROM users WHERE id = ?", [id], (err) => {
    if (err) {
      console.error("Error deleting user:", err.message);
      return;
    }

    db.run(
      "DELETE FROM fieldsdetails WHERE hashfield = ?",
      [hashfield],
      (err) => {
        if (err) {
          console.error("Error deleting field details:", err.message);
          return;
        }
        loadUsers(); // Reload the user list after deletion
      }
    );

    db.run("DELETE FROM users_quests WHERE users_id = ?", [id], (err) => {
      if (err) {
        console.error("Error deleting user quests:", err.message);
        return;
      }
      loadUsers(); // Reload the user list after deletion
    });
  });
}
