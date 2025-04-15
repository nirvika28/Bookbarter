const bookCategories = ["Fiction", "My Library", "Science Fiction", "Register"];
const bookGrid = document.querySelector(".book-grid");

bookCategories.forEach((category) => {
  const card = document.createElement("div");
  card.className = "book-card";
  card.textContent = category;
  bookGrid.appendChild(card);
});
document.addEventListener("DOMContentLoaded", () => {
    // Example user (replace with session data or login input)
    const username = "john123";
  
    // Display username
    document.getElementById("username").textContent = username;
  
    // Fetch and display user’s books
    fetch(`../backend/getBooks.php?username=${username}`)
      .then(response => response.json())
      .then(data => {
        const bookContainer = document.getElementById("book-container");
        data.books.forEach(book => {
          const bookCard = document.createElement("div");
          bookCard.classList.add("book-card");
          bookCard.textContent = book;
          bookContainer.appendChild(bookCard);
        });
      })
      .catch(error => console.error("Error fetching books:", error));
  });
  