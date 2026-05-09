import { getSet, getActiveSet, setActiveSetId, getLearnSession, setLearnSession, updateCard, createLearnSession, clearLearnSession } from "./state.js";
import { saveState, saveLearnSession, loadLearnSession, clearLearnSessionStorage } from "./storage.js";
import { showLearnMode } from "./navigation.js";
import { renderLearnMode, renderAnswerFeedback, renderLearnFeedback, renderLearnSummary, renderLearnCompletion, resetLearnUI, shuffleArray } from "./render.js";
import { calculateSM2, GRADES } from "./spacedRep.js";
import { recordCardStudy, recordSessionTime } from "./analytics.js";
import { speak } from "./tts.js";
import { getTtsState } from "./state.js";

export let learnState = { sessionStartTime: null, batchHistory: [] };

export function handleResumeSession(options) {
  // Bắt lỗi khi truyền object từ Dashboard
  const setId = typeof options === "object" ? (options.setId || options.id) : options;
  const mode = typeof options === "object" ? (options.mode || "all") : "all";
  navigateToLearnMode(setId, { resume: true, mode: mode });
}

export function navigateToLearnMode(setId, options = {}) {
  const { resume = false, mode = "all" } = options;
  
  const actualSetId = typeof setId === "object" ? (setId.setId || setId.id) : setId;
  const actualMode = typeof setId === "object" ? (setId.mode || mode) : mode;

  setActiveSetId(actualSetId);
  const set = getSet(actualSetId);
  if (!set) return;

  let session;
  const savedSession = loadLearnSession();

  if (
    savedSession &&
    savedSession.setId == actualSetId &&
    savedSession.unseenIds &&
    savedSession.unseenIds.length > 0 &&
    (resume || !savedSession.mode || savedSession.mode === actualMode)
  ) {
    console.log("Đã tìm thấy tiến độ cũ từ LocalStorage! Đang học tiếp...");
    session = savedSession;
  } else {
    console.log("LocalStorage trống! Đang lấy tiến độ từ SQL Server...");
    session = initializeNewSession(set, actualMode);
  }

  if (!session) return;

  setLearnSession(session);
  saveLearnSession(session);
  learnState.sessionStartTime = Date.now();
  learnState.batchHistory = [];

  showLearnMode(actualSetId, options, () => {
    resetLearnUI();
    nextQuestion();
  });
}

// 🔥 TUYỆT CHIÊU: Tạo session tự động quét SQL để giữ nguyên tiến độ
export function initializeNewSession(set, mode) {
  let cards = set.cards;
  if (mode === "starred") cards = set.cards.filter((c) => c.starred);
  if (mode === "due") cards = set.cards.filter((c) => c.stats && (c.stats.repetitions > 0 || c.stats.Repetitions > 0));

  if (!cards || cards.length === 0) {
    alert("Không có thẻ nào phù hợp để học!");
    return null;
  }

  let unseenIds = [];
  let masteredIds = [];
  
  // 🧠 QUÉT SQL: Thẻ nào SQL báo đã học (reps > 0), nhét thẳng vào danh sách Đã Thuộc!
  cards.forEach(c => {
    const rep = c.stats ? (c.stats.repetitions !== undefined ? c.stats.repetitions : c.stats.Repetitions || 0) : 0;
    if (rep > 0) {
        masteredIds.push(c.uuid || c.id);
    } else {
        unseenIds.push(c.uuid || c.id);
    }
  });

  // Nếu lỡ thuộc hết 100% bộ rồi thì reset cho học lại từ đầu
  if (unseenIds.length === 0) {
    unseenIds = [...masteredIds];
    masteredIds = [];
  }

  // Trộn ngẫu nhiên các từ CHƯA THUỘC
  for (let i = unseenIds.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [unseenIds[i], unseenIds[j]] = [unseenIds[j], unseenIds[i]];
  }

  return {
    setId: set.id || set.uuid,
    mode: mode,
    unseenIds: unseenIds,
    masteredIds: masteredIds,
    questionsAnswered: 0,
    correctCount: 0,
    currentQuestionId: unseenIds[0]
  };
}

export function nextQuestion() {
  const session = getLearnSession();
  const set = getActiveSet();
  if (!session || !set) return;

  if (
    session.questionsAnswered > 0 &&
    session.questionsAnswered % 10 === 0 &&
    learnState.batchHistory.length > 0
  ) {
    renderLearnSummary(learnState.batchHistory);
    return;
  }
  if (session.unseenIds.length === 0) {
    handleLearnComplete();
    return;
  }

  session.currentQuestionId = session.unseenIds[0];
  setLearnSession(session);
  saveLearnSession(session);
  resetLearnUI();
  
  const handleWordClick = async (word, x, y) => {};

  renderLearnMode(session, set, {
    onGrade: handleGrade,
    onAnswer: handleMultipleChoiceAnswer,
    onWordClick: handleWordClick,
  });

  const ttsState = getTtsState();
  if (ttsState.autoRead) {
    const card = set.cards.find((c) => c.uuid === session.currentQuestionId);
    if (card) speak(card.definition);
  }
}

