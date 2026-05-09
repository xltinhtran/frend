import { getActiveSet } from "./state.js";

export let flashcardState = { currentIndex: 0, cardOrder: [], isFlipped: false };

export function flipFlashcard() {
  const flashcard = document.getElementById("flashcard");
  if (!flashcard) return;
  flashcardState.isFlipped = !flashcardState.isFlipped;
  flashcard.classList.toggle("flipped", flashcardState.isFlipped);
}

export function nextFlashcard() {
  const set = getActiveSet();
  if (!set || set.cards.length === 0) return;
  flashcardState.currentIndex = (flashcardState.currentIndex + 1) % set.cards.length;
  flashcardState.isFlipped = false;
  updateFlashcardDisplay();
}

export function prevFlashcard() {
  const set = getActiveSet();
  if (!set || set.cards.length === 0) return;
  flashcardState.currentIndex = (flashcardState.currentIndex - 1 + set.cards.length) % set.cards.length;
  flashcardState.isFlipped = false;
  updateFlashcardDisplay();
}

export function updateFlashcardDisplay() {
  const set = getActiveSet();
  if (!set) return;
  const card = set.cards[flashcardState.cardOrder[flashcardState.currentIndex]];
  if (!card) return;

  const frontEl = document.getElementById("flashcardFront");
  const backEl = document.getElementById("flashcardBack");

  const imgUrl = card.imageUrl || "";

  if (imgUrl !== "") {
      frontEl.innerHTML = `
          <div class="flex flex-col items-center justify-center w-full h-full">
              <img src="${imgUrl}" alt="Lỗi tải ảnh!" class="w-32 h-32 object-cover rounded-xl mb-4 shadow-md border border-slate-200">
              <div class="text-3xl font-bold">${card.term}</div>
          </div>
      `;
  } else {
      frontEl.innerHTML = `<div class="text-3xl font-bold">${card.term}</div>`;
  }

  backEl.innerHTML = `<div class="text-2xl">${card.definition}</div>`;
  
  document.getElementById("flashcardCounter").textContent = `${flashcardState.currentIndex + 1} / ${set.cards.length}`;
  document.getElementById("flashcard").classList.remove("flipped");
}

window.flipFlashcard = flipFlashcard;