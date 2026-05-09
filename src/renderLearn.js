// renderLearn.js
import { escapeHtml, shuffleArray } from "./renderUtils.js";

export function renderLearnMode(session, set, handlers) {
  renderLearnProgress(session);
  renderLearnQuestion(session, set, handlers);
}

function renderLearnProgress(session) {
  const progressBar = document.getElementById("progressBar");
  const progressText = document.getElementById("progressText");

  const total = session.unseenIds.length + session.masteredIds.length;
  const mastered = session.masteredIds.length;
  const progress = total > 0 ? (mastered / total) * 100 : 0;

  if (progressBar) progressBar.style.width = `${progress}%`;
  if (progressText) progressText.textContent = `${mastered} / ${total}`;
}

export function renderLearnQuestion(session, set, handlers) {
  const questionText = document.getElementById("questionText");
  const gradeButtons = document.getElementById("gradeButtons");
  const answerOptions = document.getElementById("answerOptions");

  if (!session.currentQuestionId) return;

  const card = set.cards.find((c) => c.uuid === session.currentQuestionId);
  if (!card) return;

  if (questionText) {
    questionText.innerHTML = "";

    const parts = card.definition.split(" - ");
    const meaningOnly = parts.length > 1 ? parts[1].trim() : card.definition;
    const words = meaningOnly.split(/\s+/);

    words.forEach((word) => {
      const span = document.createElement("span");
      span.textContent = word + " ";
      span.className =
        "clickable-word cursor-pointer hover:bg-indigo-100 rounded px-0.5 transition-colors";
      span.addEventListener("click", (e) => {
        e.stopPropagation();
        handlers.onWordClick?.(
          word.replace(/[.,!?;:'"()]/g, ""),
          e.clientX,
          e.clientY,
        );
      });
      questionText.appendChild(span);
    });
  }

  if (gradeButtons) {
    gradeButtons.classList.add("hidden");
    if (answerOptions) answerOptions.classList.remove("hidden");
    renderMultipleChoice(session, set, handlers);
  }
}

function renderMultipleChoice(session, set, handlers) {
  const answerOptions = document.getElementById("answerOptions");
  if (!answerOptions) return;

  const currentCard = set.cards.find(
    (c) => c.uuid === session.currentQuestionId,
  );
  if (!currentCard) return;

  let options = [currentCard];
  const otherCards = set.cards.filter((c) => c.uuid !== currentCard.uuid);
  const shuffled = shuffleArray(otherCards);

  const numOptions = Math.min(4, set.cards.length);
  while (options.length < numOptions && shuffled.length > 0) {
    options.push(shuffled.pop());
  }

  options = shuffleArray(options);

  answerOptions.innerHTML = options
    .map(
      (card) => `
        <button class="answer-btn w-full text-left p-4 border-2 border-slate-300 rounded-lg 
                       hover:bg-slate-50 hover:border-indigo-400 transition-all"
                data-id="${card.uuid}">
            ${escapeHtml(card.term)}
        </button>
    `,
    )
    .join("");

  answerOptions.querySelectorAll(".answer-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const isCorrect = btn.dataset.id === currentCard.uuid;
      handlers.onAnswer?.(isCorrect, btn, currentCard.uuid);
    });
  });
}

export function renderAnswerFeedback(selectedBtn, correctId, isCorrect) {
  const answerOptions = document.getElementById("answerOptions");
  if (!answerOptions) return;

  answerOptions.querySelectorAll(".answer-btn").forEach((btn) => {
    btn.disabled = true;
    btn.classList.remove("hover:bg-slate-50", "hover:border-indigo-400");

    if (btn.dataset.id === correctId) {
      btn.classList.remove("border-slate-300");
      btn.classList.add("bg-green-100", "border-green-500", "text-green-800");
    } else if (btn === selectedBtn && !isCorrect) {
      btn.classList.remove("border-slate-300");
      btn.classList.add("bg-red-100", "border-red-500", "text-red-800");
    }
  });
}

export function renderLearnFeedback(isCorrect, correctAnswer) {
  const feedbackSection = document.getElementById("feedbackSection");
  const feedbackTitle = document.getElementById("feedbackTitle");
  const feedbackText = document.getElementById("feedbackText");
  const learnContent = document.getElementById("learnContent");

  if (!feedbackSection) return;

  if (learnContent) learnContent.classList.add("hidden");
  feedbackSection.classList.remove("hidden");

  if (isCorrect) {
    feedbackTitle.textContent = "Correct!";
    feedbackTitle.className = "text-xl font-bold text-green-600";
    feedbackText.textContent = "Great job! Keep going!";
  } else {
    feedbackTitle.textContent = "Not quite...";
    feedbackTitle.className = "text-xl font-bold text-red-600";
    feedbackText.textContent = `The correct answer was "${correctAnswer}". We'll ask this again later.`;
  }
}

export function renderLearnSummary(batchHistory) {
  const summaryScreen = document.getElementById("summaryScreen");
  const summaryCorrect = document.getElementById("summaryCorrect");
  const summaryMissed = document.getElementById("summaryMissed");
  const summaryList = document.getElementById("summaryList");
  const learnContent = document.getElementById("learnContent");
  const feedbackSection = document.getElementById("feedbackSection");

  if (!summaryScreen) return;

  if (learnContent) learnContent.classList.add("hidden");
  if (feedbackSection) feedbackSection.classList.add("hidden");
  summaryScreen.classList.remove("hidden");

  const correct = batchHistory.filter((h) => h.correct).length;
  const missed = batchHistory.length - correct;

  if (summaryCorrect) summaryCorrect.textContent = correct;
  if (summaryMissed) summaryMissed.textContent = missed;

  if (summaryList) {
    summaryList.innerHTML = batchHistory
      .map(
        (item) => `
            <div class="flex justify-between items-center p-3 rounded-lg ${item.correct ? "bg-green-50" : "bg-red-50"} mb-2">
                <div class="min-w-0">
                    <p class="font-medium text-slate-800 truncate">${escapeHtml(item.card?.term || "Unknown")}</p>
                    <p class="text-sm text-slate-500 truncate">${escapeHtml(item.card?.definition || "")}</p>
                </div>
                <span class="${item.correct ? "text-green-600" : "text-red-600"} font-semibold ml-4">
                    ${item.correct ? "Correct" : "Missed"}
                </span>
            </div>
        `,
      )
      .join("");
  }
}

export function renderLearnCompletion() {
  const completionScreen = document.getElementById("completionScreen");
  const learnContent = document.getElementById("learnContent");
  const feedbackSection = document.getElementById("feedbackSection");
  const summaryScreen = document.getElementById("summaryScreen");

  if (learnContent) learnContent.classList.add("hidden");
  if (feedbackSection) feedbackSection.classList.add("hidden");
  if (summaryScreen) summaryScreen.classList.add("hidden");
  if (completionScreen) completionScreen.classList.remove("hidden");
}

export function resetLearnUI() {
  const learnContent = document.getElementById("learnContent");
  const feedbackSection = document.getElementById("feedbackSection");
  const summaryScreen = document.getElementById("summaryScreen");
  const completionScreen = document.getElementById("completionScreen");

  if (learnContent) learnContent.classList.remove("hidden");
  if (feedbackSection) feedbackSection.classList.add("hidden");
  if (summaryScreen) summaryScreen.classList.add("hidden");
  if (completionScreen) completionScreen.classList.add("hidden");
}