export async function handleGrade(grade) {
  const session = getLearnSession();
  const set = getActiveSet();
  const userData = JSON.parse(localStorage.getItem("quizlet_user"));
  const userId = userData ? userData.id : 1;

  if (!session || !set) return;
  const card = set.cards.find((c) => c.uuid === session.currentQuestionId);
  if (!card) return;

  const newStats = calculateSM2(card.stats, grade);
  updateCard(set.uuid, card.uuid, { stats: newStats });
  saveState();

  const isCorrect = grade >= GRADES.GOOD;
  const realCardId = card.id || parseInt(card.uuid);

  try {
    fetch("https://localhost:7077/api/StudyProgresses/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, flashcardId: realCardId, grade }),
    });
  } catch (err) {}

  if (isCorrect && session.mode === "starred" && card.starred) {
    card.starred = false;
    saveState();
    try {
      fetch(`https://localhost:7077/api/Flashcards/toggle-star/${realCardId}/${userId}`, { method: "POST" });
    } catch (err) {}
  }

  recordCardStudy(isCorrect);
  session.questionsAnswered++;
  learnState.batchHistory.push({
    card: { term: card.term, definition: card.definition },
    correct: isCorrect,
    grade,
  });

  if (isCorrect) {
    session.unseenIds.shift();
    session.masteredIds.push(card.uuid);
    session.correctCount++;
    setTimeout(nextQuestion, 800);
  } else {
    session.unseenIds.shift();
    const insertIndex = Math.min(
      session.unseenIds.length,
      Math.floor(Math.random() * 3) + 2,
    );
    session.unseenIds.splice(insertIndex, 0, card.uuid);
    renderLearnFeedback(false, card.term);
  }
  setLearnSession(session);
  saveLearnSession(session);
}

export function handleMultipleChoiceAnswer(isCorrect, selectedBtn, correctId) {
  const session = getLearnSession();
  if (!session) return;

  if (typeof renderAnswerFeedback === "function") {
    renderAnswerFeedback(selectedBtn, correctId, isCorrect);
  }

  const userData = JSON.parse(localStorage.getItem("quizlet_user"));
  const userId = userData ? userData.id : 1;
  const gradeValue = isCorrect ? 4 : 1;

  const set = getActiveSet();
  const card = set?.cards.find(
    (c) => c.uuid == session.currentQuestionId || c.id == session.currentQuestionId,
  );
  const realCardId = card ? card.id : parseInt(session.currentQuestionId);

  fetch("https://localhost:7077/api/StudyProgresses/review", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId,
      flashcardId: realCardId,
      grade: gradeValue,
    }),
  }).catch((err) => console.error(err));

  if (isCorrect && session.mode === "starred" && card && card.starred) {
    card.starred = false; 
    saveState();
    try {
      fetch(`https://localhost:7077/api/Flashcards/toggle-star/${realCardId}/${userId}`, { method: "POST" });
    } catch (err) {}
  }

  session.questionsAnswered++;
  if (isCorrect) {
    session.correctCount++;
    session.unseenIds.shift();
    session.masteredIds.push(session.currentQuestionId);
  } else {
    const wrongCardId = session.unseenIds.shift();
    session.unseenIds.push(wrongCardId);
  }

  setLearnSession(session);
  saveLearnSession(session);

  setTimeout(() => {
    try {
      if (isCorrect) nextQuestion();
      else {
        if (typeof renderLearnFeedback === "function" && card)
          renderLearnFeedback(false, card.term);
        else nextQuestion();
      }
    } catch (error) {
      nextQuestion();
    }
  }, 800);
}

export function handleLearnComplete() {
  const session = getLearnSession();

  if (learnState.sessionStartTime) {
    const minutes = Math.round((Date.now() - learnState.sessionStartTime) / 60000);
    try { recordSessionTime(minutes); } catch (e) {}
  }

  clearLearnSessionStorage();
  clearLearnSession();
  renderLearnCompletion();

  setTimeout(() => {
    const restartBtn =
      document.querySelector(".congrats-modal button:first-child") ||
      document.querySelector('button[onclick*="restart"]');

    if (restartBtn) {
      restartBtn.onclick = (e) => {
        e.preventDefault();
        const activeSetId = getState().activeSetId;
        navigateToLearnMode(activeSetId);
      };
    }

    const backBtn =
      document.querySelector(".congrats-modal button:last-child") ||
      document.querySelector('button[onclick*="back"]');

    if (backBtn) {
      backBtn.onclick = (e) => {
        e.preventDefault();
        const activeSetId = getState().activeSetId;
        window.location.hash = `#set/${activeSetId}`;
      };
    }
  }, 100);
}

export function handleContinueLearning() {
  learnState.batchHistory = [];
  resetLearnUI();
  nextQuestion();
}